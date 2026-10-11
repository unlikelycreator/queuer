const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const User = require('../models/User');
const Company = require('../models/Company');
const { generateToken, generateTwoFactorToken } = require('../utils/generateToken');
const { randomColor } = require('../utils/colors');
const { encrypt, decrypt } = require('../utils/crypto');
const { generateSecret, verifyTotp, otpauthUrl } = require('../utils/totp');
const { sendSystemMail, appUrl } = require('../services/mailSender');
const { escapeHtml } = require('../utils/sanitize');
const { renderEmail } = require('../services/emailTemplate');
const { TEMPLATES, slaPolicies } = require('../config/workspaceTemplates');

// Applies a workspace template to a brand-new company (no tickets to preserve yet).
function seedWorkspace(company, key) {
  const tpl = TEMPLATES[key];
  if (!tpl) return;
  company.workspace.template = tpl.key;
  company.workspace.terminology = { ...tpl.terminology };
  company.workspace.ticketTypes = tpl.ticketTypes.map((t) => ({ ...t }));
  company.workspace.customFields = tpl.customFields.map((f) => ({ options: [], ...f }));
  const policies = slaPolicies(tpl);
  ['low', 'medium', 'high', 'critical'].forEach((p) => (company.sla[p] = policies[p]));
  company.workspace.configured = true;
}

const MIN_PASSWORD = 8;
const MAX_FAILED_LOGINS = 8;
const LOCK_MINUTES = 15;
const APP_NAME = process.env.APP_NAME || 'ZoopDesk';

function validatePassword(password) {
  if (!password || password.length < MIN_PASSWORD) {
    return `Password must be at least ${MIN_PASSWORD} characters`;
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Password must contain at least one letter and one number';
  }
  return null;
}

const hashCode = (code) =>
  crypto.createHash('sha256').update(String(code).replace(/[\s-]/g, '').toUpperCase()).digest('hex');

function generateBackupCodes(count = 10) {
  const plain = Array.from({ length: count }, () => {
    const raw = crypto.randomBytes(5).toString('hex').toUpperCase(); // 10 chars
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
  return { plain, hashed: plain.map(hashCode) };
}

// Shape of the user object returned to the frontend after any successful login.
async function sessionPayload(user) {
  await user.populate('company', 'name inviteCode');
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarColor: user.avatarColor,
    avatarUrl: user.avatarUrl,
    jobTitle: user.jobTitle,
    company: user.company,
    twoFactor: { enabled: !!user.twoFactor?.enabled },
    hasPassword: !!user.password,
    token: generateToken(user._id),
  };
}

// Either completes the login, or — if the account has 2FA on — returns a short-lived
// challenge token that must be exchanged via /auth/2fa/verify.
async function finishLogin(user, res, status = 200) {
  if (user.twoFactor?.enabled) {
    return res.status(200).json({ twoFactorRequired: true, tempToken: generateTwoFactorToken(user._id) });
  }
  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });
  return res.status(status).json(await sessionPayload(user));
}

// @desc    Register first user (owner) + create company
// @route   POST /api/auth/register
const registerOwner = async (req, res, next) => {
  try {
    const { name, email, password, companyName } = req.body;

    if (!name || !email || !password || !companyName) {
      res.status(400);
      throw new Error('Please provide name, email, password and company name');
    }
    const pwError = validatePassword(password);
    if (pwError) {
      res.status(400);
      throw new Error(pwError);
    }

    const existingUser = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (existingUser) {
      res.status(400);
      throw new Error('An account with this email already exists');
    }

    const company = await Company.create({
      name: companyName,
      owner: null,
      inviteCode: crypto.randomBytes(4).toString('hex').toUpperCase(),
    });

    const user = await User.create({
      name,
      email,
      password,
      role: 'owner',
      company: company._id,
      avatarColor: randomColor(),
      lastLoginAt: new Date(),
    });

    company.owner = user._id;
    seedWorkspace(company, req.body.template);
    await company.save();

    res.status(201).json(await sessionPayload(user));
  } catch (error) {
    next(error);
  }
};

// @desc    Register a user under an existing company using invite code
// @route   POST /api/auth/join
const joinCompany = async (req, res, next) => {
  try {
    const { name, email, password, inviteCode } = req.body;

    if (!name || !email || !password || !inviteCode) {
      res.status(400);
      throw new Error('Please provide name, email, password and invite code');
    }
    const pwError = validatePassword(password);
    if (pwError) {
      res.status(400);
      throw new Error(pwError);
    }

    const company = await Company.findOne({ inviteCode: String(inviteCode).toUpperCase().trim() });
    if (!company) {
      res.status(400);
      throw new Error('Invalid invite code');
    }

    const existingUser = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (existingUser) {
      res.status(400);
      throw new Error('An account with this email already exists');
    }

    const user = await User.create({
      name,
      email,
      password,
      role: 'member',
      company: company._id,
      avatarColor: randomColor(),
      lastLoginAt: new Date(),
    });

    res.status(201).json(await sessionPayload(user));
  } catch (error) {
    next(error);
  }
};

// @desc    Login (step 1 — password)
// @route   POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400);
      throw new Error('Please provide email and password');
    }

    const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select(
      '+password +failedLoginAttempts +lockUntil'
    );

    if (!user) {
      res.status(401);
      throw new Error('Invalid email or password');
    }

    if (user.isLocked()) {
      res.status(429);
      throw new Error('Too many failed attempts. Try again in a few minutes or reset your password.');
    }

    if (!user.password) {
      res.status(400);
      throw new Error('This account uses Google Sign-In. Use "Continue with Google", or set a password via "Forgot password".');
    }

    if (!(await user.matchPassword(password))) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= MAX_FAILED_LOGINS) {
        user.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
        user.failedLoginAttempts = 0;
      }
      await user.save({ validateBeforeSave: false });
      res.status(401);
      throw new Error('Invalid email or password');
    }

    if (!user.isActive) {
      res.status(403);
      throw new Error('Your account has been deactivated. Contact your company owner.');
    }

    if (user.failedLoginAttempts || user.lockUntil) {
      user.failedLoginAttempts = 0;
      user.lockUntil = undefined;
    }

    return finishLogin(user, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Login (step 2 — TOTP code or a one-time backup code)
// @route   POST /api/auth/2fa/verify
const verifyTwoFactorLogin = async (req, res, next) => {
  try {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) {
      res.status(400);
      throw new Error('Verification code is required');
    }

    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch {
      res.status(401);
      throw new Error('Your sign-in session expired. Please log in again.');
    }
    if (decoded.purpose !== '2fa') {
      res.status(401);
      throw new Error('Invalid sign-in session');
    }

    const user = await User.findById(decoded.id).select('+twoFactor.secretEncrypted +twoFactor.backupCodes');
    if (!user || !user.isActive || !user.twoFactor?.enabled) {
      res.status(401);
      throw new Error('Invalid sign-in session');
    }

    const secret = decrypt(user.twoFactor.secretEncrypted);
    const cleaned = String(code).trim();
    let ok = secret && verifyTotp(secret, cleaned);
    let usedBackup = false;

    if (!ok) {
      const hashed = hashCode(cleaned);
      const idx = (user.twoFactor.backupCodes || []).indexOf(hashed);
      if (idx !== -1) {
        user.twoFactor.backupCodes.splice(idx, 1);
        ok = true;
        usedBackup = true;
      }
    }

    if (!ok) {
      res.status(401);
      throw new Error('That code is incorrect or has expired');
    }

    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });
    const payload = await sessionPayload(user);
    if (usedBackup) payload.backupCodesRemaining = user.twoFactor.backupCodes.length;
    res.json(payload);
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('+password').populate('company', 'name inviteCode');
    const json = user.toJSON();
    json.hasPassword = !!user.password;
    res.json(json);
  } catch (error) {
    next(error);
  }
};

// @desc    Update own profile (name, job title, avatar colour)
// @route   PUT /api/auth/me
const updateMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const { name, jobTitle, avatarColor } = req.body;
    if (name !== undefined) {
      if (!String(name).trim()) {
        res.status(400);
        throw new Error('Name cannot be empty');
      }
      user.name = String(name).trim();
    }
    if (jobTitle !== undefined) user.jobTitle = String(jobTitle).trim();
    if (avatarColor && /^#[0-9a-f]{6}$/i.test(avatarColor)) user.avatarColor = avatarColor;
    await user.save();
    await user.populate('company', 'name inviteCode');
    res.json(user);
  } catch (error) {
    next(error);
  }
};

// @desc    Change password (requires current password if one is set)
// @route   PUT /api/auth/password
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    if (user.password && !(await user.matchPassword(currentPassword || ''))) {
      res.status(400);
      throw new Error('Current password is incorrect');
    }
    const pwError = validatePassword(newPassword);
    if (pwError) {
      res.status(400);
      throw new Error(pwError);
    }

    user.password = newPassword;
    await user.save();
    // Issue a fresh token so this session survives the passwordChangedAt cut-off.
    res.json({ message: 'Password updated', token: generateToken(user._id) });
  } catch (error) {
    next(error);
  }
};

// @desc    Request a password reset email
// @route   POST /api/auth/forgot-password
const forgotPassword = async (req, res, next) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    const generic = {
      message: 'If an account exists for that email, a password reset link is on its way.',
    };
    if (!email) {
      res.status(400);
      throw new Error('Email is required');
    }

    const user = await User.findOne({ email });
    // Always answer the same way so the endpoint can't be used to discover accounts.
    if (!user || !user.isActive) return res.json(generic);

    const rawToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    const resetUrl = appUrl(`/reset-password/${rawToken}`);
    const company = await Company.findById(user.company);
    await sendSystemMail(company, {
      to: user.email,
      subject: `Reset your ${APP_NAME} password`,
      text: `Hi ${user.name},\n\nWe received a request to reset your ${APP_NAME} password. Use the link below within 30 minutes:\n\n${resetUrl}\n\nIf you didn't ask for this, you can safely ignore this email.`,
      html: renderEmail({
        brand: APP_NAME,
        heading: 'Reset your password',
        body: `<p>Hi ${escapeHtml(user.name)},</p><p>We received a request to reset your password. This link is valid for <strong>30 minutes</strong>.</p><p style="color:#6b8577;font-size:13px">If you didn't ask for this, you can safely ignore this email — your password won't change.</p>`,
        cta: { label: 'Choose a new password', url: resetUrl },
      }),
    });

    res.json(generic);
  } catch (error) {
    next(error);
  }
};

// @desc    Check a reset token is still valid (so the page can show an error up front)
// @route   GET /api/auth/reset-password/:token
const checkResetToken = async (req, res, next) => {
  try {
    const hashed = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({ passwordResetToken: hashed, passwordResetExpires: { $gt: new Date() } });
    if (!user) {
      res.status(400);
      throw new Error('This reset link is invalid or has expired');
    }
    res.json({ valid: true, email: user.email });
  } catch (error) {
    next(error);
  }
};

// @desc    Set a new password using the emailed token
// @route   POST /api/auth/reset-password/:token
const resetPassword = async (req, res, next) => {
  try {
    const hashed = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({
      passwordResetToken: hashed,
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetToken +passwordResetExpires +password');

    if (!user) {
      res.status(400);
      throw new Error('This reset link is invalid or has expired');
    }

    const pwError = validatePassword(req.body.password);
    if (pwError) {
      res.status(400);
      throw new Error(pwError);
    }

    user.password = req.body.password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    res.json({ message: 'Password has been reset. You can now log in.' });
  } catch (error) {
    next(error);
  }
};

// @desc    Start 2FA setup — returns a QR code and the secret for manual entry
// @route   POST /api/auth/2fa/setup
const setupTwoFactor = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('company', 'name');
    if (user.twoFactor?.enabled) {
      res.status(400);
      throw new Error('Two-factor authentication is already enabled');
    }
    const secret = generateSecret();
    user.twoFactor = user.twoFactor || {};
    user.twoFactor.pendingSecretEncrypted = encrypt(secret);
    await user.save({ validateBeforeSave: false });

    const url = otpauthUrl({ secret, label: user.email, issuer: APP_NAME });
    const qrCode = await QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: '#0b2a1c', light: '#ffffff' } });
    res.json({ secret, otpauthUrl: url, qrCode });
  } catch (error) {
    next(error);
  }
};

// @desc    Confirm 2FA setup with a code from the app — turns 2FA on and returns backup codes
// @route   POST /api/auth/2fa/enable
const enableTwoFactor = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('+twoFactor.pendingSecretEncrypted');
    const pending = decrypt(user.twoFactor?.pendingSecretEncrypted);
    if (!pending) {
      res.status(400);
      throw new Error('Start the setup again — no pending 2FA secret found');
    }
    if (!verifyTotp(pending, req.body.code)) {
      res.status(400);
      throw new Error('That code is incorrect. Check your authenticator app and try again.');
    }
    const { plain, hashed } = generateBackupCodes();
    user.twoFactor.secretEncrypted = encrypt(pending);
    user.twoFactor.pendingSecretEncrypted = undefined;
    user.twoFactor.backupCodes = hashed;
    user.twoFactor.enabled = true;
    user.twoFactor.enabledAt = new Date();
    await user.save({ validateBeforeSave: false });
    res.json({ enabled: true, backupCodes: plain });
  } catch (error) {
    next(error);
  }
};

async function assertSecondFactorOrPassword(user, { password, code }) {
  const withSecrets = await User.findById(user._id).select('+password +twoFactor.secretEncrypted +twoFactor.backupCodes');
  if (password && withSecrets.password && (await withSecrets.matchPassword(password))) return withSecrets;
  if (code) {
    const secret = decrypt(withSecrets.twoFactor?.secretEncrypted);
    if (secret && verifyTotp(secret, code)) return withSecrets;
    if ((withSecrets.twoFactor?.backupCodes || []).includes(hashCode(code))) return withSecrets;
  }
  return null;
}

// @desc    Turn 2FA off (requires password or a current code)
// @route   POST /api/auth/2fa/disable
const disableTwoFactor = async (req, res, next) => {
  try {
    const user = await assertSecondFactorOrPassword(req.user, req.body);
    if (!user) {
      res.status(400);
      throw new Error('Enter your password or a valid authenticator code to disable 2FA');
    }
    user.twoFactor = { enabled: false };
    await user.save({ validateBeforeSave: false });
    res.json({ enabled: false });
  } catch (error) {
    next(error);
  }
};

// @desc    Replace backup codes (requires a current authenticator code)
// @route   POST /api/auth/2fa/backup-codes
const regenerateBackupCodes = async (req, res, next) => {
  try {
    const user = await assertSecondFactorOrPassword(req.user, { code: req.body.code });
    if (!user || !user.twoFactor?.enabled) {
      res.status(400);
      throw new Error('Enter a valid authenticator code');
    }
    const { plain, hashed } = generateBackupCodes();
    user.twoFactor.backupCodes = hashed;
    await user.save({ validateBeforeSave: false });
    res.json({ backupCodes: plain });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerOwner,
  joinCompany,
  login,
  verifyTwoFactorLogin,
  getMe,
  updateMe,
  changePassword,
  forgotPassword,
  checkResetToken,
  resetPassword,
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
  regenerateBackupCodes,
  finishLogin,
  validatePassword,
};
