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

test("GET /api/health returns healthy status and contract address", async () => {
  const res = await fetch(`${BASE_URL}/api/health`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.status, "healthy");
  assert.strictEqual(data.contractAddress, "0xe94A9eD3162b5c1b43f6F3FEF643E484b5B2a847");
});

test("GET /api/contract/info returns metadata and methods", async () => {
  const res = await fetch(`${BASE_URL}/api/contract/info`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.contractAddress, "0xe94A9eD3162b5c1b43f6F3FEF643E484b5B2a847");
  assert.strictEqual(data.network, "studionet");
  assert.ok(Array.isArray(data.methods));
  assert.ok(data.methods.includes("submit_claim"));
});

test("GET /api/stats returns ledger statistics", async () => {
  const res = await fetch(`${BASE_URL}/api/stats`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.ok(typeof data.totalClaims === "number");
  assert.strictEqual(data.contractAddress, "0xe94A9eD3162b5c1b43f6F3FEF643E484b5B2a847");
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
