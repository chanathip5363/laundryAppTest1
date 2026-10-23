const express = require('express');
const { verifyPaymentTime } = require('./payment-time-verify.cjs');

function createTimeRouter({ dbPath, isTest = false } = {}) {
  if (typeof isTest !== 'boolean') throw new Error('INVALID_TEST_MODE');
  const router = express.Router();
  router.post('/:txid/time', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const body = req.body;
      if (!body || typeof body !== 'object' || Array.isArray(body) ||
          Object.keys(body).length !== 1 || !Object.hasOwn(body, 'transferTime')) {
        throw new Error('INVALID_INPUT');
      }
      const result = await verifyPaymentTime(req.params.txid, body.transferTime, { dbPath, isTest });
      res.json({ success: true, txid: result.txid, status: result.status,
        message: 'ยืนยันการชำระเงินแล้ว' });
    } catch (err) {
      const errors = {
        PAYMENT_METHOD_LOCKED: [409, 'รายการนี้เลือกวิธียืนยันอื่นแล้ว กรุณาใช้วิธีที่เลือกไว้'],
        INVALID_INPUT: [400, 'กรุณากรอกเฉพาะเวลาโอนจากสลิป'],
        INVALID_TXID: [400, 'รหัสรายการไม่ถูกต้อง'],
        INVALID_PAYMENT_TIME: [400, 'กรุณากรอกเวลาแบบ 24 ชั่วโมง เช่น 14:15'],
        ORDER_NOT_FOUND: [404, 'ไม่พบรายการชำระ'],
        ORDER_NOT_PENDING: [409, 'รายการนี้ไม่ได้อยู่ระหว่างรอชำระ'],
        ORDER_EXPIRED: [409, 'รายการชำระหมดเวลาแล้ว หากโอนแล้วกรุณาติดต่อผู้ดูแล อย่าโอนซ้ำ'],
        PAYMENT_TIME_OUTSIDE_ORDER: [409, 'เวลาโอนไม่อยู่ในช่วงรายการ กรุณาตรวจเวลาบนสลิป'],
        SMS_NOT_FOUND: [409, 'ยังไม่พบ SMS ที่ตรงกัน กรุณาตรวจเวลาแล้วลองอีกครั้ง อย่าโอนซ้ำ'],
        SMS_AMBIGUOUS: [409, 'พบ SMS ตรงกันหลายรายการ กรุณาติดต่อผู้ดูแล อย่าโอนซ้ำ'],
        EVIDENCE_ALREADY_USED: [409, 'SMS นี้ถูกใช้ยืนยันรายการอื่นแล้ว'],
        ORDER_ALREADY_HAS_EVIDENCE: [409, 'รายการนี้มีหลักฐานการชำระแล้ว กรุณาตรวจสอบกับผู้ดูแล']
      };
      const known = Object.hasOwn(errors, err.message);
      if (!known) console.error('[PAYMENT TIME]', err.message);
      const [status, message] = known ? errors[err.message] : [500, 'ตรวจชำระไม่สำเร็จ กรุณาลองอีกครั้ง'];
      res.status(status).json({ success: false, code: known ? err.message : 'TIME_CHECK_FAILED', message });
    }
  });
  return router;
}

module.exports = { createTimeRouter };
