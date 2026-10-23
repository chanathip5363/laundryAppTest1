const fs = require('fs');
const os = require('os');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const defaultDbPath = path.join(__dirname, 'database.db');
function queries(db) {
  return {
    run: (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, function(err) {
      err ? reject(err) : resolve({ changes: this.changes });
    })),
    get: (sql, params = []) => new Promise((resolve, reject) => db.get(sql, params,
      (err, row) => err ? reject(err) : resolve(row)))
  };
}
async function hasTable(db) {
  return Boolean(await queries(db).get("SELECT name FROM sqlite_master WHERE type='table' AND name='payment_omise_test'"));
}
async function assertSmsMethod(db, txid) {
  if (await hasTable(db) && await queries(db).get('SELECT txid FROM payment_omise_test WHERE txid=?', [txid])) {
    throw new Error('PAYMENT_METHOD_LOCKED');
  }
}
async function getOmiseReceipt(db, txid) {
  if (!await hasTable(db)) return null;
  return queries(db).get(`SELECT amount_satang FROM payment_omise_test
    WHERE txid=? AND verified_at IS NOT NULL AND charge_id LIKE 'chrg_test_%'`, [txid]);
}
function createProvider() {
  async function request(route, body) {
    let key;
    try {
      key = fs.readFileSync(path.join(os.homedir(), '.config/laundry/omise-test-secret'), 'utf8').trim();
    } catch { throw new Error('OMISE_NOT_CONFIGURED'); }
    if (!/^skey_test_[A-Za-z0-9]+$/.test(key)) throw new Error('OMISE_TEST_KEY_REQUIRED');
    let res;
    try {
      res = await fetch('https://api.omise.co' + route, {
        method: body ? 'POST' : 'GET',
        headers: { Authorization: 'Basic ' + Buffer.from(key + ':').toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded', 'Omise-Version': '2019-05-29' },
        body: body ? new URLSearchParams(body) : undefined,
        signal: AbortSignal.timeout(15000)
      });
    } catch { throw new Error('OMISE_UNAVAILABLE'); }
    if (!res.ok) throw new Error('OMISE_API_ERROR');
    try { return await res.json(); } catch { throw new Error('OMISE_RESPONSE_INVALID'); }
  }
  return {
    create: order => request('/charges', {
      amount: String(order.amount_satang), currency: 'THB', 'source[type]': 'promptpay',
      'metadata[laundry_txid]': order.txid,
      description: 'Laundry TEST ' + order.machine + ' ' + order.txid,
      expires_at: new Date(order.expires_at).toISOString()
    }),
    retrieve: id => {
      if (!/^chrg_test_[a-z0-9]+$/.test(id)) throw new Error('OMISE_RESPONSE_INVALID');
      return request('/charges/' + id);
    }
  };
}
function validateCharge(charge, order, expectedId) {
  if (!charge || charge.object !== 'charge' || charge.livemode !== false ||
      !/^chrg_test_[a-z0-9]+$/.test(charge.id || '') ||
      (expectedId && charge.id !== expectedId) ||
      charge.amount !== order.amount_satang || String(charge.currency).toLowerCase() !== 'thb' ||
      charge.source?.type !== 'promptpay' || charge.metadata?.laundry_txid !== order.txid) {
    throw new Error('OMISE_RESPONSE_INVALID');
  }
}
function createOmiseService({ dbPath = defaultDbPath, isTest = false, provider = createProvider() } = {}) {
  if (typeof isTest !== 'boolean') throw new Error('INVALID_TEST_MODE');
  async function connect() {
    const db = await new Promise((resolve, reject) => {
      const connection = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE,
        err => err ? reject(err) : resolve(connection));
    });
    db.configure('busyTimeout', 5000);
    try {
      await queries(db).run('PRAGMA foreign_keys=ON');
      await queries(db).run(`CREATE TABLE IF NOT EXISTS payment_omise_test (
        txid TEXT PRIMARY KEY NOT NULL REFERENCES payment_orders(txid),
        charge_id TEXT UNIQUE, amount_satang INTEGER NOT NULL CHECK(amount_satang>=2000),
        qr_url TEXT, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
        verified_at INTEGER
      )`);
      return db;
    } catch(err) { await close(db); throw err; }
  }
  const close = db => new Promise(resolve => db.close(() => resolve()));
  function validTxid(txid) {
    if (typeof txid !== 'string' || !/^TX[a-f0-9]{32}$/.test(txid)) throw new Error('INVALID_TXID');
  }
  async function readOrder(q, txid, pending = true) {
    const order = await q.get('SELECT * FROM payment_orders WHERE txid=?', [txid]);
    if (!order || order.is_test !== (isTest ? 1 : 0)) throw new Error('ORDER_NOT_FOUND');
    if (pending) {
      if (order.status !== 'PENDING') throw new Error('ORDER_NOT_PENDING');
      if (order.expires_at <= Date.now()) throw new Error('ORDER_EXPIRED');
    }
    return order;
  }
  const publicCharge = (row, status = 'pending') => ({
    success: true, txid: row.txid, chargeId: row.charge_id, qrUrl: row.qr_url,
    amountSatang: row.amount_satang, expiresAt: row.expires_at, testMode: true, status
  });
  async function create(txid) {
    validTxid(txid);
    const db = await connect(), q = queries(db);
    let transaction = false;
    try {
      await q.run('BEGIN IMMEDIATE'); transaction = true;
      const order = await readOrder(q, txid);
      if (order.amount_satang < 2000) throw new Error('OMISE_MINIMUM_AMOUNT');
      const receipt = await q.get('SELECT txid FROM payment_receipts WHERE txid=?', [txid]);
      if (receipt) throw new Error('ORDER_ALREADY_HAS_EVIDENCE');
      const existing = await q.get('SELECT * FROM payment_omise_test WHERE txid=?', [txid]);
      if (existing) {
        if (!existing.charge_id) throw new Error('OMISE_CREATING');
        await q.run('COMMIT'); transaction = false;
        return publicCharge(existing);
      }
      const machine = await q.get('SELECT * FROM machines WHERE machine=?', [order.machine]);
      if (!machine || machine.status !== 'ONLINE' || machine.state !== 'RESERVED' ||
          machine.reservation_txid !== txid || machine.reserved_until <= Date.now()) {
        throw new Error('RESERVATION_INVALID');
      }
      // Commit the method lock before calling the provider, preventing duplicate
      // charges or simultaneous SMS verification. Never retry a timed-out POST.
      await q.run(`INSERT INTO payment_omise_test
        (txid,amount_satang,created_at,expires_at) VALUES (?,?,?,?)`,
      [txid, order.amount_satang, Date.now(), order.expires_at]);
      await q.run('COMMIT'); transaction = false;
      const charge = await provider.create(order);
      validateCharge(charge, order);
      const qrUrl = charge.source?.scannable_code?.image?.download_uri;
      const url = new URL(qrUrl);
      if (url.protocol !== 'https:' || url.hostname !== 'api.omise.co') throw new Error('OMISE_RESPONSE_INVALID');
      await q.run('UPDATE payment_omise_test SET charge_id=?,qr_url=? WHERE txid=? AND charge_id IS NULL',
        [charge.id, qrUrl, txid]);
      return publicCharge(await q.get('SELECT * FROM payment_omise_test WHERE txid=?', [txid]));
    } catch(err) {
      if (transaction) await q.run('ROLLBACK').catch(()=>{});
      throw err;
    } finally { await close(db); }
  }
  async function refresh(txid) {
    validTxid(txid);
    const db = await connect(), q = queries(db);
    let transaction = false;
    try {
      let order = await readOrder(q, txid, false);
      let row = await q.get('SELECT * FROM payment_omise_test WHERE txid=?', [txid]);
      if (!row?.charge_id) throw new Error('OMISE_NOT_CREATED');
      if (row.verified_at) {
        if (!['PAID','STARTING','STARTED','START_FAILED'].includes(order.status)) throw new Error('ORDER_NOT_PENDING');
        return publicCharge(row, 'PAID');
      }
      if (order.status !== 'PENDING') throw new Error('ORDER_NOT_PENDING');
      if (order.expires_at <= Date.now()) throw new Error('ORDER_EXPIRED');
      const charge = await provider.retrieve(row.charge_id);
      validateCharge(charge, order, row.charge_id);
      if (charge.status !== 'successful' || charge.paid !== true) {
        if (!['pending','failed','expired'].includes(charge.status)) throw new Error('OMISE_RESPONSE_INVALID');
        return publicCharge(row, charge.status);
      }
      const paidAt = Date.parse(charge.paid_at);
      if (!Number.isFinite(paidAt) || paidAt < order.created_at || paidAt > order.expires_at) {
        throw new Error('OMISE_PAYMENT_TIME_INVALID');
      }
      await q.run('BEGIN IMMEDIATE'); transaction = true;
      order = await readOrder(q, txid, false);
      row = await q.get('SELECT * FROM payment_omise_test WHERE txid=?', [txid]);
      if (!row.verified_at) {
        if (order.status !== 'PENDING') throw new Error('ORDER_NOT_PENDING');
        const now = Date.now();
        if (order.expires_at <= now) throw new Error('ORDER_EXPIRED');
        if (await q.get('SELECT txid FROM payment_receipts WHERE txid=?', [txid])) throw new Error('ORDER_ALREADY_HAS_EVIDENCE');
        await q.run('UPDATE payment_omise_test SET verified_at=? WHERE txid=? AND verified_at IS NULL', [now,txid]);
        const changed = await q.run("UPDATE payment_orders SET status='PAID' WHERE txid=? AND status='PENDING' AND expires_at>?",[txid,now]);
        if (changed.changes !== 1) throw new Error('ORDER_UPDATE_FAILED');
      }
      await q.run('COMMIT'); transaction = false;
      return publicCharge(row, 'PAID');
    } catch(err) {
      if(transaction) await q.run('ROLLBACK').catch(()=>{});
      throw err;
    } finally { await close(db); }
  }
  async function webhook(chargeId) {
    if (!/^chrg_test_[a-z0-9]+$/.test(chargeId || '')) return;
    const db = await connect();
    let row;
    try { row = await queries(db).get('SELECT txid FROM payment_omise_test WHERE charge_id=?',[chargeId]); }
    finally { await close(db); }
    if (row) return refresh(row.txid);
  }
  return { create, refresh, webhook };
}
module.exports = { createOmiseService, assertSmsMethod, getOmiseReceipt, createProvider };
