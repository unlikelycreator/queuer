const mongoose = require('mongoose');
const crypto = require('crypto');
const { SOFTWARE_TYPES, TEMPLATES, slaPolicies } = require('../config/workspaceTemplates');

const ticketTypeSchema = new mongoose.Schema(
  {
    value: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    short: { type: String, trim: true },
    icon: { type: String, default: 'circle' },
    color: { type: String, default: '#0d9488' },
  },
  { _id: false }
);

const customFieldSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    type: { type: String, enum: ['text', 'number', 'select', 'date', 'checkbox', 'url'], default: 'text' },
    options: [{ type: String, trim: true }],
    required: { type: Boolean, default: false },
    showInPortal: { type: Boolean, default: false },
  },
  { _id: false }
);

const slaTargetSchema = new mongoose.Schema(
  { responseHours: { type: Number, min: 0 }, resolutionHours: { type: Number, min: 0 } },
  { _id: false }
);
const DEFAULT_SLA = slaPolicies(TEMPLATES.software);

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

    // What the team uses Queuer for — drives vocabulary, ticket types and fields.
    workspace: {
      template: { type: String, default: 'software' },
      configured: { type: Boolean, default: false },
      terminology: {
        ticket: { type: String, default: 'Ticket' },
        tickets: { type: String, default: 'Tickets' },
        client: { type: String, default: 'Client' },
        clients: { type: String, default: 'Clients' },
        project: { type: String, default: 'Project' },
        projects: { type: String, default: 'Projects' },
      },
      ticketTypes: { type: [ticketTypeSchema], default: () => SOFTWARE_TYPES.map((t) => ({ ...t })) },
      customFields: { type: [customFieldSchema], default: () => [] },
    },

    sla: {
      enabled: { type: Boolean, default: true },
      low: { type: slaTargetSchema, default: () => DEFAULT_SLA.low },
      medium: { type: slaTargetSchema, default: () => DEFAULT_SLA.medium },
      high: { type: slaTargetSchema, default: () => DEFAULT_SLA.high },
      critical: { type: slaTargetSchema, default: () => DEFAULT_SLA.critical },
    },

    csatEnabled: { type: Boolean, default: true },

    // Billing defaults + how invoices look.
    billing: {
      currency: { type: String, default: 'USD', uppercase: true, trim: true },
      defaultHourlyRate: { type: Number, default: 50, min: 0 },
      taxRate: { type: Number, default: 0, min: 0 },
      taxLabel: { type: String, default: 'Tax', trim: true },
      paymentTermsDays: { type: Number, default: 14, min: 0 },
      invoicePrefix: { type: String, default: 'INV-', trim: true },
      nextInvoiceNumber: { type: Number, default: 1001 },
      template: { type: String, enum: ['modern', 'classic', 'minimal'], default: 'modern' },
      accentColor: { type: String, default: '#047857' },
      logoUrl: { type: String, default: '' },
      businessName: { type: String, default: '', trim: true },
      businessAddress: { type: String, default: '', trim: true },
      businessEmail: { type: String, default: '', trim: true },
      businessPhone: { type: String, default: '', trim: true },
      taxId: { type: String, default: '', trim: true },
      paymentInstructions: { type: String, default: '', trim: true },
      footerNote: { type: String, default: 'Thank you for your business!', trim: true },
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
