const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// SMS_TIME is a verification method, not a bank name or a slip transaction ID.
// Its receipt reference identifies the actual SMS row used as evidence.
async function verifyPaymentTime(txid, transferTime, {
  dbPath = path.join(__dirname, 'database.db'), isTest = false
} = {}) {
  if (typeof isTest !== 'boolean') throw new Error('INVALID_TEST_MODE');
  if (typeof txid !== 'string' || !/^TX[a-f0-9]{32}$/.test(txid)) {
    throw new Error('INVALID_TXID');
  }
  if (typeof transferTime !== 'string' ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(transferTime)) {
    throw new Error('INVALID_PAYMENT_TIME');
  }
  const db = await new Promise((resolve, reject) => {
    const connection = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE,
      err => err ? reject(err) : resolve(connection));
  });
  db.configure('busyTimeout', 5000);
  const run = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      err ? reject(err) : resolve({ changes: this.changes });
    });
  });
  const get = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
  const all = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
  let transaction = false;
  try {
    await run('PRAGMA foreign_keys = ON');
    await run('BEGIN IMMEDIATE');
    transaction = true;
    const order = await get('SELECT * FROM payment_orders WHERE txid = ?', [txid]);
    if (!order || order.is_test !== (isTest ? 1 : 0)) throw new Error('ORDER_NOT_FOUND');
    await require('./payment-omise.cjs').assertSmsMethod(db, txid);
    await require('./payment-discount.cjs').assertNoDiscountMethod(db, txid);
    const existing = await get('SELECT * FROM payment_receipts WHERE txid = ?', [txid]);
    if (existing) {
      const sms = await get('SELECT bank_time FROM sms_messages WHERE id = ?', [existing.sms_id]);
      if (!['PAID', 'STARTING', 'STARTED', 'START_FAILED'].includes(order.status) ||
          existing.amount_satang !== order.amount_satang || sms?.bank_time !== transferTime) {
        throw new Error('ORDER_ALREADY_HAS_EVIDENCE');
      }
      await run('COMMIT');
      transaction = false;
      return { status: 'ALREADY_VERIFIED', txid, smsId: existing.sms_id };
    }
    if (order.status !== 'PENDING') throw new Error('ORDER_NOT_PENDING');
    if (order.expires_at <= Date.now()) throw new Error('ORDER_EXPIRED');

    // Derive the date from the server's saved order, including midnight crossings.
    // The lease remains the original two minutes; no client date/amount is trusted.
    let bankDates;
    for (let minute = Math.floor(order.created_at / 60000) * 60000;
         minute <= order.expires_at; minute += 60000) {
      const thai = new Date(minute + 7 * 3600000).toISOString();
      if (thai.slice(11, 16) === transferTime) {
        const year = Number(thai.slice(0, 4)) + 543;
        const prefix = `${thai.slice(8, 10)}/${thai.slice(5, 7)}/`;
        bankDates = [prefix + String(year).slice(-2), prefix + year];
        break;
      }
    }
    if (!bankDates) throw new Error('PAYMENT_TIME_OUTSIDE_ORDER');
    const candidates = await all(`SELECT id FROM sms_messages
      WHERE is_test = ? AND parse_status = 'PARSED'
        AND receiving_account = 'X-4891' AND amount_satang = ?
        AND bank_time = ? AND bank_date IN (?, ?)
        AND received_at >= ? AND received_at <= ? ORDER BY id`,
    [isTest ? 1 : 0, order.amount_satang, transferTime, ...bankDates,
      new Date(order.created_at).toISOString(), new Date(order.expires_at).toISOString()]);
    if (!candidates.length) throw new Error('SMS_NOT_FOUND');
    if (candidates.length !== 1) throw new Error('SMS_AMBIGUOUS');
    const smsId = candidates[0].id;
    if (await get('SELECT txid FROM payment_receipts WHERE sms_id = ?', [smsId])) {
      throw new Error('EVIDENCE_ALREADY_USED');
    }
    const verifiedAt = Date.now();
    if (order.expires_at <= verifiedAt) throw new Error('ORDER_EXPIRED');
    await run(`INSERT INTO payment_receipts
      (txid, sms_id, slip_bank, slip_reference, amount_satang, verified_at)
      VALUES (?, ?, 'SMS_TIME', ?, ?, ?)`,
    [txid, smsId, 'SMS:' + smsId, order.amount_satang, verifiedAt]);
    const updated = await run(`UPDATE payment_orders SET status = 'PAID'
      WHERE txid = ? AND status = 'PENDING' AND expires_at > ?`, [txid, verifiedAt]);
    if (updated.changes !== 1) throw new Error('ORDER_UPDATE_FAILED');
    await run('COMMIT');
    transaction = false;
    return { status: 'PAID', txid, smsId };
  } catch (err) {
    if (transaction) await run('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await new Promise(resolve => db.close(() => resolve()));
  }
}

module.exports = { verifyPaymentTime };
