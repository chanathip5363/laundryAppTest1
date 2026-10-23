const express = require("express");
const multer = require("multer");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const { prepareSlipImage, MAX_FILE_BYTES } = require("./slip-image.cjs");
const { readSlip } = require("./slip-ocr.cjs");
const { parseSlip } = require("./slip-parser.cjs");
const { readBblSlip } = require("./slip-bbl.cjs");
const { verifyPendingPayment } = require("./payment-verify.cjs");

let processing = false;

function readOrder(dbPath, txid) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(
      dbPath, sqlite3.OPEN_READONLY,
      err => {
        if (err) return reject(err);

        db.configure("busyTimeout", 5000);
        db.get(
          "SELECT * FROM payment_orders WHERE txid = ?",
          [txid],
          (queryError, row) => {
            db.close(closeError => {
              if (queryError || closeError) {
                reject(queryError || closeError);
              } else {
                resolve(row);
              }
            });
          }
        );
      }
    );
  });
}

function createSlipRouter({
  dbPath = path.join(__dirname, "database.db"),
  isTest = false,
  readSlipImpl = readSlip
} = {}) {
  if (typeof isTest !== "boolean") {
    throw new Error("INVALID_TEST_MODE");
  }

  const router = express.Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MAX_FILE_BYTES,
      files: 1,
      fields: 0,
      parts: 1
    }
  }).single("slip");

  router.post("/:txid/slip", async (req, res) => {
    res.set("Cache-Control", "no-store");
    const txid = req.params.txid;

    if (!/^TX[a-f0-9]{32}$/.test(txid)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_TXID",
        message: "รหัสรายการไม่ถูกต้อง"
      });
    }

    if (processing) {
      res.set("Retry-After", "3");
      return res.status(429).json({
        success: false,
        code: "OCR_BUSY",
        message: "ระบบกำลังอ่านสลิป กรุณาลองอีกครั้ง"
      });
    }

    processing = true;

    try {
      const order = await readOrder(dbPath, txid);

      if (!order || order.is_test !== (isTest ? 1 : 0)) {
        throw new Error("ORDER_NOT_FOUND");
      }

      const previouslyPaid = [
        "PAID", "STARTING", "STARTED", "START_FAILED"
      ].includes(order.status);

      if (!previouslyPaid) {
        if (order.status !== "PENDING") {
          throw new Error("ORDER_NOT_PENDING");
        }
        if (order.expires_at <= Date.now()) {
          throw new Error("ORDER_EXPIRED");
        }
      }

      await new Promise((resolve, reject) => {
        upload(req, res, err => err ? reject(err) : resolve());
      });

      if (!req.file) throw new Error("IMAGE_REQUIRED");

      const image = await prepareSlipImage(req.file.buffer);
      let ocr;

      try {
        ocr = await readSlipImpl(image);
      } catch (err) {
        console.error("[SLIP OCR ERROR]", err.message);
        throw new Error("OCR_FAILED");
      }

      const slip = /Bangkok\s+Bank/i.test(ocr.rawText || "")
        ? await readBblSlip(image, ocr)
        : { ...parseSlip(ocr), sourceBank: "TTB" };

      if (
        slip.extractionStatus !== "EXTRACTED" ||
        !Array.isArray(slip.warnings) ||
        slip.warnings.length
      ) {
        return res.status(422).json({
          success: false,
          code: "REVIEW_REQUIRED",
          message: "อ่านข้อมูลสลิปได้ไม่ครบ กรุณาตรวจสอบภาพสลิป"
        });
      }

      const result = await verifyPendingPayment(txid, slip, {
        dbPath,
        isTest
      });

      return res.json({
        success: true,
        txid: result.txid,
        status: result.status,
        message: "ยืนยันการชำระเงินแล้ว"
      });
    } catch (err) {
      const errors = {
        PAYMENT_METHOD_LOCKED: [409, 'รายการนี้เลือกวิธียืนยันอื่นแล้ว กรุณาใช้วิธีที่เลือกไว้'],
        ORDER_NOT_FOUND: [404, "ไม่พบรายการชำระ"],
        ORDER_NOT_PENDING: [409, "รายการนี้ไม่ได้อยู่ระหว่างรอชำระ"],
        ORDER_EXPIRED: [409, "รายการชำระหมดเวลาแล้ว"],
        IMAGE_REQUIRED: [400, "กรุณาแนบภาพสลิป"],
        IMAGE_TOO_LARGE: [413, "ภาพสลิปต้องมีขนาดไม่เกิน 5 MB"],
        LIMIT_FILE_SIZE: [413, "ภาพสลิปต้องมีขนาดไม่เกิน 5 MB"],
        IMAGE_TYPE_UNSUPPORTED: [415, "กรุณาใช้ภาพ JPEG หรือ PNG"],
        IMAGE_INVALID: [422, "ไฟล์ภาพเสียหรือขนาดภาพไม่รองรับ"],
        OCR_FAILED: [503, "อ่านสลิปไม่สำเร็จ กรุณาลองอีกครั้ง"],
        INVALID_EVIDENCE: [422, "ข้อมูลสลิปไม่ตรงตามรูปแบบที่รองรับ"],
        INVALID_PAYMENT_TIME: [422, "อ่านวันเวลาชำระไม่สำเร็จ"],
        AMOUNT_MISMATCH: [409, "ยอดชำระไม่ตรงกับรายการ"],
        PAYMENT_TIME_OUTSIDE_ORDER: [409, "เวลาชำระอยู่นอกช่วงรายการ"],
        SMS_NOT_FOUND: [409, "ยังไม่พบ SMS ที่ตรงกัน กรุณาลองอีกครั้ง"],
        SMS_AMBIGUOUS: [409, "พบ SMS ตรงกันหลายรายการ ต้องตรวจสอบเพิ่มเติม"],
        EVIDENCE_ALREADY_USED: [409, "หลักฐานนี้ถูกใช้กับรายการอื่นแล้ว"],
        ORDER_ALREADY_HAS_EVIDENCE: [409, "รายการนี้มีหลักฐานการชำระแล้ว"]
      };

      const code = err instanceof multer.MulterError
        ? err.code
        : err.message;

      if (Object.hasOwn(errors, code)) {
        const [httpStatus, message] = errors[code];
        return res.status(httpStatus).json({
          success: false,
          code,
          message
        });
      }

      if (err instanceof multer.MulterError) {
        return res.status(400).json({
          success: false,
          code: "INVALID_UPLOAD",
          message: "กรุณาส่งภาพสลิปเพียงไฟล์เดียวในช่อง slip"
        });
      }

      console.error("[SLIP API ERROR]", err.message);
      return res.status(500).json({
        success: false,
        code: "SLIP_CHECK_FAILED",
        message: "ตรวจสอบการชำระไม่สำเร็จ กรุณาลองอีกครั้ง"
      });
    } finally {
      processing = false;
    }
  });

  return router;
}

module.exports = { createSlipRouter };
