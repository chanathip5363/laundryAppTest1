const sharp = require('sharp');
const path = require('path');
const { createWorker, PSM } = require('tesseract.js');

function parseBblSlip(ocr, amountText) {
  const warnings = [...(ocr.warnings || [])];
  const raw = String(ocr.rawText || '');
  const result = {
    sourceBank: 'BBL', transferDate: null, transferTime: null,
    amountSatang: null, receivingWalletId: null,
    receivingAccountSuffix: null, receivingBank: null, reference: null
  };
  if (!/Bangkok\s+Bank/i.test(raw) || /\bttb\b/i.test(raw)) {
    warnings.push('SOURCE_BANK_UNCLEAR');
  }
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const dates = new Map();
  const fallbackDateLines = ocr.dateLineFirst == null && ocr.dateLine == null
    ? raw.split(/\r?\n/).map(s => s.trim()).filter(s =>
        /^\d{1,2}\s+\S+\s+\d{2}(?:\d{2})?(?:,\s*|\s+)(?:[01]\d|2[0-3])[.:][0-5]\d(?:\s*น\.?)?$/.test(s))
    : [];
  for (const line of [ocr.dateLineFirst, ocr.dateLine, ...fallbackDateLines]) {
    const m = String(line || '').trim().match(
      /^(\d{1,2})\s+(\S+)\s+(\d{2}|\d{4})(?:,\s*|\s+)([01]\d|2[0-3])[.:]([0-5]\d)(?:\s*น\.?)?$/
    );
    if (!m) continue;
    const month = months.indexOf(m[2]);
    const be = Number(m[3]) + (m[3].length === 2 ? 2500 : 0);
    const year = be - 543;
    if (month < 0 || be < 2500) continue;
    const d = new Date(Date.UTC(year, month, Number(m[1])));
    if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month ||
        d.getUTCDate() !== Number(m[1])) continue;
    const date = d.toISOString().slice(0, 10);
    const time = m[4] + ':' + m[5];
    dates.set(date + ' ' + time, { transferDate: date, transferTime: time });
  }
  if (dates.size === 1) {
    Object.assign(result, [...dates.values()][0]);
    if (fallbackDateLines.length === 1) {
      for (let i = warnings.length - 1; i >= 0; i--) {
        if (warnings[i] === 'DATE_LINE_NOT_UNIQUE') warnings.splice(i, 1);
      }
    }
  }
  else warnings.push(dates.size > 1 ? 'DATE_CONFLICT' : 'DATE_INVALID');

  const money = String(amountText || '').trim().match(/^(\d+)\.(\d{2})$/);
  if (money) {
    const amount = Number(money[1]) * 100 + Number(money[2]);
    if (Number.isSafeInteger(amount) && amount > 0) result.amountSatang = amount;
  }
  if (result.amountSatang === null) warnings.push('AMOUNT_UNCLEAR');

  const lines = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const wallets = lines.map(s => s.replace(/[\s-]/g, ''))
    .filter(s => /^\d{15}$/.test(s));
  if (/K\s*Plus\s*Wallet/i.test(raw) && wallets.length === 1 &&
      wallets[0] === '004999254312902') {
    result.receivingWalletId = wallets[0];
    result.receivingAccountSuffix = '4891';
    result.receivingBank = 'KBANK';
  } else warnings.push('RECEIVER_UNCLEAR');

  const references = [...raw.matchAll(
    /(?:^|\n)\s*เลขที่อ้างอิง\s*\n\s*(\d{10,40})\s*(?=\n|$)/g
  )];
  if (references.length === 1) result.reference = references[0][1];
  else warnings.push('REFERENCE_UNCLEAR');

  return { ...result, extractionStatus: warnings.length ? 'REVIEW_REQUIRED' : 'EXTRACTED', warnings };
}

async function readBblSlip(image, ocr) {
  let worker;
  try {
    // This crop is for the Bangkok Bank slip layout tested with the owner.
    const { width, height } = await sharp(image).metadata();
    const crop = await sharp(image).extract({
      left: Math.round(width * 0.35), top: Math.round(height * 0.335),
      width: Math.round(width * 0.21), height: Math.round(height * 0.035)
    }).resize({ width: 800 }).png().toBuffer();
    worker = await createWorker('eng', 1, {
      cachePath: path.join(__dirname, 'private-slips')
    });
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_LINE,
      tessedit_char_whitelist: '0123456789.'
    });
    const result = await worker.recognize(crop);
    return parseBblSlip(ocr, result.data.text);
  } catch (err) {
    console.error('[BBL OCR ERROR]', err.message);
    throw new Error('OCR_FAILED');
  } finally {
    if (worker) await worker.terminate();
  }
}

module.exports = { parseBblSlip, readBblSlip };
