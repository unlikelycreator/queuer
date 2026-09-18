const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');
const User = require('../models/User');
const Company = require('../models/Company');
const generateToken = require('../utils/generateToken');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function randomColor() {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#3b82f6'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// @desc    Sign in / sign up / join a company with Google
// @route   POST /api/auth/google
// @access  Public
// body: { idToken, mode: 'register' | 'join' | 'login', companyName?, inviteCode? }
const googleAuth = async (req, res, next) => {
  try {
    if (!process.env.GOOGLE_CLIENT_ID) {
      res.status(500);
      throw new Error('Google Sign-In is not configured on the server (missing GOOGLE_CLIENT_ID)');
    }

    const { idToken, mode, companyName, inviteCode } = req.body;
    if (!idToken) {
      res.status(400);
      throw new Error('Missing Google credential');
    }

    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture, email_verified: emailVerified } = payload;

    if (!emailVerified) {
      res.status(400);
      throw new Error('Your Google email is not verified');
    }

    // Existing account (by googleId or matching email) -> just log them in.
    let user = await User.findOne({ $or: [{ googleId }, { email }] }).populate('company', 'name inviteCode');

    if (user) {
      if (!user.isActive) {
        res.status(403);
        throw new Error('Your account has been deactivated. Contact your company owner.');
      }
      if (!user.googleId) {
        user.googleId = googleId;
        if (!user.avatarUrl) user.avatarUrl = picture;
        await user.save();
      }
      return res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarColor: user.avatarColor,
        avatarUrl: user.avatarUrl,
        company: user.company,
        token: generateToken(user._id),
      });
    }

    // New account — need to know whether they're creating a workspace or joining one.
    if (mode === 'join') {
      if (!inviteCode) {
        res.status(400);
        throw new Error('An invite code is required to join a company');
      }
      const company = await Company.findOne({ inviteCode: inviteCode.toUpperCase().trim() });
      if (!company) {
        res.status(400);
        throw new Error('Invalid invite code');
      }
      user = await User.create({
        name,
        email,
        googleId,
        avatarUrl: picture,
        role: 'member',
        company: company._id,
        avatarColor: randomColor(),
      });
      return res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        company: { _id: company._id, name: company.name },
        token: generateToken(user._id),
      });
    }

    if (mode === 'register') {
      if (!companyName) {
        res.status(400);
        throw new Error('Company name is required to create a workspace');
      }
      const inviteCodeValue = crypto.randomBytes(4).toString('hex').toUpperCase();
      const company = await Company.create({ name: companyName, owner: null, inviteCode: inviteCodeValue });
      user = await User.create({
        name,
        email,
        googleId,
        avatarUrl: picture,
        role: 'owner',
        company: company._id,
        avatarColor: randomColor(),
      });
      company.owner = user._id;
      await company.save();
      return res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        company: { _id: company._id, name: company.name, inviteCode: company.inviteCode },
        token: generateToken(user._id),
      });
    }

    // mode === 'login' (or unspecified) but no account exists yet
    res.status(404);
    throw new Error('No account found for this Google email. Sign up or ask for an invite code first.');
  } catch (error) {
    next(error);
  }
};

module.exports = { googleAuth };
