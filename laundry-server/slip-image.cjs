const sharp = require("sharp");

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_PIXELS = 20 * 1000 * 1000;

async function prepareSlipImage(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("IMAGE_REQUIRED");
  }

  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error("IMAGE_TOO_LARGE");
  }

  const isJpeg =
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;

  const isPng =
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    );

  if (!isJpeg && !isPng) {
    throw new Error("IMAGE_TYPE_UNSUPPORTED");
  }

  try {
    const image = sharp(buffer, {
      limitInputPixels: MAX_PIXELS,
      failOn: "warning"
    });

    const metadata = await image.metadata();

    if (!["jpeg", "png"].includes(metadata.format)) {
      throw new Error("IMAGE_INVALID");
    }

    if (
      !metadata.width ||
      !metadata.height ||
      metadata.width * metadata.height > MAX_PIXELS ||
      (metadata.pages || 1) !== 1
    ) {
      throw new Error("IMAGE_INVALID");
    }

    // ตรวจว่าอ่านภาพได้ครบ และจัดแนวตามข้อมูลการหมุนในไฟล์
    return await image.rotate().png().toBuffer();
  } catch (err) {
    throw new Error("IMAGE_INVALID");
  }
}

module.exports = { prepareSlipImage, MAX_FILE_BYTES };
