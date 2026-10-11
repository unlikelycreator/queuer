const mongoose = require('mongoose');

// One block of tracked time. A running timer is an entry with no endedAt.
const timeEntrySchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', index: true },
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', index: true },
    description: { type: String, trim: true, maxlength: 500 },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date },
    minutes: { type: Number, default: 0, min: 0 },
    billable: { type: Boolean, default: true },
    hourlyRate: { type: Number, min: 0 }, // snapshot; falls back to the company default
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  },
  { timestamps: true }
);

timeEntrySchema.index({ company: 1, startedAt: -1 });
timeEntrySchema.index({ company: 1, user: 1, endedAt: 1 });

module.exports = mongoose.model('TimeEntry', timeEntrySchema);
