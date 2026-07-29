export function calculateTotalPrice({
  programPrice,
  tempOption,
  aromaOption,
  tempPriceMap,
}) {

  console.log("programPrice : ", programPrice);

  let total = 0;


  // ราคาหลักของโปรแกรม
  if (programPrice) {
    total += programPrice;
  }


  // ราคาเพิ่มอุณหภูมิ
  if (tempOption) {
    total += tempPriceMap[tempOption] ?? 0;
  }


  // Aroma
  if (aromaOption) {
    total += 5;
  }


  console.log("totalPrice : ", total);

  return total;
}