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
  assert.strictEqual(data.contractAddress, "0x91582A31e53648a3E8ed3B8841dE0Fb640E5a661");
});

test("GET /api/contract/info returns metadata and methods", async () => {
  const res = await fetch(`${BASE_URL}/api/contract/info`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.contractAddress, "0x91582A31e53648a3E8ed3B8841dE0Fb640E5a661");
  assert.strictEqual(data.network, "studionet");
  assert.ok(Array.isArray(data.methods));
  assert.ok(data.methods.includes("submit_claim"));
});

test("GET /api/stats returns ledger statistics", async () => {
  const res = await fetch(`${BASE_URL}/api/stats`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.ok(typeof data.totalClaims === "number");
  assert.strictEqual(data.contractAddress, "0x91582A31e53648a3E8ed3B8841dE0Fb640E5a661");
});

test("GET /api/entities returns tracked entities", async () => {
  const res = await fetch(`${BASE_URL}/api/entities`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data.entities));
  assert.ok(data.count > 0);
});

test("POST /api/simulate-query evaluates composable contract checks", async () => {
  const res = await fetch(`${BASE_URL}/api/simulate-query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entity: "euler_finance",
      consumer_type: "lending_protocol",
    }),
  });
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.targetEntity, "euler_finance");
  assert.ok(data.decision);
  assert.ok(typeof data.approved === "boolean");
});
