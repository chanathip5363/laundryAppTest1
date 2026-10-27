const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { createSessionRouter, authorizeWebhook } = require('./payment-bridge.cjs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'laundry-bridge-'));
const dbPath = path.join(dir, 'test.db');
const db = new sqlite3.Database(dbPath);
db.configure('busyTimeout', 5000);
let server;
let calls = 0;
let seen;
const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, err => err ? reject(err) : resolve());
});
const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
});
async function test() {
  await run('CREATE TABLE machines (machine TEXT PRIMARY KEY,state TEXT,status TEXT,reserved_until INTEGER,shop_id TEXT,machine_type TEXT,program_profile TEXT,enabled INTEGER NOT NULL DEFAULT 1)');
  await run("INSERT INTO machines (machine,state,status,reserved_until,shop_id,machine_type,program_profile) VALUES ('machine1','IDLE','ONLINE',NULL,'shop001','wash','toshibaA')");
  await run('CREATE TABLE sms_messages (id INTEGER PRIMARY KEY)');
  await run('CREATE TABLE transactions (txid TEXT PRIMARY KEY,machine TEXT,amount INTEGER,status TEXT)');
  const app = express();
  app.use(express.json());
  app.use('/payments', createSessionRouter({ dbPath, isTest: true }));
  // This is an isolated substitute for the old webhook; no MQTT is imported.
  app.post('/webhook', authorizeWebhook(db, { connected: true }, { isTest: true }), async (req, res) => {
    try {
      seen = req.body;
      await run('INSERT INTO transactions VALUES (?,?,?,?)', [seen.txid,seen.machine,seen.amount,'SUCCESS']);
      await run("UPDATE machines SET state='STARTING' WHERE machine=?", [seen.machine]);
      calls++;
      res.sendStatus(200);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const base = 'http://127.0.0.1:' + server.address().port;
  async function post(url, body) {
    const response = await fetch(base + url, { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    return { status:response.status, body:await response.json() };
  }
  const input = { machine:'machine1',type:'wash',program:1,amount:43,tempPulse:2,aromaPulse:1,tempOption:'40',aromaOption:true };
  await run("UPDATE machines SET enabled=0 WHERE machine='machine1'");
  const disabled = await post('/payments/session', input);
  assert.equal(disabled.status, 409);
  assert.equal(disabled.body.code, 'MACHINE_DISABLED');
  console.log('ผ่าน: เครื่องที่ปิดใช้งานไม่สามารถจองได้');
  await run("UPDATE machines SET enabled=1 WHERE machine='machine1'");

  const first = await post('/payments/session', input);
  assert.equal(first.status,201,JSON.stringify(first));
  assert.equal(first.body.amount,43);
  assert.equal(first.body.expiresAt-first.body.createdAt,120000);
  const txid=first.body.txid;
  const order=await get('SELECT * FROM payment_orders WHERE txid=?',[txid]);
  assert.deepEqual(JSON.parse(order.options_json).command,input);
  assert.equal(order.shop_id,'shop001');
  const snapshot = JSON.parse(order.price_snapshot_json);
  assert.equal(snapshot.source,'legacy');
  assert.equal(snapshot.basePrice,30);
  assert.equal(snapshot.temperaturePrice,8);
  assert.equal(snapshot.extraPrice,5);
  assert.equal(snapshot.amount,43);
  assert.equal(snapshot.amountSatang,4300);
  console.log('ผ่าน: Price Snapshot บันทึกราคาจาก Server ครบถ้วน');
  console.log('ผ่าน: payment_orders บันทึก shop_id = shop001');
  console.log('ผ่าน: เก็บยอดและคำสั่งเดิมของ React โดยไม่ใช้ตารางราคาใหม่ จอง 2 นาที');
  assert.equal((await post('/payments/session',input)).status,409);
  assert.equal((await post('/webhook',{txid})).status,403);
  assert.equal(calls,0);
  console.log('ผ่าน: จองซ้ำไม่ได้ และยังไม่ตรวจชำระจะเข้าเส้นทางสั่งเครื่องไม่ได้');
  await run('INSERT INTO sms_messages VALUES (1)');
  await run("INSERT INTO payment_receipts VALUES (?,1,'TTB','123456789012345',4300,?)",[txid,Date.now()]);
  await run("UPDATE payment_orders SET status='PAID' WHERE txid=?",[txid]);
  await run("UPDATE machines SET status='OFFLINE'");
  assert.equal((await post('/webhook',{txid})).body.code,'MACHINE_OFFLINE');
  await run("UPDATE machines SET status='ONLINE',reservation_txid='other'");
  assert.equal((await post('/webhook',{txid})).body.code,'RESERVATION_INVALID');
  await run('UPDATE machines SET reservation_txid=?,reserved_until=?',[txid,Date.now()-1]);
  assert.equal((await post('/webhook',{txid})).body.code,'RESERVATION_INVALID');
  assert.equal(calls,0);
  console.log('ผ่าน: ออฟไลน์ เจ้าของการจองไม่ตรง และการจองหมดเวลา ไม่สั่งเครื่อง');
  await run('UPDATE machines SET reserved_until=?',[order.expires_at]);
  const started=await post('/webhook',{txid,amount:1,program:99,tempPulse:99,aromaPulse:99,machine:'machine99'});
  assert.equal(started.status,200,JSON.stringify(started));
  assert.equal(started.body.success,true);
  assert.deepEqual(seen,{...input,txid});
  assert.equal(calls,1);
  const repeated=await post('/webhook',{txid});
  assert.equal(repeated.body.duplicate,true);
  assert.equal(calls,1);
  console.log('ผ่าน: ตรวจชำระแล้วใช้คำสั่งที่บันทึกไว้ ส่งซ้ำไม่สั่งเครื่องซ้ำ');
  await run("UPDATE machines SET state='IDLE',reserved_until=NULL");
  const changed={...input,amount:37.25,tempPulse:4};
  const next=await post('/payments/session',changed);
  assert.equal(next.status,409,JSON.stringify(next));
  assert.equal(next.body.code,'PAYMENT_AMOUNT_MISMATCH');
  console.log('ผ่าน: Server ปฏิเสธยอดที่ไม่ตรงกับราคาจริง');
}
async function main() {
  try { await test(); }
  finally {
    if(server) await new Promise(resolve=>server.close(resolve));
    await new Promise((resolve,reject)=>db.close(err=>err?reject(err):resolve()));
    fs.rmSync(dir,{recursive:true,force:true});
  }
}
main().catch(err=>{console.error(err);process.exitCode=1;});
