function initializeReceipts(db) {
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS payment_receipts (
        txid TEXT PRIMARY KEY NOT NULL,
        sms_id INTEGER NOT NULL UNIQUE,
        slip_bank TEXT NOT NULL,
        slip_reference TEXT NOT NULL,
        amount_satang INTEGER NOT NULL
          CHECK (amount_satang > 0),
        verified_at INTEGER NOT NULL,
        UNIQUE (slip_bank, slip_reference),
        FOREIGN KEY (txid) REFERENCES payment_orders(txid),
        FOREIGN KEY (sms_id) REFERENCES sms_messages(id)
      )
    `, err => {
      if (err) reject(err);
      else resolve();
    });
  });
}

module.exports = { initializeReceipts };
