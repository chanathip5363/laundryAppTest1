const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { randomInt } = require('crypto');

// Current promotion range. All amounts and discounts are integer satang.
const MAX_DISCOUNT_SATANG = 10;
const defaultDbPath = path.join(__dirname, 'database.db');
const queues = new Map();
function exclusive(dbPath, operation) {
  // Queue writers in this process so sqlite3 busy waits cannot exhaust the
  // Node worker pool. BEGIN IMMEDIATE still protects against other processes.
  const key = path.resolve(dbPath);
  const previous = queues.get(key) || Promise.resolve();
  const current = previous.catch(() => {}).then(operation);
  queues.set(key, current);
  return current.finally(() => {
    if (queues.get(key) === current) queues.delete(key);
  });
}
function queries(db) {
  return {
    run: (sql, args = []) => new Promise((resolve, reject) => db.run(sql, args, function(err) {
      err ? reject(err) : resolve({ changes: this.changes });
    })),
    get: (sql, args = []) => new Promise((resolve, reject) => db.get(sql, args,
      (err, row) => err ? reject(err) : resolve(row))),
    all: (sql, args = []) => new Promise((resolve, reject) => db.all(sql, args,
      (err, rows) => err ? reject(err) : resolve(rows)))
  };
}
async function hasTable(db) {
  return Boolean(await queries(db).get("SELECT name FROM sqlite_master WHERE type='table' AND name='payment_random_discount'"));
}
async function assertNoDiscountMethod(db, txid) {
  if (await hasTable(db) && await queries(db).get('SELECT txid FROM payment_random_discount WHERE txid=?', [txid])) {
    throw new Error('PAYMENT_METHOD_LOCKED');
  }
}
async function assertBaseAmountAvailable(db, amountSatang, isTest) {
  if (!await hasTable(db)) return;
  const used = await queries(db).get(`SELECT d.txid FROM payment_random_discount d
    JOIN payment_orders o ON o.txid=d.txid
    WHERE o.amount_satang=? AND o.is_test=? AND o.status='PENDING' AND o.expires_at>?`,
  [amountSatang, isTest ? 1 : 0, Date.now()]);
  if (used) throw new Error('PAYMENT_AMOUNT_RESERVED');
}
function createDiscountService({ dbPath = defaultDbPath, isTest = false } = {}) {
  if (typeof isTest !== 'boolean') throw new Error('INVALID_TEST_MODE');
  async function connect() {
    const db = await new Promise((resolve, reject) => {
      const connection = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE,
        err => err ? reject(err) : resolve(connection));
    });
    db.configure('busyTimeout', 5000);
    try {
      await queries(db).run('PRAGMA foreign_keys=ON');
      await queries(db).run(`CREATE TABLE IF NOT EXISTS payment_random_discount (
        txid TEXT PRIMARY KEY NOT NULL REFERENCES payment_orders(txid),
        base_amount_satang INTEGER NOT NULL CHECK(base_amount_satang>0),
        discount_satang INTEGER NOT NULL CHECK(discount_satang>0),
        amount_satang INTEGER NOT NULL CHECK(amount_satang>0),
        assigned_at INTEGER NOT NULL,
        CHECK(base_amount_satang-discount_satang=amount_satang)
      )`);
      return db;
    } catch (err) { await close(db); throw err; }
  }
  const close = db => new Promise(resolve => db.close(() => resolve()));
  function validTxid(txid) {
    if (typeof txid !== 'string' || !/^TX[a-f0-9]{32}$/.test(txid)) throw new Error('INVALID_TXID');
  }
  async function readOrder(q, txid) {
    const order = await q.get('SELECT * FROM payment_orders WHERE txid=?', [txid]);
    if (!order || order.is_test !== (isTest ? 1 : 0)) throw new Error('ORDER_NOT_FOUND');
    return order;
  }
  function pending(order) {
    if (order.status !== 'PENDING') throw new Error('ORDER_NOT_PENDING');
    if (order.expires_at <= Date.now()) throw new Error('ORDER_EXPIRED');
  }
  async function reserved(q, order) {
    const machine = await q.get('SELECT * FROM machines WHERE machine=?', [order.machine]);
    if (!machine || machine.status !== 'ONLINE' || machine.state !== 'RESERVED' ||
        machine.reservation_txid !== order.txid || !machine.reserved_until || machine.reserved_until <= Date.now()) {
      throw new Error('RESERVATION_INVALID');
    }
  }
  const result = (row, order, status = 'PENDING') => ({
    success: true, txid: row.txid, status, amount: row.amount_satang / 100,
    amountSatang: row.amount_satang, baseAmountSatang: row.base_amount_satang,
    discountSatang: row.discount_satang, reservedUntil: order.expires_at
  });
  async function assign(txid) {
    validTxid(txid);
    const db = await connect(), q = queries(db);
    let transaction = false;
    try {
      await q.run('BEGIN IMMEDIATE'); transaction = true;
      const order = await readOrder(q, txid);
      pending(order);
      await reserved(q, order);
      await require('./payment-omise.cjs').assertSmsMethod(db, txid);
      const receipt = await q.get('SELECT txid FROM payment_receipts WHERE txid=?', [txid]);
      if (receipt) throw new Error('ORDER_ALREADY_HAS_EVIDENCE');
      const existing = await q.get('SELECT * FROM payment_random_discount WHERE txid=?', [txid]);
      if (existing) {
        await q.run('COMMIT'); transaction = false;
        return result(existing, order);
      }
      const occupied = await q.all(`SELECT amount_satang FROM payment_orders
        WHERE txid<>? AND is_test=? AND status='PENDING' AND expires_at>?`,
      [txid, isTest ? 1 : 0, Date.now()]);
      const used = new Set(occupied.map(x => x.amount_satang));
      const available = [];
      for (let discount = 1; discount <= MAX_DISCOUNT_SATANG; discount++) {
        const amount = order.amount_satang - discount;
        if (amount > 0 && !used.has(amount)) available.push(discount);
      }
      if (!available.length) throw new Error('DISCOUNT_POOL_FULL');
      const discount = available[randomInt(available.length)];
      const row = { txid, base_amount_satang: order.amount_satang, discount_satang: discount,
        amount_satang: order.amount_satang - discount, assigned_at: Date.now() };
      const options = JSON.parse(order.options_json);
      const snapshot = JSON.parse(order.price_snapshot_json);
      if (!options.command || options.command.amount !== order.amount_satang / 100) throw new Error('COMMAND_MISMATCH');
      // The existing React total is the base; only the saved payable amount changes.
      options.command.amount = row.amount_satang / 100;
      snapshot.randomDiscount = { baseAmountSatang: row.base_amount_satang,
        discountSatang: discount, payableAmountSatang: row.amount_satang };
      await q.run(`INSERT INTO payment_random_discount
        (txid,base_amount_satang,discount_satang,amount_satang,assigned_at) VALUES (?,?,?,?,?)`,
      [txid,row.base_amount_satang,discount,row.amount_satang,row.assigned_at]);
      const updated = await q.run(`UPDATE payment_orders SET amount_satang=?,options_json=?,price_snapshot_json=?
        WHERE txid=? AND status='PENDING' AND expires_at>?`,
      [row.amount_satang,JSON.stringify(options),JSON.stringify(snapshot),txid,row.assigned_at]);
      if (updated.changes !== 1) throw new Error('ORDER_EXPIRED');
      await q.run('COMMIT'); transaction = false;
      return result(row, order);
    } catch (err) {
      if (transaction) await q.run('ROLLBACK').catch(() => {});
      throw err;
    } finally { await close(db); }
  }
  async function check(txid) {
    validTxid(txid);
    const db = await connect(), q = queries(db);
    let transaction = false;
    try {
      await q.run('BEGIN IMMEDIATE'); transaction = true;
      const order = await readOrder(q, txid);
      const row = await q.get('SELECT * FROM payment_random_discount WHERE txid=?', [txid]);
      if (!row || row.amount_satang !== order.amount_satang) throw new Error('DISCOUNT_NOT_ASSIGNED');
      const existing = await q.get('SELECT * FROM payment_receipts WHERE txid=?', [txid]);
      if (existing) {
        if (existing.slip_bank !== 'SMS_DISCOUNT' || existing.amount_satang !== order.amount_satang ||
            !['PAID','STARTING','STARTED','START_FAILED'].includes(order.status)) throw new Error('ORDER_ALREADY_HAS_EVIDENCE');
        await q.run('COMMIT'); transaction = false;
        return result(row,order,'PAID');
      }
      pending(order);
      await reserved(q,order);
      // Recheck global uniqueness in case another creation path used this amount.
      if (await q.get(`SELECT txid FROM payment_orders WHERE txid<>? AND amount_satang=?
        AND is_test=? AND status='PENDING' AND expires_at>?`,
      [txid,order.amount_satang,isTest?1:0,Date.now()])) throw new Error('DISCOUNT_AMOUNT_CONFLICT');
      const slots = new Set();
      for (let minute = Math.floor(row.assigned_at / 60000) * 60000; minute <= order.expires_at; minute += 60000) {
        const thai = new Date(minute + 7*3600000).toISOString();
        const year = Number(thai.slice(0,4)) + 543;
        const prefix = `${thai.slice(8,10)}/${thai.slice(5,7)}/`;
        slots.add(prefix + String(year).slice(-2) + '|' + thai.slice(11,16));
        slots.add(prefix + year + '|' + thai.slice(11,16));
      }
      const rows = await q.all(`SELECT id,bank_date,bank_time FROM sms_messages
        WHERE is_test=? AND parse_status='PARSED' AND receiving_account='X-4891'
        AND amount_satang=? AND received_at>=? AND received_at<=? ORDER BY id`,
      [isTest?1:0,order.amount_satang,new Date(row.assigned_at).toISOString(),new Date(order.expires_at).toISOString()]);
      const candidates = rows.filter(x => slots.has(x.bank_date+'|'+x.bank_time));
      if (!candidates.length) {
        await q.run('COMMIT'); transaction = false;
        return result(row,order);
      }
      if (candidates.length !== 1) throw new Error('SMS_AMBIGUOUS');
      const smsId = candidates[0].id;
      if (await q.get('SELECT txid FROM payment_receipts WHERE sms_id=?',[smsId])) throw new Error('EVIDENCE_ALREADY_USED');
      const now = Date.now();
      if (order.expires_at <= now) throw new Error('ORDER_EXPIRED');
      // SMS_DISCOUNT identifies the method; SMS:<id> is not a bank reference.
      await q.run(`INSERT INTO payment_receipts
        (txid,sms_id,slip_bank,slip_reference,amount_satang,verified_at)
        VALUES (?,?,'SMS_DISCOUNT',?,?,?)`,[txid,smsId,'SMS:'+smsId,order.amount_satang,now]);
      const updated = await q.run("UPDATE payment_orders SET status='PAID' WHERE txid=? AND status='PENDING' AND expires_at>?",[txid,now]);
      if (updated.changes !== 1) throw new Error('ORDER_UPDATE_FAILED');
      await q.run('COMMIT'); transaction = false;
      return result(row,order,'PAID');
    } catch(err) {
      if(transaction) await q.run('ROLLBACK').catch(()=>{});
      throw err;
    } finally { await close(db); }
  }
  return {
    assign: txid => exclusive(dbPath, () => assign(txid)),
    check: txid => exclusive(dbPath, () => check(txid))
  };
}
module.exports = { createDiscountService, assertNoDiscountMethod, assertBaseAmountAvailable, MAX_DISCOUNT_SATANG };
