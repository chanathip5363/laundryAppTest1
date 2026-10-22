const express = require("express");
const { quotePrice } = require("./payment-price.cjs");
const { createCheckout } = require("./payment-checkout.cjs");

function createPaymentRouter({ dbPath, isTest = false } = {}) {
  const router = express.Router();

  router.post("/checkout", async (req, res) => {
    res.set("Cache-Control", "no-store");

    const body = req.body;

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      typeof body.machine !== "string" ||
      !["wash", "dry"].includes(body.type) ||
      !Number.isSafeInteger(body.program) ||
      body.program <= 0
    ) {
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        message: "ข้อมูลเครื่องหรือโปรแกรมไม่ถูกต้อง"
      });
    }

    const input = {
      machine: body.machine,
      type: body.type,
      program: body.program,
      tempOption: body.tempOption,
      aromaOption: body.aromaOption,
      temperatureOption: body.temperatureOption,
      wrinkleOption: body.wrinkleOption
    };

    try {
      quotePrice(input);
    } catch (err) {
      return res.status(400).json({
        success: false,
        code: "INVALID_SELECTION",
        message: "กรุณาตรวจสอบโปรแกรมและตัวเลือกที่เลือก"
      });
    }

    try {
      const order = await createCheckout(input, { dbPath, isTest });

      return res.status(201).json({
        success: true,
        txid: order.txid,
        machine: order.machine,
        type: order.type,
        program: order.program,
        amount: order.amount,
        amountSatang: order.amountSatang,
        createdAt: order.createdAt,
        reservedUntil: order.expiresAt,
        status: order.status
      });
    } catch (err) {
      const errors = {
        MACHINE_NOT_FOUND: [404, "ไม่พบเครื่อง"],
        MACHINE_OFFLINE: [409, "เครื่องออฟไลน์"],
        MACHINE_BUSY: [409, "เครื่องไม่ว่าง"],
        RESERVATION_FAILED: [409, "จองเครื่องไม่สำเร็จ กรุณาลองใหม่"]
      };

      if (Object.hasOwn(errors, err.message)) {
        const [httpStatus, message] = errors[err.message];
        return res.status(httpStatus).json({
          success: false,
          code: err.message,
          message
        });
      }

      console.error("[CHECKOUT ERROR]", err.message);
      return res.status(500).json({
        success: false,
        code: "CHECKOUT_FAILED",
        message: "สร้างรายการชำระไม่สำเร็จ กรุณาลองใหม่"
      });
    }
  });

  return router;
}

module.exports = { createPaymentRouter };
