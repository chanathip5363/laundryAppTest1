function initializeOrders(db) {
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS payment_orders (
        txid TEXT PRIMARY KEY NOT NULL,
        machine TEXT NOT NULL,
        service TEXT NOT NULL
          CHECK (service IN ('wash', 'dry')),
        program INTEGER NOT NULL,
        options_json TEXT NOT NULL,
        amount_satang INTEGER NOT NULL
          CHECK (amount_satang > 0),
        price_snapshot_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
          CHECK (expires_at > created_at),
        status TEXT NOT NULL DEFAULT 'PENDING'
          CHECK (status IN (
            'PENDING', 'PAID', 'EXPIRED', 'CANCELLED',
            'STARTING', 'STARTED', 'START_FAILED',
            'REVIEW_REQUIRED'
          )),
        is_test INTEGER NOT NULL DEFAULT 0
          CHECK (is_test IN (0, 1)),
        shop_id TEXT
      )
    `, err => {
      if (err) reject(err);
      else resolve();
    });
  });
}


async function createPendingOrder(db, input, { isTest = false } = {}) {
  const { quotePrice } = require("./payment-price.cjs");
  const { randomUUID } = require("crypto");

  if (typeof isTest !== "boolean") {
    throw new Error("isTest ต้องเป็น true หรือ false");
  }

  const quote = quotePrice(input);
  const txid = "TX" + randomUUID().replace(/-/g, "");
  const createdAt = Date.now();
  const expiresAt = createdAt + 120000;

  const options = quote.type === "wash"
    ? {
        tempOption: input.tempOption ?? null,
        aromaOption: input.aromaOption ?? false
      }
    : {
        temperatureOption: input.temperatureOption ?? null,
        wrinkleOption: input.wrinkleOption ?? false
      };

  await initializeOrders(db);

  await new Promise((resolve, reject) => {
    db.run(
      "INSERT INTO payment_orders (txid, machine, service, program, options_json, amount_satang, price_snapshot_json, created_at, expires_at, status, is_test) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)",
      [
        txid,
        quote.machine,
        quote.type,
        quote.program,
        JSON.stringify(options),
        quote.amountSatang,
        JSON.stringify(quote),
        createdAt,
        expiresAt,
        isTest ? 1 : 0
      ],
      err => {
        if (err) reject(err);
        else resolve();
      }
    );
  });

  return {
    txid,
    ...quote,
    createdAt,
    expiresAt,
    status: "PENDING",
    isTest
  };
}

module.exports = { initializeOrders, createPendingOrder };

