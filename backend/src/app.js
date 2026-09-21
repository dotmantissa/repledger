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
  challengeClaimOnChain,
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
      "get_claim",
      "get_entity_claims",
      "get_entity_score",
      "is_flagged",
      "get_ledger_stats",
      "get_all_claim_ids",
      "get_all_entities",
      "get_recent_claims",
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

// ─────────────────────────────────────────────────────────────────────────────
// Composable Query Simulator (Lending, Prediction Markets, Agent Networks)
// ─────────────────────────────────────────────────────────────────────────────

app.post("/api/simulate-query", async (req, res) => {
  try {
    const { entity, consumer_type = "lending_protocol" } = req.body;
    if (!entity) {
      return res.status(400).json({ error: "Entity identifier is required for query simulation" });
    }

    const normEntity = String(entity).trim().toLowerCase().replace(/\s+/g, "_");
    const scoreData = await readEntityScore(normEntity);

    let decision = "";
    let approved = false;
    let rationale = "";

    const score = scoreData?.score ?? 50;
    const isExploit = scoreData?.is_exploit_flagged ?? false;

    if (consumer_type === "lending_protocol") {
      // Lending market checks track record and exploit flags
      if (isExploit) {
        approved = false;
        decision = "LOAN_REJECTED";
        rationale = "Target entity has active verified exploit or rugpull flags recorded on RepLedger.";
      } else if (score < 50) {
        approved = false;
        decision = "COLLATERAL_HAIRCUT_MAXIMUM";
        rationale = `Trust score of ${score} is below lending safety threshold. 250% collateral required.`;
      } else {
        approved = true;
        decision = "LOAN_APPROVED";
        rationale = `Trust score of ${score} qualifies for prime tier borrow interest rate.`;
      }
    } else if (consumer_type === "prediction_market") {
      // Prediction market checks if protocol was hacked before resolving market
      if (isExploit) {
        approved = true;
        decision = "RESOLVE_YES_EXPLOITED";
        rationale = "Consensus-verified exploit claim confirms condition for hack resolution.";
      } else {
        approved = false;
        decision = "RESOLVE_NO_HACK_UNVERIFIED";
        rationale = "No verified exploit claims present in immutable record.";
      }
    } else {
      // Agentic marketplace
      if (score >= 70) {
        approved = true;
        decision = "AGENT_ROUTED_PRIORITY";
        rationale = "Verified high quality deliverables on-chain. Safe for autonomous task routing.";
      } else {
        approved = false;
        decision = "AGENT_HELD_IN_ESCROW";
        rationale = "Insufficient positive track record for unsupervised task execution.";
      }
    }

    // Record audit in DB
    await sql`
      INSERT INTO query_audits (
        requester, target_entity, query_type, returned_score, returned_flag, decision_rationale
      ) VALUES (
        ${consumer_type},
        ${normEntity},
        'is_flagged_and_score',
        ${score},
        ${isExploit},
        ${rationale}
      )
    `;

    res.json({
      consumerType: consumer_type,
      targetEntity: normEntity,
      onchainScore: score,
      isExploitFlagged: isExploit,
      trustGrade: scoreData?.grade || "NEUTRAL",
      decision,
      approved,
      rationale,
      timestamp: new Date().toISOString(),
      queriedContract: CONTRACT_ADDRESS,
    });
  } catch (err) {
    console.error("[API] /api/simulate-query error:", err);
    res.status(500).json({ error: "Query simulation failed" });
  }
});
