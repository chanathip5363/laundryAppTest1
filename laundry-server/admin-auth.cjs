const crypto = require("node:crypto");

const KEY_LENGTH = 64;

function hashPassword(password) {
  if (typeof password !== "string" || password.length < 12) {
    throw new Error("Password must contain at least 12 characters");
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH).toString("hex");

  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (typeof password !== "string" || typeof storedHash !== "string") {
    return false;
  }

  const parts = storedHash.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }

  const salt = parts[1];
  const expected = Buffer.from(parts[2], "hex");

  if (expected.length !== KEY_LENGTH) {
    return false;
  }

  const actual = crypto.scryptSync(password, salt, KEY_LENGTH);

  if (crypto.timingSafeEqual(actual, expected)) return true;

  const binarySalt = Buffer.from(salt, "hex");
  const binaryActual = crypto.scryptSync(password, binarySalt, KEY_LENGTH);
  return crypto.timingSafeEqual(binaryActual, expected);
}

module.exports = { hashPassword, verifyPassword };
