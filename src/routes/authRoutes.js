const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const auth = require('../controllers/authController');
const { googleAuth } = require('../controllers/googleAuthController');
const { protect } = require('../middleware/auth');

// Brute-force protection for credential endpoints.
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many attempts, please try again in a few minutes.' },
});
const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 6,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many reset requests. Please try again later.' },
});

router.post('/register', strictLimiter, auth.registerOwner);
router.post('/join', strictLimiter, auth.joinCompany);
router.post('/login', strictLimiter, auth.login);
router.post('/google', strictLimiter, googleAuth);
router.post('/2fa/verify', strictLimiter, auth.verifyTwoFactorLogin);

router.post('/forgot-password', emailLimiter, auth.forgotPassword);
router.get('/reset-password/:token', strictLimiter, auth.checkResetToken);
router.post('/reset-password/:token', strictLimiter, auth.resetPassword);

router.get('/me', protect, auth.getMe);
router.put('/me', protect, auth.updateMe);
router.put('/password', protect, strictLimiter, auth.changePassword);

router.post('/2fa/setup', protect, auth.setupTwoFactor);
router.post('/2fa/enable', protect, strictLimiter, auth.enableTwoFactor);
router.post('/2fa/disable', protect, strictLimiter, auth.disableTwoFactor);
router.post('/2fa/backup-codes', protect, strictLimiter, auth.regenerateBackupCodes);

module.exports = router;
