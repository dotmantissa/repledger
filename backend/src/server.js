import { app } from "./app.js";
import { initDb } from "./db.js";
import dotenv from "dotenv";
dotenv.config();

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    console.log("[REP | Ledger Backend] Initializing database and services...");
    await initDb();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[REP | Ledger Backend] Server running on http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error("[REP | Ledger Backend] Failed to start:", err);
    process.exit(1);
  }
}

start();
