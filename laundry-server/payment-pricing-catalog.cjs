const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

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

  const get = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });

  try {
    const machine = await get(
      `SELECT machine, shop_id, machine_type, model, program_profile
       FROM machines WHERE machine = ?`,
      [machineId]
    );

    if (!machine) throw new Error('MACHINE_NOT_FOUND');

    let pricing = null;
    let pricingSource = null;

    // 1. Global + exact Model + Profile.
    // 2. Global + wildcard Model (*) + Profile.
    // Global Pricing takes priority so Admin Global Pricing changes
    // are reflected in the WebApp even when Shop Pricing rows exist.
    if (machine.machine_type && machine.program_profile) {
      const modelKeys = machine.model && machine.model !== '*'
        ? [machine.model, '*']
        : ['*'];

      for (const modelKey of modelKeys) {
        const globalRow = await get(
          `SELECT pricing_json
           FROM profile_pricing_v2
           WHERE machine_type = ? AND model = ? AND program_profile = ?`,
          [machine.machine_type, modelKey, machine.program_profile]
        );

        if (globalRow?.pricing_json) {
          pricing = JSON.parse(globalRow.pricing_json);
          pricingSource = modelKey === '*' ? 'global-wildcard' : 'global';
          break;
        }
      }
    }

    // 3. Shop + exact machine + Profile.
    // 4. Shop + shared Profile (machine IS NULL).
    // Shop Pricing is used only when no matching Global Pricing exists.
    if (!pricing && machine.shop_id && machine.program_profile) {
      const shopRow = await get(
        `SELECT machine, pricing_json
         FROM shop_machine_pricing
         WHERE shop_id = ?
           AND program_profile = ?
           AND (machine = ? OR machine IS NULL)
         ORDER BY CASE WHEN machine = ? THEN 0 ELSE 1 END
         LIMIT 1`,
        [machine.shop_id, machine.program_profile, machine.machine, machine.machine]
      );

      if (shopRow?.pricing_json) {
        pricing = JSON.parse(shopRow.pricing_json);
        pricingSource = shopRow.machine === machine.machine ? 'machine' : 'shop';
      }
    }

    // Legacy JSON is retained only as the final compatibility fallback.
    if (!pricing) {
      const legacy = JSON.parse(fs.readFileSync(
        path.join(__dirname, '../shared/payment-pricing.json'),
        'utf8'
      ));
      pricing = legacy[machine.machine_type]?.[machine.machine];
      pricingSource = 'legacy';
    }

    if (!pricing) throw new Error('PRICING_NOT_FOUND');

    return {
      machine: machine.machine,
      type: machine.machine_type,
      pricingSource,
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
