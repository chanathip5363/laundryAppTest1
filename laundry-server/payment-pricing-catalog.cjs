const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { getShopPricing } = require('./shop-pricing.cjs');

async function getPricingCatalog(machineId, {
  dbPath = path.join(__dirname, 'database.db')
} = {}) {
  const db = await new Promise((resolve, reject) => {
    const connection = new sqlite3.Database(
      dbPath,
      sqlite3.OPEN_READONLY,
      err => err ? reject(err) : resolve(connection)
    );
  });

  try {
    const machine = await new Promise((resolve, reject) => {
      db.get(
        `SELECT machine, shop_id, machine_type, program_profile
         FROM machines WHERE machine = ?`,
        [machineId],
        (err, row) => err ? reject(err) : resolve(row)
      );
    });

    if (!machine) throw new Error('MACHINE_NOT_FOUND');

    let selected = null;
    if (machine.shop_id && machine.program_profile) {
      selected = await getShopPricing(db, {
        shopId: machine.shop_id,
        machine: machine.machine,
        programProfile: machine.program_profile
      });
    }

    const legacy = JSON.parse(fs.readFileSync(
      path.join(__dirname, '../shared/payment-pricing.json'),
      'utf8'
    ));

    const pricing = selected
      ? selected.pricing
      : legacy[machine.machine_type]?.[machine.machine];

    if (!pricing) throw new Error('PRICING_NOT_FOUND');

    return {
      machine: machine.machine,
      type: machine.machine_type,
      pricingSource: selected ? selected.source : 'legacy',
      priceGroups: pricing.priceGroups,
      ...(machine.machine_type === 'wash'
        ? {
            temperaturePrice: pricing.temperaturePrice,
            aromaPrice: pricing.aromaPrice
          }
        : {
            temperatureRule: pricing.temperatureRule,
            wrinklePrice: pricing.wrinklePrice
          })
    };
  } finally {
    await new Promise(resolve => db.close(() => resolve()));
  }
}

module.exports = { getPricingCatalog };
