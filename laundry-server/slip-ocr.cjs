const { createWorker, PSM } = require("tesseract.js");
const path = require("path");

async function readSlip(imagePath) {
  let worker;

  try {
    worker = await createWorker(["tha", "eng"], 1, {
      cachePath: path.join(__dirname, "private-slips")
    });

    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO
    });

    const first = await worker.recognize(
      imagePath, {}, { text: true, blocks: true }
    );

    const lines = (first.data.blocks || []).flatMap(
      block => (block.paragraphs || []).flatMap(
        paragraph => paragraph.lines || []
      )
    );

    const candidates = lines.filter(
      line => /^\s*[0-9๐-๙]{1,2}\s+\S+\s+[0-9๐-๙]{2}(?:[0-9๐-๙]{2})?(?:,\s*|\s+)[0-9๐-๙]{1,2}[.:][0-9๐-๙]{2}(?:\s*น\.?)?\s*$/.test(line.text)
    );

    const result = {
      rawText: first.data.text,
      dateLineFirst: null,
      dateLine: null,
      warnings: []
    };

    if (candidates.length !== 1) {
      result.warnings.push("DATE_LINE_NOT_UNIQUE");
      return result;
    }

    const line = candidates[0];
    result.dateLineFirst = line.text.trim();

    const box = line.bbox;
    const left = Math.max(0, box.x0 - 25);
    const top = Math.max(0, box.y0 - 15);

    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_LINE
    });

    try {
      const second = await worker.recognize(imagePath, {
        rectangle: {
          left,
          top,
          width: box.x1 + 25 - left,
          height: box.y1 + 15 - top
        }
      });

      result.dateLine = second.data.text.trim();
      if (!result.dateLine) result.warnings.push("DATE_LINE_EMPTY");
    } catch (err) {
      result.warnings.push("DATE_LINE_READ_FAILED");
    }

    return result;
  } finally {
    if (worker) await worker.terminate();
  }
}

module.exports = { readSlip };

if (require.main === module) {
  const imagePath = process.argv[2];

  if (!imagePath) {
    console.error("กรุณาระบุไฟล์ภาพ");
    process.exitCode = 1;
  } else {
    readSlip(path.resolve(imagePath))
      .then(result => console.log(JSON.stringify(result, null, 2)))
      .catch(err => {
        console.error("OCR ERROR:", err.message);
        process.exitCode = 1;
      });
  }
}
