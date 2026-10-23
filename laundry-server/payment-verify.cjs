const sqlite3 = require("sqlite3").verbose();
const path = require("path");

async function verifyPendingPayment(txid, slip, {
  dbPath = path.join(__dirname, "database.db"),
  isTest = false
} = {}) {
  const sourceBank = slip?.sourceBank ?? "TTB";

  if (
    !["TTB", "BBL"].includes(sourceBank) ||
    (sourceBank === "BBL" && slip?.receivingWalletId !== "004999254312902") ||
    typeof txid !== "string" || !txid ||
    typeof isTest !== "boolean" ||
    !slip ||
    slip.extractionStatus !== "EXTRACTED" ||
    !Array.isArray(slip.warnings) || slip.warnings.length ||
    slip.receivingBank !== "KBANK" ||
    slip.receivingAccountSuffix !== "4891" ||
    !Number.isSafeInteger(slip.amountSatang) ||
    slip.amountSatang <= 0 ||
    !/^\d{10,40}$/.test(slip.reference || "")
  ) throw new Error("INVALID_EVIDENCE");

  const date = (slip.transferDate || "").match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );
  if (
    !date ||
    !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(slip.transferTime || "")
  ) throw new Error("INVALID_PAYMENT_TIME");

  const calendar = new Date(Date.UTC(
    Number(date[1]), Number(date[2]) - 1, Number(date[3])
  ));
  if (calendar.toISOString().slice(0, 10) !== slip.transferDate) {
    throw new Error("INVALID_PAYMENT_TIME");
  }

  const transferMinute = Date.parse(
    slip.transferDate + "T" + slip.transferTime + ":00+07:00"
  );
  const buddhistYear = Number(date[1]) + 543;
  const bankDates = [
    `${date[3]}/${date[2]}/${String(buddhistYear).slice(-2)}`,
    `${date[3]}/${date[2]}/${buddhistYear}`
  ];

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
    await run("BEGIN IMMEDIATE");
    inTransaction = true;

    const order = await get(
      "SELECT * FROM payment_orders WHERE txid = ?", [txid]
    );
    if (!order) throw new Error("ORDER_NOT_FOUND");
    if (order.is_test !== (isTest ? 1 : 0)) {
      throw new Error("TEST_MODE_MISMATCH");
    }
    await require('./payment-omise.cjs').assertSmsMethod(db, txid);
    await require('./payment-discount.cjs').assertNoDiscountMethod(db, txid);
    if (order.amount_satang !== slip.amountSatang) {
      throw new Error("AMOUNT_MISMATCH");
    }

    const existing = await get(
      "SELECT * FROM payment_receipts WHERE txid = ?", [txid]
    );

    if (existing) {
      if (
        existing.slip_bank !== sourceBank ||
        existing.slip_reference !== slip.reference ||
        existing.amount_satang !== order.amount_satang ||
        !["PAID", "STARTING", "STARTED", "START_FAILED"].includes(order.status)
      ) throw new Error("ORDER_ALREADY_HAS_EVIDENCE");

      await run("COMMIT");
      inTransaction = false;
      return {
        status: "ALREADY_VERIFIED",
        txid,
        smsId: existing.sms_id
      };
    }

    if (order.status !== "PENDING") {
      throw new Error("ORDER_NOT_PENDING");
    }
    if (order.expires_at <= Date.now()) {
      throw new Error("ORDER_EXPIRED");
    }

    const createdMinute = Math.floor(order.created_at / 60000) * 60000;
    const expiresMinute = Math.floor(order.expires_at / 60000) * 60000;
    if (
      transferMinute < createdMinute ||
      transferMinute > expiresMinute
    ) throw new Error("PAYMENT_TIME_OUTSIDE_ORDER");

    const candidates = await all(
      `SELECT id FROM sms_messages
       WHERE is_test = ?
         AND parse_status = 'PARSED'
         AND receiving_account = ?
         AND amount_satang = ?
         AND bank_time = ?
         AND bank_date IN (?, ?)
         AND received_at >= ?
         AND received_at <= ?
       ORDER BY id`,
      [
        isTest ? 1 : 0,
        "X-" + slip.receivingAccountSuffix,
        slip.amountSatang,
        slip.transferTime,
        ...bankDates,
        new Date(order.created_at).toISOString(),
        new Date(order.expires_at).toISOString()
      ]
    );

    if (!candidates.length) throw new Error("SMS_NOT_FOUND");
    if (candidates.length !== 1) throw new Error("SMS_AMBIGUOUS");

    const smsId = candidates[0].id;
    const used = await get(
      `SELECT txid FROM payment_receipts
       WHERE sms_id = ?
          OR (slip_bank = ? AND slip_reference = ?)`,
      [smsId, sourceBank, slip.reference]
    );
    if (used) throw new Error("EVIDENCE_ALREADY_USED");

    const verifiedAt = Date.now();
    if (order.expires_at <= verifiedAt) {
      throw new Error("ORDER_EXPIRED");
    }

    await run(
      `INSERT INTO payment_receipts
       (txid, sms_id, slip_bank, slip_reference,
        amount_satang, verified_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [txid, smsId, sourceBank, slip.reference, order.amount_satang, verifiedAt]
    );

    const updated = await run(
      `UPDATE payment_orders SET status = 'PAID'
       WHERE txid = ? AND status = 'PENDING' AND expires_at > ?`,
      [txid, verifiedAt]
    );
    if (updated.changes !== 1) throw new Error("ORDER_UPDATE_FAILED");

    await run("COMMIT");
    inTransaction = false;

    return { status: "PAID", txid, smsId };
  } catch (err) {
    if (inTransaction) {
      await run("ROLLBACK").catch(() => {});
    }
    throw err;
  } finally {
    await new Promise(resolve => db.close(() => resolve()));
  }
}

module.exports = { verifyPendingPayment };
