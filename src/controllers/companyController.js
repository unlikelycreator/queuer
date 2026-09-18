const crypto = require('crypto');
const { ImapFlow } = require('imapflow');
const Company = require('../models/Company');
const { encrypt } = require('../utils/crypto');
const { pollCompanyMailbox } = require('../services/emailPoller');

// Strip the encrypted password out of anything we send to the frontend, and instead
// tell it whether a password has been saved so the UI can show "•••• configured".
function sanitizeCompany(company) {
  const obj = company.toObject ? company.toObject() : company;
  const hasPassword = !!obj.emailImap?.passwordEncrypted;
  return {
    ...obj,
    emailImap: {
      ...obj.emailImap,
      passwordEncrypted: undefined,
      hasPassword,
    },
  };
}

// @desc    Get company settings
// @route   GET /api/company
// @access  Private
const getCompany = async (req, res, next) => {
  try {
    const company = await Company.findById(req.user.company)
      .populate('defaultEmailClient', 'name')
      .populate('defaultEmailProject', 'name');
    res.json(sanitizeCompany(company));
  } catch (error) {
    next(error);
  }
};

// @desc    Update company settings, including self-hosted IMAP mailbox config
// @route   PUT /api/company
// @access  Private/Owner/Admin
const updateCompany = async (req, res, next) => {
  try {
    const company = await Company.findById(req.user.company);
    const { name, supportEmail, emailIntakeEnabled, defaultEmailProject, imap, smtp, notifications, keywordFilter } =
      req.body;

    if (name !== undefined) company.name = name;
    if (supportEmail !== undefined) company.supportEmail = supportEmail;
    if (emailIntakeEnabled !== undefined) company.emailIntakeEnabled = emailIntakeEnabled;
    if (defaultEmailProject !== undefined) company.defaultEmailProject = defaultEmailProject || null;

    if (imap) {
      company.emailImap = company.emailImap || {};
      if (imap.host !== undefined) company.emailImap.host = imap.host;
      if (imap.port !== undefined) company.emailImap.port = imap.port;
      if (imap.secure !== undefined) company.emailImap.secure = imap.secure;
      if (imap.username !== undefined) company.emailImap.username = imap.username;
      if (imap.folder !== undefined) company.emailImap.folder = imap.folder || 'INBOX';
      // Only overwrite the stored password if a new one was actually typed in.
      if (imap.password) {
        company.emailImap.passwordEncrypted = encrypt(imap.password);
      }
    }

    if (smtp) {
      company.emailSmtp = company.emailSmtp || {};
      if (smtp.host !== undefined) company.emailSmtp.host = smtp.host;
      if (smtp.port !== undefined) company.emailSmtp.port = smtp.port;
      if (smtp.secure !== undefined) company.emailSmtp.secure = smtp.secure;
    }

    if (notifications) {
      company.emailNotifications = company.emailNotifications || {};
      if (notifications.autoReplyEnabled !== undefined) {
        company.emailNotifications.autoReplyEnabled = notifications.autoReplyEnabled;
      }
      if (notifications.assignmentNotificationsEnabled !== undefined) {
        company.emailNotifications.assignmentNotificationsEnabled = notifications.assignmentNotificationsEnabled;
      }
    }

    if (keywordFilter) {
      company.emailKeywordFilter = company.emailKeywordFilter || {};
      if (keywordFilter.enabled !== undefined) company.emailKeywordFilter.enabled = keywordFilter.enabled;
      if (keywordFilter.keywords !== undefined) company.emailKeywordFilter.keywords = keywordFilter.keywords;
    }

    await company.save();
    res.json(sanitizeCompany(company));
  } catch (error) {
    next(error);
  }
};

// @desc    Test IMAP mailbox credentials without saving them (or test the saved ones)
// @route   POST /api/company/test-imap-connection
// @access  Private/Owner/Admin
const testImapConnection = async (req, res, next) => {
  const { host, port, secure, username, password, folder } = req.body;

  if (!host || !username || !password) {
    res.status(400);
    return next(new Error('Host, username and password are required to test the connection'));
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
    lock.release();
    await client.logout();
    res.json({ success: true, message: `Connected successfully and opened "${folder || 'INBOX'}"` });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || 'Could not connect to the mailbox' });
  }
};

// @desc    Trigger an immediate mailbox check instead of waiting for the next poll cycle
// @route   POST /api/company/check-email-now
// @access  Private/Owner/Admin
const checkEmailNow = async (req, res, next) => {
  try {
    const company = await Company.findById(req.user.company);
    if (!company.emailIntakeEnabled || !company.emailImap?.host) {
      res.status(400);
      throw new Error('Set up and enable your mailbox first');
    }
    await pollCompanyMailbox(company);
    const refreshed = await Company.findById(req.user.company);
    res.json(sanitizeCompany(refreshed));
  } catch (error) {
    next(error);
  }
};

// @desc    (Legacy/optional) regenerate the secret for the external webhook method
// @route   POST /api/company/email-secret/regenerate
// @access  Private/Owner/Admin
const regenerateEmailSecret = async (req, res, next) => {
  try {
    const company = await Company.findById(req.user.company);
    company.emailWebhookSecret = crypto.randomBytes(16).toString('hex');
    await company.save();
    res.json({ emailWebhookSecret: company.emailWebhookSecret });
  } catch (error) {
    next(error);
  }
};

// @desc    Send a test email via the configured SMTP settings, to the current user
// @route   POST /api/company/test-smtp
// @access  Private/Owner/Admin
const testSmtp = async (req, res, next) => {
  try {
    const company = await Company.findById(req.user.company);
    const { sendMail } = require('../services/mailSender');
    const result = await sendMail(company, {
      to: req.user.email,
      subject: 'Queuer test email',
      text: `This is a test email from Queuer to confirm outbound mail (SMTP) is working for ${company.name}.`,
    });
    if (!result.sent) {
      res.status(400);
      throw new Error(result.reason || 'Failed to send test email');
    }
    res.json({ success: true, message: `Test email sent to ${req.user.email}` });
  } catch (error) {
    next(error);
  }
};

module.exports = { getCompany, updateCompany, testImapConnection, testSmtp, checkEmailNow, regenerateEmailSecret };
