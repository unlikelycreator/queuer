const mongoose = require('mongoose');

// A dated to-do item that belongs to a project — the team's day-by-day plan.
const todoSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    notes: { type: String, trim: true, maxlength: 4000 },
    // Stored as midnight UTC of the chosen calendar day (YYYY-MM-DD from the client).
    date: { type: Date, required: true, index: true },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

todoSchema.index({ project: 1, date: 1 });
todoSchema.index({ company: 1, assignedTo: 1, date: 1 });

module.exports = mongoose.model('Todo', todoSchema);
