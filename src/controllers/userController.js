const crypto = require('crypto');
const User = require('../models/User');
const Company = require('../models/Company');

// @desc    Get all users in company
// @route   GET /api/users
// @access  Private
const getUsers = async (req, res, next) => {
  try {
    const users = await User.find({ company: req.user.company }).sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    next(error);
  }
};

// @desc    Owner/Admin creates a new user directly under company
// @route   POST /api/users
// @access  Private/Owner/Admin
const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      res.status(400);
      throw new Error('Please provide name, email and password');
    }

    if (role === 'owner') {
      res.status(400);
      throw new Error('Cannot create another owner');
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
      role: role && ['admin', 'member'].includes(role) ? role : 'member',
      company: req.user.company,
      avatarColor: ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'][
        Math.floor(Math.random() * 6)
      ],
    });

    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
};

// @desc    Update a user (role, active status)
// @route   PUT /api/users/:id
// @access  Private/Owner/Admin
const updateUser = async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.id, company: req.user.company });
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    if (user.role === 'owner') {
      res.status(400);
      throw new Error('Cannot modify the owner account');
    }

    const { name, role, isActive } = req.body;
    if (name) user.name = name;
    if (role && ['admin', 'member'].includes(role)) user.role = role;
    if (typeof isActive === 'boolean') user.isActive = isActive;

    await user.save();
    res.json(user);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a user
// @route   DELETE /api/users/:id
// @access  Private/Owner
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.id, company: req.user.company });
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }
    if (user.role === 'owner') {
      res.status(400);
      throw new Error('Cannot delete the owner account');
    }
    await user.deleteOne();
    res.json({ message: 'User removed' });
  } catch (error) {
    next(error);
  }
};

// @desc    Regenerate company invite code
// @route   POST /api/users/invite-code/regenerate
// @access  Private/Owner/Admin
const regenerateInviteCode = async (req, res, next) => {
  try {
    const company = await Company.findById(req.user.company);
    company.inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    await company.save();
    res.json({ inviteCode: company.inviteCode });
  } catch (error) {
    next(error);
  }
};

// @desc    Owner transfers company ownership to another existing team member.
//          The current owner becomes an admin; the target user becomes the owner.
// @route   POST /api/users/:id/transfer-ownership
// @access  Private/Owner
const transferOwnership = async (req, res, next) => {
  try {
    if (req.user.role !== 'owner') {
      res.status(403);
      throw new Error('Only the current owner can transfer ownership');
    }

    const newOwner = await User.findOne({ _id: req.params.id, company: req.user.company });
    if (!newOwner) {
      res.status(404);
      throw new Error('User not found');
    }
    if (String(newOwner._id) === String(req.user._id)) {
      res.status(400);
      throw new Error('You are already the owner');
    }
    if (!newOwner.isActive) {
      res.status(400);
      throw new Error('Cannot transfer ownership to a deactivated user');
    }

    const currentOwner = await User.findById(req.user._id);
    currentOwner.role = 'admin';
    newOwner.role = 'owner';

    await currentOwner.save();
    await newOwner.save();

    const company = await Company.findById(req.user.company);
    company.owner = newOwner._id;
    await company.save();

    res.json({ message: `Ownership transferred to ${newOwner.name}` });
  } catch (error) {
    next(error);
  }
};

module.exports = { getUsers, createUser, updateUser, deleteUser, regenerateInviteCode, transferOwnership };
