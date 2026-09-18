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
