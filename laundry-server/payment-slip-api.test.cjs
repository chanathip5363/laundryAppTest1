const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const { createCheckout } = require("./payment-checkout.cjs");
const { initializeReceipts } = require("./payment-receipts.cjs");
const { createSlipRouter } = require("./payment-slip-api.cjs");

const folder = fs.mkdtempSync(path.join(os.tmpdir(), "laundry-slip-api-"));
const dbPath = path.join(folder, "test.db");
const db = new sqlite3.Database(dbPath);
db.configure("busyTimeout", 5000);
let server;
let mode = "valid";
let calls = 0;
let releaseOcr;
let notifyEntered;

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, err => err ? reject(err) : resolve());
  });
}
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
}

async function test() {
  await run(`CREATE TABLE machines (
    machine TEXT PRIMARY KEY, state TEXT,
    status TEXT, reserved_until INTEGER
  )`);
  await run("INSERT INTO machines VALUES ('machine1','IDLE','ONLINE',NULL)");
  await run(`CREATE TABLE sms_messages (
    id INTEGER PRIMARY KEY, is_test INTEGER, parse_status TEXT,
    receiving_account TEXT, amount_satang INTEGER,
    bank_time TEXT, bank_date TEXT, received_at TEXT
  )`);

  const order = await createCheckout({
    machine: "machine1", type: "wash", program: 1,
    tempOption: "30", aromaOption: true
  }, { dbPath, isTest: true });
  await initializeReceipts(db);

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Bangkok", year: "numeric",
      month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(new Date())
      .filter(p => p.type !== "literal")
      .map(p => [p.type, p.value])
  );
  const year = String(Number(parts.year) + 543).slice(-2);
  const months = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
  ];
  const time = `${parts.hour}:${parts.minute}`;
  const dateLine =
    `${parts.day} ${months[Number(parts.month) - 1]} ${year}, ${time} น.`;
  const reference = "99" + Date.now();

  await run(
    "INSERT INTO sms_messages VALUES (1,1,'PARSED','X-4891',3900,?,?,?)",
    [time, `${parts.day}/${parts.month}/${year}`, new Date().toISOString()]
  );

  async function fakeOcr() {
    calls++;
    if (mode === "hold") {
      notifyEntered();
      await new Promise(resolve => { releaseOcr = resolve; });
    }
    if (mode === "unreadable") {
      return {
        rawText: "", dateLineFirst: null, dateLine: null,
        warnings: ["DATE_LINE_NOT_UNIQUE"]
      };
    }
    return {
      rawText: [
        "โอนเงินสำเร็จ", dateLine,
        mode === "wrongAmount" ? "1.00" : "39.00",
        "ค่าธรรมเนียม 0.00",
        "ผู้โอน", "XXX-X-XX756-9", "ttb",
        "ผู้รับ", "XXX-X-XX489-1", "KBANK",
        `รหัสอ้างอิง: ${reference}`, ""
      ].join("\n"),
      dateLineFirst: dateLine, dateLine, warnings: []
    };
  }

  const app = express();
  app.use("/payments", createSlipRouter({
    dbPath, isTest: true, readSlipImpl: fakeOcr
  }));
  server = await new Promise(resolve => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  const base = `http://127.0.0.1:${server.address().port}/payments`;
  const image = fs.readFileSync(
    path.join(__dirname, "private-slips/slip-real-2-02.jpg")
  );

  async function post(buffer, txid = order.txid, field = "slip") {
    const form = new FormData();
    if (buffer !== null) {
      form.append(field, new Blob([buffer]), "slip.jpg");
    }
    const response = await fetch(`${base}/${txid}/slip`, {
      method: "POST", body: form,
      signal: AbortSignal.timeout(30000)
    });
    return { status: response.status, body: await response.json() };
  }
  async function expect(buffer, status, code, txid, field) {
    const result = await post(buffer, txid, field);
    assert.equal(result.status, status, JSON.stringify(result));
    assert.equal(result.body.code, code, JSON.stringify(result));
  }

  await expect(null, 400, "IMAGE_REQUIRED");
  await expect(Buffer.from("not an image"), 415, "IMAGE_TYPE_UNSUPPORTED");
  await expect(image, 400, "INVALID_UPLOAD", order.txid, "wrongField");
  await expect(Buffer.alloc(5 * 1024 * 1024 + 1), 413, "LIMIT_FILE_SIZE");
  await expect(image, 404, "ORDER_NOT_FOUND", "TX" + "0".repeat(32));
  assert.equal(calls, 0);
  console.log("ผ่าน: ไฟล์ผิด ช่องผิด ไฟล์เกินขนาด และรายการไม่มีจริง ไม่เข้า OCR");

  mode = "wrongAmount";
  await expect(image, 409, "AMOUNT_MISMATCH");
  mode = "unreadable";
  await expect(image, 422, "REVIEW_REQUIRED");
  assert.equal(
    (await get("SELECT status FROM payment_orders WHERE txid=?", [order.txid])).status,
    "PENDING"
  );
  assert.equal((await get("SELECT COUNT(*) AS n FROM payment_receipts")).n, 0);
  console.log("ผ่าน: ยอดผิดหรืออ่านไม่ครบ ไม่อนุมัติและไม่บันทึกหลักฐาน");

  mode = "hold";
  const entered = new Promise(resolve => { notifyEntered = resolve; });
  const pending = post(image);
  await entered;
  let busy;
  try {
    busy = await post(image);
  } finally {
    releaseOcr();
  }
  const paid = await pending;
  assert.equal(busy.status, 429);
  assert.equal(busy.body.code, "OCR_BUSY");
  assert.equal(paid.status, 200, JSON.stringify(paid));
  assert.equal(paid.body.status, "PAID");
  console.log("ผ่าน: ป้องกันงาน OCR ซ้อน และยืนยันรายการถูกต้องเป็น PAID");

  mode = "valid";
  const repeated = await post(image);
  assert.equal(repeated.status, 200, JSON.stringify(repeated));
  assert.equal(repeated.body.status, "ALREADY_VERIFIED");
  assert.equal((await get("SELECT COUNT(*) AS n FROM payment_receipts")).n, 1);
  assert.equal((await get("SELECT state FROM machines")).state, "RESERVED");
  console.log("ผ่าน: ส่งซ้ำได้ผลเดิม หลักฐานมีรายการเดียว และไม่สั่งเครื่อง");
}

async function main() {
  try {
    await test();
  } finally {
    if (releaseOcr) releaseOcr();
    if (server) await new Promise(resolve => server.close(resolve));
    await new Promise((resolve, reject) => {
      db.close(err => err ? reject(err) : resolve());
    });
    fs.rmSync(folder, { recursive: true, force: true });
  }
}
main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
