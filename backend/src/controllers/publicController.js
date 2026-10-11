const Project = require('../models/Project');
const Company = require('../models/Company');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const Todo = require('../models/Todo');
const { createTicketFromEmail } = require('../services/emailIngest');
const { sendAutoReply, sendClientCommentNotification } = require('../services/mailSender');
const { getNextTicketNumber } = require('../utils/ticketNumber');
const { getPagination } = require('../utils/pagination');
const { escapeRegex } = require('../utils/sanitize');

const { resolveType, cleanCustomFields } = require('../utils/workspace');
const { applySla } = require('../services/sla');
const { runAutomations } = require('../services/automationEngine');
const { logActivity } = require('../services/activity');
const { notify } = require('../services/notify');

// Public-facing workspace config: ticket types, portal-visible custom fields, wording.
function publicWorkspace(company) {
  const ws = company?.workspace || {};
  return {
    terminology: ws.terminology,
    ticketTypes: ws.ticketTypes || [],
    customFields: (ws.customFields || []).filter((f) => f.showInPortal),
    csatEnabled: company?.csatEnabled !== false,
  };
}
const ACTIVE = ['open', 'in_progress', 'in_review', 'reopened'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Only these fields of an uploaded-file object are accepted from anonymous callers, and
// only URLs pointing at our own /uploads folder.
function cleanFiles(files) {
  if (!Array.isArray(files)) return [];
  return files
    .slice(0, 5)
    .filter((f) => f && typeof f.url === 'string' && /\/uploads\/[\w.-]+$/.test(f.url))
    .map((f) => ({
      filename: String(f.filename || '').slice(0, 200),
      originalName: String(f.originalName || f.filename || '').slice(0, 200),
      url: f.url,
      size: Number(f.size) || undefined,
    }));
}

async function findPortalProject(token, res) {
  const project = await Project.findOne({ publicToken: token, publicFormEnabled: true })
    .populate('client', 'name')
    .populate('company', 'name');
  if (!project) {
    res.status(404);
    throw new Error('This portal is not available');
  }
  return project;
}

// Public-safe view of a ticket (never includes internal notes or team emails).
function publicTicket(ticket, { withUpdates = false } = {}) {
  const base = {
    ticketNumber: ticket.ticketNumber,
    trackingToken: ticket.publicToken,
    title: ticket.title,
    type: ticket.type,
    status: ticket.status,
    priority: ticket.priority,
    submitterName: ticket.submitterName || ticket.reportedBy?.name || null,
    createdAt: ticket.createdAt,
    updatedAt: ticket.lastActivityAt || ticket.updatedAt,
    resolvedAt: ticket.resolvedAt,
    assignee: ticket.assignedTo ? { name: ticket.assignedTo.name, avatarColor: ticket.assignedTo.avatarColor } : null,
    replies: (ticket.updates || []).filter((u) => !u.isInternal).length,
  };
  if (!withUpdates) return base;
  return {
    ...base,
    description: ticket.description,
    projectName: ticket.project?.name,
    clientName: ticket.client?.name,
    dueDate: ticket.dueDate,
    files: (ticket.files || []).map((f) => ({ url: f.url, originalName: f.originalName || f.filename, size: f.size })),
    updates: (ticket.updates || [])
      // Internal bookkeeping ("Ticket created") isn't part of the client conversation.
      .filter((u, i) => !u.isInternal && !(i === 0 && u.message === 'Ticket created'))
      .map((u) => ({
        _id: u._id,
        message: u.message,
        statusChangeTo: u.statusChangeTo,
        createdAt: u.createdAt,
        fromClient: !!u.fromClient,
        authorName: u.fromClient ? u.authorName : u.author?.name || null,
        authorColor: u.author?.avatarColor,
        files: (u.files || []).map((f) => ({ url: f.url, originalName: f.originalName || f.filename })),
        system: !u.author && !u.fromClient,
      })),
  };
}

const PUBLIC_POPULATE = [
  { path: 'project', select: 'name' },
  { path: 'client', select: 'name' },
  { path: 'assignedTo', select: 'name avatarColor' },
  { path: 'reportedBy', select: 'name' },
  { path: 'updates.author', select: 'name avatarColor' },
];

// ───────────────────────── Client portal ─────────────────────────

// @desc    Portal home: project info, progress stats, settings
// @route   GET /api/public/portal/:token
const getPortal = async (req, res, next) => {
  try {
    const project = await findPortalProject(req.params.token, res);
    const portal = project.portal || {};

    const [byStatus, byType, recentResolved] = await Promise.all([
      Ticket.aggregate([{ $match: { project: project._id } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Ticket.aggregate([{ $match: { project: project._id } }, { $group: { _id: '$type', count: { $sum: 1 } } }]),
      Ticket.find({ project: project._id, resolvedAt: { $ne: null } })
        .select('createdAt resolvedAt')
        .sort({ resolvedAt: -1 })
        .limit(500)
        .lean(),
    ]);
    const statusCounts = Object.fromEntries(byStatus.map((s) => [s._id, s.count]));
    const total = byStatus.reduce((a, s) => a + s.count, 0);
    const open = ACTIVE.reduce((a, s) => a + (statusCounts[s] || 0), 0);
    const done = (statusCounts.resolved || 0) + (statusCounts.closed || 0);

    res.json({
      companyName: project.company?.name,
      clientName: project.client?.name,
      projectName: project.name,
      welcomeMessage: portal.welcomeMessage || '',
      ...publicWorkspace(await Company.findById(project.company._id).select('workspace csatEnabled')),
      settings: {
        showAllTickets: portal.showAllTickets !== false,
        allowComments: portal.allowComments !== false,
        showProjectDetails: portal.showProjectDetails !== false,
        showTodos: portal.showTodos === true,
      },
      project:
        portal.showProjectDetails !== false
          ? {
              status: project.status,
              description: project.description,
              startDate: project.startDate,
              deadline: project.deadline,
              liveUrl: project.liveUrl,
            }
          : null,
      stats: {
        total,
        open,
        done,
        statuses: statusCounts,
        types: Object.fromEntries(byType.map((t) => [t._id, t.count])),
        avgResolutionHours: recentResolved.length
          ? Math.round(
              recentResolved.reduce((a, t) => a + (new Date(t.resolvedAt) - new Date(t.createdAt)), 0) /
                recentResolved.length /
                36e5
            )
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Portal ticket list. If the project hides other people's tickets, an email is
//          required and only that submitter's tickets are returned.
// @route   GET /api/public/portal/:token/tickets?status=&search=&email=&page=
const getPortalTickets = async (req, res, next) => {
  try {
    const project = await findPortalProject(req.params.token, res);
    const showAll = project.portal?.showAllTickets !== false;
    const { status, search, type } = req.query;
    const email = String(req.query.email || '').toLowerCase().trim();

    const filter = { project: project._id };
    if (!showAll) {
      if (!EMAIL_RE.test(email)) return res.json({ items: [], page: 1, limit: 10, total: 0, totalPages: 1, needsEmail: true });
      filter.submitterEmail = email;
    } else if (email) {
      filter.submitterEmail = email;
    }
    if (status === 'active') filter.status = { $in: ACTIVE };
    else if (status === 'done') filter.status = { $in: ['resolved', 'closed'] };
    if (type && /^[\w-]{1,60}$/.test(type)) filter.type = type;
    if (search) {
      const s = String(search).trim();
      const num = s.match(/^#?(\d+)$/);
      filter.$or = [{ title: { $regex: escapeRegex(s), $options: 'i' } }];
      if (num) filter.$or.push({ ticketNumber: Number(num[1]) });
    }

    const { limit, skip, buildResult } = getPagination(req.query, 10, 50);
    const [items, total] = await Promise.all([
      Ticket.find(filter)
        .sort({ lastActivityAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate([{ path: 'assignedTo', select: 'name avatarColor' }, { path: 'reportedBy', select: 'name' }]),
      Ticket.countDocuments(filter),
    ]);
    res.json(buildResult(items.map((t) => publicTicket(t)), total));
  } catch (error) {
    next(error);
  }
};

// @desc    Submit a new request from the portal (or the legacy embeddable form)
// @route   POST /api/public/portal/:token/tickets   (alias: POST /api/public/forms/:token/submit)
const submitPortalTicket = async (req, res, next) => {
  try {
    const project = await findPortalProject(req.params.token, res);

    const { name, email, title, description, type, priority } = req.body;
    if (!name?.trim() || !email?.trim() || !title?.trim() || !description?.trim()) {
      res.status(400);
      throw new Error('Name, email, subject and message are required');
    }
    if (!EMAIL_RE.test(String(email).trim())) {
      res.status(400);
      throw new Error('Please enter a valid email address');
    }

    const company = await Company.findById(project.company._id);
    const { values: customFields, missing } = cleanCustomFields(company, req.body.customFields, {
      portalOnly: true,
      checkRequired: true,
    });
    if (missing.length) {
      res.status(400);
      throw new Error(`Please fill in: ${missing.join(', ')}`);
    }

    const ticketNumber = await getNextTicketNumber(project.company._id);
    const ticket = new Ticket({
      company: project.company._id,
      client: project.client._id,
      project: project._id,
      ticketNumber,
      title: String(title).trim().slice(0, 200),
      description: String(description).slice(0, 20000),
      type: resolveType(company, type),
      customFields,
      priority: ['low', 'medium', 'high'].includes(priority) ? priority : 'medium',
      source: 'public_form',
      submitterName: String(name).trim().slice(0, 100),
      submitterEmail: String(email).toLowerCase().trim(),
      files: cleanFiles(req.body.files),
      awaitingTeamReply: true,
      updates: [{ message: `Submitted via the client portal by ${String(name).trim()}` }],
    });
    ticket.createdAt = new Date();
    applySla(ticket, company);
    await ticket.save();

    sendAutoReply(company, ticket).catch((err) => console.error('Failed to send portal auto-reply:', err.message));
    logActivity({
      company: company._id,
      actorName: `Client: ${ticket.submitterName}`,
      entityType: 'ticket',
      entityId: ticket._id,
      entityLabel: `#${ticket.ticketNumber}`,
      action: 'ticket.created',
      summary: `submitted #${ticket.ticketNumber} “${ticket.title}” via the portal`,
      link: `/tickets/${ticket._id}`,
    });
    await runAutomations('ticket.created', ticket._id, company._id);
    const fresh = await Ticket.findById(ticket._id).select('assignedTo');
    if (!fresh.assignedTo) {
      notify(company._id, 'admins', {
        kind: 'client_reply',
        title: `New portal request #${ticket.ticketNumber}`,
        body: ticket.title,
        link: `/tickets/${ticket._id}`,
      });
    }

    res.status(201).json({ ticketNumber: ticket.ticketNumber, trackingToken: ticket.publicToken });
  } catch (error) {
    next(error);
  }
};

// @desc    Public ticket detail by tracking token (works from the portal and email links)
// @route   GET /api/public/tickets/:token
const getPublicTicket = async (req, res, next) => {
  try {
    const ticket = await Ticket.findOne({ publicToken: req.params.token }).populate(PUBLIC_POPULATE);
    if (!ticket) {
      res.status(404);
      throw new Error('Ticket not found');
    }
    const project = await Project.findById(ticket.project?._id).select('publicToken publicFormEnabled portal');
    const company = await Company.findById(ticket.company).select('name workspace csatEnabled');
    const ws = publicWorkspace(company);
    res.json({
      ...publicTicket(ticket, { withUpdates: true }),
      ...ws,
      fields: ws.customFields
        .filter((f) => ticket.customFields?.[f.key] !== undefined && ticket.customFields?.[f.key] !== '')
        .map((f) => ({ label: f.label, type: f.type, value: ticket.customFields[f.key] })),
      csat: ticket.csat?.rating ? { rating: ticket.csat.rating, comment: ticket.csat.comment } : null,
      companyName: company?.name,
      portalToken: project?.publicFormEnabled ? project.publicToken : null,
      allowComments: project?.portal?.allowComments !== false,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Client adds a message to their ticket; can also reopen a resolved ticket
// @route   POST /api/public/tickets/:token/comments
const addPublicComment = async (req, res, next) => {
  try {
    const ticket = await Ticket.findOne({ publicToken: req.params.token });
    if (!ticket) {
      res.status(404);
      throw new Error('Ticket not found');
    }
    const project = await Project.findById(ticket.project).select('portal');
    if (project?.portal?.allowComments === false) {
      res.status(403);
      throw new Error('Comments are disabled for this project');
    }

    const message = String(req.body.message || '').trim();
    const name = String(req.body.name || ticket.submitterName || 'Client').trim().slice(0, 100);
    if (!message) {
      res.status(400);
      throw new Error('Message is required');
    }
    if (message.length > 10000) {
      res.status(400);
      throw new Error('Message is too long');
    }

    const files = cleanFiles(req.body.files);
    const update = { authorName: name, message, fromClient: true, isInternal: false, files };
    if (req.body.reopen && ['resolved', 'closed'].includes(ticket.status)) {
      ticket.status = 'reopened';
      ticket.resolvedAt = undefined;
      update.statusChangeTo = 'reopened';
    }
    files.forEach((f) => ticket.files.push(f));
    ticket.updates.push(update);
    ticket.awaitingTeamReply = true;
    ticket.lastActivityAt = new Date();
    await ticket.save();

    // Notify the assignee — or the owners/admins if nobody is assigned yet.
    (async () => {
      const company = await Company.findById(ticket.company);
      const recipients = ticket.assignedTo
        ? await User.find({ _id: ticket.assignedTo, isActive: true }).select('email')
        : await User.find({ company: ticket.company, role: { $in: ['owner', 'admin'] }, isActive: true }).select('email');
      if (company) await sendClientCommentNotification(company, ticket, recipients, { authorName: name, message });
    })().catch((err) => console.error('Failed to notify team of client comment:', err.message));

    logActivity({
      company: ticket.company,
      actorName: `Client: ${name}`,
      entityType: 'ticket',
      entityId: ticket._id,
      entityLabel: `#${ticket.ticketNumber}`,
      action: update.statusChangeTo ? 'ticket.reopened' : 'ticket.client_replied',
      summary: update.statusChangeTo ? `reopened #${ticket.ticketNumber}` : `replied on #${ticket.ticketNumber}`,
      link: `/tickets/${ticket._id}`,
    });
    notify(ticket.company, ticket.assignedTo || 'admins', {
      kind: 'client_reply',
      title: `${name} replied on #${ticket.ticketNumber}`,
      body: message,
      link: `/tickets/${ticket._id}`,
    });
    await runAutomations('ticket.client_replied', ticket._id, ticket.company);
    if (update.statusChangeTo) await runAutomations('ticket.status_changed', ticket._id, ticket.company);

    const populated = await Ticket.findById(ticket._id).populate(PUBLIC_POPULATE);
    res.status(201).json(publicTicket(populated, { withUpdates: true }));
  } catch (error) {
    next(error);
  }
};

// "2026-10-08" -> Date at 00:00 UTC (todos are stored per calendar day).
function parseDay(value) {
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

// @desc    Read-only view of the project's to-do plan, only when the team has enabled it.
//          Notes and ticket links are internal and never returned.
// @route   GET /api/public/portal/:token/todos?from=YYYY-MM-DD&to=YYYY-MM-DD
const getPortalTodos = async (req, res, next) => {
  try {
    const project = await findPortalProject(req.params.token, res);
    if (project.portal?.showTodos !== true) {
      res.status(403);
      throw new Error('The to-do list is not shared for this project');
    }
    const today = parseDay(new Date().toISOString().slice(0, 10));
    const from = parseDay(req.query.from) || new Date(today.getTime() - 3 * 864e5);
    let to = parseDay(req.query.to) || new Date(today.getTime() + 3 * 864e5);
    // Cap the range so the endpoint can't be used to dump everything at once.
    if (to - from > 62 * 864e5) to = new Date(from.getTime() + 62 * 864e5);

    const [todos, summary] = await Promise.all([
      Todo.find({ project: project._id, date: { $gte: from, $lte: to } })
        .sort({ date: 1, completed: 1, createdAt: 1 })
        .populate('assignedTo', 'name avatarColor')
        .lean(),
      Todo.aggregate([
        { $match: { project: project._id } },
        { $group: { _id: '$completed', count: { $sum: 1 } } },
      ]),
    ]);

    const total = summary.reduce((a, s) => a + s.count, 0);
    const done = summary.filter((s) => s._id === true).reduce((a, s) => a + s.count, 0);

    res.json({
      from,
      to,
      totals: { total, done },
      todos: todos.map((t) => ({
        _id: t._id,
        title: t.title,
        date: t.date,
        priority: t.priority,
        completed: t.completed,
        completedAt: t.completedAt,
        assignee: t.assignedTo ? { name: t.assignedTo.name, avatarColor: t.assignedTo.avatarColor } : null,
      })),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Client rates how their resolved request was handled (1–5 + optional comment)
// @route   POST /api/public/tickets/:token/csat
const submitCsat = async (req, res, next) => {
  try {
    const ticket = await Ticket.findOne({ publicToken: req.params.token });
    if (!ticket) {
      res.status(404);
      throw new Error('Ticket not found');
    }
    const company = await Company.findById(ticket.company).select('csatEnabled');
    if (company?.csatEnabled === false) {
      res.status(403);
      throw new Error('Ratings are disabled');
    }
    if (!['resolved', 'closed'].includes(ticket.status)) {
      res.status(400);
      throw new Error('You can rate a request once it has been resolved');
    }
    const rating = Number(req.body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      res.status(400);
      throw new Error('Rating must be between 1 and 5');
    }
    ticket.csat = { rating, comment: String(req.body.comment || '').slice(0, 2000), submittedAt: new Date() };
    await ticket.save();
    logActivity({
      company: ticket.company,
      actorName: `Client: ${ticket.submitterName || 'Client'}`,
      entityType: 'ticket',
      entityId: ticket._id,
      entityLabel: `#${ticket.ticketNumber}`,
      action: 'ticket.csat',
      summary: `rated #${ticket.ticketNumber} ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`,
      link: `/tickets/${ticket._id}`,
    });
    notify(ticket.company, ticket.assignedTo || 'admins', {
      kind: 'csat',
      title: `#${ticket.ticketNumber} rated ${rating}/5`,
      body: ticket.csat.comment || ticket.title,
      link: `/tickets/${ticket._id}`,
    });
    res.json({ csat: { rating, comment: ticket.csat.comment } });
  } catch (error) {
    next(error);
  }
};

// ───────────────────────── Legacy embeddable form ─────────────────────────

// @desc    Get public metadata for a project's embeddable intake form
// @route   GET /api/public/forms/:token
const getPublicForm = async (req, res, next) => {
  try {
    const project = await findPortalProject(req.params.token, res);
    res.json({
      projectName: project.name,
      companyName: project.company?.name,
      clientName: project.client?.name,
      ...publicWorkspace(await Company.findById(project.company._id).select('workspace csatEnabled')),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Inbound email webhook (legacy/optional alternative to IMAP polling)
// @route   POST /api/public/email/:companyId/:secret
const emailWebhook = async (req, res, next) => {
  try {
    const { companyId, secret } = req.params;
    const company = await Company.findOne({ _id: companyId, emailWebhookSecret: secret });
    if (!company) {
      res.status(401);
      throw new Error('Invalid email webhook credentials');
    }
    if (!company.emailIntakeEnabled) {
      return res.status(200).json({ message: 'Email intake is disabled for this company' });
    }

    const fromRaw = req.body.from || req.body.sender || req.body.From || '';
    const subject = req.body.subject || req.body.Subject || '(no subject)';
    const text = req.body.text || req.body['body-plain'] || req.body.TextBody || req.body.body || '';

    const emailMatch = fromRaw.match(/[\w.+-]+@[\w-]+\.[a-zA-Z.]{2,}/);
    const senderEmail = (emailMatch ? emailMatch[0] : fromRaw).toLowerCase().trim();
    const nameMatch = fromRaw.match(/^"?([^"<]*)"?\s*</);
    const senderName = nameMatch ? nameMatch[1].trim() : senderEmail;

    const ticket = await createTicketFromEmail(company, { senderEmail, senderName, subject, text });
    if (!ticket) return res.status(200).json({ message: 'Ignored by keyword filter' });

    res.status(201).json({ message: 'Ticket created', ticketNumber: ticket.ticketNumber });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPortal,
  getPortalTickets,
  getPortalTodos,
  submitPortalTicket,
  getPublicTicket,
  addPublicComment,
  submitCsat,
  getPublicForm,
  submitPublicForm: submitPortalTicket,
  emailWebhook,
};
