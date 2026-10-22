const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const { initializeOrders, createPendingOrder } =
  require("./payment-orders.cjs");

const defaultDbPath = path.join(__dirname, "database.db");

async function createCheckout(input, {
  dbPath = defaultDbPath,
  isTest = false
} = {}) {
  if (typeof isTest !== "boolean") {
    throw new Error("INVALID_TEST_MODE");
  }

  if (isTest && path.resolve(dbPath) === path.resolve(defaultDbPath)) {
    throw new Error("TEST_REQUIRES_SEPARATE_DATABASE");
  }

  const db = await new Promise((resolve, reject) => {
    const connection = new sqlite3.Database(
      dbPath, sqlite3.OPEN_READWRITE,
      err => err ? reject(err) : resolve(connection)
    );
  });
  db.configure("busyTimeout", 5000);

  const run = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ changes: this.changes });
    });
  });

  const get = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });

  const all = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });

  let inTransaction = false;

  try {
    await run("PRAGMA foreign_keys = ON");
    await initializeOrders(db);

    await run("BEGIN IMMEDIATE");
    inTransaction = true;

    const columns = await all("PRAGMA table_info(machines)");
    if (!columns.some(column => column.name === "reservation_txid")) {
      await run("ALTER TABLE machines ADD COLUMN reservation_txid TEXT");
    }

    const machine = await get(
      "SELECT * FROM machines WHERE machine = ?", [input.machine]
    );

    if (!machine) throw new Error("MACHINE_NOT_FOUND");
    if (machine.status !== "ONLINE") throw new Error("MACHINE_OFFLINE");

    const now = Date.now();
    const available =
      !["RUNNING", "STARTING"].includes(machine.state) &&
      !(machine.state === "RESERVED" && machine.reserved_until > now);

    if (!available) throw new Error("MACHINE_BUSY");

    await run(
      `UPDATE payment_orders SET status = 'EXPIRED'
       WHERE machine = ? AND is_test = ?
         AND status = 'PENDING' AND expires_at <= ?`,
      [input.machine, isTest ? 1 : 0, now]
    );

    const order = await createPendingOrder(db, input, { isTest });

    const reserved = await run(
      `UPDATE machines
       SET state = 'RESERVED', reserved_until = ?, reservation_txid = ?
       WHERE machine = ? AND status = 'ONLINE'
         AND state IS ? AND reserved_until IS ?`,
      [order.expiresAt, order.txid, input.machine,
       machine.state, machine.reserved_until]
    );

    if (reserved.changes !== 1) throw new Error("RESERVATION_FAILED");

    await run("COMMIT");
    inTransaction = false;

    return order;
  } catch (err) {
    if (inTransaction) {
      await run("ROLLBACK").catch(() => {});
    }
    throw err;
  } finally {
    await new Promise(resolve => db.close(() => resolve()));
  }
}

module.exports = { createCheckout };
