import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

import { Agent, setGlobalDispatcher } from "undici";
setGlobalDispatcher(new Agent({ connect: { family: 4 } }));

import { createClient, chains } from "genlayer-js";
import { transactionsStatusNumberToName } from "genlayer-js/types";
import { ethers } from "ethers";
import { sql } from "./db.js";
import dotenv from "dotenv";
dotenv.config();

const RPC_URL = process.env.GENLAYER_RPC_URL || "https://studio.genlayer.com/api";
export const DEPLOYER_ADDRESS =
  process.env.DEPLOYER_ADDRESS || "0xBC1399c55538eC034d4Da550C03c34Ae0C357f53";
const DEPLOYER_PRIVATE_KEY =
  process.env.DEPLOYER_PRIVATE_KEY ||
  "0xd4479070c2a31da31a01e732ca51707132bacdb480aae432a0c8bd0b91eba4b7";
export const CONTRACT_ADDRESS =
  process.env.CONTRACT_ADDRESS || "0x91582A31e53648a3E8ed3B8841dE0Fb640E5a661";

export async function rpcCall(method, params = []) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data.result;
}

const wallet = new ethers.Wallet(DEPLOYER_PRIVATE_KEY);

const customProvider = {
  async request({ method, params = [] }) {
    if (method === "eth_sendTransaction") {
      const tx = params[0];
      const nonce = await rpcCall("eth_getTransactionCount", [
        DEPLOYER_ADDRESS,
        "latest",
      ]);
      const chainId = await rpcCall("eth_chainId", []);
      const signed = await wallet.signTransaction({
        to: tx.to ?? null,
        data: tx.data,
        value: tx.value ?? "0x0",
        gas: tx.gas ?? "0x4C4B40",
        gasPrice: tx.gasPrice ?? "0x0",
        nonce,
        chainId: parseInt(chainId, 16),
      });
      return rpcCall("eth_sendRawTransaction", [signed]);
    }
    if (method === "eth_estimateGas") return "0x4C4B40";
    return rpcCall(method, params);
  },
};

export const genlayerClient = createClient({
  chain: chains.studionet,
  endpoint: RPC_URL,
  account: DEPLOYER_ADDRESS,
  provider: customProvider,
});

/**
 * Read latest ledger stats directly from on-chain contract
 */
export async function readContractStats() {
  try {
    const raw = await genlayerClient.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_ledger_stats",
      args: [],
    });
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (err) {
    console.error("[Relayer] readContractStats failed:", err.message);
    return null;
  }
}

/**
 * Read entity score directly from on-chain contract
 */
export async function readEntityScore(entity) {
  try {
    const raw = await genlayerClient.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_entity_score",
      args: [String(entity).trim().toLowerCase()],
    });
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (err) {
    console.error(`[Relayer] readEntityScore for ${entity} failed:`, err.message);
    return null;
  }
}

/**
 * Read single claim directly from on-chain contract
 */
export async function readContractClaim(claimId) {
  try {
    const raw = await genlayerClient.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_claim",
      args: [String(claimId).trim()],
    });
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (err) {
    console.error(`[Relayer] readContractClaim for ${claimId} failed:`, err.message);
    return null;
  }
}

/**
 * Read recent claims directly from on-chain contract
 */
export async function readRecentClaims(limit = 20) {
  try {
    const raw = await genlayerClient.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_recent_claims",
      args: [Number(limit)],
    });
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (err) {
    console.error("[Relayer] readRecentClaims failed:", err.message);
    return [];
  }
}

/**
 * Submit a new claim on-chain asynchronously (returns txHash immediately within 2s)
 */
export async function submitClaimOnChain({
  entity,
  entity_type,
  claim_text,
  evidence_urls = [],
  bond_amount = 10,
  category = "general_reputation",
  sentiment = "negative",
  claimant_email = "anonymous",
}) {
  const normEntity = String(entity).trim().toLowerCase().replace(/\s+/g, "_");
  const cleanType = String(entity_type).trim().toLowerCase();
  const cleanClaim = String(claim_text).trim();
  const cleanCat = String(category).trim().toLowerCase();
  const cleanSent = String(sentiment).trim().toLowerCase();
  const urlsJson = JSON.stringify(evidence_urls);
  const bond = parseInt(bond_amount, 10) || 10;

  console.log(`[Relayer] Broadcasting submit_claim for entity: ${normEntity}, bond: ${bond} GEN...`);

  // Broadcast write transaction
  const txHash = await genlayerClient.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "submit_claim",
    args: [
      normEntity,
      cleanType,
      cleanClaim,
      urlsJson,
      bond,
      cleanCat,
      cleanSent,
    ],
    value: BigInt(0),
  });

  console.log(`[Relayer] Transaction broadcast successfully: ${txHash}`);

  // Create provisional pending record in Neon DB
  const tempId = `claim_pending_${txHash.slice(2, 10)}`;
  try {
    await sql`
      INSERT INTO claims (
        claim_id, entity, entity_type, claim_text, evidence_urls, claimant, claimant_email,
        bond_amount, category, sentiment, verdict, status, is_slashed, confidence_score,
        consensus_summary, key_findings, evidence_sources_checked, challenges, genlayer_tx_hash,
        onchain_finalized, created_at, updated_at
      ) VALUES (
        ${tempId},
        ${normEntity},
        ${cleanType},
        ${cleanClaim},
        ${JSON.stringify(evidence_urls)}::jsonb,
        ${DEPLOYER_ADDRESS},
        ${claimant_email},
        ${bond},
        ${cleanCat},
        ${cleanSent},
        'PENDING',
        'PENDING',
        FALSE,
        0,
        'Validators independently fetching evidence and voting...',
        '[]'::jsonb,
        ${evidence_urls.length},
        '[]'::jsonb,
        ${txHash},
        FALSE,
        NOW(),
        NOW()
      )
      ON CONFLICT (claim_id) DO NOTHING;
    `;
  } catch (dbErr) {
    console.warn("[Relayer] Provisional claim insert warning:", dbErr.message);
  }

  return {
    success: true,
    txHash,
    status: "PENDING",
    tempId,
    message: "Transaction broadcast to GenLayer Studio Network. Awaiting validator consensus.",
  };
}

/**
 * Poll transaction status on GenLayer and finalize claim in DB when consensus completes
 */
export async function checkClaimStatusOnChain(txHash) {
  try {
    const tx = await rpcCall("eth_getTransactionByHash", [txHash]);
    if (!tx) {
      return { finalized: false, status: "PENDING", rawStatus: "PENDING", txHash };
    }

    const raw = tx.status;
    let statusName = "PENDING";
    if (typeof raw === "string") {
      statusName = raw === "ACTIVATED" ? "PENDING" : raw;
    } else if (typeof raw === "number") {
      statusName = transactionsStatusNumberToName[String(raw)] || "PENDING";
    }

    if (!["FINALIZED", "ACCEPTED", "CANCELED"].includes(statusName)) {
      return { finalized: false, status: "PENDING", rawStatus: statusName, txHash };
    }

    if (statusName === "CANCELED") {
      await sql`
        UPDATE claims SET status = 'FAILED', verdict = 'FAILED', updated_at = NOW()
        WHERE genlayer_tx_hash = ${txHash};
      `;
      return { finalized: true, status: "FAILED", rawStatus: "CANCELED", error: "Consensus transaction canceled on-chain" };
    }

    // Transaction is finalized/accepted on-chain! Read real record from contract.
    const stats = await readContractStats();
    let claimRecord = null;

    if (stats && stats.total_claims > 0) {
      // Check candidate claim
      const candidate = await readContractClaim(`claim_${stats.total_claims}`);
      if (candidate && candidate.id) {
        claimRecord = candidate;
      }
    }

    if (!claimRecord) {
      const recent = await readRecentClaims(5);
      claimRecord = recent[0] || null;
    }

    if (!claimRecord || !claimRecord.id) {
      return { finalized: false, status: "INDEXING", rawStatus: statusName, message: "Transaction confirmed, reading consensus result..." };
    }

    // Finalize claim in Neon DB
    await sql`
      INSERT INTO claims (
        claim_id, entity, entity_type, claim_text, evidence_urls, claimant, claimant_email,
        bond_amount, category, sentiment, verdict, status, is_slashed, confidence_score,
        consensus_summary, key_findings, evidence_sources_checked, challenges, genlayer_tx_hash,
        onchain_finalized, created_at, updated_at
      ) VALUES (
        ${claimRecord.id},
        ${claimRecord.entity},
        ${claimRecord.entity_type || "protocol"},
        ${claimRecord.claim_text},
        ${JSON.stringify(claimRecord.evidence_urls || [])}::jsonb,
        ${claimRecord.claimant || DEPLOYER_ADDRESS},
        'verified_claimant',
        ${claimRecord.bond_amount || 10},
        ${claimRecord.category || "exploit"},
        ${claimRecord.sentiment || "negative"},
        ${claimRecord.verdict || "ACCEPTED"},
        ${claimRecord.status || "ACCEPTED"},
        ${Boolean(claimRecord.is_slashed)},
        ${claimRecord.confidence_score || 90},
        ${claimRecord.consensus_summary || ""},
        ${JSON.stringify(claimRecord.key_findings || [])}::jsonb,
        ${claimRecord.evidence_sources_checked || 1},
        ${JSON.stringify(claimRecord.challenges || [])}::jsonb,
        ${txHash},
        TRUE,
        NOW(),
        NOW()
      )
      ON CONFLICT (claim_id) DO UPDATE SET
        verdict = EXCLUDED.verdict,
        status = EXCLUDED.status,
        is_slashed = EXCLUDED.is_slashed,
        confidence_score = EXCLUDED.confidence_score,
        consensus_summary = EXCLUDED.consensus_summary,
        key_findings = EXCLUDED.key_findings,
        onchain_finalized = TRUE,
        genlayer_tx_hash = EXCLUDED.genlayer_tx_hash,
        updated_at = NOW();
    `;

    // Remove provisional record if different ID
    await sql`
      DELETE FROM claims
      WHERE genlayer_tx_hash = ${txHash} AND claim_id LIKE 'claim_pending_%' AND claim_id != ${claimRecord.id};
    `;

    // Sync entity trust score
    await syncEntityInDb(claimRecord.entity);

    return {
      finalized: true,
      status: claimRecord.status,
      verdict: claimRecord.verdict,
      consensusStatus: statusName,
      claim: claimRecord,
    };
  } catch (err) {
    console.error(`[Relayer] checkClaimStatus for ${txHash} error:`, err);
    return { finalized: false, status: "ERROR", error: err.message };
  }
}

/**
 * Challenge an existing claim on-chain asynchronously
 */
export async function challengeClaimOnChain({
  claim_id,
  rebuttal_text,
  counter_evidence_urls = [],
  counter_bond = 10,
  challenger_email = "anonymous",
}) {
  const cid = String(claim_id).trim();
  const cleanRebuttal = String(rebuttal_text).trim();
  const urlsJson = JSON.stringify(counter_evidence_urls);
  const cbond = parseInt(counter_bond, 10) || 10;

  console.log(`[Relayer] Challenging claim: ${cid} with bond ${cbond} GEN...`);

  const txHash = await genlayerClient.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "challenge_claim",
    args: [cid, cleanRebuttal, urlsJson, cbond],
    value: BigInt(0),
  });

  console.log(`[Relayer] Challenge transaction broadcast: ${txHash}`);

  return {
    success: true,
    txHash,
    status: "PENDING",
    claimId: cid,
    message: "Challenge broadcast to GenLayer Network. Validators are evaluating counter-evidence.",
  };
}

/**
 * Poll challenge status on-chain
 */
export async function checkChallengeStatusOnChain(txHash, claimId) {
  try {
    const tx = await rpcCall("eth_getTransactionByHash", [txHash]);
    if (!tx) {
      return { finalized: false, status: "PENDING", txHash };
    }

    const raw = tx.status;
    let statusName = "PENDING";
    if (typeof raw === "string") {
      statusName = raw === "ACTIVATED" ? "PENDING" : raw;
    } else if (typeof raw === "number") {
      statusName = transactionsStatusNumberToName[String(raw)] || "PENDING";
    }

    if (!["FINALIZED", "ACCEPTED", "CANCELED"].includes(statusName)) {
      return { finalized: false, status: "PENDING", rawStatus: statusName, txHash };
    }

    if (statusName === "CANCELED") {
      return { finalized: true, status: "FAILED", error: "Challenge transaction rejected on-chain" };
    }

    // Read updated claim record from chain
    const updatedClaim = await readContractClaim(claimId);
    if (updatedClaim && updatedClaim.id) {
      await sql`
        UPDATE claims SET
          status = ${updatedClaim.status},
          verdict = ${updatedClaim.verdict},
          challenges = ${JSON.stringify(updatedClaim.challenges || [])}::jsonb,
          updated_at = NOW()
        WHERE claim_id = ${claimId};
      `;

      if (updatedClaim.entity) {
        await syncEntityInDb(updatedClaim.entity);
      }
    }

    return {
      finalized: true,
      status: updatedClaim?.status || "ACCEPTED",
      updatedClaim,
      consensusStatus: statusName,
    };
  } catch (err) {
    console.error(`[Relayer] checkChallengeStatus error:`, err);
    return { finalized: false, status: "ERROR", error: err.message };
  }
}

/**
 * Faucet: Drip testnet GEN tokens to user account and embedded wallet
 */
export async function dripFaucet({ email, address, amount = 100 }) {
  const userEmail = String(email || "guest@repledger.io").trim().toLowerCase();
  const walletAddr = String(address || "").trim();
  const dripAmt = Math.max(10, Math.min(amount, 250));

  console.log(`[Faucet] Dripping ${dripAmt} GEN to ${userEmail} (${walletAddr || "no-wallet"})...`);

  const updated = await sql`
    INSERT INTO users (email, wallet_address, gen_balance, last_faucet_at)
    VALUES (${userEmail}, ${walletAddr}, ${dripAmt}, NOW())
    ON CONFLICT (email) DO UPDATE SET
      gen_balance = users.gen_balance + ${dripAmt},
      wallet_address = COALESCE(NULLIF(${walletAddr}, ''), users.wallet_address),
      last_faucet_at = NOW(),
      last_active = NOW()
    RETURNING gen_balance, wallet_address;
  `;

  return {
    success: true,
    amount: dripAmt,
    balance: updated[0]?.gen_balance || dripAmt,
    address: updated[0]?.wallet_address || walletAddr,
    message: `Successfully dripped ${dripAmt} GEN testnet tokens!`,
  };
}

/**
 * Retrieve user testnet GEN stake balance
 */
export async function getUserBalance(email) {
  const userEmail = String(email || "").trim().toLowerCase();
  if (!userEmail) return { balance: 100, address: null };

  const rows = await sql`
    SELECT gen_balance, wallet_address FROM users WHERE email = ${userEmail} LIMIT 1
  `;
  if (rows.length > 0) {
    return {
      balance: rows[0].gen_balance || 100,
      address: rows[0].wallet_address || null,
    };
  }
  return { balance: 100, address: null };
}

/**
 * Sync entity aggregate trust score from on-chain views to DB
 */
export async function syncEntityInDb(entityId) {
  const normEntity = String(entityId).trim().toLowerCase().replace(/\s+/g, "_");
  const onChainScore = await readEntityScore(normEntity);
  if (!onChainScore) return;

  const displayName = normEntity
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  await sql`
    INSERT INTO entities (
      entity_id, display_name, entity_type, trust_score, trust_grade, status,
      total_claims, accepted_positive, accepted_negative, overridden_count,
      is_exploit_flagged, updated_at
    ) VALUES (
      ${normEntity},
      ${displayName},
      'protocol',
      ${onChainScore.score || 50},
      ${onChainScore.grade || 'NEUTRAL'},
      ${onChainScore.status || 'UNASSESSED'},
      ${onChainScore.total_claims || 0},
      ${onChainScore.accepted_positive || 0},
      ${onChainScore.accepted_negative || 0},
      ${onChainScore.overridden || 0},
      ${Boolean(onChainScore.is_exploit_flagged)},
      NOW()
    )
    ON CONFLICT (entity_id) DO UPDATE SET
      trust_score = EXCLUDED.trust_score,
      trust_grade = EXCLUDED.trust_grade,
      status = EXCLUDED.status,
      total_claims = EXCLUDED.total_claims,
      accepted_positive = EXCLUDED.accepted_positive,
      accepted_negative = EXCLUDED.accepted_negative,
      overridden_count = EXCLUDED.overridden_count,
      is_exploit_flagged = EXCLUDED.is_exploit_flagged,
      updated_at = NOW();
  `;
}
