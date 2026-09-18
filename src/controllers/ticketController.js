const Ticket = require('../models/Ticket');
const Project = require('../models/Project');
const Company = require('../models/Company');
const User = require('../models/User');
const Counter = require('../models/Counter');
const { sendAssignmentNotification, sendTicketReply } = require('../services/mailSender');
const { getPagination } = require('../utils/pagination');

const getNextTicketNumber = async (companyId) => {
  const counter = await Counter.findOneAndUpdate(
    { company: companyId },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
};

const POPULATE_LIST = [
  { path: 'client', select: 'name' },
  { path: 'project', select: 'name' },
  { path: 'assignedTo', select: 'name avatarColor' },
  { path: 'reportedBy', select: 'name avatarColor' },
];

const POPULATE_DETAIL = [
  { path: 'client', select: 'name' },
  { path: 'project', select: 'name' },
  { path: 'assignedTo', select: 'name avatarColor email' },
  { path: 'reportedBy', select: 'name avatarColor email' },
  { path: 'updates.author', select: 'name avatarColor' },
];

// @desc    Get all tickets (filterable, paginated)
// @route   GET /api/tickets
// @access  Private
const getTickets = async (req, res, next) => {
  try {
    const { project, client, type, status, priority, assignedTo, tag, source, search } = req.query;
    const filter = { company: req.user.company };
    if (project) filter.project = project;
    if (client) filter.client = client;
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (source) filter.source = source;
    if (tag) filter.tags = tag;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ];
    }

    const { limit, skip, buildResult } = getPagination(req.query, 15);
    const [tickets, total] = await Promise.all([
      Ticket.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate(POPULATE_LIST),
      Ticket.countDocuments(filter),
    ]);

    res.json(buildResult(tickets, total));
  } catch (error) {
    next(error);
  }
};

// @desc    Get single ticket
// @route   GET /api/tickets/:id
// @access  Private
const getTicket = async (req, res, next) => {
  try {
    const ticket = await Ticket.findOne({ _id: req.params.id, company: req.user.company }).populate(
      POPULATE_DETAIL
    );
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
// @access  Private
const createTicket = async (req, res, next) => {
  try {
    const { project, title, description, type, priority, assignedTo, attachmentUrls, tags, dueDate, files } =
      req.body;

    if (!project || !title || !description || !type) {
      res.status(400);
      throw new Error('Project, title, description and type are required');
    }

    const projectDoc = await Project.findOne({ _id: project, company: req.user.company });
    if (!projectDoc) {
      res.status(404);
      throw new Error('Project not found');
    }

    const ticketNumber = await getNextTicketNumber(req.user.company);

    const ticket = await Ticket.create({
      company: req.user.company,
      client: projectDoc.client,
      project,
      ticketNumber,
      title,
      description,
      type,
      priority: priority || 'medium',
      assignedTo: assignedTo || null,
      reportedBy: req.user._id,
      source: 'internal',
      attachmentUrls: attachmentUrls || [],
      tags: tags || [],
      dueDate: dueDate || undefined,
      files: files || [],
      updates: [
        {
          author: req.user._id,
          message: 'Ticket created',
        },
      ],
    });

    const populated = await Ticket.findById(ticket._id).populate(POPULATE_LIST);

    if (assignedTo) {
      notifyAssignment(req.user.company, populated).catch((err) =>
        console.error('Failed to send assignment notification:', err.message)
      );
    }

    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
};

// @desc    Update ticket (details, assignment, priority, tags, due date)
// @route   PUT /api/tickets/:id
// @access  Private
const updateTicket = async (req, res, next) => {
  try {
    const ticket = await Ticket.findOne({ _id: req.params.id, company: req.user.company });
    if (!ticket) {
      res.status(404);
      throw new Error('Ticket not found');
    }
    const assignmentChanged =
      req.body.assignedTo !== undefined && String(req.body.assignedTo) !== String(ticket.assignedTo || '');

    const fields = ['title', 'description', 'type', 'priority', 'assignedTo', 'attachmentUrls', 'tags', 'dueDate'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) ticket[f] = req.body[f];
    });
    await ticket.save();
    const populated = await Ticket.findById(ticket._id).populate(POPULATE_LIST);

    if (assignmentChanged && ticket.assignedTo) {
      notifyAssignment(req.user.company, populated).catch((err) =>
        console.error('Failed to send assignment notification:', err.message)
      );
    }

    res.json(populated);
  } catch (error) {
    next(error);
  }
};

async function notifyAssignment(companyId, ticket) {
  const company = await Company.findById(companyId);
  const assignedUser = await User.findById(ticket.assignedTo?._id || ticket.assignedTo);
  if (company && assignedUser) {
    await sendAssignmentNotification(company, ticket, assignedUser);
  }
}

// @desc    Change ticket status + add update/comment (internal note or public-visible)
// @route   POST /api/tickets/:id/updates
// @access  Private
const addTicketUpdate = async (req, res, next) => {
  try {
    const ticket = await Ticket.findOne({ _id: req.params.id, company: req.user.company });
    if (!ticket) {
      res.status(404);
      throw new Error('Ticket not found');
    }

    const { message, status, isInternal } = req.body;
    if (!message) {
      res.status(400);
      throw new Error('Update message is required');
    }

    const update = {
      author: req.user._id,
      message,
      isInternal: !!isInternal,
    };

    if (status && status !== ticket.status) {
      update.statusChangeTo = status;
      ticket.status = status;
      if (status === 'resolved' || status === 'closed') {
        ticket.resolvedAt = new Date();
      } else {
        ticket.resolvedAt = undefined;
      }
    }

    ticket.updates.push(update);
    await ticket.save();

    const populated = await Ticket.findById(ticket._id).populate(POPULATE_DETAIL);

    res.json(populated);
  } catch (error) {
    next(error);
  }
};

// @desc    Add uploaded file references to a ticket
// @route   POST /api/tickets/:id/files
// @access  Private
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
    });
    await ticket.save();
    const populated = await Ticket.findById(ticket._id).populate(POPULATE_DETAIL);
    res.json(populated);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete ticket
// @route   DELETE /api/tickets/:id
// @access  Private
const deleteTicket = async (req, res, next) => {
  try {
    const ticket = await Ticket.findOne({ _id: req.params.id, company: req.user.company });
    if (!ticket) {
      res.status(404);
      throw new Error('Ticket not found');
    }
    await ticket.deleteOne();
    res.json({ message: 'Ticket removed' });
  } catch (error) {
    next(error);
  }
};

// @desc    Reply to the client by email, Gmail-style — sends via the company's own
//          mailbox and logs the message as a normal (public) ticket update.
// @route   POST /api/tickets/:id/reply
// @access  Private
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

    const { message, files } = req.body;
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
    ticket.updates.push({
      author: req.user._id,
      message,
      isInternal: false,
      sentAsEmail: true,
    });
    await ticket.save();

    const populated = await Ticket.findById(ticket._id).populate(POPULATE_DETAIL);
    res.json(populated);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTickets,
  getTicket,
  createTicket,
  updateTicket,
  addTicketUpdate,
  addTicketFiles,
  replyToTicket,
  deleteTicket,
};
