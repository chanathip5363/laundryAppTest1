const fs = require("fs");
const path = require("path");

function quotePrice(input, pricingOverride = null) {
  const pricing = JSON.parse(fs.readFileSync(
    path.join(__dirname, "../shared/payment-pricing.json"),
    "utf8"
  ));

  const {
    machine, type, program,
    tempOption = null,
    aromaOption = false,
    temperatureOption = null,
    wrinkleOption = false
  } = input;

  if (
    !["wash", "dry"].includes(type) ||
    !Number.isInteger(program) ||
    program <= 0
  ) {
    throw new Error("ประเภทบริการหรือโปรแกรมไม่ถูกต้อง");
  }

  const machines = pricing[type];
  if (
    pricingOverride === null &&
    (!machines || !Object.hasOwn(machines, machine))
  ) {
    throw new Error("ไม่พบเครื่องในบริการนี้");
  }

  const config = pricingOverride === null
    ? machines[machine]
    : pricingOverride;
  const groups = Object.entries(config.priceGroups).filter(
    ([, programs]) => programs.includes(program)
  );

  if (groups.length !== 1) {
    throw new Error("ไม่พบราคาของโปรแกรม หรือกำหนดราคาซ้ำ");
  }

  const basePrice = Number(groups[0][0]);
  let temperaturePrice = 0;
  let extraPrice = 0;

  if (type === "wash") {
    if (typeof aromaOption !== "boolean") {
      throw new Error("aromaOption ต้องเป็น true หรือ false");
    }

    if (tempOption !== null && tempOption !== "normal") {
      if (!Object.hasOwn(config.temperaturePrice, tempOption)) {
        throw new Error("ไม่พบราคาอุณหภูมิซัก");
      }
      temperaturePrice = config.temperaturePrice[tempOption];
    }

    if (aromaOption) extraPrice = config.aromaPrice;
  } else {
    if (typeof wrinkleOption !== "boolean") {
      throw new Error("wrinkleOption ต้องเป็น true หรือ false");
    }

    if (temperatureOption !== null) {
      const rule = config.temperatureRule;

      if (!Object.hasOwn(rule.prices, temperatureOption)) {
        throw new Error("ไม่พบตัวเลือกอุณหภูมิอบ");
      }

      if (rule.programs.includes(program)) {
        temperaturePrice = rule.prices[temperatureOption];
      }
    }

    if (wrinkleOption) extraPrice = config.wrinklePrice;
  }

  const amounts = [basePrice, temperaturePrice, extraPrice];
  if (amounts.some(value =>
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0
  )) {
    throw new Error("ค่าราคาในไฟล์ตั้งค่าไม่ถูกต้อง");
  }

  const satang = amounts.map(value => Math.round(value * 100));
  const amountSatang = satang.reduce((total, value) => total + value, 0);

  if (
    satang.some(value => !Number.isSafeInteger(value)) ||
    !Number.isSafeInteger(amountSatang) ||
    amountSatang <= 0
  ) {
    throw new Error("ยอดรวมไม่ถูกต้อง");
  }

  return {
    machine,
    type,
    program,
    basePrice,
    temperaturePrice,
    extraPrice,
    amountSatang,
    amount: amountSatang / 100
  };
}

module.exports = { quotePrice };
