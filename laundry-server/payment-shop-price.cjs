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

  let selectedPricing = null;

  if (machineInfo.shop_id && machineInfo.program_profile) {
    selectedPricing = await getShopPricing(db, {
      shopId: machineInfo.shop_id,
      machine: machineInfo.machine,
      programProfile: machineInfo.program_profile
    });
  }

  const quote = quotePrice(
    input,
    selectedPricing ? selectedPricing.pricing : null
  );

  return {
    ...quote,
    pricingSource: selectedPricing ? selectedPricing.source : "legacy"
  };
}

module.exports = { quoteShopPrice };
