const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { initializeOrders } = require('./payment-orders.cjs');
const { initializeReceipts } = require('./payment-receipts.cjs');
const { parseBblSlip } = require('./slip-bbl.cjs');
const { verifyPendingPayment } = require('./payment-verify.cjs');
const { createSlipRouter } = require('./payment-slip-api.cjs');

async function main() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'laundry-bbl-'));
  const dbPath = path.join(folder, 'test.db');
  let db, server;
  try {
    db = await new Promise((resolve, reject) => {
      const connection = new sqlite3.Database(dbPath,
        err => err ? reject(err) : resolve(connection));
    });
    db.configure('busyTimeout', 5000);
    const run = (sql, values = []) => new Promise((resolve, reject) => {
      db.run(sql, values, err => err ? reject(err) : resolve());
    });
    const get = (sql, values = []) => new Promise((resolve, reject) => {
      db.get(sql, values, (err, row) => err ? reject(err) : resolve(row));
    });
    await initializeOrders(db);
    await run(`CREATE TABLE sms_messages (
      id INTEGER PRIMARY KEY, is_test INTEGER, parse_status TEXT,
      receiving_account TEXT, amount_satang INTEGER,
      bank_time TEXT, bank_date TEXT, received_at TEXT
    )`);
    await initializeReceipts(db);

    const now = Date.now();
    const thai = new Date(now + 7 * 3600000).toISOString();
    const transferDate = thai.slice(0, 10);
    const transferTime = thai.slice(11, 16);
    const [year, month, day] = transferDate.split('-');
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const be = Number(year) + 543;
    const dateLine = `${Number(day)} ${months[Number(month) - 1]} ${String(be).slice(-2)}, ${transferTime}`;
    const reference = '2026102301412323007446508';
    const raw = `Bangkok Bank\nรายการสําเร็จ\n${dateLine}\nจํานวนเงิน\n20.00าก6ธ\nK Plus Wallet\n00499-925-431-2902\nหมายเลขอ้างอิง\n513916\nเลขที่อ้างอิง\n${reference}\nสแกนเพื่อตรวจสอบ\n`;
    const ocr = { rawText: raw, dateLineFirst: dateLine, dateLine, warnings: [] };
    const slip = parseBblSlip(ocr, '20.00');
    assert.equal(slip.extractionStatus, 'EXTRACTED');
    assert.equal(slip.transferDate, transferDate);
    assert.equal(slip.transferTime, transferTime);
    assert.equal(slip.amountSatang, 2000);
    assert.equal(slip.reference, reference);
    assert.equal(slip.receivingWalletId, '004999254312902');
    for (const [changed, amount] of [
      [{ ...ocr, rawText: raw.replace('00499-925-431-2902', '00499-925-431-2903') }, '20.00'],
      [{ ...ocr, dateLine: `32 ต.ค. 69, 01:41`, dateLineFirst: `32 ต.ค. 69, 01:41` }, '20.00'],
      [{ ...ocr, rawText: raw.replace('เลขที่อ้างอิง', 'ไม่มีเลขที่') }, '20.00'],
      [{ ...ocr, rawText: raw + `เลขที่อ้างอิง\n${reference}\n` }, '20.00'],
      [ocr, '20.00.'],
      [{ ...ocr, warnings: ['DATE_LINE_NOT_UNIQUE'] }, '20.00']
    ]) assert.equal(parseBblSlip(changed, amount).extractionStatus, 'REVIEW_REQUIRED');
    const dottedDate = dateLine.replace(/:(\d{2})$/, '.$1');
    const fallbackOcr = {
      ...ocr, dateLineFirst: null, dateLine: null,
      rawText: raw.replaceAll(dateLine, dottedDate),
      warnings: ['DATE_LINE_NOT_UNIQUE']
    };
    const recovered = parseBblSlip(fallbackOcr, '20.00');
    assert.equal(recovered.extractionStatus, 'EXTRACTED');
    assert.equal(recovered.transferTime, transferTime);
    assert.equal(recovered.transferDate, transferDate);
    assert.equal(parseBblSlip({ ...fallbackOcr,
      rawText: fallbackOcr.rawText + '\n' + dottedDate
    }, '20.00').extractionStatus, 'REVIEW_REQUIRED');
    assert.equal(parseBblSlip({ ...fallbackOcr,
      rawText: fallbackOcr.rawText.replace(dottedDate, '32 ต.ค. 69, 03.14')
    }, '20.00').extractionStatus, 'REVIEW_REQUIRED');
    assert.equal(parseBblSlip({ ...fallbackOcr,
      warnings: ['DATE_LINE_NOT_UNIQUE', 'OTHER_WARNING']
    }, '20.00').extractionStatus, 'REVIEW_REQUIRED');
    console.log('ผ่าน: เวลาแบบจุดอ่านได้ และยังปฏิเสธวันเวลาผิดหรือหลายบรรทัด');
    console.log('ผ่าน: อ่านข้อมูลกรุงเทพ และไม่อนุมัติข้อมูลไม่ครบหรือผู้รับผิด');

    const txid = 'TX' + 'b'.repeat(32);
    const txid2 = 'TX' + 'c'.repeat(32);
    const ttbId = 'TX' + 'd'.repeat(32);
    async function order(id, amount) {
      await run(`INSERT INTO payment_orders
        (txid, machine, service, program, options_json, amount_satang,
         price_snapshot_json, created_at, expires_at, status, is_test)
        VALUES (?, 'machine1', 'wash', 1, '{}', ?, '{}', ?, ?, 'PENDING', 1)`,
      [id, amount, now - 1000, now + 120000]);
    }
    async function sms(id, amount) {
      await run(`INSERT INTO sms_messages VALUES (?, 1, 'PARSED', 'X-4891', ?, ?, ?, ?)`,
        [id, amount, transferTime, `${day}/${month}/${String(be).slice(-2)}`, new Date(now).toISOString()]);
    }
    await order(txid, 2000);
    await sms(1, 2000);

    const app = express();
    app.use('/payments', createSlipRouter({ dbPath, isTest: true,
      readSlipImpl: async () => ocr }));
    server = await new Promise(resolve => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    const original = fs.readFileSync(path.join(__dirname,
      'private-slips/D6DAFA5E-7AEC-40E2-9686-E0202A916D2F.jpg'));
    const form = new FormData();
    form.append('slip', new Blob([original], { type: 'image/jpeg' }), 'bbl.jpg');
    const response = await fetch(`http://127.0.0.1:${server.address().port}/payments/${txid}/slip`, {
      method: 'POST', body: form, signal: AbortSignal.timeout(90000)
    });
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(body.status, 'PAID');
    assert.equal((await get('SELECT slip_bank FROM payment_receipts WHERE txid = ?', [txid])).slip_bank, 'BBL');
    console.log('ผ่าน: ช่องแนบสลิปเรียกตัวอ่านกรุงเทพ อ่านยอดจากภาพ และบันทึกหลักฐานเป็น BBL');

    const options = { dbPath, isTest: true };
    assert.equal((await verifyPendingPayment(txid, slip, options)).status, 'ALREADY_VERIFIED');
    await order(txid2, 2000);
    await assert.rejects(verifyPendingPayment(txid2, slip, options), /EVIDENCE_ALREADY_USED/);
    assert.equal((await get('SELECT COUNT(*) AS n FROM payment_receipts')).n, 1);
    assert.equal((await get('SELECT status FROM payment_orders WHERE txid = ?', [txid2])).status, 'PENDING');
    await assert.rejects(verifyPendingPayment(txid, { ...slip, sourceBank: 'UNKNOWN' }, options), /INVALID_EVIDENCE/);
    console.log('ผ่าน: ส่งซ้ำได้ผลเดิม และใช้ SMS หรือหลักฐานกรุงเทพกับรายการอื่นไม่ได้');

    await order(ttbId, 2100);
    await sms(2, 2100);
    const ttbSlip = { ...slip, amountSatang: 2100, reference: '261023014326651344' };
    delete ttbSlip.sourceBank;
    assert.equal((await verifyPendingPayment(ttbId, ttbSlip, options)).status, 'PAID');
    assert.equal((await get('SELECT slip_bank FROM payment_receipts WHERE txid = ?', [ttbId])).slip_bank, 'TTB');
    await assert.rejects(verifyPendingPayment(ttbId, { ...ttbSlip, sourceBank: 'BBL' }, options), /ORDER_ALREADY_HAS_EVIDENCE/);
    console.log('ผ่าน: หลักฐาน TTB เดิมยังใช้ได้ และไม่สับสนกับธนาคารกรุงเทพ');
    console.log('การทดสอบทั้งหมดใช้ฐานข้อมูลชั่วคราว ไม่เรียก webhook และไม่ส่ง MQTT');
  } finally {
    if (server) await new Promise(resolve => {
      server.close(resolve);
      server.closeAllConnections();
    });
    if (db) await new Promise((resolve, reject) => db.close(err => err ? reject(err) : resolve()));
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

main().catch(err => { console.error(err); process.exitCode = 1; });
