const assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const {randomUUID}=require('crypto');
const sqlite3=require('sqlite3').verbose();
const express=require('express');
const {initializeOrders}=require('./payment-orders.cjs');
const {initializeReceipts}=require('./payment-receipts.cjs');
const {createOmiseService,getOmiseReceipt,assertSmsMethod}=require('./payment-omise.cjs');
const {createOmiseRouter}=require('./payment-omise-api.cjs');
const {verifyPaymentTime}=require('./payment-time-verify.cjs');
const {verifyPendingPayment}=require('./payment-verify.cjs');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'laundry-omise-'));
const dbPath=path.join(folder,'test.db');
const db=new sqlite3.Database(dbPath);db.configure('busyTimeout',5000);
const run=(sql,params=[])=>new Promise((resolve,reject)=>db.run(sql,params,function(e){e?reject(e):resolve(this)}));
const get=(sql,params=[])=>new Promise((resolve,reject)=>db.get(sql,params,(e,r)=>e?reject(e):resolve(r)));
const exec=sql=>new Promise((resolve,reject)=>db.exec(sql,e=>e?reject(e):resolve()));
let creates=0,retrieves=0,charges=new Map(),rejectCreate=false;
const provider={
 async create(order){
  creates++;if(rejectCreate)throw new Error('OMISE_UNAVAILABLE');
  const id='chrg_test_'+randomUUID().replace(/-/g,'');
  const charge={object:'charge',id,livemode:false,amount:order.amount_satang,currency:'THB',
   source:{type:'promptpay',scannable_code:{image:{download_uri:'https://api.omise.co/test-qr/'+id}}},
   metadata:{laundry_txid:order.txid},status:'pending',paid:false,paid_at:null};
  charges.set(id,charge);return charge;
 },
 async retrieve(id){retrieves++;return charges.get(id);}
};
const options={dbPath,isTest:true,provider};
const service=createOmiseService(options);
const txid=()=> 'TX'+randomUUID().replace(/-/g,'');
async function order({amount=2000,expires=Date.now()+90000}={}){
 const id=txid();
 await run(`INSERT INTO payment_orders
  (txid,machine,service,program,options_json,amount_satang,price_snapshot_json,created_at,expires_at,status,is_test)
  VALUES (?,'machine1','wash',1,?,?,'{}',?,?,'PENDING',1)`,
 [id,JSON.stringify({command:{machine:'machine1',type:'wash',program:1,amount:amount/100,tempPulse:2,aromaPulse:1}}),amount,Date.now()-30000,expires]);
 await run(`INSERT OR REPLACE INTO machines VALUES ('machine1','ONLINE','RESERVED',?,?)`,[expires,id]);
 return id;
}
async function sms(){
 const now=Date.now(),thai=new Date(now+7*3600000).toISOString(),year=Number(thai.slice(0,4))+543;
 const date=`${thai.slice(8,10)}/${thai.slice(5,7)}/${String(year).slice(-2)}`;
 return run(`INSERT INTO sms_messages VALUES (NULL,?,?,?,?,2000,'PARSED',1)`,
  [new Date(now).toISOString(),date,thai.slice(11,16),'X-4891']);
}
async function reset(){
 await exec('DELETE FROM payment_receipts;DELETE FROM payment_omise_test;DELETE FROM sms_messages;DELETE FROM payment_orders;DELETE FROM machines;');
 creates=0;retrieves=0;charges.clear();rejectCreate=false;
}
async function paid(id){const charge=charges.get(id);charge.status='successful';charge.paid=true;charge.paid_at=new Date().toISOString();}
async function main(){
 await initializeOrders(db);await initializeReceipts(db);
 await exec(`CREATE TABLE machines(machine TEXT PRIMARY KEY,status TEXT,state TEXT,reserved_until INTEGER,reservation_txid TEXT);
 CREATE TABLE sms_messages(id INTEGER PRIMARY KEY,received_at TEXT,bank_date TEXT,bank_time TEXT,receiving_account TEXT,amount_satang INTEGER,parse_status TEXT,is_test INTEGER);
 CREATE TABLE transactions(txid TEXT PRIMARY KEY,machine TEXT,amount INTEGER,status TEXT);`);
 let id=await order();
 const raced=await Promise.allSettled([service.create(id),service.create(id)]);
 assert.ok(raced.some(x=>x.status==='fulfilled'));assert.equal(creates,1);
 const created=await service.create(id);assert.equal(creates,1);assert.equal(created.testMode,true);
 assert.equal((await service.refresh(id)).status,'pending');
 assert.equal((await get('SELECT status FROM payment_orders WHERE txid=?',[id])).status,'PENDING');
 assert.equal(await getOmiseReceipt(db,id),undefined);
 await sms();const now=Date.now(),thai=new Date(now+7*3600000).toISOString();
 await assert.rejects(assertSmsMethod(db,id),/PAYMENT_METHOD_LOCKED/);
 await assert.rejects(verifyPaymentTime(id,thai.slice(11,16),{dbPath,isTest:true}),/PAYMENT_METHOD_LOCKED/);
 await assert.rejects(verifyPendingPayment(id,{extractionStatus:'EXTRACTED',warnings:[],receivingBank:'KBANK',
  receivingAccountSuffix:'4891',amountSatang:2000,reference:'261023124535120900',transferDate:thai.slice(0,10),transferTime:thai.slice(11,16)},
  {dbPath,isTest:true}),/PAYMENT_METHOD_LOCKED/);
 console.log('ผ่าน: สร้างรายการ Omise เฉพาะ txid ใช้ยอดเดิม สร้างพร้อมกันไม่ซ้ำ และล็อกการยืนยันด้วย SMS');
 const charge=charges.get(created.chargeId);
 for(const mutation of [ {amount:1}, {livemode:true}, {currency:'USD'}, {metadata:{laundry_txid:txid()}}, {source:{type:'card'}}, {id:'chrg_test_wrong'} ]){
  const original={...charge};Object.assign(charge,mutation);
  await assert.rejects(service.refresh(id),/OMISE_RESPONSE_INVALID/);
  Object.assign(charge,original);
  assert.equal((await get('SELECT status FROM payment_orders WHERE txid=?',[id])).status,'PENDING');
 }
 await paid(created.chargeId);
 const completed=await Promise.all([service.refresh(id),service.refresh(id)]);
 assert.ok(completed.every(x=>x.status==='PAID'));
 assert.equal((await getOmiseReceipt(db,id)).amount_satang,2000);
 assert.equal((await get('SELECT COUNT(*) AS n FROM payment_receipts')).n,0);
 await service.webhook(created.chargeId);assert.equal((await service.refresh(id)).status,'PAID');
 assert.equal((await get('SELECT COUNT(*) AS n FROM payment_omise_test WHERE verified_at IS NOT NULL')).n,1);
 console.log('ผ่าน: รับเฉพาะ charge Test ที่ยอด สกุลเงิน ประเภท และ txid ตรงกัน จึงบันทึก PAID แยกจาก SMS');
 await reset();id=await order();let row=await service.create(id);await paid(row.chargeId);
 await exec(`CREATE TRIGGER omise_fail BEFORE UPDATE OF status ON payment_orders
 WHEN NEW.status='PAID' BEGIN SELECT RAISE(ABORT,'TEST_ROLLBACK'); END;`);
 await assert.rejects(service.refresh(id),/TEST_ROLLBACK/);
 assert.equal((await get('SELECT verified_at FROM payment_omise_test')).verified_at,null);
 await exec('DROP TRIGGER omise_fail');
 await run('UPDATE payment_orders SET expires_at=? WHERE txid=?',[Date.now()-1,id]);
 await assert.rejects(service.refresh(id),/ORDER_EXPIRED/);
 await reset();id=await order();rejectCreate=true;
 await assert.rejects(service.create(id),/OMISE_UNAVAILABLE/);
 await assert.rejects(service.create(id),/OMISE_CREATING/);assert.equal(creates,1);
 await reset();id=await order({amount:1999});
 await assert.rejects(service.create(id),/OMISE_MINIMUM_AMOUNT/);assert.equal(creates,0);
 console.log('ผ่าน: หมดเวลาไม่อนุมัติ ผิดพลาดย้อนกลับครบ และไม่สร้าง charge ซ้ำเมื่อผลเครือข่ายไม่แน่นอน');
 await reset();id=await order();
 const Module=require('module'),originalLoad=Module._load;
 let authorizeWebhook;
 try{
  Module._load=function(request,parent,isMain){
   if(request==='./payment-checkout.cjs') return {createCheckout:()=>{throw new Error('UNUSED_IN_TEST');}};
   return originalLoad.call(this,request,parent,isMain);
  };
  ({authorizeWebhook}=require('./payment-bridge.cjs'));
 } finally{Module._load=originalLoad;}
 const app=express();app.use(express.json());app.use('/payments',createOmiseRouter(options));
 let commands=0;
 app.post('/webhook',authorizeWebhook(db,{connected:true},{isTest:true}),(req,res)=>{
  assert.equal(req.body.machine,'machine1');assert.equal(req.body.amount,20);
  assert.equal(req.body.tempPulse,2);assert.equal(req.body.aromaPulse,1);
  commands++;
  db.run('INSERT INTO transactions VALUES (?,?,?,?)',[req.body.txid,req.body.machine,req.body.amount,'SUCCESS'],
   err=>err?res.sendStatus(500):res.sendStatus(200));
 });
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 try{
  const base='http://127.0.0.1:'+server.address().port;
  const post=async(route,body)=>{
   const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   const text=await r.text();return {status:r.status,body:text==='OK'?{}:JSON.parse(text)};
  };
  assert.equal((await post('/payments/'+id+'/omise',{amount:1})).status,400);
  assert.equal((await post('/webhook',{txid:id})).status,403);
  row=(await post('/payments/'+id+'/omise',{})).body;
  assert.equal(row.testMode,true);
  await post('/payments/omise/webhook',{key:'charge.complete',data:{id:row.chargeId,status:'successful',paid:true}});
  assert.ok(retrieves>0);
  assert.equal((await get('SELECT status FROM payment_orders WHERE txid=?',[id])).status,'PENDING');
  await paid(row.chargeId);
  assert.equal((await post('/payments/omise/webhook',{key:'charge.complete',data:{id:row.chargeId}})).status,200);
  assert.equal((await get('SELECT status FROM payment_orders WHERE txid=?',[id])).status,'PAID');
  assert.equal((await post('/webhook',{txid:id,amount:1,tempPulse:999})).body.status,'COMMAND_SENT');
  assert.equal((await post('/webhook',{txid:id})).body.duplicate,true);
  assert.equal(commands,1);
  console.log('ผ่าน: Webhook ปลอมสถานะไม่ได้ ดึงผลจาก provider และส่งต่อคำสั่งเดิมได้ครั้งเดียว');
 }finally{await new Promise(resolve=>server.close(resolve));}
 console.log('ทุกกรณีใช้ฐานข้อมูลชั่วคราวและ provider จำลอง ไม่อ่านคีย์จริง ไม่เรียก Omise จริง และไม่สั่งเครื่อง');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{
 await new Promise(resolve=>db.close(resolve));fs.rmSync(folder,{recursive:true,force:true});
});
