const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const Project = require('../models/Project');
const Company = require('../models/Company');
const User = require('../models/User');
const {
  sendAssignmentNotification,
  sendTicketReply,
  sendStatusChangeNotification,
} = require('../services/mailSender');
const { getPagination } = require('../utils/pagination');
const { getNextTicketNumber } = require('../utils/ticketNumber');
const { escapeRegex, isObjectId } = require('../utils/sanitize');
const { resolveType, cleanCustomFields } = require('../utils/workspace');
const { applySla, recordFirstResponse, recordResolution } = require('../services/sla');
const { runAutomations } = require('../services/automationEngine');
const { logActivity } = require('../services/activity');
const { notify } = require('../services/notify');

const STATUS_EVENT = (req, ticket, summary) =>
  logActivity({
    company: req.user.company,
    actor: req.user,
    entityType: 'ticket',
    entityId: ticket._id,
    entityLabel: `#${ticket.ticketNumber}`,
    action: 'ticket.updated',
    summary,
    link: `/tickets/${ticket._id}`,
  });

const STATUSES = ['open', 'in_progress', 'in_review', 'resolved', 'closed', 'reopened'];
const ACTIVE_STATUSES = ['open', 'in_progress', 'in_review', 'reopened'];
const STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In Progress',
  in_review: 'In Review',
  resolved: 'Resolved',
  closed: 'Closed',
  reopened: 'Reopened',
};

const POPULATE_LIST = [
  { path: 'client', select: 'name' },
  { path: 'project', select: 'name' },
  { path: 'assignedTo', select: 'name avatarColor avatarUrl' },
  { path: 'reportedBy', select: 'name avatarColor avatarUrl' },
];

const POPULATE_DETAIL = [
  { path: 'client', select: 'name email contactPerson' },
  { path: 'project', select: 'name publicToken' },
  { path: 'assignedTo', select: 'name avatarColor avatarUrl email' },
  { path: 'reportedBy', select: 'name avatarColor avatarUrl email' },
  { path: 'updates.author', select: 'name avatarColor avatarUrl' },
  { path: 'checklist.doneBy', select: 'name' },
];

const SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  updated: { lastActivityAt: -1, updatedAt: -1 },
  priority: { priorityRank: -1, createdAt: -1 },
  due: { dueDate: 1, createdAt: -1 },
};

// Builds the Mongo filter shared by the list, counts and board endpoints.
function buildFilter(req, { ignoreStatus = false } = {}) {
  const { project, client, type, status, priority, assignedTo, tag, source, search, view } = req.query;
  const filter = { company: req.user.company };
  if (isObjectId(project)) filter.project = new mongoose.Types.ObjectId(project);
  if (isObjectId(client)) filter.client = new mongoose.Types.ObjectId(client);
  if (type) filter.type = type;
  if (priority) filter.priority = priority;
  if (source) filter.source = source;
  if (tag) filter.tags = tag;

  if (assignedTo === 'me') filter.assignedTo = req.user._id;
  else if (assignedTo === 'unassigned') filter.assignedTo = null;
  else if (isObjectId(assignedTo)) filter.assignedTo = new mongoose.Types.ObjectId(assignedTo);

  if (!ignoreStatus) {
    if (status === 'active') filter.status = { $in: ACTIVE_STATUSES };
    else if (status === 'done') filter.status = { $in: ['resolved', 'closed'] };
    else if (STATUSES.includes(status)) filter.status = status;
  }

  // Saved "views" used by the ticket inbox sidebar.
  if (view === 'overdue') {
    filter.dueDate = { $lt: new Date() };
    filter.status = { $in: ACTIVE_STATUSES };
  } else if (view === 'awaiting') {
    filter.awaitingTeamReply = true;
  }

  if (search) {
    const s = String(search).trim();
    const num = s.match(/^#?(\d+)$/);
    const regex = { $regex: escapeRegex(s), $options: 'i' };
    filter.$or = [
      { title: regex },
      { description: regex },
      { tags: regex },
      { submitterEmail: regex },
      { submitterName: regex },
    ];
    if (num) filter.$or.push({ ticketNumber: Number(num[1]) });
  }
  return filter;
}

// @desc    Get all tickets (filterable, sortable, paginated)
// @route   GET /api/tickets
const getTickets = async (req, res, next) => {
  try {
    const filter = buildFilter(req);
    const sortKey = SORTS[req.query.sort] ? req.query.sort : 'newest';
    const { limit, skip, buildResult } = getPagination(req.query, 20, 200);

    let tickets;
    if (sortKey === 'due') {
      // Tickets with a due date first (soonest first), then the rest by newest.
      const withDue = { ...filter, dueDate: { $ne: null } };
      const dueCount = await Ticket.countDocuments(withDue);
      const fromDue = skip < dueCount
        ? await Ticket.find(withDue).select('-updates').sort({ dueDate: 1 }).skip(skip).limit(limit).populate(POPULATE_LIST)
        : [];
      const remaining = limit - fromDue.length;
      const fromRest = remaining > 0
        ? await Ticket.find({ ...filter, dueDate: null })
            .select('-updates')
            .sort({ createdAt: -1 })
            .skip(Math.max(0, skip - dueCount))
            .limit(remaining)
            .populate(POPULATE_LIST)
        : [];
      tickets = [...fromDue, ...fromRest];
    } else {
      tickets = await Ticket.find(filter)
        .select('-updates')
        .sort(SORTS[sortKey])
        .skip(skip)
        .limit(limit)
        .populate(POPULATE_LIST);
    }
    const total = await Ticket.countDocuments(filter);

    res.json(buildResult(tickets, total));
  } catch (error) {
    next(error);
  }
};

// @desc    Ticket counts per status for the current filter (powers the status tabs)
// @route   GET /api/tickets/counts
const getTicketCounts = async (req, res, next) => {
  try {
    const filter = buildFilter(req, { ignoreStatus: true });
    const [byStatus, mine, unassigned, overdue, awaiting] = await Promise.all([
      Ticket.aggregate([{ $match: filter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Ticket.countDocuments({ company: req.user.company, assignedTo: req.user._id, status: { $in: ACTIVE_STATUSES } }),
      Ticket.countDocuments({ company: req.user.company, assignedTo: null, status: { $in: ACTIVE_STATUSES } }),
      Ticket.countDocuments({
        company: req.user.company,
        dueDate: { $lt: new Date() },
        status: { $in: ACTIVE_STATUSES },
      }),
      Ticket.countDocuments({ company: req.user.company, awaitingTeamReply: true }),
    ]);
    const statuses = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    byStatus.forEach((s) => (statuses[s._id] = s.count));
    const all = Object.values(statuses).reduce((a, b) => a + b, 0);
    const active = ACTIVE_STATUSES.reduce((a, s) => a + statuses[s], 0);
    res.json({
      statuses,
      all,
      active,
      done: statuses.resolved + statuses.closed,
      views: { mine, unassigned, overdue, awaiting },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single ticket
// @route   GET /api/tickets/:id
const getTicket = async (req, res, next) => {
  try {
    const ticket = await Ticket.findOne({ _id: req.params.id, company: req.user.company }).populate(POPULATE_DETAIL);
    if (!ticket) {
      res.status(404);
      throw new Error('Ticket not found');
    }
    res.json(ticket);
  } catch (error) {
    next(error);
  }
};

// @desc    Create ticket (bug/feature/change/support)
// @route   POST /api/tickets
const createTicket = async (req, res, next) => {
  try {
    const { project, title, description, priority, assignedTo, attachmentUrls, tags, dueDate, files } = req.body;
    const { billable, estimateHours, fixedPrice, checklist } = req.body;
    const company = await Company.findById(req.user.company);
    const type = resolveType(company, req.body.type, { strict: true });

    if (!project || !title || !description || !type) {
      res.status(400);
      throw new Error('Project, title, description and type are required');
    }

    const projectDoc = await Project.findOne({ _id: project, company: req.user.company });
    if (!projectDoc) {
      res.status(404);
      throw new Error('Project not found');
    }

    if (assignedTo && !(await User.exists({ _id: assignedTo, company: req.user.company }))) {
      res.status(400);
      throw new Error('Assignee is not part of your team');
    }

    const { values: customFields, missing } = cleanCustomFields(company, req.body.customFields, { checkRequired: true });
    if (missing.length) {
      res.status(400);
      throw new Error(`Please fill in: ${missing.join(', ')}`);
    }

    const ticketNumber = await getNextTicketNumber(req.user.company);

    const ticket = new Ticket({
      company: req.user.company,
      client: projectDoc.client,
      project,
      ticketNumber,
      title,
      description,
      type,
      customFields,
      billable: billable !== false,
      estimateHours: Number(estimateHours) > 0 ? Number(estimateHours) : undefined,
      fixedPrice: Number(fixedPrice) > 0 ? Number(fixedPrice) : undefined,
      checklist: Array.isArray(checklist)
        ? checklist.filter((c) => c && String(c.text || c).trim()).slice(0, 100).map((c) => ({ text: String(c.text || c).trim() }))
        : [],
      priority: priority || 'medium',
      assignedTo: assignedTo || null,
      reportedBy: req.user._id,
      source: 'internal',
      attachmentUrls: attachmentUrls || [],
      tags: tags || [],
      dueDate: dueDate || undefined,
      files: files || [],
      updates: [{ author: req.user._id, message: 'Ticket created' }],
    });
    ticket.createdAt = new Date();
    applySla(ticket, company);
    await ticket.save();

    logActivity({
      company: req.user.company,
      actor: req.user,
      entityType: 'ticket',
      entityId: ticket._id,
      entityLabel: `#${ticket.ticketNumber}`,
      action: 'ticket.created',
      summary: `created #${ticket.ticketNumber} “${ticket.title}”`,
      link: `/tickets/${ticket._id}`,
    });

    await runAutomations('ticket.created', ticket._id, req.user.company);
    const populated = await Ticket.findById(ticket._id).populate(POPULATE_LIST);

    if (populated.assignedTo) {
      notifyAssignment(req.user.company, populated).catch((err) =>
        console.error('Failed to send assignment notification:', err.message)
      );
      notify(req.user.company, populated.assignedTo._id, {
        kind: 'assigned',
        title: `#${ticket.ticketNumber} assigned to you`,
        body: ticket.title,
        link: `/tickets/${ticket._id}`,
      }, { exclude: req.user._id });
    }

    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
};

// @desc    Update ticket fields. Status changes made here are also logged in the timeline.
// @route   PUT /api/tickets/:id
const updateTicket = async (req, res, next) => {
  try {
    const ticket = await Ticket.findOne({ _id: req.params.id, company: req.user.company });
    if (!ticket) {
      res.status(404);
      throw new Error('Ticket not found');
    }
    const assignmentChanged =
      req.body.assignedTo !== undefined && String(req.body.assignedTo || '') !== String(ticket.assignedTo || '');

    if (assignmentChanged && req.body.assignedTo) {
      const assignee = await User.findOne({ _id: req.body.assignedTo, company: req.user.company });
      if (!assignee) {
        res.status(400);
        throw new Error('Assignee is not part of your team');
      }
      ticket.updates.push({ author: req.user._id, message: `Assigned to ${assignee.name}`, isInternal: true });
    } else if (assignmentChanged) {
      ticket.updates.push({ author: req.user._id, message: 'Unassigned', isInternal: true });
    }

    const company = await Company.findById(req.user.company);
    if (req.body.type !== undefined && !resolveType(company, req.body.type, { strict: true })) {
      res.status(400);
      throw new Error('Unknown ticket type for this workspace');
    }
    const priorityChanged = req.body.priority !== undefined && req.body.priority !== ticket.priority;

    const fields = ['title', 'description', 'type', 'priority', 'assignedTo', 'attachmentUrls', 'tags', 'dueDate'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) ticket[f] = req.body[f] === '' ? null : req.body[f];
    });
    if (req.body.billable !== undefined) ticket.billable = !!req.body.billable;
    ['estimateHours', 'fixedPrice'].forEach((f) => {
      if (req.body[f] !== undefined) ticket[f] = Number(req.body[f]) > 0 ? Number(req.body[f]) : undefined;
    });
    if (req.body.customFields && typeof req.body.customFields === 'object') {
      const { values } = cleanCustomFields(company, { ...(ticket.customFields || {}), ...req.body.customFields });
      // Explicitly cleared fields are removed.
      Object.entries(req.body.customFields).forEach(([k, v]) => (v === '' || v === null) && delete values[k]);
      ticket.customFields = values;
      ticket.markModified('customFields');
    }
    if (priorityChanged && !['resolved', 'closed'].includes(ticket.status)) applySla(ticket, company);

    let statusChanged = false;
    if (req.body.status && STATUSES.includes(req.body.status) && req.body.status !== ticket.status) {
      applyStatus(ticket, req.body.status);
      ticket.updates.push({
        author: req.user._id,
        message: `Status changed to ${STATUS_LABELS[req.body.status]}`,
        statusChangeTo: req.body.status,
      });
      statusChanged = true;
    }

    ticket.lastActivityAt = new Date();
    await ticket.save();

    const changed = Object.keys(req.body).filter((k) => !['customFields'].includes(k));
    if (changed.length || req.body.customFields) {
      STATUS_EVENT(req, ticket, statusChanged
        ? `moved #${ticket.ticketNumber} to ${STATUS_LABELS[ticket.status]}`
        : `updated ${[...changed, ...(req.body.customFields ? ['custom fields'] : [])].join(', ')} on #${ticket.ticketNumber}`);
    }
    if (statusChanged) await runAutomations('ticket.status_changed', ticket._id, req.user.company);
    if (assignmentChanged && ticket.assignedTo) await runAutomations('ticket.assigned', ticket._id, req.user.company);

    const populated = await Ticket.findById(ticket._id).populate(POPULATE_DETAIL);

    if (assignmentChanged && ticket.assignedTo) {
      notifyAssignment(req.user.company, populated).catch((err) =>
        console.error('Failed to send assignment notification:', err.message)
      );
      notify(req.user.company, ticket.assignedTo, {
        kind: 'assigned',
        title: `#${ticket.ticketNumber} assigned to you`,
        body: ticket.title,
        link: `/tickets/${ticket._id}`,
      }, { exclude: req.user._id });
    }
    if (statusChanged) notifyStatus(req.user.company, ticket, req.body.status);

    res.json(populated);
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk update status / priority / assignee for several tickets at once
// @route   POST /api/tickets/bulk
const bulkUpdateTickets = async (req, res, next) => {
  try {
    const { ids, status, priority, assignedTo } = req.body;
    if (!Array.isArray(ids) || !ids.length || ids.length > 200) {
      res.status(400);
      throw new Error('Select between 1 and 200 tickets');
    }
    const tickets = await Ticket.find({ _id: { $in: ids.filter(isObjectId) }, company: req.user.company });
    let assignee = null;
    if (assignedTo && assignedTo !== 'unassigned') {
      assignee = await User.findOne({ _id: assignedTo, company: req.user.company });
      if (!assignee) {
        res.status(400);
        throw new Error('Assignee is not part of your team');
      }
    }
    for (const ticket of tickets) {
      if (status && STATUSES.includes(status) && ticket.status !== status) {
        applyStatus(ticket, status);
        ticket.updates.push({ author: req.user._id, message: `Status changed to ${STATUS_LABELS[status]}`, statusChangeTo: status });
      }
      if (priority && ['low', 'medium', 'high', 'critical'].includes(priority)) ticket.priority = priority;
      if (assignedTo === 'unassigned') ticket.assignedTo = null;
      else if (assignee) ticket.assignedTo = assignee._id;
      ticket.lastActivityAt = new Date();
      await ticket.save();
      if (status) await runAutomations('ticket.status_changed', ticket._id, req.user.company);
    }
    logActivity({
      company: req.user.company,
      actor: req.user,
      entityType: 'ticket',
      action: 'ticket.bulk',
      summary: `bulk-updated ${tickets.length} ticket${tickets.length === 1 ? '' : 's'} (${[status && `status ${status}`, priority && `priority ${priority}`, assignedTo && 'assignee'].filter(Boolean).join(', ')})`,
      link: '/tickets',
    });
    res.json({ updated: tickets.length });
  } catch (error) {
    next(error);
  }
};

function applyStatus(ticket, status) {
  ticket.status = status;
  if (status === 'resolved' || status === 'closed') {
    ticket.resolvedAt = ticket.resolvedAt || new Date();
    recordResolution(ticket);
  } else ticket.resolvedAt = undefined;
}

async function notifyAssignment(companyId, ticket) {
  const company = await Company.findById(companyId);
  const assignedUser = await User.findById(ticket.assignedTo?._id || ticket.assignedTo);
  if (company && assignedUser) {
    await sendAssignmentNotification(company, ticket, assignedUser);
  }
}

// Emails the external submitter when their ticket is resolved/closed/reopened.
function notifyStatus(companyId, ticket, status, message) {
  if (!['resolved', 'closed', 'reopened', 'in_progress'].includes(status)) return;
  Company.findById(companyId)
    .then((company) =>
      company && sendStatusChangeNotification(company, ticket, { statusLabel: STATUS_LABELS[status], message })
    )
    .catch((err) => console.error('Failed to send status notification:', err.message));
}

// @desc    Post a timeline update (public reply or internal note), optionally changing status
// @route   POST /api/tickets/:id/updates
const addTicketUpdate = async (req, res, next) => {
  try {
    const ticket = await Ticket.findOne({ _id: req.params.id, company: req.user.company });
    if (!ticket) {
      res.status(404);
      throw new Error('Ticket not found');
    }

    const { message, status, isInternal, files } = req.body;
    const statusChanging = status && STATUSES.includes(status) && status !== ticket.status;
    if (!message?.trim() && !statusChanging && !files?.length) {
      res.status(400);
      throw new Error('Update message is required');
    }

    const update = {
      author: req.user._id,
      message: message?.trim() || (statusChanging ? `Status changed to ${STATUS_LABELS[status]}` : 'Attached files'),
      isInternal: !!isInternal,
    };

    if (Array.isArray(files) && files.length) {
      update.files = files;
      files.forEach((f) => ticket.files.push({ ...f, uploadedBy: req.user._id }));
    }

    if (statusChanging) {
      update.statusChangeTo = status;
      applyStatus(ticket, status);
    }

    // A public reply from the team clears the "awaiting reply" flag and counts as first response.
    if (!isInternal) {
      ticket.awaitingTeamReply = false;
      if (message?.trim()) recordFirstResponse(ticket);
    }
    ticket.lastActivityAt = new Date();
    ticket.updates.push(update);
    await ticket.save();

    STATUS_EVENT(req, ticket, statusChanging
      ? `moved #${ticket.ticketNumber} to ${STATUS_LABELS[status]}${message?.trim() ? ' with a note' : ''}`
      : `${isInternal ? 'added an internal note to' : 'replied on'} #${ticket.ticketNumber}`);
    if (statusChanging) await runAutomations('ticket.status_changed', ticket._id, req.user.company);
    if (statusChanging && !isInternal) notifyStatus(req.user.company, ticket, status, message?.trim());

    const populated = await Ticket.findById(ticket._id).populate(POPULATE_DETAIL);
    res.json(populated);
  } catch (error) {
    next(error);
  }
};

// @desc    Add uploaded file references to a ticket
// @route   POST /api/tickets/:id/files
const addTicketFiles = async (req, res, next) => {
  try {
    const ticket = await Ticket.findOne({ _id: req.params.id, company: req.user.company });
    if (!ticket) {
      res.status(404);
      throw new Error('Ticket not found');
    }
    const { files } = req.body;
    if (!files || !files.length) {
      res.status(400);
      throw new Error('No files provided');
    }
    files.forEach((f) => ticket.files.push({ ...f, uploadedBy: req.user._id }));
    ticket.updates.push({
      author: req.user._id,
      message: `Attached ${files.length} file${files.length > 1 ? 's' : ''}`,
      files,
    });
    ticket.lastActivityAt = new Date();
    await ticket.save();
    const populated = await Ticket.findById(ticket._id).populate(POPULATE_DETAIL);
    res.json(populated);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete ticket
// @route   DELETE /api/tickets/:id
const deleteTicket = async (req, res, next) => {
  try {
    const ticket = await Ticket.findOne({ _id: req.params.id, company: req.user.company });
    if (!ticket) {
      res.status(404);
      throw new Error('Ticket not found');
    }
    await ticket.deleteOne();
    logActivity({
      company: req.user.company,
      actor: req.user,
      entityType: 'ticket',
      entityId: ticket._id,
      entityLabel: `#${ticket.ticketNumber}`,
      action: 'ticket.deleted',
      summary: `deleted #${ticket.ticketNumber} “${ticket.title}”`,
    });
    res.json({ message: 'Ticket removed' });
  } catch (error) {
    next(error);
  }
};

// @desc    Reply to the client by email, Gmail-style — sends via the company's own
//          mailbox and logs the message as a normal (public) ticket update.
// @route   POST /api/tickets/:id/reply
const replyToTicket = async (req, res, next) => {
  try {
    const ticket = await Ticket.findOne({ _id: req.params.id, company: req.user.company });
    if (!ticket) {
      res.status(404);
      throw new Error('Ticket not found');
    }
    if (!ticket.submitterEmail) {
      res.status(400);
      throw new Error('This ticket has no submitter email to reply to');
    }

    const { message, files, status } = req.body;
    if (!message?.trim()) {
      res.status(400);
      throw new Error('Reply message is required');
    }

    const company = await Company.findById(req.user.company);
    const result = await sendTicketReply(company, ticket, {
      message,
      authorName: req.user.name,
      attachments: files || [],
    });

    if (!result.sent) {
      res.status(400);
      throw new Error(result.reason || 'Failed to send email — check your SMTP settings in Settings');
    }

    if (files?.length) {
      files.forEach((f) => ticket.files.push({ ...f, uploadedBy: req.user._id }));
    }
    const update = { author: req.user._id, message, isInternal: false, sentAsEmail: true, files: files || [] };
    if (status && STATUSES.includes(status) && status !== ticket.status) {
      update.statusChangeTo = status;
      applyStatus(ticket, status);
    }
    ticket.updates.push(update);
    ticket.awaitingTeamReply = false;
    recordFirstResponse(ticket);
    ticket.lastActivityAt = new Date();
    await ticket.save();
    STATUS_EVENT(req, ticket, `emailed a reply on #${ticket.ticketNumber}`);
    if (update.statusChangeTo) await runAutomations('ticket.status_changed', ticket._id, req.user.company);

    const populated = await Ticket.findById(ticket._id).populate(POPULATE_DETAIL);
    res.json(populated);
  } catch (error) {
    next(error);
  }
};

// ───────── Checklist ─────────

async function loadOwnTicket(req, res) {
  const ticket = await Ticket.findOne({ _id: req.params.id, company: req.user.company });
  if (!ticket) {
    res.status(404);
    throw new Error('Ticket not found');
  }
  return ticket;
}

// @route   POST /api/tickets/:id/checklist   { text } or { items: [text…] }
const addChecklistItem = async (req, res, next) => {
  try {
    const ticket = await loadOwnTicket(req, res);
    const items = (Array.isArray(req.body.items) ? req.body.items : [req.body.text])
      .map((t) => String(t || '').trim())
      .filter(Boolean)
      .slice(0, 50);
    if (!items.length) {
      res.status(400);
      throw new Error('Checklist item text is required');
    }
    if (ticket.checklist.length + items.length > 200) {
      res.status(400);
      throw new Error('Checklist is full');
    }
    items.forEach((text) => ticket.checklist.push({ text }));
    ticket.lastActivityAt = new Date();
    await ticket.save();
    res.status(201).json((await Ticket.findById(ticket._id).populate(POPULATE_DETAIL)));
  } catch (error) {
    next(error);
  }
};

// @route   PUT /api/tickets/:id/checklist/:itemId   { text?, done? }
const updateChecklistItem = async (req, res, next) => {
  try {
    const ticket = await loadOwnTicket(req, res);
    const item = ticket.checklist.id(req.params.itemId);
    if (!item) {
      res.status(404);
      throw new Error('Checklist item not found');
    }
    if (req.body.text !== undefined && String(req.body.text).trim()) item.text = String(req.body.text).trim();
    if (typeof req.body.done === 'boolean' && req.body.done !== item.done) {
      item.done = req.body.done;
      item.doneBy = req.body.done ? req.user._id : undefined;
      item.doneAt = req.body.done ? new Date() : undefined;
      if (req.body.done) {
        const doneCount = ticket.checklist.filter((c) => c.done).length;
        STATUS_EVENT(req, ticket, `checked “${item.text}” on #${ticket.ticketNumber} (${doneCount}/${ticket.checklist.length})`);
      }
    }
    ticket.lastActivityAt = new Date();
    await ticket.save();
    res.json(await Ticket.findById(ticket._id).populate(POPULATE_DETAIL));
  } catch (error) {
    next(error);
  }
};

// @route   DELETE /api/tickets/:id/checklist/:itemId
const deleteChecklistItem = async (req, res, next) => {
  try {
    const ticket = await loadOwnTicket(req, res);
    ticket.checklist.pull({ _id: req.params.itemId });
    await ticket.save();
    res.json(await Ticket.findById(ticket._id).populate(POPULATE_DETAIL));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  getTickets,
  getTicketCounts,
  getTicket,
  createTicket,
  updateTicket,
  bulkUpdateTickets,
  addTicketUpdate,
  addTicketFiles,
  replyToTicket,
  deleteTicket,
  STATUS_LABELS,
  ACTIVE_STATUSES,
};
