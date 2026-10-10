export function calculateDryTotalPrice({
  basePrice,
  program,
  temperatureOption,
  wrinkleOption,
  dryerType,
}) {
  let total = basePrice || 0;

  // TCL Dry1
  if (dryerType === "dry1") {
    // Program 1-7 สามารถปรับอุณหภูมิได้
    if (program >= 1 && program <= 7) {
      if (temperatureOption === "normal") {
        total += 5;
      }

      if (temperatureOption === "extra") {
        total += 10;
      }
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
      if (dryerType === "dry2") {
        total += 3;
      } else if (dryerType === "dry3") {
        total += 8;
      } else if (dryerType === "dry4") {
        total += 6;        
      } else {
        total += 5;
      }
    }


  return total;
}