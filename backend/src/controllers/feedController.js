const Activity = require('../models/Activity');
const Notification = require('../models/Notification');
const SavedReply = require('../models/SavedReply');
const { getPagination } = require('../utils/pagination');
const { isObjectId } = require('../utils/sanitize');

// ───── Activity log ─────

// @route GET /api/activity?entityType&actor&entityId&page
const listActivity = async (req, res, next) => {
  try {
    const filter = { company: req.user.company };
    if (req.query.entityType) filter.entityType = String(req.query.entityType);
    if (isObjectId(req.query.actor)) filter.actor = req.query.actor;
    if (isObjectId(req.query.entityId)) filter.entityId = req.query.entityId;
    if (req.query.from) filter.createdAt = { $gte: new Date(req.query.from) };
    const { limit, skip, buildResult } = getPagination(req.query, 40, 200);
    const [items, total] = await Promise.all([
      Activity.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('actor', 'name avatarColor avatarUrl'),
      Activity.countDocuments(filter),
    ]);
    res.json(buildResult(items, total));
  } catch (error) {
    next(error);
  }
};

// ───── Notifications ─────

const listNotifications = async (req, res, next) => {
  try {
    const [items, unread] = await Promise.all([
      Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(40),
      Notification.countDocuments({ user: req.user._id, read: false }),
    ]);
    res.json({ items, unread });
  } catch (error) {
    next(error);
  }
};

const unreadCount = async (req, res, next) => {
  try {
    res.json({ unread: await Notification.countDocuments({ user: req.user._id, read: false }) });
  } catch (error) {
    next(error);
  }
};

const markRead = async (req, res, next) => {
  try {
    const filter = { user: req.user._id };
    if (req.params.id) filter._id = req.params.id;
    await Notification.updateMany(filter, { $set: { read: true } });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};

// ───── Saved replies ─────

const listReplies = async (req, res, next) => {
  try {
    const replies = await SavedReply.find({
      company: req.user.company,
      $or: [{ shared: true }, { createdBy: req.user._id }],
    })
      .sort({ useCount: -1, title: 1 })
      .populate('createdBy', 'name');
    res.json(replies);
  } catch (error) {
    next(error);
  }
};

function replyFields(body, res) {
  const title = String(body.title || '').trim();
  const text = String(body.body || '').trim();
  if (!title || !text) {
    res.status(400);
    throw new Error('Title and message are required');
  }
  return { title: title.slice(0, 120), body: text.slice(0, 8000), shared: body.shared !== false };
}

const createReply = async (req, res, next) => {
  try {
    const reply = await SavedReply.create({ ...replyFields(req.body, res), company: req.user.company, createdBy: req.user._id });
    res.status(201).json(reply);
  } catch (error) {
    next(error);
  }
};

async function ownReply(req, res) {
  const reply = await SavedReply.findOne({ _id: req.params.id, company: req.user.company });
  if (!reply) {
    res.status(404);
    throw new Error('Saved reply not found');
  }
  const isAdmin = ['owner', 'admin'].includes(req.user.role);
  if (!isAdmin && String(reply.createdBy) !== String(req.user._id)) {
    res.status(403);
    throw new Error('Only the author or an admin can change this reply');
  }
  return reply;
}

const updateReply = async (req, res, next) => {
  try {
    const reply = await ownReply(req, res);
    Object.assign(reply, replyFields({ ...reply.toObject(), ...req.body }, res));
    await reply.save();
    res.json(reply);
  } catch (error) {
    next(error);
  }
};

const deleteReply = async (req, res, next) => {
  try {
    const reply = await ownReply(req, res);
    await reply.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (error) {
    next(error);
  }
};

const useReply = async (req, res, next) => {
  try {
    await SavedReply.updateOne({ _id: req.params.id, company: req.user.company }, { $inc: { useCount: 1 } });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listActivity,
  listNotifications,
  unreadCount,
  markRead,
  listReplies,
  createReply,
  updateReply,
  deleteReply,
  useReply,
};
