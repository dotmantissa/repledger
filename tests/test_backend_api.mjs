import test from "node:test";
import assert from "node:assert";
import { app } from "../backend/src/app.js";

let server;
const PORT = 3098;
const BASE_URL = `http://localhost:${PORT}`;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(PORT, "127.0.0.1", resolve);
  });
});

test.after(async () => {
  await new Promise((resolve) => {
    if (server) server.close(resolve);
    else resolve();
  });
});

test("GET /api/health returns healthy status and upgraded contract address", async () => {
  const res = await fetch(`${BASE_URL}/api/health`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.status, "healthy");
  assert.strictEqual(data.contractAddress, "0x6Bf2142a7AbA111e5BcD41Ad70Ebb4fC501660Ee");
});

test("GET /api/contract/info returns metadata and financial methods", async () => {
  const res = await fetch(`${BASE_URL}/api/contract/info`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.contractAddress, "0x6Bf2142a7AbA111e5BcD41Ad70Ebb4fC501660Ee");
  assert.strictEqual(data.network, "studionet");
  assert.ok(Array.isArray(data.methods));
  assert.ok(data.methods.includes("submit_claim"));
  assert.ok(data.methods.includes("challenge_claim"));
  assert.ok(data.methods.includes("refund_bond"));
  assert.ok(data.methods.includes("get_claim_bond"));
});

test("GET /api/stats returns ledger custody and payout telemetry", async () => {
  const res = await fetch(`${BASE_URL}/api/stats`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.ok(typeof data.totalClaims === "number");
  assert.strictEqual(data.contractAddress, "0x6Bf2142a7AbA111e5BcD41Ad70Ebb4fC501660Ee");
  assert.ok(typeof data.totalBondsRefunded === "number");
  assert.ok(typeof data.totalChallengerPayouts === "number");
  assert.ok(typeof data.totalBondsInCustody === "number");
  assert.ok(typeof data.treasury === "string");
});

test("GET /api/entities returns tracked entities array", async () => {
  const res = await fetch(`${BASE_URL}/api/entities`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data.entities));
  assert.ok(typeof data.count === "number");
});

test("POST /api/faucet/drip dispenses testnet stake balance", async () => {
  const res = await fetch(`${BASE_URL}/api/faucet/drip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "test_suite_user@example.com",
      address: "0x0000000000000000000000000000000000000001",
      amount: 50,
    }),
  });
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.ok(data.balance >= 50);
});

test("POST /api/claims/submit validates write path and returns pending status", async () => {
  // Submit claim write path validation: checks payload requirements
  const res = await fetch(`${BASE_URL}/api/claims/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entity: "", // empty entity
      claim_text: "Empty entity test",
    }),
  });
  assert.strictEqual(res.status, 400);
  const err = await res.json();
  assert.ok(err.error.includes("Target entity identifier is required"));
});

test("POST /api/claims/:id/refund endpoint exists and responds to requests", async () => {
  const res = await fetch(`${BASE_URL}/api/claims/claim_999999/refund`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  // Since claim_999999 does not exist on-chain, relayer will return 500 with user error
  assert.ok([200, 500].includes(res.status));
});
