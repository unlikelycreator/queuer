const nodemailer = require('nodemailer');
const { decrypt } = require('../utils/crypto');

/**
 * Builds a nodemailer transporter from the company's stored mailbox credentials.
 * Returns null if SMTP isn't configured (so callers can no-op gracefully).
 */
function getTransporter(company) {
  const smtp = company.emailSmtp || {};
  const imap = company.emailImap || {};
  if (!smtp.host || !imap.username || !imap.passwordEncrypted) return null;

  const password = decrypt(imap.passwordEncrypted);
  if (!password) return null;

  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port || 587,
    secure: !!smtp.secure, // true for 465 (SSL), false for 587/25 (STARTTLS)
    auth: { user: imap.username, pass: password },
  });
}

function fromAddress(company) {
  const name = company.name || 'Support';
  const address = company.supportEmail || company.emailImap?.username;
  return address ? `"${name}" <${address}>` : undefined;
}

async function sendMail(company, options) {
  const transporter = getTransporter(company);
  if (!transporter) return { sent: false, reason: 'SMTP not configured' };
  try {
    await transporter.sendMail({ from: fromAddress(company), ...options });
    return { sent: true };
  } catch (err) {
    console.error(`Failed to send email for company ${company._id}:`, err.message);
    return { sent: false, reason: err.message };
  }
}

// Sent automatically the moment a ticket is created from an inbound email.
async function sendAutoReply(company, ticket) {
  if (!company.emailNotifications?.autoReplyEnabled) return;
  if (!ticket.submitterEmail) return;

  await sendMail(company, {
    to: ticket.submitterEmail,
    subject: `Re: ${ticket.title} [Ticket #${ticket.ticketNumber}]`,
    inReplyTo: ticket.originalMessageId || undefined,
    references: ticket.originalMessageId || undefined,
    text: `Hi ${ticket.submitterName || ''},\n\nThanks for reaching out — we've received your message and our team will get back to you at the earliest.\n\nYour reference number is #${ticket.ticketNumber}.\n\n— ${company.name}`,
    html: `<p>Hi ${ticket.submitterName || ''},</p><p>Thanks for reaching out — we've received your message and our team will get back to you at the earliest.</p><p>Your reference number is <strong>#${ticket.ticketNumber}</strong>.</p><p>— ${company.name}</p>`,
  });
}

// Sent to a team member when they're assigned a ticket.
async function sendAssignmentNotification(company, ticket, assignedUser) {
  if (!company.emailNotifications?.assignmentNotificationsEnabled) return;
  if (!assignedUser?.email) return;

  await sendMail(company, {
    to: assignedUser.email,
    subject: `[Ticket #${ticket.ticketNumber}] assigned to you: ${ticket.title}`,
    text: `You've been assigned ticket #${ticket.ticketNumber} — "${ticket.title}".\n\n${ticket.description}\n\nOpen Queuer to respond.`,
    html: `<p>You've been assigned ticket <strong>#${ticket.ticketNumber}</strong> — "${ticket.title}".</p><p>${(ticket.description || '').replace(/\n/g, '<br/>')}</p><p>Open Queuer to respond.</p>`,
  });
}

// A team member replying to the client directly from the ticket (Gmail-style reply).
async function sendTicketReply(company, ticket, { message, authorName, attachments = [] }) {
  if (!ticket.submitterEmail) return { sent: false, reason: 'This ticket has no submitter email to reply to' };

  return sendMail(company, {
    to: ticket.submitterEmail,
    subject: `Re: ${ticket.title} [Ticket #${ticket.ticketNumber}]`,
    inReplyTo: ticket.originalMessageId || undefined,
    references: ticket.originalMessageId || undefined,
    text: `${message}\n\n— ${authorName || company.name}`,
    html: `<p>${(message || '').replace(/\n/g, '<br/>')}</p><p>— ${authorName || company.name}</p>`,
    attachments: attachments.map((a) => ({ filename: a.originalName || a.filename, path: a.url })),
  });
}

module.exports = { sendMail, sendAutoReply, sendAssignmentNotification, sendTicketReply };
