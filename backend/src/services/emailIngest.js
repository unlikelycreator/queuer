const Client = require('../models/Client');
const Project = require('../models/Project');
const Ticket = require('../models/Ticket');
const { getNextTicketNumber } = require('../utils/ticketNumber');
const { resolveType } = require('../utils/workspace');
const { applySla } = require('./sla');

const TYPE_MAP = {
  bug: 'bug_report',
  feature: 'feature_request',
  change: 'change_request',
  support: 'support_ticket',
};

/**
 * Finds (or creates a fallback) client/project for an inbound email, then creates a ticket.
 * Returns null (and creates nothing) if the company has keyword filtering enabled and the
 * subject doesn't contain any of the configured trigger words.
 * @param {Document} company - the Company mongoose document
 * @param {{ senderEmail: string, senderName: string, subject: string, text: string, files?: Array, messageId?: string }} email
 */
async function createTicketFromEmail(company, email) {
  const { senderEmail, senderName, subject, text, files = [], messageId } = email;

  const filter = company.emailKeywordFilter;
  if (filter?.enabled && filter.keywords?.length) {
    const subjectLower = (subject || '').toLowerCase();
    const matches = filter.keywords.some((kw) => kw && subjectLower.includes(kw.toLowerCase()));
    if (!matches) return null;
  }

  let client = senderEmail ? await Client.findOne({ company: company._id, email: senderEmail }) : null;
  let project = null;

  if (client) {
    project = await Project.findOne({ client: client._id }).sort({ createdAt: -1 });
  }

  if (!project) {
    if (company.defaultEmailProject) {
      project = await Project.findById(company.defaultEmailProject);
      if (project) client = await Client.findById(project.client);
    }
    if (!project) {
      client =
        (await Client.findOne({ company: company._id, name: 'Email Inquiries' })) ||
        (await Client.create({ company: company._id, name: 'Email Inquiries', email: '', status: 'active' }));
      project =
        (await Project.findOne({ company: company._id, client: client._id, name: 'General Support' })) ||
        (await Project.create({
          company: company._id,
          client: client._id,
          name: 'General Support',
          description: 'Auto-created inbox for incoming support emails that could not be matched to a client.',
          status: 'in_progress',
        }));
      company.defaultEmailClient = client._id;
      company.defaultEmailProject = project._id;
      await company.save();
    }
  }

  const typeTag = (subject.match(/\[(bug|feature|change|support)[^\]]*\]/i) || [])[1];
  const type = resolveType(company, TYPE_MAP[typeTag?.toLowerCase()] || 'support_ticket');

  const ticketNumber = await getNextTicketNumber(company._id);

  const ticket = new Ticket({
    company: company._id,
    client: client._id,
    project: project._id,
    ticketNumber,
    title: subject.replace(/\[(bug|feature|change|support)[^\]]*\]\s*/i, '').slice(0, 200) || '(no subject)',
    description: text || '(No message body)',
    type,
    priority: 'medium',
    source: 'email',
    submitterName: senderName,
    submitterEmail: senderEmail,
    originalMessageId: messageId || undefined,
    files,
    awaitingTeamReply: true,
    updates: [
      {
        message: `Auto-created from an email sent to ${company.supportEmail || 'the support inbox'} by ${senderName} <${senderEmail}>`,
      },
    ],
  });

  ticket.createdAt = new Date();
  applySla(ticket, company);
  await ticket.save();
  // Lazy require avoids a circular import (engine → mailSender → …).
  await require('./automationEngine').runAutomations('ticket.created', ticket._id, company._id);
  require('./notify').notify(company._id, 'admins', {
    kind: 'client_reply',
    title: `New email ticket #${ticket.ticketNumber}`,
    body: ticket.title,
    link: `/tickets/${ticket._id}`,
  });
  return ticket;
}

module.exports = { createTicketFromEmail };
