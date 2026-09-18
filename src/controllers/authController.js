const crypto = require('crypto');
const User = require('../models/User');
const Company = require('../models/Company');
const generateToken = require('../utils/generateToken');

// @desc    Register first user (owner) + create company
// @route   POST /api/auth/register
// @access  Public
const registerOwner = async (req, res, next) => {
  try {
    const { name, email, password, companyName } = req.body;

    if (!name || !email || !password || !companyName) {
      res.status(400);
      throw new Error('Please provide name, email, password and company name');
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400);
      throw new Error('An account with this email already exists');
    }

    const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();

    const company = await Company.create({
      name: companyName,
      owner: null,
      inviteCode,
    });

    const user = await User.create({
      name,
      email,
      password,
      role: 'owner',
      company: company._id,
      avatarColor: randomColor(),
    });

    company.owner = user._id;
    await company.save();

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      company: { _id: company._id, name: company.name, inviteCode: company.inviteCode },
      token: generateToken(user._id),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Register a user under an existing company using invite code
// @route   POST /api/auth/join
// @access  Public
const joinCompany = async (req, res, next) => {
  try {
    const { name, email, password, inviteCode } = req.body;

    if (!name || !email || !password || !inviteCode) {
      res.status(400);
      throw new Error('Please provide name, email, password and invite code');
    }

    const company = await Company.findOne({ inviteCode: inviteCode.toUpperCase().trim() });
    if (!company) {
      res.status(400);
      throw new Error('Invalid invite code');
    }

    const existingUser = await User.findOne({ email });
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
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      company: { _id: company._id, name: company.name },
      token: generateToken(user._id),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400);
      throw new Error('Please provide email and password');
    }

    const user = await User.findOne({ email }).select('+password').populate('company', 'name inviteCode');

    if (!user) {
      res.status(401);
      throw new Error('Invalid email or password');
    }

    if (!user.password) {
      res.status(400);
      throw new Error('This account uses Google Sign-In. Use the "Continue with Google" button instead.');
    }

    if (!(await user.matchPassword(password))) {
      res.status(401);
      throw new Error('Invalid email or password');
    }

    if (!user.isActive) {
      res.status(403);
      throw new Error('Your account has been deactivated. Contact your company owner.');
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarColor: user.avatarColor,
      company: user.company,
      token: generateToken(user._id),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('company', 'name inviteCode');
    res.json(user);
  } catch (error) {
    next(error);
  }
};

function randomColor() {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#3b82f6'];
  return colors[Math.floor(Math.random() * colors.length)];
}

module.exports = { registerOwner, joinCompany, login, getMe };
