const express = require("express");
const crypto = require("node:crypto");
const sqlite3 = require("sqlite3").verbose();
const { verifyPassword } = require("./admin-auth.cjs");

const SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000;

function createAdminRouter(dbPath = "database.db", { publishFinish } = {}) {
  const router = express.Router();
  const allowedOrigins = new Set([
    "https://laundry-app-test1.vercel.app"
  ]);

  router.use((req, res, next) => {
    const origin = req.get("Origin");

    if (origin && allowedOrigins.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
      );
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PATCH, OPTIONS"
      );
    }

    if (req.method === "OPTIONS") {
      return origin && allowedOrigins.has(origin)
        ? res.sendStatus(204)
        : res.sendStatus(403);
    }


    if (origin && !allowedOrigins.has(origin)) {
      return res.status(403).json({ error: "Origin not allowed" });
    }

    next();
  });

  const db = new sqlite3.Database(dbPath);

  function createToken() {
    return crypto.randomBytes(32).toString("hex");
  }

  function hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
  }



  const loginAttempts = new Map();
  const LOGIN_WINDOW_MS = 15 * 60 * 1000;
  const MAX_LOGIN_FAILURES = 5;

  function loginRateLimit(req, res, next) {
    const key = req.ip;
    const now = Date.now();
    const record = loginAttempts.get(key);

    if (record && now - record.startedAt < LOGIN_WINDOW_MS &&
        record.failures >= MAX_LOGIN_FAILURES) {
      return res.status(429).json({
        error: "Too many login attempts. Try again later."
      });
    }

    if (record && now - record.startedAt >= LOGIN_WINDOW_MS) {
      loginAttempts.delete(key);
    }

    next();
  }

  router.post("/login", loginRateLimit, (req, res) => {
    const { username, password } = req.body || {};

    if (typeof username !== "string" ||
        typeof password !== "string" ||
        !username.trim() || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    db.get(
      "SELECT id, username, password_hash, role FROM admin_users WHERE username = ? AND status = 'ACTIVE'",
      [username.trim()],
      (err, user) => {
        if (err) return res.status(500).json({ error: "Database error" });

        if (!user || !verifyPassword(password, user.password_hash)) {
          const key = req.ip;
          const now = Date.now();
          let record = loginAttempts.get(key);

          if (!record || now - record.startedAt >= LOGIN_WINDOW_MS) {
            record = { startedAt: now, failures: 0 };
          }

          record.failures += 1;
          loginAttempts.set(key, record);

          return res.status(401).json({ error: "Invalid credentials" });
        }

        loginAttempts.delete(req.ip);

        const token = createToken();
        const expiresAt = Date.now() + SESSION_LIFETIME_MS;

        db.run(
          "INSERT INTO admin_sessions (admin_user_id, token_hash, expires_at) VALUES (?, ?, ?)",
          [user.id, hashToken(token), expiresAt],
          (err) => {
            if (err) return res.status(500).json({ error: "Session error" });

            res.json({
              token,
              expiresAt,
              user: {
                id: user.id,
                username: user.username,
                role: user.role
              }
            });
          }
        );
      }
    );
  });


  function requireAdmin(req, res, next) {
    const authorization = req.get("Authorization") || "";
    const match = /^Bearer ([a-f0-9]{64})$/.exec(authorization);

    if (!match) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const tokenHash = hashToken(match[1]);

    db.get(
      `SELECT u.id, u.username, u.role
       FROM admin_sessions s
       JOIN admin_users u ON u.id = s.admin_user_id
       WHERE s.token_hash = ?
         AND s.expires_at > ?
         AND u.status = 'ACTIVE'`,
      [tokenHash, Date.now()],
      (err, user) => {
        if (err) return res.status(500).json({ error: "Database error" });

        if (!user) {
          return res.status(401).json({ error: "Invalid or expired session" });
        }

        req.admin = user;
        next();
      }
    );
  }

  // TEMPORARY TEST ONLY: enable explicitly on the server and restrict to allowlisted IPs.
  // Browser Origin/CORS is NOT an authentication mechanism.
  const TEST_FINISH_ENABLED = process.env.LAUNDRY_TEST_FINISH_ENABLED === "true";
  const TEST_FINISH_ALLOWED_IPS = new Set(
    (process.env.LAUNDRY_TEST_FINISH_ALLOWED_IPS || "")
      .split(",").map(ip => ip.trim()).filter(Boolean)
  );
  const finishAttempts = new Map();
  function requireTestFinish(req, res, next) {
    if (!TEST_FINISH_ENABLED) return res.status(404).json({ error: "Test mode disabled" });
    // Require explicit IP allowlist, never default to public access.
    const ip = req.ip;
    if (!TEST_FINISH_ALLOWED_IPS.has(ip)) return res.status(403).json({ error: "Test access denied" });
    const now = Date.now();
    const last = finishAttempts.get(ip) || 0;
    if (now - last < 3000) return res.status(429).json({ error: "Please wait before retrying" });
    finishAttempts.set(ip, now);
    next();
  }
  // Development finish buttons: shop-aware, shared by washers and dryers.
  router.post("/machines/finish", requireTestFinish, (req, res) => {
    const { shopId, machineId } = req.body || {};
    if (typeof shopId !== "string" || !/^shop[a-zA-Z0-9_-]{1,30}$/.test(shopId) ||
        typeof machineId !== "string" || !/^machine\d+$/.test(machineId)) {
      return res.status(400).json({ error: "Invalid shop or machine" });
    }
    if (typeof publishFinish !== "function") {
      return res.status(503).json({ error: "Finish service unavailable" });
    }
    db.get(
      `SELECT machine, shop_id, state, status FROM machines
       WHERE machine=? AND shop_id=? AND deleted_at IS NULL`,
      [machineId, shopId],
      async (err, row) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (!row) return res.status(404).json({ error: "Machine not found in shop" });
        if (row.status !== "ONLINE") return res.status(409).json({ error: "Machine is offline" });
        if (row.state !== "RUNNING") return res.status(409).json({ error: "Machine is not running" });
        try {
          const broker = await publishFinish(shopId, machineId);
          console.log("[TEST FINISH]", req.ip, shopId, machineId, broker);
          return res.json({ success: true, shopId, machineId, broker });
        } catch (error) {
          console.error("[ADMIN FINISH] Publish failed:", error.message);
          return res.status(502).json({ error: "MQTT publish failed: " + error.message });
        }
      }
    );
  });

  router.get("/me", requireAdmin, (req, res) => {
    res.json({ user: req.admin });
  });


  router.post("/logout", requireAdmin, (req, res) => {
    const token = req.get("Authorization").slice(7);

    db.run(
      "DELETE FROM admin_sessions WHERE token_hash = ?",
      [hashToken(token)],
      function(err) {
        if (err) {
          return res.status(500).json({ error: "Logout failed" });
        }

        res.json({ success: true });
      }
    );
  });


  router.get("/shops", requireAdmin, (req, res) => {
    db.all(
      `SELECT shop_id, shop_name, payment_mode, status, created_at
       FROM shops
       ORDER BY shop_id`,
      [],
      (err, rows) => {
        if (err) {
          return res.status(500).json({ error: "Database error" });
        }

        res.json({ shops: rows });
      }
    );
  });


  router.post("/shops", requireAdmin, (req, res) => {
    const { shop_id, shop_name } = req.body || {};

    if (
      typeof shop_id !== "string" ||
      !/^shop[a-zA-Z0-9_-]{1,30}$/.test(shop_id) ||
      typeof shop_name !== "string" ||
      !shop_name.trim() ||
      shop_name.trim().length > 100
    ) {
      return res.status(400).json({
        error: "Invalid shop ID or shop name"
      });
    }

    db.run(
      `INSERT INTO shops (shop_id, shop_name, payment_mode, status)
       VALUES (?, ?, 'CENTRAL', 'ACTIVE')`,
      [shop_id, shop_name.trim()],
      function (err) {
        if (err) {
          if (err.code === "SQLITE_CONSTRAINT") {
            return res.status(409).json({
              error: "Shop ID already exists"
            });
          }

          return res.status(500).json({
            error: "Database error"
          });
        }

        res.status(201).json({
          shop: {
            shop_id,
            shop_name: shop_name.trim(),
            payment_mode: "CENTRAL",
            status: "ACTIVE"
          }
        });
      }
    );
  });

  router.get("/shops/:shopId/machines", requireAdmin, (req, res) => {
    db.all(
      `SELECT machine, shop_id, machine_type, model,
              display_name, program_profile, state, status, enabled, deleted_at,
              CASE WHEN state='RUNNING' THEN
                (SELECT started_at FROM machine_run_clock c WHERE c.machine=machines.machine)
              END AS run_started_at,
              CASE WHEN state='RUNNING' THEN
                (SELECT estimated_minutes FROM machine_run_clock c WHERE c.machine=machines.machine)
              END AS estimated_minutes
       FROM machines
       WHERE shop_id = ?
       ORDER BY machine`,
      [req.params.shopId],
      (err, rows) => {
        if (err) {
          return res.status(500).json({ error: "Database error" });
        }

        res.json({ machines: rows });
      }
    );
  });


  router.post("/shops/:shopId/machines", requireAdmin, async (req, res) => {
    const shopId = req.params.shopId;
    const { machine_type, model, display_name, program_profile } = req.body || {};

    if (
      typeof machine_type !== "string" ||
      !["wash", "dry"].includes(machine_type) ||
      typeof display_name !== "string" ||
      !display_name.trim() ||
      display_name.trim().length > 100 ||
      (model != null && (typeof model !== "string" || model.length > 100)) ||
      (program_profile != null &&
        (typeof program_profile !== "string" ||
         program_profile.length > 100))
    ) {
      return res.status(400).json({ error: "Invalid machine data" });
    }

    const writeDb = new sqlite3.Database(dbPath);

    const run = (sql, params = []) => new Promise((resolve, reject) => {
      writeDb.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
      });
    });

    const get = (sql, params = []) => new Promise((resolve, reject) => {
      writeDb.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    const close = () => new Promise((resolve) => writeDb.close(() => resolve()));

    let transactionStarted = false;

    try {
      await run("PRAGMA busy_timeout = 10000");
      await run("BEGIN IMMEDIATE");
      transactionStarted = true;

      const shop = await get(
        "SELECT shop_id FROM shops WHERE shop_id = ? AND status = 'ACTIVE'",
        [shopId]
      );

      if (!shop) {
        await run("ROLLBACK");
        transactionStarted = false;
        return res.status(404).json({ error: "Shop not found" });
      }

      const counter = await get(
        "SELECT last_number FROM machine_id_counter WHERE id = 1"
      );

      if (!counter || !Number.isSafeInteger(counter.last_number)) {
        throw new Error("Machine ID counter missing or invalid");
      }

      const nextNumber = counter.last_number + 1;

      if (!Number.isSafeInteger(nextNumber)) {
        throw new Error("Machine ID counter exhausted");
      }

      const machine = `machine${nextNumber}`;

      await run(
        "UPDATE machine_id_counter SET last_number = ? WHERE id = 1",
        [nextNumber]
      );

      await run(
        `INSERT INTO machines
         (machine, shop_id, machine_type, model, display_name,
          program_profile, state, status)
         VALUES (?, ?, ?, ?, ?, ?, 'IDLE', 'OFFLINE')`,
        [
          machine,
          shopId,
          machine_type,
          model?.trim() || null,
          display_name.trim(),
          program_profile?.trim() || null
        ]
      );

      await run("COMMIT");
      transactionStarted = false;

      return res.status(201).json({
        machine: {
          machine,
          shop_id: shopId,
          machine_type,
          model: model?.trim() || null,
          display_name: display_name.trim(),
          program_profile: program_profile?.trim() || null,
          state: "IDLE",
          status: "OFFLINE"
        }
      });
    } catch (err) {
      if (transactionStarted) {
        try {
          await run("ROLLBACK");
        } catch (rollbackErr) {
          console.error("Machine allocation rollback failed:", rollbackErr);
        }
      }

      console.error("Machine allocation failed:", err);
      return res.status(500).json({ error: "Machine registration failed" });
    } finally {
      await close();
    }
  });



  // Edit machine metadata without changing machine identity or history
  router.patch("/shops/:shopId/machines/:machine", requireAdmin, async (req, res) => {
    const { shopId, machine } = req.params;
    const { display_name, model, program_profile } = req.body || {};

    if (
      typeof display_name !== "string" ||
      !display_name.trim() ||
      display_name.trim().length > 100 ||
      (model != null && (typeof model !== "string" || model.length > 100)) ||
      (program_profile != null &&
        (typeof program_profile !== "string" || program_profile.length > 100))
    ) {
      return res.status(400).json({ error: "Invalid machine data" });
    }

    const writeDb = new sqlite3.Database(dbPath);
    const run = (sql, params = []) => new Promise((resolve, reject) =>
      writeDb.run(sql, params, function(err) {
        err ? reject(err) : resolve(this);
      })
    );
    const get = (sql, params = []) => new Promise((resolve, reject) =>
      writeDb.get(sql, params, (err, row) =>
        err ? reject(err) : resolve(row)
      )
    );
    const close = () => new Promise(resolve => writeDb.close(() => resolve()));

    let inTransaction = false;

    try {
      await run("PRAGMA busy_timeout = 10000");
      await run("BEGIN IMMEDIATE");
      inTransaction = true;

      const row = await get(
        `SELECT machine, state, reserved_until, deleted_at
         FROM machines WHERE machine = ? AND shop_id = ?`,
        [machine, shopId]
      );

      if (!row) {
        await run("ROLLBACK");
        inTransaction = false;
        return res.status(404).json({ error: "Machine not found" });
      }

      if (row.deleted_at != null) {
        await run("ROLLBACK");
        inTransaction = false;
        return res.status(409).json({ error: "Machine has been deleted" });
      }

      if (row.state !== "IDLE" || (row.reserved_until && row.reserved_until > Date.now())) {
        await run("ROLLBACK");
        inTransaction = false;
        return res.status(409).json({ error: "Machine is busy" });
      }

      await run(
        `UPDATE machines
         SET display_name = ?, model = ?, program_profile = ?
         WHERE machine = ? AND shop_id = ?`,
        [
          display_name.trim(),
          model?.trim() || null,
          program_profile?.trim() || null,
          machine,
          shopId
        ]
      );

      await run("COMMIT");
      inTransaction = false;

      return res.json({
        machine,
        shop_id: shopId,
        display_name: display_name.trim(),
        model: model?.trim() || null,
        program_profile: program_profile?.trim() || null
      });
    } catch (err) {
      if (inTransaction) {
        try { await run("ROLLBACK"); } catch (_) {}
      }
      console.error("Machine metadata update failed:", err);
      return res.status(500).json({ error: "Machine update failed" });
    } finally {
      await close();
    }
  });


  router.patch("/shops/:shopId/machines/:machine/delete", requireAdmin, async (req, res) => {
    const { shopId, machine } = req.params;
    const writeDb = new sqlite3.Database(dbPath);
    const run = (sql, params = []) => new Promise((resolve, reject) =>
      writeDb.run(sql, params, function(err) { err ? reject(err) : resolve(this); })
    );
    const get = (sql, params = []) => new Promise((resolve, reject) =>
      writeDb.get(sql, params, (err, row) => err ? reject(err) : resolve(row))
    );
    const close = () => new Promise(resolve => writeDb.close(() => resolve()));

    let inTransaction = false;
    try {
      await run("PRAGMA busy_timeout = 10000");
      await run("BEGIN IMMEDIATE");
      inTransaction = true;

      const row = await get(
        `SELECT state, reserved_until, deleted_at
         FROM machines WHERE machine = ? AND shop_id = ?`,
        [machine, shopId]
      );

      if (!row) {
        await run("ROLLBACK");
        inTransaction = false;
        return res.status(404).json({ error: "Machine not found" });
      }

      if (row.deleted_at != null) {
        await run("ROLLBACK");
        inTransaction = false;
        return res.status(409).json({ error: "Machine already deleted" });
      }

      if (row.state !== "IDLE" ||
          (row.reserved_until != null && row.reserved_until > Date.now())) {
        await run("ROLLBACK");
        inTransaction = false;
        return res.status(409).json({ error: "Machine is busy" });
      }

      const deletedAt = Date.now();
      await run(
        `UPDATE machines
         SET enabled = 0, deleted_at = ?
         WHERE machine = ? AND shop_id = ? AND deleted_at IS NULL`,
        [deletedAt, machine, shopId]
      );

      await run("COMMIT");
      inTransaction = false;
      return res.json({ machine, shop_id: shopId, enabled: 0, deleted_at: deletedAt });
    } catch (err) {
      if (inTransaction) {
        try { await run("ROLLBACK"); } catch (_) {}
      }
      console.error("Machine soft delete failed:", err);
      return res.status(500).json({ error: "Machine delete failed" });
    } finally {
      await close();
    }
  });

  router.patch("/shops/:shopId/machines/:machine/enabled", requireAdmin, async (req, res) => {
    const { shopId, machine } = req.params;
    const { enabled } = req.body || {};

    if (typeof enabled !== "boolean") {
      return res.status(400).json({ error: "enabled must be boolean" });
    }

    const writeDb = new sqlite3.Database(dbPath);
    const run = (sql, params = []) => new Promise((resolve, reject) => {
      writeDb.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
    const get = (sql, params = []) => new Promise((resolve, reject) => {
      writeDb.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
    });
    const close = () => new Promise(resolve => writeDb.close(() => resolve()));

    let inTransaction = false;

    try {
      await run("PRAGMA busy_timeout = 10000");
      await run("BEGIN IMMEDIATE");
      inTransaction = true;

      const row = await get(
        "SELECT machine, state, reserved_until, enabled, deleted_at FROM machines WHERE machine = ? AND shop_id = ?",
        [machine, shopId]
      );

      if (!row) {
        await run("ROLLBACK");
        inTransaction = false;
        return res.status(404).json({ error: "Machine not found" });
      }

      if (row.deleted_at != null) {
        await run("ROLLBACK");
        inTransaction = false;
        return res.status(409).json({ error: "Machine has been deleted" });
      }

      if (!enabled && (
        row.state !== "IDLE" ||
        (row.reserved_until != null && row.reserved_until > Date.now())
      )) {
        await run("ROLLBACK");
        inTransaction = false;
        return res.status(409).json({ error: "Machine is not idle" });
      }

      await run(
        "UPDATE machines SET enabled = ? WHERE machine = ? AND shop_id = ?",
        [enabled ? 1 : 0, machine, shopId]
      );

      await run("COMMIT");
      inTransaction = false;

      return res.json({ machine, shop_id: shopId, enabled: enabled ? 1 : 0 });
    } catch (err) {
      if (inTransaction) {
        try { await run("ROLLBACK"); } catch (_) {}
      }
      console.error("Admin machine enabled update failed:", err);
      return res.status(500).json({ error: "Machine update failed" });
    } finally {
      await close();
    }
  });


  // Shop-specific pricing: read the effective catalog for a machine.
  router.get("/shops/:shopId/machines/:machine/pricing", requireAdmin, async (req, res) => {
    const { shopId, machine } = req.params;
    if (!/^machine\d+$/.test(machine)) {
      return res.status(400).json({ error: "Invalid machine" });
    }
    db.get(
      `SELECT machine FROM machines WHERE machine = ? AND shop_id = ? AND deleted_at IS NULL`,
      [machine, shopId],
      async (err, row) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (!row) return res.status(404).json({ error: "Machine not found in shop" });
        try {
          const { getPricingCatalog } = require("./payment-pricing-catalog.cjs");
          const catalog = await getPricingCatalog(machine, { dbPath });
          res.set("Cache-Control", "no-store");
          return res.json({ success: true, shop_id: shopId, ...catalog });
        } catch (error) {
          console.error("Admin pricing read failed:", error);
          return res.status(500).json({ error: "Pricing read failed" });
        }
      }
    );
  });


  // Save machine-specific pricing without changing the firmware program IDs.
  router.patch("/shops/:shopId/machines/:machine/pricing", requireAdmin, async (req, res) => {
    const { shopId, machine } = req.params;
    const pricing = req.body?.pricing;
    if (!/^machine\d+$/.test(machine) || !pricing || typeof pricing !== "object" || Array.isArray(pricing)) {
      return res.status(400).json({ error: "Invalid machine or pricing" });
    }

    const validMoney = (v, positive = false) =>
      typeof v === "number" && Number.isFinite(v) &&
      (positive ? v > 0 : v >= 0) && v <= 100000 &&
      Number.isSafeInteger(Math.round(v * 100)) &&
      Math.abs(v * 100 - Math.round(v * 100)) < 1e-7;
    const validPrices = (obj) => obj && typeof obj === "object" &&
      !Array.isArray(obj) && Object.values(obj).every(v => validMoney(v));
    const groups = pricing.priceGroups;
    if (!groups || typeof groups !== "object" || Array.isArray(groups) ||
        !Object.keys(groups).length || Object.entries(groups).some(([price, programs]) =>
          !/^\d+(?:\.\d{1,2})?$/.test(price) || !validMoney(Number(price), true) ||
          !Array.isArray(programs) || !programs.length ||
          programs.some(id => !Number.isSafeInteger(id) || id <= 0))) {
      return res.status(400).json({ error: "Invalid price groups" });
    }
    const programIds = Object.values(groups).flat();
    if (new Set(programIds).size !== programIds.length) {
      return res.status(400).json({ error: "Program appears in more than one price group" });
    }

    const writeDb = new sqlite3.Database(dbPath);
    const get = (sql, params = []) => new Promise((resolve, reject) =>
      writeDb.get(sql, params, (err, row) => err ? reject(err) : resolve(row)));
    const run = (sql, params = []) => new Promise((resolve, reject) =>
      writeDb.run(sql, params, function (err) { err ? reject(err) : resolve(this); }));
    let started = false;
    try {
      await run("PRAGMA busy_timeout = 10000");
      await run("BEGIN IMMEDIATE");
      started = true;
      const row = await get(
        `SELECT machine_type, program_profile FROM machines
         WHERE machine = ? AND shop_id = ? AND deleted_at IS NULL`,
        [machine, shopId]
      );
      if (!row) {
        await run("ROLLBACK"); started = false;
        return res.status(404).json({ error: "Machine not found in shop" });
      }
      if (!row.program_profile) {
        await run("ROLLBACK"); started = false;
        return res.status(409).json({ error: "Machine has no program profile" });
      }
      const type = row.machine_type;
      const allowed = type === "wash"
        ? ["priceGroups", "temperaturePrice", "aromaPrice"]
        : ["priceGroups", "temperatureRule", "wrinklePrice"];
      if (!allowed.every(k => Object.hasOwn(pricing, k)) ||
          Object.keys(pricing).some(k => !allowed.includes(k)) ||
          (type === "wash" && (!validPrices(pricing.temperaturePrice) || !validMoney(pricing.aromaPrice))) ||
          (type === "dry" && (!pricing.temperatureRule ||
            !Array.isArray(pricing.temperatureRule.programs) ||
            new Set(pricing.temperatureRule.programs).size !== pricing.temperatureRule.programs.length ||
            pricing.temperatureRule.programs.some(id => !programIds.includes(id)) ||
            !validPrices(pricing.temperatureRule.prices) ||
            !validMoney(pricing.wrinklePrice))) ||
          !["wash", "dry"].includes(type)) {
        await run("ROLLBACK"); started = false;
        return res.status(400).json({ error: "Invalid pricing structure for machine type" });
      }
      await run(
        `INSERT INTO shop_machine_pricing
           (shop_id, machine, program_profile, pricing_json, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(machine) WHERE machine IS NOT NULL DO UPDATE SET
           shop_id = excluded.shop_id,
           program_profile = excluded.program_profile,
           pricing_json = excluded.pricing_json,
           updated_at = CURRENT_TIMESTAMP`,
        [shopId, machine, row.program_profile, JSON.stringify(pricing)]
      );
      await run("COMMIT"); started = false;
      res.set("Cache-Control", "no-store");
      return res.json({ success: true, shop_id: shopId, machine, pricingSource: "machine", pricing });
    } catch (error) {
      if (started) { try { await run("ROLLBACK"); } catch (_) {} }
      console.error("Admin pricing save failed:", error);
      return res.status(500).json({ error: "Pricing save failed" });
    } finally {
      await new Promise(resolve => writeDb.close(() => resolve()));
    }
  });

  return router;
}

module.exports = { createAdminRouter };
