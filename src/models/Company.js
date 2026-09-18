const mongoose = require('mongoose');
const crypto = require('crypto');

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    inviteCode: { type: String, unique: true, sparse: true },

    // Dynamic support inbox: the company decides the address (e.g. support@ezeelink.net)
    // on their own mail provider — Queuer connects to it directly over IMAP, so no
    // third-party inbound-parsing service is required.
    supportEmail: { type: String, trim: true, lowercase: true, default: '' },
    emailIntakeEnabled: { type: Boolean, default: false },

    emailImap: {
      host: { type: String, trim: true, default: '' },
      port: { type: Number, default: 993 },
      secure: { type: Boolean, default: true }, // true = TLS/SSL (typical for port 993)
      username: { type: String, trim: true, default: '' },
      passwordEncrypted: { type: String, default: '' },
      folder: { type: String, trim: true, default: 'INBOX' },
    },

    // Outbound mail (assignment notifications, auto-replies, and manual replies from a
    // ticket) — reuses the IMAP mailbox's username/password by default, since most
    // providers issue one login for both. A separate SMTP host/port can be set when
    // the provider splits them (e.g. imap.example.com vs smtp.example.com).
    emailSmtp: {
      host: { type: String, trim: true, default: '' },
      port: { type: Number, default: 587 },
      secure: { type: Boolean, default: false }, // false = STARTTLS on 587, true = SSL on 465
    },

    emailNotifications: {
      autoReplyEnabled: { type: Boolean, default: true },
      assignmentNotificationsEnabled: { type: Boolean, default: true },
    },

    // Only subjects containing one of these words become tickets, so a mailbox that
    // gets general mail doesn't turn everything into a ticket.
    emailKeywordFilter: {
      enabled: { type: Boolean, default: true },
      keywords: {
        type: [String],
        default: ['support', 'bug', 'help', 'issue', 'feature', 'request', 'ticket'],
      },
    },

    emailLastCheckedAt: { type: Date },
    emailLastError: { type: String, default: '' },

    // Legacy/optional: inbound webhook secret, kept for anyone who still wants to
    // wire up an external provider instead of IMAP polling.
    emailWebhookSecret: { type: String, unique: true, sparse: true },

    // Where tickets land when an inbound email can't be matched to a specific client/project.
    defaultEmailClient: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
    defaultEmailProject: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  },
  { timestamps: true }
);

companySchema.pre('save', function (next) {
  if (!this.emailWebhookSecret) {
    this.emailWebhookSecret = crypto.randomBytes(16).toString('hex');
  }
  next();
});

module.exports = mongoose.model('Company', companySchema);
