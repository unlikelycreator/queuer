const Project = require('../models/Project');
const Client = require('../models/Client');
const Company = require('../models/Company');
const Ticket = require('../models/Ticket');
const Counter = require('../models/Counter');
const { createTicketFromEmail } = require('../services/emailIngest');

const getNextTicketNumber = async (companyId) => {
  const counter = await Counter.findOneAndUpdate(
    { company: companyId },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
};

// @desc    Get public metadata for a project's embeddable intake form
// @route   GET /api/public/forms/:token
// @access  Public
const getPublicForm = async (req, res, next) => {
  try {
    const project = await Project.findOne({ publicToken: req.params.token, publicFormEnabled: true })
      .populate('client', 'name')
      .populate('company', 'name');
    if (!project) {
      res.status(404);
      throw new Error('This form is not available');
    }
    const company = await Company.findById(project.company).select('name');
    res.json({
      projectName: project.name,
      companyName: company?.name,
      clientName: project.client?.name,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Submit the public intake form -> creates a ticket automatically on the project
// @route   POST /api/public/forms/:token/submit
// @access  Public
const submitPublicForm = async (req, res, next) => {
  try {
    const project = await Project.findOne({ publicToken: req.params.token, publicFormEnabled: true });
    if (!project) {
      res.status(404);
      throw new Error('This form is not available');
    }

    const { name, email, title, description, type, files } = req.body;
    if (!name || !email || !title || !description) {
      res.status(400);
      throw new Error('Name, email, subject and message are required');
    }

    const ticketNumber = await getNextTicketNumber(project.company);
    const allowedTypes = ['bug_report', 'feature_request', 'change_request', 'support_ticket'];

    const ticket = await Ticket.create({
      company: project.company,
      client: project.client,
      project: project._id,
      ticketNumber,
      title,
      description,
      type: allowedTypes.includes(type) ? type : 'support_ticket',
      priority: 'medium',
      source: 'public_form',
      submitterName: name,
      submitterEmail: email,
      files: files || [],
      updates: [
        {
          message: `Submitted via the public project form by ${name} (${email})`,
        },
      ],
    });

    res.status(201).json({
      ticketNumber: ticket.ticketNumber,
      trackingToken: ticket.publicToken,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Read-only public ticket status (for the person who submitted it to track progress)
// @route   GET /api/public/tickets/:token
// @access  Public
const getPublicTicket = async (req, res, next) => {
  try {
    const ticket = await Ticket.findOne({ publicToken: req.params.token })
      .populate('project', 'name')
      .populate('client', 'name');
    if (!ticket) {
      res.status(404);
      throw new Error('Ticket not found');
    }

    res.json({
      ticketNumber: ticket.ticketNumber,
      title: ticket.title,
      description: ticket.description,
      type: ticket.type,
      status: ticket.status,
      priority: ticket.priority,
      projectName: ticket.project?.name,
      clientName: ticket.client?.name,
      createdAt: ticket.createdAt,
      resolvedAt: ticket.resolvedAt,
      updates: ticket.updates
        .filter((u) => !u.isInternal)
        .map((u) => ({
          message: u.message,
          statusChangeTo: u.statusChangeTo,
          createdAt: u.createdAt,
        })),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Inbound email webhook — configure your email provider (Mailgun/SendGrid/Postmark
//          inbound parsing, or a forwarding rule) to POST parsed emails here so that any mail
//          sent to the company's support address automatically becomes a ticket.
// @route   POST /api/public/email/:companyId/:secret
// @access  Public (secured by the per-company secret in the URL)
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

    // Accept a range of common field names since inbound-parse providers differ slightly.
    const fromRaw = req.body.from || req.body.sender || req.body.From || '';
    const subject = req.body.subject || req.body.Subject || '(no subject)';
    const text = req.body.text || req.body['body-plain'] || req.body.TextBody || req.body.body || '';

    const emailMatch = fromRaw.match(/[\w.+-]+@[\w-]+\.[a-zA-Z.]{2,}/);
    const senderEmail = (emailMatch ? emailMatch[0] : fromRaw).toLowerCase().trim();
    const nameMatch = fromRaw.match(/^"?([^"<]*)"?\s*</);
    const senderName = nameMatch ? nameMatch[1].trim() : senderEmail;

    const ticket = await createTicketFromEmail(company, { senderEmail, senderName, subject, text });

    res.status(201).json({ message: 'Ticket created', ticketNumber: ticket.ticketNumber });
  } catch (error) {
    next(error);
  }
};

module.exports = { getPublicForm, submitPublicForm, getPublicTicket, emailWebhook };
