const TimeEntry = require('../models/TimeEntry');
const Ticket = require('../models/Ticket');
const Project = require('../models/Project');
const { isObjectId } = require('../utils/sanitize');
const { logActivity } = require('../services/activity');

const POPULATE = [
  { path: 'user', select: 'name avatarColor avatarUrl' },
  { path: 'project', select: 'name' },
  { path: 'client', select: 'name' },
  { path: 'ticket', select: 'ticketNumber title' },
  { path: 'invoice', select: 'number status' },
];

const MAX_MINUTES = 24 * 60;

// Keeps the cached total on the ticket in sync after any change to its entries.
async function refreshTicketTotal(ticketId) {
  if (!ticketId) return;
  const entries = await TimeEntry.find({ ticket: ticketId, endedAt: { $ne: null } }).select('minutes').lean();
  await Ticket.updateOne({ _id: ticketId }, { $set: { timeSpentMinutes: entries.reduce((a, e) => a + (e.minutes || 0), 0) } });
}

// Resolves the project/client for a new entry from a ticket or a project id.
async function resolveTarget(req, res, { ticket, project }) {
  if (ticket) {
    if (!isObjectId(ticket)) {
      res.status(400);
      throw new Error('Invalid ticket');
    }
    const t = await Ticket.findOne({ _id: ticket, company: req.user.company }).select('project client billable ticketNumber');
    if (!t) {
      res.status(404);
      throw new Error('Ticket not found');
    }
    return { ticket: t._id, project: t.project, client: t.client, billable: t.billable !== false, label: `#${t.ticketNumber}` };
  }
  if (!isObjectId(project)) {
    res.status(400);
    throw new Error('Pick a ticket or project to track time against');
  }
  const p = await Project.findOne({ _id: project, company: req.user.company }).select('client name');
  if (!p) {
    res.status(404);
    throw new Error('Project not found');
  }
  return { project: p._id, client: p.client, billable: true, label: p.name };
}

// @route GET /api/time?from&to&user&project&client&ticket&billable&invoiced
const listEntries = async (req, res, next) => {
  try {
    const { from, to, user, project, client, ticket, billable, invoiced } = req.query;
    const filter = { company: req.user.company, endedAt: { $ne: null } };
    if (user === 'me') filter.user = req.user._id;
    else if (isObjectId(user)) filter.user = user;
    if (isObjectId(project)) filter.project = project;
    if (isObjectId(client)) filter.client = client;
    if (isObjectId(ticket)) filter.ticket = ticket;
    if (billable === 'true') filter.billable = true;
    if (billable === 'false') filter.billable = false;
    if (invoiced === 'true') filter.invoice = { $ne: null };
    if (invoiced === 'false') filter.invoice = null;
    if (from || to) {
      filter.startedAt = {};
      if (from) filter.startedAt.$gte = new Date(from);
      if (to) filter.startedAt.$lte = new Date(to);
    }
    const entries = await TimeEntry.find(filter).sort({ startedAt: -1 }).limit(1000).populate(POPULATE);
    const totalMinutes = entries.reduce((a, e) => a + e.minutes, 0);
    const billableMinutes = entries.filter((e) => e.billable).reduce((a, e) => a + e.minutes, 0);
    res.json({ entries, totalMinutes, billableMinutes });
  } catch (error) {
    next(error);
  }
};

// @route GET /api/time/running — the current user's running timer (or null)
const getRunning = async (req, res, next) => {
  try {
    const entry = await TimeEntry.findOne({ company: req.user.company, user: req.user._id, endedAt: null }).populate(POPULATE);
    res.json(entry);
  } catch (error) {
    next(error);
  }
};

async function stopEntry(entry) {
  entry.endedAt = new Date();
  entry.minutes = Math.min(MAX_MINUTES, Math.max(1, Math.round((entry.endedAt - entry.startedAt) / 60000)));
  await entry.save();
  await refreshTicketTotal(entry.ticket);
  return entry;
}

// @route POST /api/time/start { ticket?, project?, description? } — stops any running timer first
const startTimer = async (req, res, next) => {
  try {
    const target = await resolveTarget(req, res, req.body);
    const running = await TimeEntry.findOne({ company: req.user.company, user: req.user._id, endedAt: null });
    if (running) await stopEntry(running);
    const entry = await TimeEntry.create({
      company: req.user.company,
      user: req.user._id,
      project: target.project,
      client: target.client,
      ticket: target.ticket,
      description: String(req.body.description || '').slice(0, 500),
      startedAt: new Date(),
      billable: target.billable,
    });
    res.status(201).json(await entry.populate(POPULATE));
  } catch (error) {
    next(error);
  }
};

// @route POST /api/time/stop
const stopTimer = async (req, res, next) => {
  try {
    const running = await TimeEntry.findOne({ company: req.user.company, user: req.user._id, endedAt: null });
    if (!running) {
      res.status(400);
      throw new Error('No timer is running');
    }
    await stopEntry(running);
    await running.populate(POPULATE);
    logActivity({
      company: req.user.company,
      actor: req.user,
      entityType: 'time',
      entityId: running._id,
      action: 'time.logged',
      summary: `tracked ${running.minutes}m on ${running.ticket ? `#${running.ticket.ticketNumber}` : running.project?.name}`,
      link: running.ticket ? `/tickets/${running.ticket._id}` : '/time',
    });
    res.json(running);
  } catch (error) {
    next(error);
  }
};

// @route POST /api/time — manual entry { ticket?|project?, date, minutes | (startedAt, endedAt), description, billable }
const createEntry = async (req, res, next) => {
  try {
    const target = await resolveTarget(req, res, req.body);
    let startedAt = req.body.startedAt ? new Date(req.body.startedAt) : req.body.date ? new Date(`${req.body.date}T09:00:00`) : new Date();
    let minutes = Number(req.body.minutes);
    let endedAt;
    if (req.body.endedAt) {
      endedAt = new Date(req.body.endedAt);
      minutes = Math.round((endedAt - startedAt) / 60000);
    }
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > MAX_MINUTES || Number.isNaN(startedAt.getTime())) {
      res.status(400);
      throw new Error('Enter a duration between 1 minute and 24 hours');
    }
    endedAt = endedAt || new Date(startedAt.getTime() + minutes * 60000);
    const entry = await TimeEntry.create({
      company: req.user.company,
      user: isObjectId(req.body.user) && ['owner', 'admin'].includes(req.user.role) ? req.body.user : req.user._id,
      project: target.project,
      client: target.client,
      ticket: target.ticket,
      description: String(req.body.description || '').slice(0, 500),
      startedAt,
      endedAt,
      minutes,
      billable: req.body.billable !== undefined ? !!req.body.billable : target.billable,
      hourlyRate: Number(req.body.hourlyRate) > 0 ? Number(req.body.hourlyRate) : undefined,
    });
    await refreshTicketTotal(entry.ticket);
    logActivity({
      company: req.user.company,
      actor: req.user,
      entityType: 'time',
      entityId: entry._id,
      action: 'time.logged',
      summary: `logged ${minutes}m on ${target.label}`,
      link: target.ticket ? `/tickets/${target.ticket}` : '/time',
    });
    res.status(201).json(await entry.populate(POPULATE));
  } catch (error) {
    next(error);
  }
};

async function loadEditable(req, res) {
  const entry = await TimeEntry.findOne({ _id: req.params.id, company: req.user.company });
  if (!entry) {
    res.status(404);
    throw new Error('Time entry not found');
  }
  const isAdmin = ['owner', 'admin'].includes(req.user.role);
  if (!isAdmin && String(entry.user) !== String(req.user._id)) {
    res.status(403);
    throw new Error('You can only edit your own time');
  }
  if (entry.invoice) {
    res.status(400);
    throw new Error('This time is already on an invoice — remove it from the invoice first');
  }
  return entry;
}

// @route PUT /api/time/:id
const updateEntry = async (req, res, next) => {
  try {
    const entry = await loadEditable(req, res);
    if (req.body.description !== undefined) entry.description = String(req.body.description).slice(0, 500);
    if (req.body.billable !== undefined) entry.billable = !!req.body.billable;
    if (req.body.hourlyRate !== undefined) entry.hourlyRate = Number(req.body.hourlyRate) > 0 ? Number(req.body.hourlyRate) : undefined;
    if (req.body.minutes !== undefined && entry.endedAt) {
      const m = Number(req.body.minutes);
      if (!Number.isFinite(m) || m <= 0 || m > MAX_MINUTES) {
        res.status(400);
        throw new Error('Enter a duration between 1 minute and 24 hours');
      }
      entry.minutes = Math.round(m);
      entry.endedAt = new Date(entry.startedAt.getTime() + entry.minutes * 60000);
    }
    if (req.body.date && entry.endedAt) {
      const d = new Date(`${req.body.date}T${entry.startedAt.toISOString().slice(11, 19)}Z`);
      if (!Number.isNaN(d.getTime())) {
        entry.startedAt = d;
        entry.endedAt = new Date(d.getTime() + entry.minutes * 60000);
      }
    }
    await entry.save();
    await refreshTicketTotal(entry.ticket);
    res.json(await entry.populate(POPULATE));
  } catch (error) {
    next(error);
  }
};

// @route DELETE /api/time/:id
const deleteEntry = async (req, res, next) => {
  try {
    const entry = await loadEditable(req, res);
    await entry.deleteOne();
    await refreshTicketTotal(entry.ticket);
    res.json({ message: 'Time entry removed' });
  } catch (error) {
    next(error);
  }
};

// @route GET /api/time/summary?from&to — hours per user/day for the timesheet header
const getSummary = async (req, res, next) => {
  try {
    const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 6 * 864e5);
    const to = req.query.to ? new Date(req.query.to) : new Date();
    const entries = await TimeEntry.find({
      company: req.user.company,
      endedAt: { $ne: null },
      startedAt: { $gte: from, $lte: to },
    })
      .select('user minutes billable startedAt')
      .populate('user', 'name avatarColor avatarUrl')
      .lean();
    const byUser = {};
    entries.forEach((e) => {
      const k = String(e.user?._id);
      byUser[k] ||= { user: e.user, minutes: 0, billableMinutes: 0 };
      byUser[k].minutes += e.minutes;
      if (e.billable) byUser[k].billableMinutes += e.minutes;
    });
    res.json({ users: Object.values(byUser).sort((a, b) => b.minutes - a.minutes) });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listEntries,
  getRunning,
  startTimer,
  stopTimer,
  createEntry,
  updateEntry,
  deleteEntry,
  getSummary,
  refreshTicketTotal,
};
