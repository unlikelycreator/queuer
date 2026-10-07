// Minimal RFC 6238 (TOTP) / RFC 4226 (HOTP) implementation — compatible with Google
// Authenticator, Authy, 1Password, Microsoft Authenticator, etc. No third-party
// dependency so there's nothing extra to audit for something this security-sensitive.
const crypto = require('crypto');

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(input) {
  const clean = String(input).toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error('Invalid base32 character');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function generateSecret(size = 20) {
  return base32Encode(crypto.randomBytes(size));
}

function hotp(secret, counter, digits = 6) {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 10 ** digits).padStart(digits, '0');
}

function totp(secret, { step = 30, time = Date.now() } = {}) {
  return hotp(secret, Math.floor(time / 1000 / step));
}

// Accepts the current code plus one step either side to tolerate clock drift.
function verifyTotp(secret, token, { window = 1, step = 30 } = {}) {
  const code = String(token || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(code)) return false;
  const counter = Math.floor(Date.now() / 1000 / step);
  for (let i = -window; i <= window; i++) {
    const candidate = hotp(secret, counter + i);
    if (crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(code))) return true;
  }
  return false;
}

function otpauthUrl({ secret, label, issuer }) {
  const encodedIssuer = encodeURIComponent(issuer);
  return `otpauth://totp/${encodedIssuer}:${encodeURIComponent(label)}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

module.exports = { generateSecret, totp, verifyTotp, otpauthUrl, base32Encode, base32Decode };
