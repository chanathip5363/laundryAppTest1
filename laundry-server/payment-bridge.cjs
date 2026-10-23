const express = require('express');
const path = require('path');
const { randomUUID } = require('crypto');
const { createCheckout } = require('./payment-checkout.cjs');
const { initializeReceipts } = require('./payment-receipts.cjs');

function selection(input) {
  if (!input || typeof input.machine !== 'string' || !/^machine\d+$/.test(input.machine) ||
      !['wash', 'dry'].includes(input.type) || !Number.isSafeInteger(input.program) || input.program < 1 ||
      typeof input.amount !== 'number' || !Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('INVALID_SELECTION');
  }
  const amountSatang = Math.round(input.amount * 100);
  if (!Number.isSafeInteger(amountSatang) || amountSatang <= 0 ||
      Math.abs(input.amount * 100 - amountSatang) > 0.000001) throw new Error('INVALID_SELECTION');
  const command = { machine: input.machine, type: input.type, amount: amountSatang / 100, program: input.program };
  if (input.type === 'wash') {
    for (const key of ['tempPulse', 'aromaPulse']) {
      if (!Number.isSafeInteger(input[key]) || input[key] < 0) throw new Error('INVALID_SELECTION');
      command[key] = input[key];
    }
  } else {
    if (input.temperatureOption !== null && typeof input.temperatureOption !== 'string') throw new Error('INVALID_SELECTION');
    if (typeof input.wrinkleOption !== 'boolean') throw new Error('INVALID_SELECTION');
    command.temperatureOption = input.temperatureOption;
    command.wrinkleOption = input.wrinkleOption;
  }
  return { command, amountSatang };
}

async function saveSelectedOrder(db, input, { isTest = false } = {}) {
  const { command, amountSatang } = selection(input);
  await initializeReceipts(db);
  const txid = 'TX' + randomUUID().replace(/-/g, '');
  const createdAt = Date.now();
  const expiresAt = createdAt + 120000;
  // Save the existing React result; do not introduce a second price or pulse table.
  const options = { command };
  const snapshot = { source: 'existing-react', amount: command.amount, amountSatang };
  await new Promise((resolve, reject) => {
    db.run(`INSERT INTO payment_orders
      (txid,machine,service,program,options_json,amount_satang,price_snapshot_json,created_at,expires_at,status,is_test)
      VALUES (?,?,?,?,?,?,?,?,?,'PENDING',?)`,
    [txid,command.machine,command.type,command.program,JSON.stringify(options),amountSatang,
      JSON.stringify(snapshot),createdAt,expiresAt,isTest ? 1 : 0],
    err => err ? reject(err) : resolve());
  });
  return { txid, machine: command.machine, type: command.type, program: command.program,
    amount: command.amount, amountSatang, createdAt, expiresAt, status: 'PENDING' };
}

function createSessionRouter({ dbPath = path.join(__dirname, 'database.db'), isTest = false } = {}) {
  const router = express.Router();
  router.post('/session', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      selection(req.body);
      const order = await createCheckout(req.body, { dbPath, isTest, createOrder: saveSelectedOrder });
      res.status(201).json({ success: true, ...order, reservedUntil: order.expiresAt });
    } catch (err) {
      const errors = {
        INVALID_SELECTION: [400, 'ข้อมูลรายการชำระไม่ถูกต้อง'],
        MACHINE_NOT_FOUND: [404, 'ไม่พบเครื่อง'],
        MACHINE_OFFLINE: [409, 'เครื่องออฟไลน์'],
        MACHINE_BUSY: [409, 'เครื่องไม่ว่าง'],
        RESERVATION_FAILED: [409, 'จองเครื่องไม่สำเร็จ กรุณาลองใหม่']
      };
      const known = Object.hasOwn(errors, err.message);
      if (!known) console.error('[PAYMENT SESSION]', err.message);
      const [status, message] = known ? errors[err.message] : [500, 'สร้างรายการชำระไม่สำเร็จ'];
      res.status(status).json({ success: false, code: known ? err.message : 'SESSION_FAILED', message });
    }
  });
  router.use(require('./payment-time-api.cjs').createTimeRouter({ dbPath, isTest }));
  router.use(require('./payment-omise-api.cjs').createOmiseRouter({ dbPath, isTest }));
  return router;
}

function authorizeWebhook(db, client, { isTest = false } = {}) {
  return async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const txid = req.body?.txid;
    const get = (sql, params = []) => new Promise((resolve, reject) => {      db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
    });
    const deny = (status, code, message) => res.status(status).json({ success: false, code, message });
    try {
      if (typeof txid !== 'string' || !/^TX[a-f0-9]{32}$/.test(txid)) {
        return deny(400, 'INVALID_TXID', 'รหัสรายการไม่ถูกต้อง');
      }
      const order = await get('SELECT * FROM payment_orders WHERE txid=?', [txid]);
      if (!order || order.is_test !== (isTest ? 1 : 0)) return deny(404, 'ORDER_NOT_FOUND', 'ไม่พบรายการชำระ');
      const receipt = await get('SELECT * FROM payment_receipts WHERE txid=?', [txid]) ||
        await require('./payment-omise.cjs').getOmiseReceipt(db, txid);
      if (!receipt || order.status !== 'PAID' || receipt.amount_satang !== order.amount_satang) {
        return deny(403, 'PAYMENT_NOT_VERIFIED', 'ยังไม่ผ่านการยืนยันชำระเงิน');
      }
      const existing = await get('SELECT * FROM transactions WHERE txid=?', [txid]);
      if (existing) {
        if (existing.status === 'SUCCESS') return res.json({ success: true, txid, status: 'COMMAND_SENT', duplicate: true });
        return deny(409, 'START_REJECTED', 'รายการนี้ถูกปฏิเสธการเริ่มเครื่อง กรุณาตรวจสอบกับผู้ดูแล');
      }
      const machine = await get('SELECT * FROM machines WHERE machine=?', [order.machine]);
      if (!machine || machine.status !== 'ONLINE') return deny(409, 'MACHINE_OFFLINE', 'เครื่องออฟไลน์');
      if (machine.state !== 'RESERVED' || machine.reservation_txid !== txid ||
          !machine.reserved_until || machine.reserved_until <= Date.now() || order.expires_at <= Date.now()) {
        return deny(409, 'RESERVATION_INVALID', 'การจองเครื่องหมดเวลาหรือไม่ตรงกับรายการ กรุณาติดต่อผู้ดูแล');
      }
      if (client && !client.connected) return deny(503, 'MQTT_OFFLINE', 'ระบบสั่งเครื่องยังไม่เชื่อมต่อ กรุณาลองอีกครั้ง');
      const saved = JSON.parse(order.options_json).command;
      const { command, amountSatang } = selection(saved);
      if (command.machine !== order.machine || command.type !== order.service ||
          command.program !== order.program || amountSatang !== order.amount_satang) {
        return deny(409, 'COMMAND_MISMATCH', 'ข้อมูลรายการไม่ตรงกัน กรุณาติดต่อผู้ดูแล');
      }
      // Only the saved selection reaches the original webhook and original MQTT code.
      req.body = { ...command, txid };
      const originalSendStatus = res.sendStatus.bind(res);
      res.sendStatus = code => {
        if (code !== 200) return originalSendStatus(code);
        db.get('SELECT status FROM transactions WHERE txid=?', [txid], (err, row) => {
          if (err) return deny(500, 'START_CHECK_FAILED', 'ตรวจผลการส่งคำสั่งไม่สำเร็จ กรุณาติดต่อผู้ดูแล');
          if (row?.status === 'SUCCESS') return res.json({ success: true, txid, status: 'COMMAND_SENT' });
          return deny(409, 'START_NOT_CONFIRMED', 'ยังยืนยันการส่งคำสั่งไม่ได้ กรุณาตรวจสอบสถานะเครื่องก่อนลองอีกครั้ง');
        });
        return res;
      };
      next();
    } catch (err) {
      console.error('[PAYMENT GATE]', err.message);
      return deny(500, 'PAYMENT_GATE_FAILED', 'ตรวจรายการก่อนสั่งเครื่องไม่สำเร็จ');
    }
  };
}

module.exports = { createSessionRouter, authorizeWebhook, selection };
