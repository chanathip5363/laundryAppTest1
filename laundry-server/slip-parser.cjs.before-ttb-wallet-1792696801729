function parseSlip(ocr) {
  const warnings = [...(ocr.warnings || [])];
  const ascii = value => String(value || "").replace(
    /[๐-๙]/g, digit => String("๐๑๒๓๔๕๖๗๘๙".indexOf(digit))
  );

  const raw = ascii(ocr.rawText);
  const result = {
    transferDate: null,
    transferTime: null,
    amountSatang: null,
    receivingAccountSuffix: null,
    receivingBank: null,
    reference: null
  };

  const months = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
  ];

  function parseDateLine(value) {
    const date = ascii(value).trim().match(
      /^(\d{1,2})\s+(\S+)\s+(\d{2}|\d{4}),?\s+(\d{2}):(\d{2})\s*น\.?$/
    );
    if (!date) return null;

    const day = Number(date[1]);
    const month = months.indexOf(date[2]);
    const buddhistYear = date[3].length === 2
      ? 2500 + Number(date[3]) : Number(date[3]);
    const year = buddhistYear - 543;
    const hour = Number(date[4]);
    const minute = Number(date[5]);
    const check = new Date(Date.UTC(year, month, day));

    if (
      month < 0 || buddhistYear < 2500 ||
      hour >= 24 || minute >= 60 ||
      check.getUTCFullYear() !== year ||
      check.getUTCMonth() !== month ||
      check.getUTCDate() !== day
    ) return null;

    return {
      transferDate: [
        year,
        String(month + 1).padStart(2, "0"),
        String(day).padStart(2, "0")
      ].join("-"),
      transferTime: date[4] + ":" + date[5]
    };
  }

  const dateOptions = new Map();

  for (const line of [ocr.dateLineFirst, ocr.dateLine]) {
    const parsed = parseDateLine(line);
    if (parsed) {
      dateOptions.set(
        parsed.transferDate + " " + parsed.transferTime,
        parsed
      );
    }
  }

  if (dateOptions.size === 1) {
    Object.assign(result, [...dateOptions.values()][0]);
  } else {
    warnings.push(dateOptions.size > 1 ? "DATE_CONFLICT" : "DATE_INVALID");
  }

  const lines = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const dateIndexes = lines.flatMap(
    (line, index) => line === ascii(ocr.dateLineFirst).trim()
      ? [index] : []
  );

  if (dateIndexes.length === 1) {
    const amount = (lines[dateIndexes[0] + 1] || "").match(
      /^(\d{1,3}(?:,\d{3})+|\d+)\.(\d{2})$/
    );

    if (amount) {
      const satang =
        Number(amount[1].replace(/,/g, "")) * 100 + Number(amount[2]);
      if (Number.isSafeInteger(satang) && satang > 0) {
        result.amountSatang = satang;
      }
    }
  }

  if (result.amountSatang === null) warnings.push("AMOUNT_UNCLEAR");

  const accounts = [...raw.matchAll(
    /X{3}-X-X{2}(\d{3})-(\d)/gi
  )];

  if (
    /\bttb\b/i.test(raw) &&
    accounts.length === 2 &&
    /^\s*KBANK\b/i.test(
      raw.slice(accounts[1].index + accounts[1][0].length)
    )
  ) {
    result.receivingAccountSuffix = accounts[1][1] + accounts[1][2];
    result.receivingBank = "KBANK";
  } else {
    warnings.push("RECEIVER_UNCLEAR");
  }

  const references = [...raw.matchAll(
    /รหัสอ้างอิง\s*:\s*(\d{10,40})\s*$/gm
  )];

  if (references.length === 1) {
    result.reference = references[0][1];
  } else {
    warnings.push("REFERENCE_UNCLEAR");
  }

  return {
    ...result,
    extractionStatus: warnings.length ? "REVIEW_REQUIRED" : "EXTRACTED",
    warnings
  };
}

module.exports = { parseSlip };
