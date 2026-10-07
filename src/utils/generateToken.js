const jwt = require('jsonwebtoken');

// Full session token for an authenticated user.
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

// Short-lived token proving the password (or Google) step succeeded, which can only be
// exchanged for a real session once the 2FA code is verified.
const generateTwoFactorToken = (id) => {
  return jwt.sign({ id, purpose: '2fa' }, process.env.JWT_SECRET, { expiresIn: '10m' });
};

module.exports = generateToken;
module.exports.generateToken = generateToken;
module.exports.generateTwoFactorToken = generateTwoFactorToken;
