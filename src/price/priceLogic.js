export function calculateTotalPrice({
  programPrice,
  tempOption,
  aromaOption,
  tempPriceMap,
  aromaPrice = 5,
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
    total += aromaPrice;
  }


  console.log("totalPrice : ", total);

  return total;
}