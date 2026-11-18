
const { getShopPricing } = require("./shop-pricing.cjs");
const { quotePrice } = require("./payment-price.cjs");

function normalize(value) {
  if (Array.isArray(value)) {
    return value.map(normalize);
  }

  if (value && typeof value === "object") {
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

async function quoteShopPrice(db, input, machineInfo) {
  if (
    !machineInfo ||
    machineInfo.machine !== input.machine ||
    machineInfo.machine_type !== input.type
  ) {
    throw new Error("MACHINE_INFO_MISMATCH");
  }

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

  let pricing = null;
  let pricingSource = null;

  if (machineInfo.machine_type && machineInfo.program_profile) {
    // 1. Exact Model + Profile.
    if (machineInfo.model && machineInfo.model !== "*") {
      const exact = await get(
        `SELECT pricing_json
         FROM profile_pricing_v2
         WHERE machine_type = ?
           AND model = ?
           AND program_profile = ?`,
        [
          machineInfo.machine_type,
          machineInfo.model,
          machineInfo.program_profile
        ]
      );

      if (exact?.pricing_json) {
        pricing = JSON.parse(exact.pricing_json);
        pricingSource = "global";
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
        [machineInfo.machine_type, machineInfo.program_profile]
      );

      if (wildcard?.pricing_json) {
        pricing = JSON.parse(wildcard.pricing_json);
        pricingSource = "global-wildcard";
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
          machineInfo.machine_type,
          machineInfo.program_profile,
          machineInfo.model || ""
        ]
      );

      if (sharedRows.length > 0) {
        const firstPricing = JSON.parse(sharedRows[0].pricing_json);

        const hasDifferentPrice = sharedRows.some(row =>
          !samePricing(firstPricing, JSON.parse(row.pricing_json))
        );

        if (hasDifferentPrice) {
          throw new Error("PRICING_PROFILE_AMBIGUOUS");
        }

        pricing = firstPricing;
        pricingSource = "global-shared";
      }
    }
  }

  // 4. Shop Pricing fallback.
  if (!pricing && machineInfo.shop_id && machineInfo.program_profile) {
    const selected = await getShopPricing(db, {
      shopId: machineInfo.shop_id,
      machine: machineInfo.machine,
      programProfile: machineInfo.program_profile
    });

    if (selected) {
      pricing = selected.pricing;
      pricingSource = selected.source;
    }
  }

  // 5. Legacy JSON fallback.
  const quote = quotePrice(input, pricing);

  return {
    ...quote,
    pricingSource: pricingSource || "legacy"
  };
}

module.exports = { quoteShopPrice };
