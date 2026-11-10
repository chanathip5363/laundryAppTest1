const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = __dirname;
const files = {"slip-bbl.cjs": "const sharp = require('sharp');\nconst path = require('path');\nconst { createWorker, PSM } = require('tesseract.js');\n\nfunction parseBblSlip(ocr, amountText) {\n  const warnings = [...(ocr.warnings || [])];\n  const raw = String(ocr.rawText || '');\n  const result = {\n    sourceBank: 'BBL', transferDate: null, transferTime: null,\n    amountSatang: null, receivingWalletId: null,\n    receivingAccountSuffix: null, receivingBank: null, reference: null\n  };\n  if (!/Bangkok\\s+Bank/i.test(raw) || /\\bttb\\b/i.test(raw)) {\n    warnings.push('SOURCE_BANK_UNCLEAR');\n  }\n  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',\n    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];\n  const dates = new Map();\n  for (const line of [ocr.dateLineFirst, ocr.dateLine]) {\n    const m = String(line || '').trim().match(\n      /^(\\d{1,2})\\s+(\\S+)\\s+(\\d{2}|\\d{4}),?\\s+([01]\\d|2[0-3]):([0-5]\\d)(?:\\s*น\\.?)?$/\n    );\n    if (!m) continue;\n    const month = months.indexOf(m[2]);\n    const be = Number(m[3]) + (m[3].length === 2 ? 2500 : 0);\n    const year = be - 543;\n    if (month < 0 || be < 2500) continue;\n    const d = new Date(Date.UTC(year, month, Number(m[1])));\n    if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month ||\n        d.getUTCDate() !== Number(m[1])) continue;\n    const date = d.toISOString().slice(0, 10);\n    const time = m[4] + ':' + m[5];\n    dates.set(date + ' ' + time, { transferDate: date, transferTime: time });\n  }\n  if (dates.size === 1) Object.assign(result, [...dates.values()][0]);\n  else warnings.push(dates.size > 1 ? 'DATE_CONFLICT' : 'DATE_INVALID');\n\n  const money = String(amountText || '').trim().match(/^(\\d+)\\.(\\d{2})$/);\n  if (money) {\n    const amount = Number(money[1]) * 100 + Number(money[2]);\n    if (Number.isSafeInteger(amount) && amount > 0) result.amountSatang = amount;\n  }\n  if (result.amountSatang === null) warnings.push('AMOUNT_UNCLEAR');\n\n  const lines = raw.split(/\\r?\\n/).map(s => s.trim()).filter(Boolean);\n  const wallets = lines.map(s => s.replace(/[\\s-]/g, ''))\n    .filter(s => /^\\d{15}$/.test(s));\n  if (/K\\s*Plus\\s*Wallet/i.test(raw) && wallets.length === 1 &&\n      wallets[0] === '004999254312902') {\n    result.receivingWalletId = wallets[0];\n    result.receivingAccountSuffix = '4891';\n    result.receivingBank = 'KBANK';\n  } else warnings.push('RECEIVER_UNCLEAR');\n\n  const references = [...raw.matchAll(\n    /(?:^|\\n)\\s*เลขที่อ้างอิง\\s*\\n\\s*(\\d{10,40})\\s*(?=\\n|$)/g\n  )];\n  if (references.length === 1) result.reference = references[0][1];\n  else warnings.push('REFERENCE_UNCLEAR');\n\n  return { ...result, extractionStatus: warnings.length ? 'REVIEW_REQUIRED' : 'EXTRACTED', warnings };\n}\n\nasync function readBblSlip(image, ocr) {\n  let worker;\n  try {\n    // This crop is for the Bangkok Bank slip layout tested with the owner.\n    const { width, height } = await sharp(image).metadata();\n    const crop = await sharp(image).extract({\n      left: Math.round(width * 0.35), top: Math.round(height * 0.335),\n      width: Math.round(width * 0.21), height: Math.round(height * 0.035)\n    }).resize({ width: 800 }).png().toBuffer();\n    worker = await createWorker('eng', 1, {\n      cachePath: path.join(__dirname, 'private-slips')\n    });\n    await worker.setParameters({\n      tessedit_pageseg_mode: PSM.SINGLE_LINE,\n      tessedit_char_whitelist: '0123456789.'\n    });\n    const result = await worker.recognize(crop);\n    return parseBblSlip(ocr, result.data.text);\n  } catch (err) {\n    console.error('[BBL OCR ERROR]', err.message);\n    throw new Error('OCR_FAILED');\n  } finally {\n    if (worker) await worker.terminate();\n  }\n}\n\nmodule.exports = { parseBblSlip, readBblSlip };\n", "payment-bbl.test.cjs": "const assert = require('node:assert/strict');\nconst fs = require('fs');\nconst os = require('os');\nconst path = require('path');\nconst express = require('express');\nconst sqlite3 = require('sqlite3').verbose();\nconst { initializeOrders } = require('./payment-orders.cjs');\nconst { initializeReceipts } = require('./payment-receipts.cjs');\nconst { parseBblSlip } = require('./slip-bbl.cjs');\nconst { verifyPendingPayment } = require('./payment-verify.cjs');\nconst { createSlipRouter } = require('./payment-slip-api.cjs');\n\nasync function main() {\n  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'laundry-bbl-'));\n  const dbPath = path.join(folder, 'test.db');\n  let db, server;\n  try {\n    db = await new Promise((resolve, reject) => {\n      const connection = new sqlite3.Database(dbPath,\n        err => err ? reject(err) : resolve(connection));\n    });\n    db.configure('busyTimeout', 5000);\n    const run = (sql, values = []) => new Promise((resolve, reject) => {\n      db.run(sql, values, err => err ? reject(err) : resolve());\n    });\n    const get = (sql, values = []) => new Promise((resolve, reject) => {\n      db.get(sql, values, (err, row) => err ? reject(err) : resolve(row));\n    });\n    await initializeOrders(db);\n    await run(`CREATE TABLE sms_messages (\n      id INTEGER PRIMARY KEY, is_test INTEGER, parse_status TEXT,\n      receiving_account TEXT, amount_satang INTEGER,\n      bank_time TEXT, bank_date TEXT, received_at TEXT\n    )`);\n    await initializeReceipts(db);\n\n    const now = Date.now();\n    const thai = new Date(now + 7 * 3600000).toISOString();\n    const transferDate = thai.slice(0, 10);\n    const transferTime = thai.slice(11, 16);\n    const [year, month, day] = transferDate.split('-');\n    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',\n      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];\n    const be = Number(year) + 543;\n    const dateLine = `${Number(day)} ${months[Number(month) - 1]} ${String(be).slice(-2)}, ${transferTime}`;\n    const reference = '2026102301412323007446508';\n    const raw = `Bangkok Bank\\nรายการสําเร็จ\\n${dateLine}\\nจํานวนเงิน\\n20.00าก6ธ\\nK Plus Wallet\\n00499-925-431-2902\\nหมายเลขอ้างอิง\\n513916\\nเลขที่อ้างอิง\\n${reference}\\nสแกนเพื่อตรวจสอบ\\n`;\n    const ocr = { rawText: raw, dateLineFirst: dateLine, dateLine, warnings: [] };\n    const slip = parseBblSlip(ocr, '20.00');\n    assert.equal(slip.extractionStatus, 'EXTRACTED');\n    assert.equal(slip.transferDate, transferDate);\n    assert.equal(slip.transferTime, transferTime);\n    assert.equal(slip.amountSatang, 2000);\n    assert.equal(slip.reference, reference);\n    assert.equal(slip.receivingWalletId, '004999254312902');\n    for (const [changed, amount] of [\n      [{ ...ocr, rawText: raw.replace('00499-925-431-2902', '00499-925-431-2903') }, '20.00'],\n      [{ ...ocr, dateLine: `32 ต.ค. 69, 01:41`, dateLineFirst: `32 ต.ค. 69, 01:41` }, '20.00'],\n      [{ ...ocr, rawText: raw.replace('เลขที่อ้างอิง', 'ไม่มีเลขที่') }, '20.00'],\n      [{ ...ocr, rawText: raw + `เลขที่อ้างอิง\\n${reference}\\n` }, '20.00'],\n      [ocr, '20.00.'],\n      [{ ...ocr, warnings: ['DATE_LINE_NOT_UNIQUE'] }, '20.00']\n    ]) assert.equal(parseBblSlip(changed, amount).extractionStatus, 'REVIEW_REQUIRED');\n    console.log('ผ่าน: อ่านข้อมูลกรุงเทพ และไม่อนุมัติข้อมูลไม่ครบหรือผู้รับผิด');\n\n    const txid = 'TX' + 'b'.repeat(32);\n    const txid2 = 'TX' + 'c'.repeat(32);\n    const ttbId = 'TX' + 'd'.repeat(32);\n    async function order(id, amount) {\n      await run(`INSERT INTO payment_orders\n        (txid, machine, service, program, options_json, amount_satang,\n         price_snapshot_json, created_at, expires_at, status, is_test)\n        VALUES (?, 'machine1', 'wash', 1, '{}', ?, '{}', ?, ?, 'PENDING', 1)`,\n      [id, amount, now - 1000, now + 120000]);\n    }\n    async function sms(id, amount) {\n      await run(`INSERT INTO sms_messages VALUES (?, 1, 'PARSED', 'X-4891', ?, ?, ?, ?)`,\n        [id, amount, transferTime, `${day}/${month}/${String(be).slice(-2)}`, new Date(now).toISOString()]);\n    }\n    await order(txid, 2000);\n    await sms(1, 2000);\n\n    const app = express();\n    app.use('/payments', createSlipRouter({ dbPath, isTest: true,\n      readSlipImpl: async () => ocr }));\n    server = await new Promise(resolve => {\n      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));\n    });\n    const original = fs.readFileSync(path.join(__dirname,\n      'private-slips/D6DAFA5E-7AEC-40E2-9686-E0202A916D2F.jpg'));\n    const form = new FormData();\n    form.append('slip', new Blob([original], { type: 'image/jpeg' }), 'bbl.jpg');\n    const response = await fetch(`http://127.0.0.1:${server.address().port}/payments/${txid}/slip`, {\n      method: 'POST', body: form, signal: AbortSignal.timeout(90000)\n    });\n    const body = await response.json();\n    assert.equal(response.status, 200, JSON.stringify(body));\n    assert.equal(body.status, 'PAID');\n    assert.equal((await get('SELECT slip_bank FROM payment_receipts WHERE txid = ?', [txid])).slip_bank, 'BBL');\n    console.log('ผ่าน: ช่องแนบสลิปเรียกตัวอ่านกรุงเทพ อ่านยอดจากภาพ และบันทึกหลักฐานเป็น BBL');\n\n    const options = { dbPath, isTest: true };\n    assert.equal((await verifyPendingPayment(txid, slip, options)).status, 'ALREADY_VERIFIED');\n    await order(txid2, 2000);\n    await assert.rejects(verifyPendingPayment(txid2, slip, options), /EVIDENCE_ALREADY_USED/);\n    assert.equal((await get('SELECT COUNT(*) AS n FROM payment_receipts')).n, 1);\n    assert.equal((await get('SELECT status FROM payment_orders WHERE txid = ?', [txid2])).status, 'PENDING');\n    await assert.rejects(verifyPendingPayment(txid, { ...slip, sourceBank: 'UNKNOWN' }, options), /INVALID_EVIDENCE/);\n    console.log('ผ่าน: ส่งซ้ำได้ผลเดิม และใช้ SMS หรือหลักฐานกรุงเทพกับรายการอื่นไม่ได้');\n\n    await order(ttbId, 2100);\n    await sms(2, 2100);\n    const ttbSlip = { ...slip, amountSatang: 2100, reference: '261023014326651344' };\n    delete ttbSlip.sourceBank;\n    assert.equal((await verifyPendingPayment(ttbId, ttbSlip, options)).status, 'PAID');\n    assert.equal((await get('SELECT slip_bank FROM payment_receipts WHERE txid = ?', [ttbId])).slip_bank, 'TTB');\n    await assert.rejects(verifyPendingPayment(ttbId, { ...ttbSlip, sourceBank: 'BBL' }, options), /ORDER_ALREADY_HAS_EVIDENCE/);\n    console.log('ผ่าน: หลักฐาน TTB เดิมยังใช้ได้ และไม่สับสนกับธนาคารกรุงเทพ');\n    console.log('การทดสอบทั้งหมดใช้ฐานข้อมูลชั่วคราว ไม่เรียก webhook และไม่ส่ง MQTT');\n  } finally {\n    if (server) await new Promise(resolve => {\n      server.close(resolve);\n      server.closeAllConnections();\n    });\n    if (db) await new Promise((resolve, reject) => db.close(err => err ? reject(err) : resolve()));\n    fs.rmSync(folder, { recursive: true, force: true });\n  }\n}\n\nmain().catch(err => { console.error(err); process.exitCode = 1; });\n"};

function change(source, before, after, label) {
  if (source.split(before).length !== 2) {
    throw new Error('จุดแก้ไม่ตรง: ' + label + ' หยุดโดยไม่เขียนไฟล์');
  }
  return source.replace(before, () => after);
}

const originals = {};
for (const name of ['payment-slip-api.cjs', 'payment-verify.cjs']) {
  originals[name] = fs.readFileSync(path.join(root, name), 'utf8');
}
for (const name of Object.keys(files)) {
  if (fs.existsSync(path.join(root, name))) {
    throw new Error(name + ' มีอยู่แล้ว หยุดโดยไม่เขียนทับ');
  }
}

let api = originals['payment-slip-api.cjs'];
api = change(api,
  'const { parseSlip } = require("./slip-parser.cjs");',
  'const { parseSlip } = require("./slip-parser.cjs");\nconst { readBblSlip } = require("./slip-bbl.cjs");',
  'BBL import');
api = change(api, '      const slip = parseSlip(ocr);', String.raw`      const slip = /Bangkok\s+Bank/i.test(ocr.rawText || "")
        ? await readBblSlip(image, ocr)
        : { ...parseSlip(ocr), sourceBank: "TTB" };`, 'BBL route');

let verify = originals['payment-verify.cjs'];
verify = change(verify, '  if (\n    typeof txid',
  '  const sourceBank = slip?.sourceBank ?? "TTB";\n\n  if (\n' +
  '    !["TTB", "BBL"].includes(sourceBank) ||\n' +
  '    (sourceBank === "BBL" && slip?.receivingWalletId !== "004999254312902") ||\n' +
  '    typeof txid', 'source bank validation');
verify = change(verify, 'existing.slip_bank !== "TTB"',
  'existing.slip_bank !== sourceBank', 'existing receipt bank');
verify = change(verify, "OR (slip_bank = 'TTB' AND slip_reference = ?)",
  'OR (slip_bank = ? AND slip_reference = ?)', 'reuse bank query');
verify = change(verify, '[smsId, slip.reference]',
  '[smsId, sourceBank, slip.reference]', 'reuse bank parameters');
verify = change(verify, "VALUES (?, ?, 'TTB', ?, ?, ?)",
  'VALUES (?, ?, ?, ?, ?, ?)', 'receipt placeholders');
verify = change(verify,
  '[txid, smsId, slip.reference, order.amount_satang, verifiedAt]',
  '[txid, smsId, sourceBank, slip.reference, order.amount_satang, verifiedAt]',
  'receipt bank parameters');

files['payment-slip-api.cjs'] = api;
files['payment-verify.cjs'] = verify;
for (const [name, source] of Object.entries(files)) {
  new vm.Script(source, { filename: name });
}

const backup = fs.mkdtempSync(path.join(root, 'payment-backup-bbl-'));
for (const [name, source] of Object.entries(originals)) {
  fs.writeFileSync(path.join(backup, name), source);
}
fs.writeFileSync(path.join(backup, 'rollback.cjs'),
  'const fs=require("fs"),path=require("path");\n' +
  'const root=path.dirname(__dirname);\n' +
  'for(const name of ' + JSON.stringify(Object.keys(originals)) + ') ' +
  'fs.copyFileSync(path.join(__dirname,name),path.join(root,name));\n' +
  'for(const name of ["slip-bbl.cjs","payment-bbl.test.cjs"]) ' +
  'fs.rmSync(path.join(root,name),{force:true});\n' +
  'console.log("คืนไฟล์ก่อนเพิ่มกรุงเทพแล้ว ยังไม่รีสตาร์ต");\n');
try {
  for (const [name, source] of Object.entries(files)) {
    fs.writeFileSync(path.join(root, name), source);
  }
} catch (err) {
  for (const [name, source] of Object.entries(originals)) fs.writeFileSync(path.join(root, name), source);
  for (const name of ['slip-bbl.cjs', 'payment-bbl.test.cjs']) fs.rmSync(path.join(root, name), { force: true });
  throw err;
}
console.log('เชื่อมตัวอ่านกรุงเทพแล้ว สำรองที่:', backup);
console.log('ยังไม่รีสตาร์ต ไม่แก้ฐานข้อมูล และไม่ส่ง MQTT');
