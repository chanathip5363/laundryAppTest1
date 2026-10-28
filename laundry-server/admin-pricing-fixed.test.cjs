"use strict";
// Isolated integration tests: creates a temporary SQLite database and HTTP server.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const { createAdminRouter } = require("./admin-router.cjs");

const run = (db, sql, params = []) => new Promise((resolve, reject) =>
  db.run(sql, params, function (err) { err ? reject(err) : resolve(this); }));
const get = (db, sql, params = []) => new Promise((resolve, reject) =>
  db.get(sql, params, (err, row) => err ? reject(err) : resolve(row)));
const closeDb = (db) => new Promise((resolve, reject) =>
  db.close(err => err ? reject(err) : resolve()));

const pricingA = {
  priceGroups: { "20": [4, 6], "30": [1, 2, 3, 5, 7, 8, 9], "50": [10] },
  temperaturePrice: { "20": 3, "30": 4, "40": 8, "60": 15, "90": 20 },
  aromaPrice: 5,
};
const pricingB = {
  priceGroups: { "25": [4, 6], "35": [1, 2, 3, 5, 7, 8, 9], "55": [10] },
  temperaturePrice: { "20": 3, "30": 4, "40": 8, "60": 15, "90": 20 },
  aromaPrice: 6,
};

test("Admin pricing: authentication, save/read, and shop isolation", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "laundry-admin-pricing-"));
  const dbPath = path.join(dir, "test.db");
  const db = new sqlite3.Database(dbPath);
  let server;
  try {
    await run(db, `CREATE TABLE admin_users (id INTEGER PRIMARY KEY, username TEXT, role TEXT, status TEXT)`);
    await run(db, `CREATE TABLE admin_sessions (admin_user_id INTEGER, token_hash TEXT, expires_at INTEGER)`);
    await run(db, `CREATE TABLE machines (machine TEXT PRIMARY KEY, shop_id TEXT, machine_type TEXT, program_profile TEXT, deleted_at INTEGER)`);
    await run(db, `CREATE TABLE shop_machine_pricing (id INTEGER PRIMARY KEY, shop_id TEXT, machine TEXT, program_profile TEXT, pricing_json TEXT, updated_at TEXT)`);
    await run(db, `CREATE UNIQUE INDEX pricing_machine_unique ON shop_machine_pricing(machine) WHERE machine IS NOT NULL`);
    await run(db, `CREATE UNIQUE INDEX pricing_profile_unique ON shop_machine_pricing(shop_id, program_profile) WHERE machine IS NULL`);
    await run(db, `INSERT INTO admin_users VALUES (1, 'tester', 'admin', 'ACTIVE')`);
    const token = crypto.randomBytes(32).toString("hex");
    await run(db, `INSERT INTO admin_sessions VALUES (1, ?, ?)`, [crypto.createHash("sha256").update(token).digest("hex"), Date.now() + 600000]);
    await run(db, `INSERT INTO machines VALUES ('machine1','shop001','wash','toshibaA',NULL)`);
    await run(db, `INSERT INTO machines VALUES ('machine9','shop002','wash','toshibaA',NULL)`);
    await run(db, `INSERT INTO shop_machine_pricing(shop_id,machine,program_profile,pricing_json,updated_at) VALUES ('shop001',NULL,'toshibaA',?,CURRENT_TIMESTAMP)`, [JSON.stringify(pricingA)]);
    await run(db, `INSERT INTO shop_machine_pricing(shop_id,machine,program_profile,pricing_json,updated_at) VALUES ('shop002',NULL,'toshibaA',?,CURRENT_TIMESTAMP)`, [JSON.stringify(pricingA)]);

    const app = express();
    app.use(express.json());
    app.use("/admin", createAdminRouter(dbPath));
    server = await new Promise((resolve, reject) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
      s.once("error", reject);
    });
    const base = `http://127.0.0.1:${server.address().port}/admin/shops`;
    const url1 = `${base}/shop001/machines/machine1/pricing`;
    const url9 = `${base}/shop002/machines/machine9/pricing`;
    const auth = { Authorization: `Bearer ${token}` };
    const request = (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(10000) });

    await t.test("rejects unauthenticated requests", async () => {
      assert.equal((await request(url1)).status, 401);
      assert.equal((await request(url1, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pricing: pricingA }) })).status, 401);
    });
    await t.test("rejects a machine in the wrong shop", async () => {
      const r = await request(`${base}/shop002/machines/machine1/pricing`, { headers: auth });
      assert.equal(r.status, 404);
    });
    await t.test("rejects duplicate program IDs", async () => {
      const invalid = { ...pricingA, priceGroups: { "20": [4, 6], "30": [4, 5] } };
      const r = await request(url1, { method: "PATCH", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ pricing: invalid }) });
      assert.equal(r.status, 400);
    });
    await t.test("saves machine-specific pricing", async () => {
      const r = await request(url1, { method: "PATCH", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ pricing: pricingB }) });
      assert.equal(r.status, 200);
      const row = await get(db, "SELECT pricing_json FROM shop_machine_pricing WHERE shop_id=? AND machine=?", ["shop001", "machine1"]);
      assert.deepEqual(JSON.parse(row.pricing_json), pricingB);
    });
    await t.test("GET reads updated machine pricing", async () => {
      const r = await request(url1, { headers: auth });
      assert.equal(r.status, 200);
      // API may wrap catalog data; assert the updated prices are present in its response.
      // Avoid relying on unrelated presentation metadata.
      const body = await r.json();
      assert.equal(body.success, true);
      assert.equal(body.pricing?.priceGroups?.["25"]?.[0] ?? body.priceGroups?.["25"]?.[0], 4);
    });
    await t.test("other shop retains its own pricing", async () => {
      const row = await get(db, "SELECT pricing_json FROM shop_machine_pricing WHERE shop_id=? AND machine IS NULL", ["shop002"]);
      assert.deepEqual(JSON.parse(row.pricing_json), pricingA);
      const machineRow = await get(db, "SELECT id FROM shop_machine_pricing WHERE shop_id=? AND machine=?", ["shop002", "machine9"]);
      assert.equal(machineRow, undefined);
      const r = await request(url9, { headers: auth });
      assert.equal(r.status, 200);
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await closeDb(db);
    // The Admin router owns a SQLite connection that remains open until process exit.
    // On Windows, its open handle prevents removing the temp directory here.
    try {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch (err) {
      if (err.code !== "EPERM" && err.code !== "EBUSY") throw err;
      t.diagnostic(`Temporary test DB retained until process exit: ${dir}`);
    }
  }
});
