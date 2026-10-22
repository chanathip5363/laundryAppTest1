const sqlite3 = require("sqlite3").verbose();
const path = require("path");

async function findSmsCandidates(slip) {
  if (
    slip.extractionStatus !== "EXTRACTED" ||
    !Array.isArray(slip.warnings) ||
    slip.warnings.length > 0 ||
    slip.receivingBank !== "KBANK" ||
    !/^\d{4}$/.test(slip.receivingAccountSuffix || "") ||
    !Number.isSafeInteger(slip.amountSatang) ||
    slip.amountSatang <= 0
  ) {
    return { status: "REVIEW_REQUIRED", smsIds: [] };
  }

  const date = (slip.transferDate || "").match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (!date || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(
    slip.transferTime || ""
  )) {
    return { status: "REVIEW_REQUIRED", smsIds: [] };
  }

  const buddhistYear = Number(date[1]) + 543;
  const shortYear = String(buddhistYear).slice(-2);
  const shortDate = `${date[3]}/${date[2]}/${shortYear}`;
  const fullDate = `${date[3]}/${date[2]}/${buddhistYear}`;

  const rows = await new Promise((resolve, reject) => {
    const db = new sqlite3.Database(
      path.join(__dirname, "database.db"),
      sqlite3.OPEN_READONLY,
      err => {
        if (err) return reject(err);

        db.all(
          `SELECT id FROM sms_messages
           WHERE is_test = 0
             AND parse_status = 'PARSED'
             AND receiving_account = ?
             AND amount_satang = ?
             AND bank_time = ?
             AND bank_date IN (?, ?)
           ORDER BY id`,
          [
            "X-" + slip.receivingAccountSuffix,
            slip.amountSatang,
            slip.transferTime,
            shortDate,
            fullDate
          ],
          (err, rows) => {
            db.close(closeErr => {
              if (err || closeErr) reject(err || closeErr);
              else resolve(rows);
            });
          }
        );
      }
    );
  });

  return {
    status: rows.length === 0
      ? "NO_CANDIDATE"
      : rows.length === 1
        ? "ONE_CANDIDATE"
        : "MULTIPLE_CANDIDATES",
    smsIds: rows.map(row => row.id)
  };
}

module.exports = { findSmsCandidates };
