const mongoose = require('mongoose');
const crypto = require('crypto');

const projectSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    techStack: [{ type: String, trim: true }],
    repoUrl: { type: String, trim: true },
    liveUrl: { type: String, trim: true },
    status: {
      type: String,
      enum: ['planning', 'in_progress', 'on_hold', 'completed', 'cancelled'],
      default: 'planning',
    },
    startDate: { type: Date },
    deadline: { type: Date },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Public embeddable intake form
    publicToken: { type: String, unique: true, sparse: true },
    publicFormEnabled: { type: Boolean, default: true },

    // Client portal (the same public link) — what the client can see and do there.
    portal: {
      showAllTickets: { type: Boolean, default: true }, // false = only tickets looked up by email/tracking link
      allowComments: { type: Boolean, default: true },
      showProjectDetails: { type: Boolean, default: true },
      // Off by default: the team's to-do plan is internal until someone chooses to share it.
      showTodos: { type: Boolean, default: false },
      welcomeMessage: { type: String, trim: true, maxlength: 1000, default: '' },
    },
  },
  { timestamps: true }
);

projectSchema.pre('save', function (next) {
  if (!this.publicToken) {
    this.publicToken = crypto.randomBytes(12).toString('hex');
  }
  next();
});

module.exports = mongoose.model('Project', projectSchema);
