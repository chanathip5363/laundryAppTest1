export function calculateDryTotalPrice({
  basePrice,
  temperatureOption,
  wrinkleOption,
  dryerType,
}) {
  let total = basePrice || 0;

  // TCL Dry1
  if (dryerType === "dry1") {
    if (temperatureOption === "normal") {
      total += 5;
    }

    if (temperatureOption === "extra") {
      total += 10;
    }
  }

  // Dry2 / Dry3 เดิม
  else {
    if (temperatureOption === "medium") {
      total += 5;
    }

    if (temperatureOption === "high") {
      total += 10;
    }
  }

  if (wrinkleOption) {
    total += 5;
  }

  return total;
}