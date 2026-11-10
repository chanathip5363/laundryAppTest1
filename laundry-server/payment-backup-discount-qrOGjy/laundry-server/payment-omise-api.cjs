const express = require('express');
const { createOmiseService } = require('./payment-omise.cjs');
function createOmiseRouter(options = {}) {
  const router = express.Router();
  const service = createOmiseService(options);
  const fail = (res, err) => {
    const errors = {
      INVALID_TXID:[400,'รหัสรายการไม่ถูกต้อง'], INVALID_INPUT:[400,'ข้อมูลไม่ถูกต้อง'],
      ORDER_NOT_FOUND:[404,'ไม่พบรายการชำระ'], ORDER_NOT_PENDING:[409,'รายการนี้ไม่ได้รอชำระ'],
      ORDER_EXPIRED:[409,'รายการหมดเวลาแล้ว กรุณาทำรายการใหม่'],
      RESERVATION_INVALID:[409,'การจองไม่ถูกต้องหรือเครื่องออฟไลน์'],
      ORDER_ALREADY_HAS_EVIDENCE:[409,'รายการนี้ยืนยันด้วยวิธีอื่นแล้ว'],
      OMISE_MINIMUM_AMOUNT:[400,'Omise รองรับยอดตั้งแต่ 20 บาท'],
      OMISE_NOT_CONFIGURED:[503,'ยังไม่ได้ตั้งค่าคีย์ Omise Test บนเซิร์ฟเวอร์'],
      OMISE_TEST_KEY_REQUIRED:[503,'ต้องใช้คีย์ Omise Test Mode'],
      OMISE_CREATING:[409,'กำลังสร้างรายการ Omise หรือยังยืนยันผลการสร้างไม่ได้ กรุณารอหรือทำรายการใหม่เมื่อหมดเวลา'],
      OMISE_NOT_CREATED:[409,'ยังไม่ได้สร้างรายการ Omise'],
      OMISE_UNAVAILABLE:[503,'ติดต่อ Omise ไม่สำเร็จ กรุณาลองตรวจสถานะอีกครั้ง'],
      OMISE_API_ERROR:[503,'Omise ปฏิเสธคำขอ กรุณาติดต่อผู้ดูแล'],
      OMISE_RESPONSE_INVALID:[502,'ข้อมูลตอบกลับ Omise ไม่ตรงกับรายการ'],
      OMISE_PAYMENT_TIME_INVALID:[409,'เวลาชำระ Omise ไม่อยู่ในช่วงรายการ']
    };
    const known = Object.hasOwn(errors,err.message);
    if(!known) console.error('[OMISE TEST]',err.code || 'INTERNAL_ERROR');
    const [status,message] = known ? errors[err.message] : [500,'ตรวจ Omise ไม่สำเร็จ'];
    return res.status(status).json({success:false,code:known?err.message:'OMISE_FAILED',message});
  };
  router.post('/:txid/omise', async(req,res)=>{
    res.set('Cache-Control','no-store');
    try {
      if(!req.body || typeof req.body!=='object' || Array.isArray(req.body) || Object.keys(req.body).length) throw new Error('INVALID_INPUT');
      res.json(await service.create(req.params.txid));
    } catch(err){fail(res,err);}
  });
  router.get('/:txid/omise',async(req,res)=>{
    res.set('Cache-Control','no-store');
    try {res.json(await service.refresh(req.params.txid));}catch(err){fail(res,err);}
  });
  router.post('/omise/webhook',async(req,res)=>{
    try {
      // Payload is only a hint. Always retrieve the saved charge using our key.
      if(req.body?.key==='charge.complete') await service.webhook(req.body?.data?.id);
      res.sendStatus(200);
    }catch(err){
      if(['ORDER_EXPIRED','ORDER_NOT_PENDING','ORDER_NOT_FOUND'].includes(err.message)) return res.sendStatus(200);
      fail(res,err);
    }
  });
  return router;
}
module.exports={createOmiseRouter};
