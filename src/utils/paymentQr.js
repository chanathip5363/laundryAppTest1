const RECEIVER = "0016A0000006770101110315004999254312902";

function crc16(text) {
  let crc = 0xffff;
  for (const char of text) {
    crc ^= char.charCodeAt(0) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = ((crc & 0x8000)
        ? (crc << 1) ^ 0x1021
        : crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function field(id, value) {
  return id + String(value.length).padStart(2, "0") + value;
}

export function getPaymentQrUrl(amount) {
  const satang = Math.round(amount * 100);

  if (
    typeof amount !== "number" ||
    !Number.isFinite(amount) ||
    !Number.isSafeInteger(satang) ||
    satang <= 0 ||
    Math.abs(amount * 100 - satang) > 0.000001
  ) {
    throw new Error("ยอดชำระไม่ถูกต้อง");
  }

  const text =
    field("00", "01") +
    field("01", "12") +
    field("29", RECEIVER) +
    field("53", "764") +
    field("54", (satang / 100).toFixed(2)) +
    field("58", "TH") +
    "6304";

  const payload = text + crc16(text);

  return "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=" +
    encodeURIComponent(payload);
}
