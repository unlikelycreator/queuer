const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const { convert: htmlToText } = require('html-to-text');
const Company = require('../models/Company');
const { decrypt } = require('../utils/crypto');
const { createTicketFromEmail } = require('./emailIngest');
const { sendAutoReply } = require('./mailSender');
const { uploadDir } = require('../config/multer');

const POLL_INTERVAL_MS = Number(process.env.EMAIL_POLL_INTERVAL_MS) || 60000; // 1 minute by default
const PUBLIC_API_URL = (process.env.PUBLIC_API_URL || 'http://localhost:5000').replace(/\/$/, '');

let pollingTimer = null;
let pollInFlight = false;

function extractSender(parsed) {
  const addr = parsed.from?.value?.[0];
  const senderEmail = (addr?.address || '').toLowerCase().trim();
  const senderName = addr?.name || senderEmail;
  return { senderEmail, senderName };
}

// Prefer the plain-text body; if the email is HTML-only, convert it to readable text
// instead of dumping raw markup. Also strips quoted "On ... wrote:" reply chains and
// collapses excess blank lines so the ticket description stays clean.
function extractBody(parsed) {
  let text = (parsed.text || '').trim();

  if (!text && parsed.html) {
    text = htmlToText(parsed.html, {
      wordwrap: false,
      selectors: [
        { selector: 'img', format: 'skip' },
        { selector: 'a', options: { ignoreHref: true } },
      ],
    }).trim();
  }

  // Cut off common quoted-reply markers so replies to auto-reply threads stay short.
  const quoteMarkers = [/\n\s*On .{0,80} wrote:\s*\n/i, /\n-{2,}\s*Original Message\s*-{2,}/i, /\n_{5,}\n/];
  for (const marker of quoteMarkers) {
    const idx = text.search(marker);
    if (idx > 0) text = text.slice(0, idx).trim();
  }

  return text.replace(/\n{3,}/g, '\n\n').trim();
}

async function saveAttachment(attachment) {
  const unique = crypto.randomBytes(10).toString('hex');
  const safeExt = path.extname(attachment.filename || '') || '';
  const filename = `${Date.now()}-${unique}${safeExt}`;
  const filepath = path.join(uploadDir, filename);
  fs.writeFileSync(filepath, attachment.content);
  return {
    filename,
    originalName: attachment.filename || filename,
    url: `${PUBLIC_API_URL}/uploads/${filename}`,
    size: attachment.size || attachment.content.length,
  };
}

/**
 * Connects to one company's mailbox over IMAP, pulls any unseen messages,
 * turns each into a ticket (if its subject matches the keyword filter), and
 * marks them as seen so they aren't reprocessed on the next check.
 */
async function pollCompanyMailbox(company) {
  const { host, port, secure, username, passwordEncrypted, folder } = company.emailImap || {};
  if (!host || !username || !passwordEncrypted) return;

  const password = decrypt(passwordEncrypted);
  if (!password) {
    company.emailLastError = 'Stored mailbox password could not be decrypted — please re-enter it in Settings.';
    await company.save();
    return;
  }

  const client = new ImapFlow({
    host,
    port: port || 993,
    secure: secure !== false,
    auth: { user: username, pass: password },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock(folder || 'INBOX');
    try {
      // Only fetch messages we haven't processed yet. uid:true keeps ids stable
      // across the session instead of shifting sequence numbers.
      const uids = await client.search({ seen: false }, { uid: true });
      for (const uid of uids || []) {
        try {
          const { content } = await client.download(uid, undefined, { uid: true });
          const parsed = await simpleParser(content);
          const { senderEmail, senderName } = extractSender(parsed);
          const bodyText = extractBody(parsed);

          const files = [];
          for (const att of parsed.attachments || []) {
            // mailparser also lists inline images referenced by the HTML body (cid:...)
            // as "attachments" — skip those so we don't attach the email's own logo etc.
            if (att.contentDisposition === 'inline' && att.related) continue;
            try {
              files.push(await saveAttachment(att));
            } catch (attErr) {
              console.error('Failed to save email attachment:', attErr.message);
            }
          }

          const ticket = await createTicketFromEmail(company, {
            senderEmail,
            senderName,
            subject: parsed.subject || '(no subject)',
            text: bodyText,
            files,
            messageId: parsed.messageId,
          });

          if (ticket) {
            sendAutoReply(company, ticket).catch((err) =>
              console.error('Failed to send auto-reply:', err.message)
            );
          }

          await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
        } catch (msgErr) {
          console.error(`Failed to process inbound email (uid ${uid}) for company ${company._id}:`, msgErr.message);
        }
      }
    } finally {
      lock.release();
    }
    company.emailLastError = '';
  } catch (err) {
    company.emailLastError = err.message || 'Failed to connect to mailbox';
    console.error(`IMAP poll failed for company ${company._id}:`, err.message);
  } finally {
    company.emailLastCheckedAt = new Date();
    await company.save();
    try {
      await client.logout();
    } catch {
      /* connection may already be closed */
    }
  }
}

async function pollAllCompanies() {
  if (pollInFlight) return; // avoid overlapping runs if one poll takes longer than the interval
  pollInFlight = true;
  try {
    const companies = await Company.find({
      emailIntakeEnabled: true,
      'emailImap.host': { $ne: '' },
      'emailImap.passwordEncrypted': { $ne: '' },
    });
    for (const company of companies) {
      await pollCompanyMailbox(company);
    }
  } catch (err) {
    console.error('Email polling cycle failed:', err.message);
  } finally {
    pollInFlight = false;
  }
}

function startEmailPolling() {
  if (pollingTimer) return;
  console.log(`Self-hosted IMAP email polling started (every ${POLL_INTERVAL_MS / 1000}s)`);
  pollingTimer = setInterval(pollAllCompanies, POLL_INTERVAL_MS);
  // Kick off an initial check shortly after boot rather than waiting a full interval.
  setTimeout(pollAllCompanies, 5000);
}

module.exports = { startEmailPolling, pollCompanyMailbox, pollAllCompanies };
