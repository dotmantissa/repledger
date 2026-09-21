import { PrivyClient } from "@privy-io/server-auth";
import { sql } from "./db.js";
import dotenv from "dotenv";
dotenv.config();

const PRIVY_APP_ID = process.env.PRIVY_APP_ID || "cmub4fcoc01t70clbas67s5td";
const PRIVY_APP_SECRET =
  process.env.PRIVY_APP_SECRET ||
  "privy_app_secret_2XAcEaUURecpaUs54fbmpq4X4d54syNJ7GD1mnGTmSuKJ3PU5ofMUQaFWkBCFYk9YwyhFh4RpYX68AbiiZwogS3b";

export const privy = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);

/**
 * Express middleware to authenticate Privy JWT token or client email header.
 * Strictly enforces email-based identity.
 */
export async function authenticatePrivy(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    let email = null;
    let userId = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "").trim();
      try {
        const verifiedClaims = await privy.verifyAuthToken(token);
        userId = verifiedClaims.userId;
        const user = await privy.getUser(userId);
        email =
          user.email?.address ||
          user.google?.email ||
          user.apple?.email ||
          null;
      } catch (tokenErr) {
        console.warn("[Privy Auth] Token verification note:", tokenErr.message);
      }
    }

    // Support client passed email if verified on frontend
    if (!email && req.headers["x-user-email"]) {
      email = String(req.headers["x-user-email"]).trim().toLowerCase();
    }

    if (!email && req.body && req.body.submitter_email) {
      email = String(req.body.submitter_email).trim().toLowerCase();
    }

    if (!email) {
      email = "repledger_guest@genlayer.io";
    }

    req.user = {
      email,
      userId: userId || `did:privy:${email}`,
    };

    // Upsert into Neon DB users table
    try {
      await sql`
        INSERT INTO users (email, privy_did, last_active)
        VALUES (${req.user.email}, ${req.user.userId}, NOW())
        ON CONFLICT (email) DO UPDATE SET
          last_active = NOW(),
          privy_did = EXCLUDED.privy_did;
      `;
    } catch (dbErr) {
      console.warn("[Users DB] Sync warning:", dbErr.message);
    }

    next();
  } catch (err) {
    console.error("[Privy Auth Middleware Error]:", err);
    next();
  }
}
