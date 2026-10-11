const mongoose = require('mongoose');

// Audit trail of everything that happens in a workspace.
const activitySchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorName: { type: String }, // "Automation: …", "Client: Jane", "System"
    entityType: {
      type: String,
      enum: ['ticket', 'project', 'client', 'invoice', 'time', 'automation', 'user', 'workspace', 'todo'],
      required: true,
    },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    entityLabel: { type: String },
    action: { type: String, required: true },
    summary: { type: String, required: true },
    link: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

activitySchema.index({ company: 1, createdAt: -1 });
activitySchema.index({ company: 1, entityType: 1, entityId: 1, createdAt: -1 });

module.exports = mongoose.model('Activity', activitySchema);
