import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

import { Agent, setGlobalDispatcher } from "undici";
setGlobalDispatcher(new Agent({ connect: { family: 4 } }));

import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
dotenv.config();

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_SP2eVO3zbCui@ep-square-tooth-b4sc0i8i-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

export const sql = neon(connectionString);

/**
 * Initialize Neon PostgreSQL schema
 */
export async function initDb() {
  console.log("[Neon DB] Establishing tables and indices for REP | Ledger...");

  // Users table (email auth only)
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      privy_did VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

  // Entities table (aggregated trust profile)
  await sql`
    CREATE TABLE IF NOT EXISTS entities (
      id SERIAL PRIMARY KEY,
      entity_id VARCHAR(255) UNIQUE NOT NULL,
      display_name VARCHAR(255) NOT NULL,
      entity_type VARCHAR(50) NOT NULL DEFAULT 'contract',
      trust_score INTEGER NOT NULL DEFAULT 50,
      trust_grade VARCHAR(20) NOT NULL DEFAULT 'NEUTRAL',
      status VARCHAR(50) NOT NULL DEFAULT 'UNASSESSED',
      total_claims INTEGER NOT NULL DEFAULT 0,
      accepted_positive INTEGER NOT NULL DEFAULT 0,
      accepted_negative INTEGER NOT NULL DEFAULT 0,
      overridden_count INTEGER NOT NULL DEFAULT 0,
      is_exploit_flagged BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

  // Claims table (mirrors on-chain state with rich indexing)
  await sql`
    CREATE TABLE IF NOT EXISTS claims (
      id SERIAL PRIMARY KEY,
      claim_id VARCHAR(100) UNIQUE NOT NULL,
      entity VARCHAR(255) NOT NULL,
      entity_type VARCHAR(50) NOT NULL DEFAULT 'contract',
      claim_text TEXT NOT NULL,
      evidence_urls JSONB DEFAULT '[]'::jsonb,
      claimant VARCHAR(255) NOT NULL,
      claimant_email VARCHAR(255) DEFAULT 'anonymous',
      bond_amount INTEGER NOT NULL DEFAULT 1,
      category VARCHAR(50) NOT NULL,
      sentiment VARCHAR(20) NOT NULL,
      verdict VARCHAR(50) NOT NULL DEFAULT 'PENDING',
      status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
      is_slashed BOOLEAN NOT NULL DEFAULT FALSE,
      confidence_score INTEGER DEFAULT 0,
      consensus_summary TEXT DEFAULT '',
      key_findings JSONB DEFAULT '[]'::jsonb,
      evidence_sources_checked INTEGER DEFAULT 0,
      challenges JSONB DEFAULT '[]'::jsonb,
      genlayer_tx_hash VARCHAR(255),
      onchain_finalized BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

  // Composable queries log (for lending / prediction market simulation audit)
  await sql`
    CREATE TABLE IF NOT EXISTS query_audits (
      id SERIAL PRIMARY KEY,
      requester VARCHAR(255) DEFAULT 'anonymous',
      target_entity VARCHAR(255) NOT NULL,
      query_type VARCHAR(100) NOT NULL,
      returned_score INTEGER,
      returned_flag BOOLEAN,
      decision_rationale TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

  console.log("[Neon DB] Tables and schema initialized successfully with zero mock data!");
}
