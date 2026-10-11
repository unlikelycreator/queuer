const mongoose = require('mongoose');

// "When <trigger>, if <conditions>, then <actions>" — a no-code rule.
const automationSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    enabled: { type: Boolean, default: true },
    trigger: {
      type: String,
      enum: ['ticket.created', 'ticket.status_changed', 'ticket.assigned', 'ticket.client_replied', 'ticket.idle', 'sla.breached'],
      required: true,
    },
    // For ticket.idle: hours without activity before the rule fires.
    idleHours: { type: Number, min: 1, default: 72 },
    matchAll: { type: Boolean, default: true },
    conditions: [
      {
        field: { type: String, required: true },
        operator: { type: String, enum: ['is', 'is_not', 'contains', 'not_contains'], default: 'is' },
        value: { type: String, default: '' },
        _id: false,
      },
    ],
    actions: [
      {
        type: {
          type: String,
          enum: [
            'set_status',
            'set_priority',
            'assign_to',
            'assign_round_robin',
            'add_tag',
            'add_note',
            'reply_to_client',
            'notify',
            'send_webhook',
            'create_todo',
            'set_due_in_days',
          ],
          required: true,
        },
        value: { type: String, default: '' },
        message: { type: String, default: '' },
        _id: false,
      },
    ],
    runCount: { type: Number, default: 0 },
    lastRunAt: { type: Date },
    recentRuns: [
      {
        at: Date,
        ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' },
        ticketNumber: Number,
        ok: Boolean,
        summary: String,
        _id: false,
      },
    ],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Automation', automationSchema);
