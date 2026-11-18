
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

function normalize(value) {
  if (Array.isArray(value)) {
    return value.map(normalize);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = normalize(value[key]);
        return result;
      }, {});
  }

  return value;
}

function samePricing(a, b) {
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

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
    db.get(sql, params, (err, row) =>
      err ? reject(err) : resolve(row)
    );
  });

  const all = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) =>
      err ? reject(err) : resolve(rows || [])
    );
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

    if (machine.machine_type && machine.program_profile) {
      // 1. Exact Model + Profile.
      if (machine.model && machine.model !== '*') {
        const exact = await get(
          `SELECT pricing_json
           FROM profile_pricing_v2
           WHERE machine_type = ?
             AND model = ?
             AND program_profile = ?`,
          [
            machine.machine_type,
            machine.model,
            machine.program_profile
          ]
        );

        if (exact?.pricing_json) {
          pricing = JSON.parse(exact.pricing_json);
          pricingSource = 'global';
        }
      }

      // 2. Explicit shared Global Pricing (*).
      if (!pricing) {
        const wildcard = await get(
          `SELECT pricing_json
           FROM profile_pricing_v2
           WHERE machine_type = ?
             AND model = '*'
             AND program_profile = ?`,
          [machine.machine_type, machine.program_profile]
        );

        if (wildcard?.pricing_json) {
          pricing = JSON.parse(wildcard.pricing_json);
          pricingSource = 'global-wildcard';
        }
      }

      // 3. Reuse the same Profile from another Model
      // only when every matching price is identical.
      if (!pricing) {
        const sharedRows = await all(
          `SELECT model, pricing_json
           FROM profile_pricing_v2
           WHERE machine_type = ?
             AND program_profile = ?
             AND model IS NOT NULL
             AND model <> '*'
             AND model <> ?`,
          [
            machine.machine_type,
            machine.program_profile,
            machine.model || ''
          ]
        );

        if (sharedRows.length > 0) {
          const firstPricing = JSON.parse(sharedRows[0].pricing_json);

          const hasDifferentPrice = sharedRows.some(row =>
            !samePricing(firstPricing, JSON.parse(row.pricing_json))
          );

          if (hasDifferentPrice) {
            throw new Error('PRICING_PROFILE_AMBIGUOUS');
          }

          pricing = firstPricing;
          pricingSource = 'global-shared';
        }
      }
    }

    // 4. Shop Pricing fallback.
    if (!pricing && machine.shop_id && machine.program_profile) {
      const shopRow = await get(
        `SELECT machine, pricing_json
         FROM shop_machine_pricing
         WHERE shop_id = ?
           AND program_profile = ?
           AND (machine = ? OR machine IS NULL)
         ORDER BY CASE WHEN machine = ? THEN 0 ELSE 1 END
         LIMIT 1`,
        [
          machine.shop_id,
          machine.program_profile,
          machine.machine,
          machine.machine
        ]
      );

      if (shopRow?.pricing_json) {
        pricing = JSON.parse(shopRow.pricing_json);
        pricingSource = shopRow.machine === machine.machine
          ? 'machine'
          : 'shop';
      }
    }

    // 5. Legacy JSON fallback.
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
