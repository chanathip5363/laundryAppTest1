export function calculateDryTotalPrice({
  basePrice,
  temperatureOption,
  wrinkleOption,
}) {
  let total = basePrice || 0;

  if (temperatureOption === "medium") {
    total += 5;
  }

  if (temperatureOption === "high") {
    total += 10;
  }

  if (wrinkleOption) {
    total += 5;
  }

  return total;
}