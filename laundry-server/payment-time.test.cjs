const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const { initializeReceipts } = require('./payment-receipts.cjs');
const { verifyPendingPayment } = require('./payment-verify.cjs');
const { verifyPaymentTime } = require('./payment-time-verify.cjs');
const { createTimeRouter } = require('./payment-time-api.cjs');

const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'laundry-time-'));
const dbPath = path.join(folder, 'test.db');
const db = new sqlite3.Database(dbPath);
db.configure('busyTimeout', 5000);
const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) { err ? reject(err) : resolve(this); });
});
const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
});
const exec = sql => new Promise((resolve, reject) => db.exec(sql, err => err ? reject(err) : resolve()));
const options = { dbPath, isTest: true };
const timeAt = ms => new Date(ms + 7 * 3600000).toISOString().slice(11, 16);
async function reset() {
  await exec('DELETE FROM payment_receipts; DELETE FROM sms_messages; DELETE FROM payment_orders;');
}
async function order({ amount = 2000, created = Date.now() - 30000, expires = Date.now() + 90000, test = 1 } = {}) {
  const txid = 'TX' + randomUUID().replace(/-/g, '');
  await run(`INSERT INTO payment_orders
    (txid,machine,service,program,options_json,amount_satang,price_snapshot_json,created_at,expires_at,status,is_test)
    VALUES (?,'machine1','wash',1,'{}',?,'{}',?,?,'PENDING',?)`, [txid, amount, created, expires, test]);
  return { txid, created, expires };
}
async function sms({ amount = 2000, at = Date.now(), test = 1, account = 'X-4891', parsed = 'PARSED', received = at } = {}) {
  const thai = new Date(at + 7 * 3600000).toISOString();
  const year = Number(thai.slice(0, 4)) + 543;
  const date = `${thai.slice(8, 10)}/${thai.slice(5, 7)}/${String(year).slice(-2)}`;
  const result = await run(`INSERT INTO sms_messages
    (received_at,bank_date,bank_time,receiving_account,amount_satang,parse_status,is_test)
    VALUES (?,?,?,?,?,?,?)`, [new Date(received).toISOString(), date, timeAt(at), account, amount, parsed, test]);
  return result.lastID;
}
async function counts(txid, status = 'PENDING', count = 0) {
  assert.equal((await get('SELECT status FROM payment_orders WHERE txid=?', [txid])).status, status);
  assert.equal((await get('SELECT COUNT(*) AS n FROM payment_receipts')).n, count);
}
async function slip(at = Date.now()) {
  return { sourceBank: 'TTB', extractionStatus: 'EXTRACTED', warnings: [],
    receivingBank: 'KBANK', receivingAccountSuffix: '4891', amountSatang: 2000,
    reference: '261023124535120900',
    transferDate: new Date(at + 7 * 3600000).toISOString().slice(0, 10), transferTime: timeAt(at) };
}
let server;
async function main() {
  // Temporary database only. No machine table, webhook, MQTT or real payments.
  const { initializeOrders } = require('./payment-orders.cjs');
  await initializeOrders(db);
  await exec(`CREATE TABLE sms_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT, received_at TEXT, bank_date TEXT, bank_time TEXT,
    receiving_account TEXT, amount_satang INTEGER, parse_status TEXT, is_test INTEGER
  );`);
  await initializeReceipts(db);
  let o = await order();
  let id = await sms();
  assert.equal((await verifyPaymentTime(o.txid, timeAt(Date.now()), options)).status, 'PAID');
  assert.equal((await get('SELECT slip_bank FROM payment_receipts')).slip_bank, 'SMS_TIME');
  assert.equal((await get('SELECT slip_reference FROM payment_receipts')).slip_reference, 'SMS:' + id);
  assert.equal((await verifyPaymentTime(o.txid, timeAt(Date.now()), options)).status, 'ALREADY_VERIFIED');
  await counts(o.txid, 'PAID', 1);
  const other = await order();
  await assert.rejects(verifyPaymentTime(other.txid, timeAt(Date.now()), options), /EVIDENCE_ALREADY_USED/);
  console.log('ผ่าน: กรอกเวลาจับคู่ยอดจากรายการ บันทึก PAID และส่งซ้ำไม่เพิ่มหลักฐาน');

  await reset(); o = await order(); await sms(); await sms();
  await assert.rejects(verifyPaymentTime(o.txid, timeAt(Date.now()), options), /SMS_AMBIGUOUS/);
  await counts(o.txid);
  for (const override of [ {amount: 1999}, {account: 'X-9999'}, {test: 0}, {parsed: 'UNPARSED'}, {received: Date.now()-3600000}, {at: Date.now()-86400000, received: Date.now()} ]) {
    await reset(); o = await order(); await sms(override);
    await assert.rejects(verifyPaymentTime(o.txid, timeAt(Date.now()), options), /SMS_NOT_FOUND/);
    await counts(o.txid);
  }
  await reset(); o = await order({expires:Date.now()-1, created:Date.now()-120001});
  await assert.rejects(verifyPaymentTime(o.txid, timeAt(Date.now()), options), /ORDER_EXPIRED/);
  await counts(o.txid);
  for (const invalid of ['24:00','12:60','1:15','12.45','',null]) {
    await assert.rejects(verifyPaymentTime(o.txid, invalid, options), /INVALID_PAYMENT_TIME/);
  }
  await reset(); o = await order();
  await assert.rejects(verifyPaymentTime(o.txid,timeAt(Date.now()-3600000),options), /PAYMENT_TIME_OUTSIDE_ORDER/);
  await counts(o.txid);
  console.log('ผ่าน: หลาย SMS ยอดผิด ผู้รับผิด วันผิด หมดเวลา และเวลาไม่ถูกต้อง ไม่อนุมัติ');

  await reset(); const a = await order(); const b = await order(); await sms();
  const race = await Promise.allSettled([a,b].map(x=>verifyPaymentTime(x.txid,timeAt(Date.now()),options)));
  assert.equal(race.filter(x=>x.status==='fulfilled').length,1);
  assert.equal((await get("SELECT COUNT(*) AS n FROM payment_orders WHERE status='PAID'")).n,1);
  await reset(); o = await order(); await sms();
  await exec(`CREATE TRIGGER fail_time_update BEFORE UPDATE OF status ON payment_orders
    WHEN NEW.status='PAID' BEGIN SELECT RAISE(ABORT,'SIMULATED_FAILURE'); END;`);
  await assert.rejects(verifyPaymentTime(o.txid,timeAt(Date.now()),options), /SIMULATED_FAILURE/);
  await counts(o.txid); await exec('DROP TRIGGER fail_time_update');
  console.log('ผ่าน: ยืนยันพร้อมกันใช้ SMS ได้ครั้งเดียว และผิดพลาดกลางทางย้อนกลับครบ');

  // Use a short simulated clock only in this isolated test process.
  const realNow = Date.now;
  try {
    const now = Date.parse('2026-10-23T00:00:30+07:00');
    Date.now = () => now;
    await reset(); o = await order({created:now-90000,expires:now+30000});
    await sms({at:now-60000,received:now-55000});
    assert.equal((await verifyPaymentTime(o.txid,'23:59',options)).status,'PAID');
  } finally { Date.now = realNow; }
  console.log('ผ่าน: รายการคร่อมเที่ยงคืนใช้วันที่จากรายการได้ถูกต้อง');

  await reset(); const s1=await order(); const s2=await order(); await sms();
  await verifyPendingPayment(s1.txid,await slip(),options);
  await assert.rejects(verifyPaymentTime(s2.txid,timeAt(Date.now()),options),/EVIDENCE_ALREADY_USED/);
  assert.equal((await verifyPaymentTime(s1.txid,timeAt(Date.now()),options)).status,'ALREADY_VERIFIED');
  await reset(); const t1=await order(); const t2=await order(); await sms();
  await verifyPaymentTime(t1.txid,timeAt(Date.now()),options);
  await assert.rejects(verifyPendingPayment(t2.txid,await slip(),options),/EVIDENCE_ALREADY_USED/);
  assert.equal((await get('SELECT COUNT(*) AS n FROM payment_receipts')).n,1);
  console.log('ผ่าน: สลิปเดิมและกรอกเวลาใช้ SMS ร่วมกันได้ แต่ใช้ซ้ำข้ามรายการไม่ได้');

  const app = express(); app.use(express.json()); app.use('/payments',createTimeRouter(options));
  server = await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  const post = async (txid,body) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/payments/${txid}/time`,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    return {status:res.status,body:await res.json()};
  };
  await reset(); o=await order(); await sms();
  for (const body of [{transferTime:timeAt(Date.now()),amount:1}, {transferTime:timeAt(Date.now()),isTest:false}, {}]) {
    assert.equal((await post(o.txid,body)).status,400);
    await counts(o.txid);
  }
  assert.equal((await post('bad',{transferTime:'14:15'})).body.code,'INVALID_TXID');
  assert.equal((await post(o.txid,{transferTime:timeAt(Date.now())})).body.status,'PAID');
  assert.equal((await post(o.txid,{transferTime:timeAt(Date.now())})).body.status,'ALREADY_VERIFIED');
  console.log('ผ่าน: API รับเฉพาะเวลา ไม่รับยอดหรือโหมดทดสอบจากหน้าเว็บ และไม่สั่งเครื่อง');
}
main().catch(err=>{console.error(err);process.exitCode=1;}).finally(async()=>{
  if(server) await new Promise(resolve=>server.close(resolve));
  await new Promise(resolve=>db.close(resolve));
  fs.rmSync(folder,{recursive:true,force:true});
});
