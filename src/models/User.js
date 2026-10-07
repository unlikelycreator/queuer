const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: {
      type: String,
      minlength: 8,
      select: false,
      required: function () {
        return !this.googleId;
      },
    },
    googleId: { type: String, unique: true, sparse: true },
    avatarUrl: { type: String },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member'],
      default: 'member',
    },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    avatarColor: { type: String, default: '#10b981' },
    jobTitle: { type: String, trim: true, maxlength: 80 },
    isActive: { type: Boolean, default: true },

    // Two-factor authentication (TOTP). The secret is stored encrypted at rest; backup
    // codes are stored as SHA-256 hashes and removed once used.
    twoFactor: {
      enabled: { type: Boolean, default: false },
      secretEncrypted: { type: String, select: false },
      pendingSecretEncrypted: { type: String, select: false },
      backupCodes: { type: [String], select: false, default: undefined },
      enabledAt: { type: Date },
    },

    // Password reset — only the SHA-256 hash of the emailed token is stored.
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    // Any JWT issued before this moment is rejected (logs out other sessions after a
    // password change/reset).
    passwordChangedAt: { type: Date },

    lastLoginAt: { type: Date },
    failedLoginAttempts: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, select: false },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  if (!this.isNew) this.passwordChangedAt = new Date(Date.now() - 1000);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  return bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.createPasswordResetToken = function () {
  const raw = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(raw).digest('hex');
  this.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
  return raw;
};

userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Never leak secrets in JSON responses, even if a query accidentally selected them.
userSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.password;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
    delete ret.failedLoginAttempts;
    delete ret.lockUntil;
    if (ret.twoFactor) {
      delete ret.twoFactor.secretEncrypted;
      delete ret.twoFactor.pendingSecretEncrypted;
      delete ret.twoFactor.backupCodes;
    }
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
