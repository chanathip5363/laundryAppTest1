const express = require("express");
const crypto = require("node:crypto");
const sqlite3 = require("sqlite3").verbose();
const { verifyPassword } = require("./admin-auth.cjs");

const SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000;

function createAdminRouter(dbPath = "database.db") {
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
              display_name, program_profile, state, status, enabled
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
        `SELECT machine, state, reserved_until
         FROM machines WHERE machine = ? AND shop_id = ?`,
        [machine, shopId]
      );

      if (!row) {
        await run("ROLLBACK");
        inTransaction = false;
        return res.status(404).json({ error: "Machine not found" });
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
        "SELECT machine, state, reserved_until, enabled FROM machines WHERE machine = ? AND shop_id = ?",
        [machine, shopId]
      );

      if (!row) {
        await run("ROLLBACK");
        inTransaction = false;
        return res.status(404).json({ error: "Machine not found" });
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

  return router;
}

module.exports = { createAdminRouter };
