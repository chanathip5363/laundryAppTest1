const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { quoteShopPrice } = require('./payment-shop-price.cjs');

async function getPaymentQuote(input, {
  dbPath = path.join(__dirname, 'database.db')
} = {}) {
  const db = await new Promise((resolve, reject) => {
    const connection = new sqlite3.Database(
      dbPath, sqlite3.OPEN_READONLY,
      err => err ? reject(err) : resolve(connection)
    );
  });

  try {
    const machine = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM machines WHERE machine = ?',
        [input.machine],
        (err, row) => err ? reject(err) : resolve(row)
      );
    });

    if (!machine) throw new Error('MACHINE_NOT_FOUND');
    return await quoteShopPrice(db, input, machine);
  } finally {
    await new Promise(resolve => db.close(() => resolve()));
  }
}

module.exports = { getPaymentQuote };
