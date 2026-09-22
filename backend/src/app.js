import express from "express";
import cors from "cors";
import { sql } from "./db.js";
import { authenticatePrivy } from "./privyAuth.js";
import {
  readContractStats,
  readEntityScore,
  readContractClaim,
  readRecentClaims,
  submitClaimOnChain,
  checkClaimStatusOnChain,
  challengeClaimOnChain,
  checkChallengeStatusOnChain,
  relayRefundBond,
  dripFaucet,
  getUserBalance,
  CONTRACT_ADDRESS,
} from "./genlayerRelayer.js";

export const app = express();

app.use(cors());
app.use(express.json());

// ─────────────────────────────────────────────────────────────────────────────
// System and Protocol Metadata
// ─────────────────────────────────────────────────────────────────────────────

app.get("/api/health", async (req, res) => {
  res.json({
    status: "healthy",
    service: "REP | Ledger Relayer & Consensus API",
    contractAddress: CONTRACT_ADDRESS,
    network: "GenLayer Studio Network (studionet)",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/contract/info", async (req, res) => {
  res.json({
    name: "REP | Ledger Intelligent Contract",
    contractAddress: CONTRACT_ADDRESS,
    network: "studionet",
    chainId: "61999",
    rpcUrl: process.env.GENLAYER_RPC_URL || "https://studio.genlayer.com/api",
    explorerUrl: "https://genlayer-explorer.vercel.app",
    methods: [
      "submit_claim",
      "challenge_claim",
      "refund_bond",
      "get_claim",
      "get_claim_bond",
      "get_entity_claims",
      "get_entity_score",
      "is_flagged",
      "get_ledger_stats",
      "get_all_claim_ids",
      "get_all_entities",
      "get_recent_claims",
      "set_treasury",
      "get_treasury",
    ],
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Ledger Statistics and Aggregates
// ─────────────────────────────────────────────────────────────────────────────

app.get("/api/stats", async (req, res) => {
  try {
    const onchainStats = await readContractStats();
    const dbClaimsCount = await sql`SELECT COUNT(*) as count FROM claims`;
    const dbEntitiesCount = await sql`SELECT COUNT(*) as count FROM entities`;
    const slashedSum = await sql`
      SELECT COALESCE(SUM(bond_amount), 0) as total FROM claims WHERE is_slashed = TRUE
    `;

    res.json({
      onchain: onchainStats || {},
      totalClaims: onchainStats?.total_claims ?? parseInt(dbClaimsCount[0].count, 10),
      totalAccepted: onchainStats?.total_accepted ?? 0,
      totalRejected: onchainStats?.total_rejected ?? 0,
      totalOverridden: onchainStats?.total_overridden ?? 0,
      totalSlashedBonds: onchainStats?.total_slashed_bonds ?? parseInt(slashedSum[0].total, 10),
      totalBondsRefunded: onchainStats?.total_bonds_refunded ?? 0,
      totalChallengerPayouts: onchainStats?.total_challenger_payouts ?? 0,
      totalBondsInCustody: onchainStats?.total_bonds_in_custody ?? 0,
      treasury: onchainStats?.treasury ?? "",
      uniqueEntities: onchainStats?.unique_entities_count ?? parseInt(dbEntitiesCount[0].count, 10),
      contractAddress: CONTRACT_ADDRESS,
    });
  } catch (err) {
    console.error("[API] /api/stats error:", err);
    res.status(500).json({ error: "Failed to fetch ledger statistics" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Claims Endpoints
// ─────────────────────────────────────────────────────────────────────────────

app.get("/api/claims", async (req, res) => {
  try {
    const { entity, status, category, limit = 50 } = req.query;

    let query = sql`SELECT * FROM claims WHERE 1=1`;

    if (entity) {
      const cleanEnt = String(entity).trim().toLowerCase().replace(/\s+/g, "_");
      query = sql`${query} AND entity = ${cleanEnt}`;
    }
    if (status) {
      query = sql`${query} AND status = ${String(status).toUpperCase()}`;
    }
    if (category) {
      query = sql`${query} AND category = ${String(category).toLowerCase()}`;
    }

    const claims = await sql`
      ${query}
      ORDER BY id DESC
      LIMIT ${Number(limit)}
    `;

    res.json({
      count: claims.length,
      claims,
    });
  } catch (err) {
    console.error("[API] /api/claims error:", err);
    res.status(500).json({ error: "Failed to fetch claims" });
  }
});

app.get("/api/claims/:id", async (req, res) => {
  try {
    const claimId = req.params.id.trim();

    // First try on-chain read
    let onchainClaim = await readContractClaim(claimId);
    if (onchainClaim && onchainClaim.id) {
      return res.json(onchainClaim);
    }

    // Fallback to database
    const dbClaims = await sql`SELECT * FROM claims WHERE claim_id = ${claimId} LIMIT 1`;
    if (dbClaims.length > 0) {
      return res.json(dbClaims[0]);
    }

    res.status(404).json({ error: "Claim not found in ledger" });
  } catch (err) {
    console.error(`[API] /api/claims/${req.params.id} error:`, err);
    res.status(500).json({ error: "Failed to load claim details" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Entities and Dossier Endpoints
// ─────────────────────────────────────────────────────────────────────────────

app.get("/api/entities", async (req, res) => {
  try {
    const entities = await sql`
      SELECT * FROM entities
      ORDER BY trust_score DESC, total_claims DESC
    `;
    res.json({
      count: entities.length,
      entities,
    });
  } catch (err) {
    console.error("[API] /api/entities error:", err);
    res.status(500).json({ error: "Failed to fetch entities" });
  }
});

app.get("/api/entities/:entity", async (req, res) => {
  try {
    const normEntity = String(req.params.entity).trim().toLowerCase().replace(/\s+/g, "_");

    // Fetch on-chain score
    const onchainScore = await readEntityScore(normEntity);

    // Fetch associated claims from DB
    const claims = await sql`
      SELECT * FROM claims
      WHERE entity = ${normEntity}
      ORDER BY id DESC
    `;

    // Fetch entity record from DB
    const entityRows = await sql`
      SELECT * FROM entities
      WHERE entity_id = ${normEntity}
      LIMIT 1
    `;

    const entityProfile = entityRows[0] || {
      entity_id: normEntity,
      display_name: normEntity,
      entity_type: "contract",
      trust_score: onchainScore?.score || 50,
      trust_grade: onchainScore?.grade || "NEUTRAL",
      status: onchainScore?.status || "UNASSESSED",
      total_claims: claims.length,
      accepted_positive: claims.filter((c) => c.status === "ACCEPTED" && c.sentiment === "positive").length,
      accepted_negative: claims.filter((c) => c.status === "ACCEPTED" && c.sentiment === "negative").length,
      overridden_count: claims.filter((c) => c.status === "OVERRIDDEN").length,
      is_exploit_flagged: onchainScore?.is_exploit_flagged || false,
    };

    res.json({
      entity: entityProfile,
      onchainScore: onchainScore || {},
      claims,
    });
  } catch (err) {
    console.error(`[API] /api/entities/${req.params.entity} error:`, err);
    res.status(500).json({ error: "Failed to load entity dossier" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Transaction Execution Endpoints (Abstracted for Users)
// ─────────────────────────────────────────────────────────────────────────────

app.post("/api/claims/submit", authenticatePrivy, async (req, res) => {
  try {
    const {
      entity,
      entity_type,
      claim_text,
      evidence_urls = [],
      bond_amount = 10,
      category = "general_reputation",
      sentiment = "negative",
    } = req.body;

    if (!entity || !String(entity).trim()) {
      return res.status(400).json({ error: "Target entity identifier is required" });
    }
    if (!claim_text || !String(claim_text).trim()) {
      return res.status(400).json({ error: "Claim description cannot be empty" });
    }

    const claimantEmail = req.user?.email || "anonymous";

    const result = await submitClaimOnChain({
      entity,
      entity_type,
      claim_text,
      evidence_urls,
      bond_amount,
      category,
      sentiment,
      claimant_email: claimantEmail,
    });

    res.json({
      success: true,
      message: "Claim submitted and evaluated by validator consensus",
      ...result,
    });
  } catch (err) {
    console.error("[API] /api/claims/submit error:", err);
    res.status(500).json({ error: err.message || "Failed to submit claim" });
  }
});

app.post("/api/claims/:id/challenge", authenticatePrivy, async (req, res) => {
  try {
    const claimId = req.params.id;
    const { rebuttal_text, counter_evidence_urls = [], counter_bond = 10 } = req.body;

    if (!rebuttal_text || !String(rebuttal_text).trim()) {
      return res.status(400).json({ error: "Rebuttal justification is required to mount a challenge" });
    }

    const challengerEmail = req.user?.email || "anonymous";

    const result = await challengeClaimOnChain({
      claim_id: claimId,
      rebuttal_text,
      counter_evidence_urls,
      counter_bond,
      challenger_email: challengerEmail,
    });

    res.json({
      success: true,
      message: "Challenge submitted and adjudicated by validator consensus",
      ...result,
    });
  } catch (err) {
    console.error(`[API] /api/claims/${req.params.id}/challenge error:`, err);
    res.status(500).json({ error: err.message || "Failed to challenge claim" });
  }
});

app.post("/api/claims/:id/refund", authenticatePrivy, async (req, res) => {
  try {
    const claimId = req.params.id;
    const claimantEmail = req.user?.email || "anonymous";
    const result = await relayRefundBond({ claimId, claimantEmail });
    res.json(result);
  } catch (err) {
    console.error(`[API] /api/claims/${req.params.id}/refund error:`, err);
    res.status(500).json({ error: err.message || "Failed to process bond refund" });
  }
});

app.get("/api/claims/status/:txHash", async (req, res) => {
  try {
    const { txHash } = req.params;
    const status = await checkClaimStatusOnChain(txHash);
    res.json(status);
  } catch (err) {
    console.error("[API] /api/claims/status error:", err);
    res.status(500).json({ error: "Failed to check claim status" });
  }
});

app.get("/api/challenges/status/:txHash", async (req, res) => {
  try {
    const { txHash } = req.params;
    const { claimId } = req.query;
    const status = await checkChallengeStatusOnChain(txHash, claimId);
    res.json(status);
  } catch (err) {
    console.error("[API] /api/challenges/status error:", err);
    res.status(500).json({ error: "Failed to check challenge status" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Testnet Faucet for Embedded Wallets
// ─────────────────────────────────────────────────────────────────────────────

app.post("/api/faucet/drip", async (req, res) => {
  try {
    const { email, address, amount = 100 } = req.body;
    const result = await dripFaucet({ email, address, amount });
    res.json(result);
  } catch (err) {
    console.error("[API] /api/faucet/drip error:", err);
    res.status(500).json({ error: "Faucet drip request failed" });
  }
});

app.get("/api/faucet/balance/:email", async (req, res) => {
  try {
    const result = await getUserBalance(req.params.email);
    res.json(result);
  } catch (err) {
    console.error("[API] /api/faucet/balance error:", err);
    res.status(500).json({ balance: 100 });
  }
});
