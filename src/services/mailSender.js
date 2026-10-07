const nodemailer = require('nodemailer');
const { decrypt } = require('../utils/crypto');
const { escapeHtml, nl2br } = require('../utils/sanitize');
const { renderEmail } = require('./emailTemplate');

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

function appUrl(path = '') {
  return `${(process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '')}${path}`;
}

function trackingUrl(ticket) {
  return ticket.publicToken ? appUrl(`/public/ticket/${ticket.publicToken}`) : null;
}

// Platform-level SMTP (set in .env) used for account emails like password resets, which
// must work even before a company has configured its own mailbox.
let systemTransporter;
function getSystemTransporter() {
  if (systemTransporter !== undefined) return systemTransporter;
  if (!process.env.SMTP_HOST) {
    systemTransporter = null;
    return null;
  }
  systemTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return systemTransporter;
}

/**
 * Sends an account/system email. Prefers the platform SMTP from .env; falls back to the
 * user's company mailbox; and in development, logs the message to the console so flows
 * like "forgot password" can be tested without any mail setup.
 */
async function sendSystemMail(company, options) {
  const transporter = getSystemTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        ...options,
      });
      return { sent: true };
    } catch (err) {
      console.error('System SMTP send failed:', err.message);
    }
  }
  if (company) {
    const result = await sendMail(company, options);
    if (result.sent) return result;
  }
  if (process.env.NODE_ENV !== 'production') {
    console.log('\n──────── [dev] email not sent (no SMTP configured) ────────');
    console.log(`To: ${options.to}\nSubject: ${options.subject}\n\n${options.text}`);
    console.log('────────────────────────────────────────────────────────────\n');
    return { sent: false, reason: 'logged-to-console' };
  }
  return { sent: false, reason: 'No SMTP configured' };
}

// Tells the assignee (or every admin when unassigned) that the client posted on the portal.
async function sendClientCommentNotification(company, ticket, recipients, { authorName, message }) {
  const to = recipients.map((u) => u.email).filter(Boolean);
  if (!to.length) return;
  await sendMail(company, {
    to: to.join(', '),
    subject: `[Ticket #${ticket.ticketNumber}] New message from ${authorName}`,
    text: `${authorName} wrote on ticket #${ticket.ticketNumber} — "${ticket.title}":\n\n${message}\n\nOpen: ${appUrl(`/tickets/${ticket._id}`)}`,
    html: renderEmail({
      brand: company.name,
      heading: `New client message on #${ticket.ticketNumber}`,
      body: `<p><strong>${escapeHtml(authorName)}</strong> wrote:</p><blockquote style="margin:0;padding:12px 16px;border-left:3px solid #10b981;background:#f0fdf4;border-radius:8px">${nl2br(message)}</blockquote>`,
      cta: { label: 'Open ticket', url: appUrl(`/tickets/${ticket._id}`) },
    }),
  });
}

// Lets the submitter know their ticket moved (e.g. resolved), with a link back to the portal.
async function sendStatusChangeNotification(company, ticket, { statusLabel, message }) {
  if (!ticket.submitterEmail || !company.emailNotifications?.autoReplyEnabled) return;
  await sendMail(company, {
    to: ticket.submitterEmail,
    subject: `Re: ${ticket.title} [Ticket #${ticket.ticketNumber}] — ${statusLabel}`,
    inReplyTo: ticket.originalMessageId || undefined,
    references: ticket.originalMessageId || undefined,
    text: `Your request #${ticket.ticketNumber} is now: ${statusLabel}.${message ? `\n\n${message}` : ''}${trackingUrl(ticket) ? `\n\nTrack progress: ${trackingUrl(ticket)}` : ''}`,
    html: renderEmail({
      brand: company.name,
      heading: `Request #${ticket.ticketNumber} is now ${statusLabel}`,
      body: `<p><strong>${escapeHtml(ticket.title)}</strong></p>${message ? `<p>${nl2br(message)}</p>` : ''}`,
      cta: trackingUrl(ticket) ? { label: 'View request', url: trackingUrl(ticket) } : null,
    }),
  });
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
    text: `Hi ${ticket.submitterName || ''},\n\nThanks for reaching out — we've received your message and our team will get back to you at the earliest.\n\nYour reference number is #${ticket.ticketNumber}.${trackingUrl(ticket) ? `\n\nTrack progress: ${trackingUrl(ticket)}` : ''}\n\n— ${company.name}`,
    html: renderEmail({
      brand: company.name,
      heading: `We've received your request`,
      body: `<p>Hi ${escapeHtml(ticket.submitterName || '')},</p><p>Thanks for reaching out — our team will get back to you at the earliest.</p><p>Your reference number is <strong>#${ticket.ticketNumber}</strong>.</p>`,
      cta: trackingUrl(ticket) ? { label: 'Track your request', url: trackingUrl(ticket) } : null,
    }),
  });
}

// Sent to a team member when they're assigned a ticket.
async function sendAssignmentNotification(company, ticket, assignedUser) {
  if (!company.emailNotifications?.assignmentNotificationsEnabled) return;
  if (!assignedUser?.email) return;

  await sendMail(company, {
    to: assignedUser.email,
    subject: `[Ticket #${ticket.ticketNumber}] assigned to you: ${ticket.title}`,
    text: `You've been assigned ticket #${ticket.ticketNumber} — "${ticket.title}".\n\n${ticket.description}\n\nOpen Queuer to respond: ${appUrl(`/tickets/${ticket._id}`)}`,
    html: renderEmail({
      brand: company.name,
      heading: `Ticket #${ticket.ticketNumber} assigned to you`,
      body: `<p><strong>${escapeHtml(ticket.title)}</strong></p><p>${nl2br(ticket.description || '')}</p>`,
      cta: { label: 'Open ticket', url: appUrl(`/tickets/${ticket._id}`) },
    }),
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
    text: `${message}\n\n— ${authorName || company.name}${trackingUrl(ticket) ? `\n\nView the full conversation: ${trackingUrl(ticket)}` : ''}`,
    html: renderEmail({
      brand: company.name,
      body: `<p>${nl2br(message || '')}</p><p>— ${escapeHtml(authorName || company.name)}</p>`,
      cta: trackingUrl(ticket) ? { label: 'View conversation', url: trackingUrl(ticket) } : null,
    }),
    attachments: attachments.map((a) => ({ filename: a.originalName || a.filename, path: a.url })),
  });
}

module.exports = {
  sendMail,
  sendSystemMail,
  sendAutoReply,
  sendAssignmentNotification,
  sendTicketReply,
  sendClientCommentNotification,
  sendStatusChangeNotification,
  appUrl,
  trackingUrl,
};
