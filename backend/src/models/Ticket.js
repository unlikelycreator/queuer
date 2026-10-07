const mongoose = require('mongoose');
const crypto = require('crypto');

const updateSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    authorName: { type: String }, // fallback label when update was posted by system/email/guest
    message: { type: String, required: true },
    statusChangeTo: { type: String },
    isInternal: { type: Boolean, default: false }, // internal-only note, hidden from public tracking page
    sentAsEmail: { type: Boolean, default: false }, // this update was also sent as an email reply to the submitter
    fromClient: { type: Boolean, default: false }, // posted by the client from the portal / tracking page
    files: [
      {
        filename: String,
        originalName: String,
        url: String,
        size: Number,
      },
    ],
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const fileSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    originalName: { type: String },
    url: { type: String, required: true },
    size: { type: Number },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const ticketSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    ticketNumber: { type: Number },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    type: {
      type: String,
      enum: ['bug_report', 'feature_request', 'change_request', 'support_ticket'],
      required: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    // Numeric copy of priority (0-3) so "sort by priority" is a plain indexed sort.
    priorityRank: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'in_review', 'resolved', 'closed', 'reopened'],
      default: 'open',
    },
    tags: [{ type: String, trim: true }],
    dueDate: { type: Date },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Internal team member who filed it (optional — absent for guest/email submissions)
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Where the ticket came from
    source: {
      type: String,
      enum: ['internal', 'public_form', 'email'],
      default: 'internal',
    },
    submitterName: { type: String, trim: true },
    submitterEmail: { type: String, trim: true, lowercase: true },
    // The inbound email's Message-ID header, so our reply threads correctly in the
    // submitter's inbox (via In-Reply-To/References) instead of starting a new thread.
    originalMessageId: { type: String, trim: true },

    attachmentUrls: [{ type: String }],
    files: [fileSchema],
    updates: [updateSchema],
    resolvedAt: { type: Date },
    lastActivityAt: { type: Date, default: Date.now },
    // Set when the client posts from the portal and no one on the team has replied yet.
    awaitingTeamReply: { type: Boolean, default: false },

    // Lets an external submitter check status without logging in
    publicToken: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
);

ticketSchema.index({ company: 1, ticketNumber: 1 }, { unique: true });
ticketSchema.index({ company: 1, status: 1, createdAt: -1 });
ticketSchema.index({ project: 1, createdAt: -1 });

const PRIORITY_RANK = { low: 0, medium: 1, high: 2, critical: 3 };

ticketSchema.pre('save', function (next) {
  this.priorityRank = PRIORITY_RANK[this.priority] ?? 1;
  if (!this.publicToken) {
    this.publicToken = crypto.randomBytes(14).toString('hex');
  }
  next();
});

const Ticket = mongoose.model('Ticket', ticketSchema);

// Backfills priorityRank on tickets created before the field existed. Cheap and idempotent.
Ticket.backfillPriorityRank = async () => {
  for (const [priority, rank] of Object.entries(PRIORITY_RANK)) {
    await Ticket.updateMany({ priority, priorityRank: { $ne: rank } }, { $set: { priorityRank: rank } });
  }
};

module.exports = Ticket;
