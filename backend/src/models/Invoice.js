const mongoose = require('mongoose');
const crypto = require('crypto');

const itemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true, maxlength: 500 },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, default: '', trim: true }, // e.g. "hrs"
    unitPrice: { type: Number, required: true, min: 0 },
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' },
    timeEntries: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TimeEntry' }],
    fixedPriceTicket: { type: Boolean, default: false },
  },
  { _id: true }
);

const paymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now },
    method: { type: String, trim: true, default: 'Bank transfer' },
    note: { type: String, trim: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true }
);

const invoiceSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    number: { type: String, required: true },
    status: { type: String, enum: ['draft', 'sent', 'paid', 'void'], default: 'draft' },
    issueDate: { type: Date, default: Date.now },
    dueDate: { type: Date },
    currency: { type: String, default: 'USD' },
    items: [itemSchema],
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    taxRate: { type: Number, default: 0, min: 0 },
    taxLabel: { type: String, default: 'Tax' },
    subtotal: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    payments: [paymentSchema],
    notes: { type: String, trim: true, maxlength: 4000 },
    terms: { type: String, trim: true, maxlength: 4000 },
    // Optional per-invoice look; falls back to the company billing settings.
    template: { type: String, enum: ['modern', 'classic', 'minimal', ''], default: '' },
    accentColor: { type: String, default: '' },
    publicToken: { type: String, unique: true, sparse: true },
    sentAt: { type: Date },
    paidAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

invoiceSchema.index({ company: 1, number: 1 }, { unique: true });

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

invoiceSchema.methods.recalculate = function () {
  this.subtotal = round2(this.items.reduce((a, i) => a + round2(i.quantity * i.unitPrice), 0));
  this.discountAmount = round2((this.subtotal * (this.discountPercent || 0)) / 100);
  const taxable = this.subtotal - this.discountAmount;
  this.taxAmount = round2((taxable * (this.taxRate || 0)) / 100);
  this.total = round2(taxable + this.taxAmount);
  this.amountPaid = round2(this.payments.reduce((a, p) => a + p.amount, 0));
  if (this.status !== 'void' && this.status !== 'draft') {
    if (this.total > 0 && this.amountPaid >= this.total) {
      this.status = 'paid';
      this.paidAt = this.paidAt || new Date();
    } else if (this.status === 'paid') {
      this.status = 'sent';
      this.paidAt = undefined;
    }
  }
};

// "overdue" is derived rather than stored, so it is always accurate.
invoiceSchema.virtual('displayStatus').get(function () {
  if (this.status === 'sent' && this.dueDate && this.dueDate < new Date()) return 'overdue';
  if (this.status === 'sent' && this.amountPaid > 0) return 'partial';
  return this.status;
});

invoiceSchema.virtual('balanceDue').get(function () {
  return round2((this.total || 0) - (this.amountPaid || 0));
});

invoiceSchema.pre('save', function (next) {
  if (!this.publicToken) this.publicToken = crypto.randomBytes(16).toString('hex');
  this.recalculate();
  next();
});

module.exports = mongoose.model('Invoice', invoiceSchema);
