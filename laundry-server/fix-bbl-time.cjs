const fs = require('fs');
const vm = require('vm');
function replaceOnce(source, before, after) {
  if (source.split(before).length !== 2) throw new Error('จุดแก้ไม่ตรง หยุดโดยไม่เขียนไฟล์');
  return source.replace(before, () => after);
}
let source = fs.readFileSync('slip-bbl.cjs', 'utf8');
source = replaceOnce(source,
  '  for (const line of [ocr.dateLineFirst, ocr.dateLine]) {',
  String.raw`  const fallbackDateLines = ocr.dateLineFirst == null && ocr.dateLine == null
    ? raw.split(/\r?\n/).map(s => s.trim()).filter(s =>
        /^\d{1,2}\s+\S+\s+\d{2}(?:\d{2})?,?\s+(?:[01]\d|2[0-3])[.:][0-5]\d(?:\s*น\.?)?$/.test(s))
    : [];
  for (const line of [ocr.dateLineFirst, ocr.dateLine, ...fallbackDateLines]) {`);
source = replaceOnce(source,
  String.raw`([01]\d|2[0-3]):([0-5]\d)`,
  String.raw`([01]\d|2[0-3])[.:]([0-5]\d)`);
source = replaceOnce(source,
  '  if (dates.size === 1) Object.assign(result, [...dates.values()][0]);',
  `  if (dates.size === 1) {
    Object.assign(result, [...dates.values()][0]);
    if (fallbackDateLines.length === 1) {
      for (let i = warnings.length - 1; i >= 0; i--) {
        if (warnings[i] === 'DATE_LINE_NOT_UNIQUE') warnings.splice(i, 1);
      }
    }
  }`);

let test = fs.readFileSync('payment-bbl.test.cjs', 'utf8');
const marker = "    console.log('ผ่าน: อ่านข้อมูลกรุงเทพ และไม่อนุมัติข้อมูลไม่ครบหรือผู้รับผิด');";
test = replaceOnce(test, marker, String.raw`    const dottedDate = dateLine.replace(/:(\d{2})$/, '.$1');
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
` + marker);
for (const [name, text] of [['slip-bbl.cjs', source], ['payment-bbl.test.cjs', test]]) {
  new vm.Script(text, { filename: name });
}
const stamp = Date.now();
for (const name of ['slip-bbl.cjs', 'payment-bbl.test.cjs']) {
  fs.copyFileSync(name, name + '.before-time-fix-' + stamp);
}
fs.writeFileSync('slip-bbl.cjs', source);
fs.writeFileSync('payment-bbl.test.cjs', test);
console.log('แก้ตัวอ่านเวลากรุงเทพและเพิ่มกรณีทดสอบแล้ว ยังไม่รีสตาร์ต');

async function checkRealSlip() {
  const assert = require('node:assert/strict');
  const { prepareSlipImage } = require('./slip-image.cjs');
  const { readSlip } = require('./slip-ocr.cjs');
  const { readBblSlip } = require('./slip-bbl.cjs');
  const { findSmsCandidates } = require('./slip-sms-match.cjs');
  const image = await prepareSlipImage(fs.readFileSync('private-slips/IMG_6542.jpeg'));
  const slip = await readBblSlip(image, await readSlip(image));
  console.log('ผลอ่านสลิป 03:14:', slip);
  assert.equal(slip.extractionStatus, 'EXTRACTED');
  assert.equal(slip.transferDate, '2026-10-23');
  assert.equal(slip.transferTime, '03:14');
  assert.equal(slip.amountSatang, 2000);
  assert.equal(slip.reference, '2026102303140924005607908');
  console.log('ผลค้นหา SMS:', await findSmsCandidates(slip));
  console.log('ผ่าน: อ่านสลิปที่เคยติดได้ครบ โดยไม่อนุมัติรายการหรือสั่งเครื่อง');
}
checkRealSlip().catch(err => { console.error(err); process.exitCode = 1; });
