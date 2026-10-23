const assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),{randomUUID}=require('crypto');
const sqlite3=require('sqlite3').verbose(),express=require('express');
const {initializeOrders}=require('./payment-orders.cjs');
const {initializeReceipts}=require('./payment-receipts.cjs');
const {createDiscountService,assertNoDiscountMethod,assertBaseAmountAvailable}=require('./payment-discount.cjs');
const {createDiscountRouter}=require('./payment-discount-api.cjs');
const {createOmiseService}=require('./payment-omise.cjs');
const {verifyPaymentTime}=require('./payment-time-verify.cjs');
const {verifyPendingPayment}=require('./payment-verify.cjs');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'laundry-discount-'));
const dbPath=path.join(folder,'test.db'),db=new sqlite3.Database(dbPath);
db.configure('busyTimeout',5000);
const run=(sql,p=[])=>new Promise((resolve,reject)=>db.run(sql,p,function(e){e?reject(e):resolve(this)}));
const get=(sql,p=[])=>new Promise((resolve,reject)=>db.get(sql,p,(e,r)=>e?reject(e):resolve(r)));
const exec=sql=>new Promise((resolve,reject)=>db.exec(sql,e=>e?reject(e):resolve()));
const options={dbPath,isTest:true},service=createDiscountService(options);
let seq=0;
async function order({base=3000,type='wash',expires=Date.now()+90000}={}){
 const txid='TX'+randomUUID().replace(/-/g,''),machine='machine'+(++seq);
 const command={machine,type,amount:base/100,program:2,...(type==='wash'?{tempPulse:4,aromaPulse:1}:{temperatureOption:'high',wrinkleOption:true})};
 const created=Date.now()-30000;
 await run(`INSERT INTO payment_orders
  (txid,machine,service,program,options_json,amount_satang,price_snapshot_json,created_at,expires_at,status,is_test)
  VALUES (?,?,?,?,?,?,?, ?,?,'PENDING',1)`,
 [txid,machine,type,2,JSON.stringify({command}),base,JSON.stringify({source:'existing-react',amount:base/100,amountSatang:base}),created,expires]);
 await run("INSERT INTO machines VALUES (?,'ONLINE','RESERVED',?,?)",[machine,expires,txid]);
 return {txid,machine,command,created,expires};
}
async function sms(amount,{at=Date.now(),received=Date.now(),account='X-4891',test=1,parsed='PARSED'}={}){
 const thai=new Date(at+7*3600000).toISOString(),year=Number(thai.slice(0,4))+543;
 const date=`${thai.slice(8,10)}/${thai.slice(5,7)}/${String(year).slice(-2)}`;
 const r=await run(`INSERT INTO sms_messages
  (received_at,bank_date,bank_time,receiving_account,amount_satang,parse_status,is_test) VALUES (?,?,?,?,?,?,?)`,
 [new Date(received).toISOString(),date,thai.slice(11,16),account,amount,parsed,test]);
 return r.lastID;
}
async function reset(){
 await exec('DELETE FROM payment_receipts;DELETE FROM payment_random_discount;DELETE FROM payment_orders;DELETE FROM machines;DELETE FROM sms_messages;DELETE FROM transactions;');
}
async function main(){
 await initializeOrders(db);await initializeReceipts(db);
 await exec(`CREATE TABLE machines(machine TEXT PRIMARY KEY,status TEXT,state TEXT,reserved_until INTEGER,reservation_txid TEXT);
 CREATE TABLE sms_messages(id INTEGER PRIMARY KEY,received_at TEXT,bank_date TEXT,bank_time TEXT,receiving_account TEXT,amount_satang INTEGER,parse_status TEXT,is_test INTEGER);
 CREATE TABLE transactions(txid TEXT PRIMARY KEY,machine TEXT,amount INTEGER,status TEXT);`);
 let o=await order(),row=await service.assign(o.txid);
 assert.ok(row.discountSatang>=1&&row.discountSatang<=10);
 assert.equal(row.amountSatang,3000-row.discountSatang);
 assert.equal(row.reservedUntil,o.expires);
 assert.deepEqual(await service.assign(o.txid),row);
 let stored=await get('SELECT * FROM payment_orders WHERE txid=?',[o.txid]);
 assert.deepEqual(JSON.parse(stored.options_json).command,{...o.command,amount:row.amount});
 assert.equal(JSON.parse(stored.price_snapshot_json).amountSatang,3000);
 assert.equal((await get('SELECT reserved_until FROM machines WHERE machine=?',[o.machine])).reserved_until,o.expires);
 assert.equal((await service.check(o.txid)).status,'PENDING');
 console.log('ผ่าน: หักส่วนลดจากยอด React เดิม เก็บราคาเต็มและคำสั่งครบ สุ่มซ้ำได้ค่าเดิม ไม่ต่อเวลาจอง');

 await reset();const orders=[];
 for(let i=0;i<10;i++)orders.push(await order());
 const rows=await Promise.all(orders.map(x=>createDiscountService(options).assign(x.txid)));
 assert.equal(new Set(rows.map(x=>x.amountSatang)).size,10);
 const extra=await order();await assert.rejects(service.assign(extra.txid),/DISCOUNT_POOL_FULL/);
 assert.equal((await get('SELECT COUNT(*) AS n FROM payment_random_discount')).n,10);
 assert.equal((await get('SELECT amount_satang FROM payment_orders WHERE txid=?',[extra.txid])).amount_satang,3000);
 await assert.rejects(assertBaseAmountAvailable(db,rows[0].amountSatang,true),/PAYMENT_AMOUNT_RESERVED/);
 await run('UPDATE payment_orders SET expires_at=? WHERE txid=?',[Date.now()-1,orders[0].txid]);
 const reused=await service.assign(extra.txid);
 assert.equal(reused.amountSatang,rows[0].amountSatang);
 console.log('ผ่าน: สุ่มพร้อมกัน 10 รายการได้ยอดไม่ซ้ำ ครบแล้วไม่สุ่มทับ และหมดอายุคืนยอดให้รายการใหม่');

 await reset();o=await order();
 for(let d=1;d<=10;d++)if(d!==5)await order({base:3000-d});
 row=await service.assign(o.txid);assert.equal(row.amountSatang,2995);
 for(const override of [{amount:3000},{account:'X-9999'},{test:0},{parsed:'UNPARSED'},
  {at:Date.now()-86400000},{received:Date.now()-60000}]){
  await exec('DELETE FROM sms_messages');
  await sms(override.amount??2995,override);
  assert.equal((await service.check(o.txid)).status,'PENDING');
 }
 await exec('DELETE FROM sms_messages');await sms(2995);await sms(2995);
 await assert.rejects(service.check(o.txid),/SMS_AMBIGUOUS/);
 assert.equal((await get('SELECT COUNT(*) AS n FROM payment_receipts')).n,0);
 await exec('DELETE FROM sms_messages');const smsId=await sms(2995);
 const paid=await Promise.all([service.check(o.txid),service.check(o.txid)]);
 assert.ok(paid.every(x=>x.status==='PAID'));
 assert.equal((await get('SELECT COUNT(*) AS n FROM payment_receipts')).n,1);
 const proof=await get('SELECT * FROM payment_receipts');
 assert.equal(proof.sms_id,smsId);assert.equal(proof.slip_bank,'SMS_DISCOUNT');
 const next=await order();assert.equal((await service.assign(next.txid)).amountSatang,2995);
 assert.equal((await service.check(next.txid)).status,'PENDING');
 console.log('ผ่าน: ตรวจยอด บัญชี วันเวลา และโหมด SMS ถูกต้อง หลาย SMS ไม่เลือกเอง จ่ายแล้วคืนยอดและไม่ใช้หลักฐานซ้ำ');

 await reset();o=await order({type:'dry'});row=await service.assign(o.txid);
 stored=await get('SELECT * FROM payment_orders WHERE txid=?',[o.txid]);
 assert.deepEqual(JSON.parse(stored.options_json).command,{...o.command,amount:row.amount});
 await assert.rejects(assertNoDiscountMethod(db,o.txid),/PAYMENT_METHOD_LOCKED/);
 const thai=new Date(Date.now()+7*3600000).toISOString();
 await assert.rejects(verifyPaymentTime(o.txid,thai.slice(11,16),options),/PAYMENT_METHOD_LOCKED/);
 await assert.rejects(verifyPendingPayment(o.txid,{extractionStatus:'EXTRACTED',warnings:[],receivingBank:'KBANK',
  receivingAccountSuffix:'4891',amountSatang:row.amountSatang,reference:'261023124535120900',
  transferDate:thai.slice(0,10),transferTime:thai.slice(11,16)},options),/PAYMENT_METHOD_LOCKED/);
 await assert.rejects(createOmiseService({...options,provider:{create:()=>{throw new Error('MUST_NOT_CALL');}}}).create(o.txid),/PAYMENT_METHOD_LOCKED/);
 await sms(row.amountSatang);
 await exec(`CREATE TRIGGER fail_discount BEFORE UPDATE OF status ON payment_orders
  WHEN NEW.status='PAID' BEGIN SELECT RAISE(ABORT,'TEST_ROLLBACK'); END;`);
 await assert.rejects(service.check(o.txid),/TEST_ROLLBACK/);
 assert.equal((await get('SELECT COUNT(*) AS n FROM payment_receipts')).n,0);
 assert.equal((await get('SELECT status FROM payment_orders WHERE txid=?',[o.txid])).status,'PENDING');
 await exec('DROP TRIGGER fail_discount');
 await run('UPDATE payment_orders SET expires_at=? WHERE txid=?',[Date.now()-1,o.txid]);
 await assert.rejects(service.check(o.txid),/ORDER_EXPIRED/);
 console.log('ผ่าน: ตัวเลือกเครื่องอบคงเดิม ล็อกวิธีเมื่อสุ่มแล้ว หมดเวลาไม่อนุมัติ และข้อผิดพลาดย้อนกลับครบ');

 await reset();o=await order();
 await run("UPDATE machines SET status='OFFLINE' WHERE machine=?",[o.machine]);
 await assert.rejects(service.assign(o.txid),/RESERVATION_INVALID/);
 await run("UPDATE machines SET status='ONLINE',reservation_txid='OTHER' WHERE machine=?",[o.machine]);
 await assert.rejects(service.assign(o.txid),/RESERVATION_INVALID/);
 assert.equal((await get('SELECT COUNT(*) AS n FROM payment_random_discount')).n,0);
 await reset();o=await order();row=await service.assign(o.txid);
 // Corruption/another checkout path introducing a conflicting amount must fail closed.
 await order({base:row.amountSatang});await sms(row.amountSatang);
 await assert.rejects(service.check(o.txid),/DISCOUNT_AMOUNT_CONFLICT/);
 console.log('ผ่าน: ออฟไลน์ เจ้าของการจองไม่ตรง และยอดชนจากเส้นทางอื่น ไม่อนุมัติ');

 await reset();o=await order();
 await exec(`CREATE TRIGGER fail_assign BEFORE UPDATE OF amount_satang ON payment_orders
  BEGIN SELECT RAISE(ABORT,'ASSIGN_ROLLBACK'); END;`);
 await assert.rejects(service.assign(o.txid),/ASSIGN_ROLLBACK/);
 assert.equal((await get('SELECT COUNT(*) AS n FROM payment_random_discount')).n,0);
 assert.equal((await get('SELECT amount_satang FROM payment_orders WHERE txid=?',[o.txid])).amount_satang,3000);
 await exec('DROP TRIGGER fail_assign');
 const realNow=Date.now;
 try {
  let now=Date.parse('2026-10-23T23:59:30+07:00');Date.now=()=>now;
  await reset();o=await order();row=await service.assign(o.txid);
  now+=40000;await sms(row.amountSatang);
  assert.equal((await service.check(o.txid)).status,'PAID');
 }finally{Date.now=realNow;}
 console.log('ผ่าน: สุ่มผิดพลาดย้อนกลับทั้งยอดและส่วนลด และ SMS คร่อมเที่ยงคืนจับคู่ได้');

 await reset();o=await order();
 const Module=require('module'),oldLoad=Module._load;let authorizeWebhook;
 try{
  Module._load=function(req,parent,isMain){
   if(req==='./payment-checkout.cjs')return {createCheckout:()=>{throw new Error('UNUSED');}};
   return oldLoad.call(this,req,parent,isMain);
  };
  ({authorizeWebhook}=require('./payment-bridge.cjs'));
 }finally{Module._load=oldLoad;}
 let commands=0;
 const app=express();app.use(express.json());app.use('/payments',createDiscountRouter(options));
 app.post('/webhook',authorizeWebhook(db,{connected:true},{isTest:true}),(req,res)=>{
  commands++;assert.equal(req.body.tempPulse,4);assert.equal(req.body.aromaPulse,1);assert.equal(req.body.amount,row.amount);
  db.run('INSERT INTO transactions VALUES (?,?,?,?)',[req.body.txid,req.body.machine,req.body.amount,'SUCCESS'],e=>e?res.sendStatus(500):res.sendStatus(200));
 });
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 try{
  const base='http://127.0.0.1:'+server.address().port;
  const post=async(route,body)=>{const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
  assert.equal((await post('/webhook',{txid:o.txid})).status,403);
  assert.equal((await post('/payments/'+o.txid+'/discount',{discountSatang:99})).status,400);
  row=(await post('/payments/'+o.txid+'/discount',{})).body;
  await sms(row.amountSatang);
  let r=await fetch(base+'/payments/'+o.txid+'/discount');assert.equal((await r.json()).status,'PAID');
  assert.equal((await post('/webhook',{txid:o.txid,amount:1,tempPulse:999})).body.status,'COMMAND_SENT');
  assert.equal((await post('/webhook',{txid:o.txid})).body.duplicate,true);assert.equal(commands,1);
 }finally{await new Promise(resolve=>server.close(resolve));}
 console.log('ผ่าน: API ไม่รับยอดหรือส่วนลดจากลูกค้า จ่ายผ่านแล้วส่งคำสั่งเดิมได้ครั้งเดียว');
 console.log('ทุกกรณีใช้ฐานข้อมูลชั่วคราว ไม่โอนเงิน ไม่เรียก Omise และไม่ส่ง MQTT');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{
 await new Promise(resolve=>db.close(resolve));fs.rmSync(folder,{recursive:true,force:true});
});
