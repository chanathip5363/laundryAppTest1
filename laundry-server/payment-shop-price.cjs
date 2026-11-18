
const { getShopPricing } = require("./shop-pricing.cjs");
const { quotePrice } = require("./payment-price.cjs");

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

  let pricing = null;
  let pricingSource = null;

  // 1. Global Pricing: exact model, then wildcard.
  if (machineInfo.machine_type && machineInfo.program_profile) {
    const modelKeys =
      machineInfo.model && machineInfo.model !== "*"
        ? [machineInfo.model, "*"]
        : ["*"];

    for (const modelKey of modelKeys) {
      const row = await get(
        `SELECT pricing_json
         FROM profile_pricing_v2
         WHERE machine_type = ?
           AND model = ?
           AND program_profile = ?`,
        [
          machineInfo.machine_type,
          modelKey,
          machineInfo.program_profile
        ]
      );

      if (row?.pricing_json) {
        pricing = JSON.parse(row.pricing_json);
        pricingSource =
          modelKey === "*" ? "global-wildcard" : "global";
        break;
      }
    }
  }

  // 2. Shop Pricing fallback.
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

  // 3. Legacy JSON fallback.
  const quote = quotePrice(input, pricing);

  return {
    ...quote,
    pricingSource: pricingSource || "legacy"
  };
}

module.exports = { quoteShopPrice };
