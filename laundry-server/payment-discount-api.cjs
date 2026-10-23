const express = require('express');
const { createDiscountService } = require('./payment-discount.cjs');
function createDiscountRouter(options = {}) {
  const router = express.Router(), service = createDiscountService(options);
  const fail = (res,err) => {
    const errors = {
      INVALID_INPUT:[400,'กรุณากดสุ่มจากหน้าเว็บ ไม่ต้องระบุยอดหรือส่วนลด'],
      INVALID_TXID:[400,'รหัสรายการไม่ถูกต้อง'], ORDER_NOT_FOUND:[404,'ไม่พบรายการชำระ'],
      ORDER_NOT_PENDING:[409,'รายการนี้ไม่ได้รอชำระ'], ORDER_EXPIRED:[409,'รายการหมดเวลา หากโอนแล้วกรุณาติดต่อผู้ดูแล อย่าโอนซ้ำ'],
      RESERVATION_INVALID:[409,'การจองไม่ถูกต้องหรือเครื่องออฟไลน์'],
      PAYMENT_METHOD_LOCKED:[409,'รายการนี้เลือกวิธียืนยันอื่นแล้ว'],
      ORDER_ALREADY_HAS_EVIDENCE:[409,'รายการนี้มีหลักฐานการชำระแล้ว'],
      DISCOUNT_POOL_FULL:[409,'ยอดส่วนลดถูกจองครบแล้ว กรุณารอสักครู่แล้วกดใหม่'],
      DISCOUNT_NOT_ASSIGNED:[409,'ยังไม่ได้สุ่มส่วนลด'],
      DISCOUNT_AMOUNT_CONFLICT:[409,'ยอดนี้มีรายการรอชำระซ้ำ กรุณาติดต่อผู้ดูแล อย่าโอนซ้ำ'],
      SMS_AMBIGUOUS:[409,'พบ SMS ตรงกันหลายรายการ กรุณาติดต่อผู้ดูแล อย่าโอนซ้ำ'],
      EVIDENCE_ALREADY_USED:[409,'SMS นี้ถูกใช้กับรายการอื่นแล้ว']
    };
    const known = Object.hasOwn(errors,err.message);
    if(!known) console.error('[DISCOUNT PAYMENT]',err.code || 'INTERNAL_ERROR');
    const [status,message] = known?errors[err.message]:[500,'ตรวจส่วนลดไม่สำเร็จ กรุณาลองอีกครั้ง'];
    return res.status(status).json({success:false,code:known?err.message:'DISCOUNT_FAILED',message});
  };
  router.post('/:txid/discount',async(req,res)=>{
    res.set('Cache-Control','no-store');
    try {
      if(!req.body || typeof req.body!=='object' || Array.isArray(req.body) || Object.keys(req.body).length) throw new Error('INVALID_INPUT');
      res.json(await service.assign(req.params.txid));
    }catch(err){fail(res,err);}
  });
  router.get('/:txid/discount',async(req,res)=>{
    res.set('Cache-Control','no-store');
    try{res.json(await service.check(req.params.txid));}catch(err){fail(res,err);}
  });
  return router;
}
module.exports={createDiscountRouter};
