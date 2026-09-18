// Simple at-rest encryption for storing IMAP passwords in MongoDB (AES-256-GCM).
// Uses ENCRYPTION_KEY from .env; falls back to deriving one from JWT_SECRET so the
// app still works if the person forgot to set it, but a dedicated key is recommended.
const crypto = require('crypto');

function getKey() {
  const raw = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'queuer_fallback_key';
  return crypto.createHash('sha256').update(raw).digest(); // 32 bytes for AES-256
}

function encrypt(plainText) {
  if (!plainText) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decrypt(payload) {
  if (!payload) return '';
  try {
    const buf = Buffer.from(payload, 'base64');
    const iv = buf.subarray(0, 12);
    const authTag = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch (err) {
    return '';
  }
}

module.exports = { encrypt, decrypt };
