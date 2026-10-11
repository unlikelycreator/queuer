const Invoice = require('../models/Invoice');
const Company = require('../models/Company');
const Client = require('../models/Client');
const Project = require('../models/Project');
const TimeEntry = require('../models/TimeEntry');
const Ticket = require('../models/Ticket');
const { isObjectId } = require('../utils/sanitize');
const { renderInvoicePdf, money } = require('../services/invoicePdf');
const { sendMail, appUrl } = require('../services/mailSender');
const { renderEmail } = require('../services/emailTemplate');
const { escapeHtml } = require('../utils/sanitize');
const { logActivity } = require('../services/activity');
const { notify } = require('../services/notify');

const POPULATE = [
  { path: 'client', select: 'name email contactPerson address' },
  { path: 'project', select: 'name' },
  { path: 'createdBy', select: 'name' },
];

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

async function nextNumber(companyId) {
  const company = await Company.findOneAndUpdate(
    { _id: companyId },
    { $inc: { 'billing.nextInvoiceNumber': 1 } },
    { new: false }
  );
  const n = company.billing?.nextInvoiceNumber || 1001;
  return `${company.billing?.invoicePrefix ?? 'INV-'}${n}`;
}

function cleanItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((i) => i && String(i.description || '').trim())
    .slice(0, 300)
    .map((i) => ({
      _id: isObjectId(String(i._id || '')) ? i._id : undefined,
      description: String(i.description).trim().slice(0, 500),
      quantity: Math.max(0, Number(i.quantity) || 0),
      unit: String(i.unit || '').slice(0, 20),
      unitPrice: Math.max(0, Number(i.unitPrice) || 0),
      ticket: isObjectId(String(i.ticket || '')) ? i.ticket : undefined,
      timeEntries: Array.isArray(i.timeEntries) ? i.timeEntries.filter((t) => isObjectId(String(t))) : [],
      fixedPriceTicket: !!i.fixedPriceTicket,
    }));
}

// Marks time entries / fixed-price tickets referenced by an invoice as billed (or frees them).
async function syncBilledWork(invoice, attach) {
  const entryIds = invoice.items.flatMap((i) => i.timeEntries || []);
  const ticketIds = invoice.items.filter((i) => i.fixedPriceTicket && i.ticket).map((i) => i.ticket);
  if (attach) {
    if (entryIds.length) await TimeEntry.updateMany({ _id: { $in: entryIds }, company: invoice.company }, { $set: { invoice: invoice._id } });
    if (ticketIds.length) await Ticket.updateMany({ _id: { $in: ticketIds }, company: invoice.company }, { $set: { fixedPriceInvoiced: true } });
  } else {
    await TimeEntry.updateMany({ invoice: invoice._id }, { $unset: { invoice: 1 } });
    if (ticketIds.length) await Ticket.updateMany({ _id: { $in: ticketIds }, company: invoice.company }, { $set: { fixedPriceInvoiced: false } });
  }
}

function log(req, invoice, action, summary) {
  logActivity({
    company: req.user.company,
    actor: req.user,
    entityType: 'invoice',
    entityId: invoice._id,
    entityLabel: invoice.number,
    action,
    summary,
    link: `/invoices/${invoice._id}`,
  });
}

// @route GET /api/invoices?status&client
const listInvoices = async (req, res, next) => {
  try {
    const filter = { company: req.user.company };
    if (isObjectId(req.query.client)) filter.client = req.query.client;
    if (['draft', 'sent', 'paid', 'void'].includes(req.query.status)) filter.status = req.query.status;
    if (req.query.status === 'overdue') Object.assign(filter, { status: 'sent', dueDate: { $lt: new Date() } });
    const invoices = await Invoice.find(filter).select('-items.timeEntries').sort({ issueDate: -1, createdAt: -1 }).limit(500).populate(POPULATE);

    const all = await Invoice.find({ company: req.user.company, status: { $ne: 'void' } }).select('status total amountPaid dueDate paidAt currency').lean();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const stats = all.reduce(
      (s, i) => {
        const balance = round2(i.total - i.amountPaid);
        if (i.status === 'sent') {
          s.outstanding += balance;
          if (i.dueDate && new Date(i.dueDate) < now) {
            s.overdue += balance;
            s.overdueCount += 1;
          }
        }
        if (i.status === 'draft') s.draftCount += 1;
        if (i.paidAt && new Date(i.paidAt) >= monthStart) s.paidThisMonth += i.amountPaid;
        s.collected += i.amountPaid;
        return s;
      },
      { outstanding: 0, overdue: 0, overdueCount: 0, paidThisMonth: 0, collected: 0, draftCount: 0 }
    );
    Object.keys(stats).forEach((k) => (stats[k] = round2(stats[k])));
    res.json({ invoices, stats });
  } catch (error) {
    next(error);
  }
};

// @route GET /api/invoices/unbilled?client&project&from&to — what could be invoiced right now
const getUnbilled = async (req, res, next) => {
  try {
    if (!isObjectId(req.query.client)) {
      res.status(400);
      throw new Error('Choose a client');
    }
    const company = await Company.findById(req.user.company).select('billing');
    const rate = company.billing?.defaultHourlyRate || 0;
    const timeFilter = { company: req.user.company, client: req.query.client, billable: true, invoice: null, endedAt: { $ne: null } };
    const ticketFilter = { company: req.user.company, client: req.query.client, fixedPrice: { $gt: 0 }, fixedPriceInvoiced: { $ne: true } };
    if (isObjectId(req.query.project)) {
      timeFilter.project = req.query.project;
      ticketFilter.project = req.query.project;
    }
    if (req.query.from || req.query.to) {
      timeFilter.startedAt = {};
      if (req.query.from) timeFilter.startedAt.$gte = new Date(req.query.from);
      if (req.query.to) timeFilter.startedAt.$lte = new Date(`${req.query.to}T23:59:59`);
    }
    const [entries, tickets] = await Promise.all([
      TimeEntry.find(timeFilter).populate('ticket', 'ticketNumber title fixedPrice').populate('project', 'name').populate('user', 'name').sort({ startedAt: 1 }),
      Ticket.find(ticketFilter).select('ticketNumber title fixedPrice status project').populate('project', 'name'),
    ]);

    // Time on fixed-price tickets is covered by the quote, so it isn't billed separately.
    const fixedIds = new Set(tickets.map((t) => String(t._id)));
    const billableEntries = entries.filter((e) => !(e.ticket?.fixedPrice > 0) && !fixedIds.has(String(e.ticket?._id)));

    // Group time by ticket (or project when logged without a ticket) into suggested lines.
    const groups = new Map();
    billableEntries.forEach((e) => {
      const key = e.ticket ? `t:${e.ticket._id}` : `p:${e.project?._id}`;
      const g = groups.get(key) || {
        description: e.ticket ? `#${e.ticket.ticketNumber} ${e.ticket.title}` : `${e.project?.name || 'Project'} — general work`,
        ticket: e.ticket?._id,
        minutes: 0,
        rate: e.hourlyRate || rate,
        timeEntries: [],
      };
      g.minutes += e.minutes;
      g.timeEntries.push(e._id);
      groups.set(key, g);
    });

    const lines = [
      ...[...groups.values()].map((g) => ({
        description: g.description,
        quantity: round2(g.minutes / 60),
        unit: 'hrs',
        unitPrice: g.rate,
        ticket: g.ticket,
        timeEntries: g.timeEntries,
        kind: 'time',
      })),
      ...tickets.map((t) => ({
        description: `#${t.ticketNumber} ${t.title} (fixed price)`,
        quantity: 1,
        unit: '',
        unitPrice: t.fixedPrice,
        ticket: t._id,
        fixedPriceTicket: true,
        kind: 'fixed',
        status: t.status,
      })),
    ];
    res.json({
      lines,
      totalMinutes: billableEntries.reduce((a, e) => a + e.minutes, 0),
      entryCount: billableEntries.length,
      total: round2(lines.reduce((a, l) => a + l.quantity * l.unitPrice, 0)),
    });
  } catch (error) {
    next(error);
  }
};

// @route GET /api/invoices/:id
const getInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, company: req.user.company }).populate(POPULATE).populate('payments.recordedBy', 'name');
    if (!invoice) {
      res.status(404);
      throw new Error('Invoice not found');
    }
    res.json(invoice);
  } catch (error) {
    next(error);
  }
};

// @route POST /api/invoices { client, project?, items[], issueDate?, dueDate?, notes?, terms?, discountPercent?, taxRate? }
const createInvoice = async (req, res, next) => {
  try {
    const { client, project } = req.body;
    if (!isObjectId(client) || !(await Client.exists({ _id: client, company: req.user.company }))) {
      res.status(400);
      throw new Error('Choose a valid client');
    }
    if (project && !(await Project.exists({ _id: project, company: req.user.company, client }))) {
      res.status(400);
      throw new Error('Project must belong to the chosen client');
    }
    const company = await Company.findById(req.user.company);
    const b = company.billing || {};
    const items = cleanItems(req.body.items);

    // Time entries can only be billed once.
    const entryIds = items.flatMap((i) => i.timeEntries);
    if (entryIds.length) {
      const taken = await TimeEntry.countDocuments({ _id: { $in: entryIds }, company: req.user.company, invoice: { $ne: null } });
      if (taken) {
        res.status(409);
        throw new Error('Some of this time has already been invoiced — refresh and try again');
      }
    }

    const issueDate = req.body.issueDate ? new Date(req.body.issueDate) : new Date();
    const invoice = new Invoice({
      company: req.user.company,
      client,
      project: project || undefined,
      number: await nextNumber(req.user.company),
      issueDate,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : new Date(issueDate.getTime() + (b.paymentTermsDays ?? 14) * 864e5),
      currency: b.currency || 'USD',
      items,
      discountPercent: Number(req.body.discountPercent) || 0,
      taxRate: req.body.taxRate !== undefined ? Number(req.body.taxRate) || 0 : b.taxRate || 0,
      taxLabel: b.taxLabel || 'Tax',
      notes: req.body.notes,
      terms: req.body.terms ?? (b.paymentTermsDays ? `Payment due within ${b.paymentTermsDays} days.` : ''),
      createdBy: req.user._id,
    });
    await invoice.save();
    await syncBilledWork(invoice, true);
    log(req, invoice, 'invoice.created', `created invoice ${invoice.number} (${money(invoice.total, invoice.currency)})`);
    res.status(201).json(await invoice.populate(POPULATE));
  } catch (error) {
    next(error);
  }
};

// @route PUT /api/invoices/:id — edit while draft/sent; items locked once paid/void
const updateInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, company: req.user.company });
    if (!invoice) {
      res.status(404);
      throw new Error('Invoice not found');
    }
    if (['paid', 'void'].includes(invoice.status) && (req.body.items || req.body.discountPercent !== undefined || req.body.taxRate !== undefined)) {
      res.status(400);
      throw new Error(`A ${invoice.status} invoice can't be changed`);
    }
    if (req.body.items) {
      await syncBilledWork(invoice, false);
      invoice.items = cleanItems(req.body.items);
    }
    ['notes', 'terms'].forEach((f) => req.body[f] !== undefined && (invoice[f] = req.body[f]));
    ['discountPercent', 'taxRate'].forEach((f) => req.body[f] !== undefined && (invoice[f] = Number(req.body[f]) || 0));
    if (req.body.issueDate) invoice.issueDate = new Date(req.body.issueDate);
    if (req.body.dueDate) invoice.dueDate = new Date(req.body.dueDate);
    if (req.body.template !== undefined && ['modern', 'classic', 'minimal', ''].includes(req.body.template)) invoice.template = req.body.template;
    if (req.body.accentColor !== undefined && /^(#[0-9a-f]{6})?$/i.test(req.body.accentColor)) invoice.accentColor = req.body.accentColor;
    if (req.body.status && ['draft', 'sent', 'void'].includes(req.body.status) && req.body.status !== invoice.status) {
      if (req.body.status === 'sent' && !invoice.sentAt) invoice.sentAt = new Date();
      invoice.status = req.body.status;
      if (req.body.status === 'void') await syncBilledWork(invoice, false);
      log(req, invoice, `invoice.${req.body.status}`, `marked invoice ${invoice.number} as ${req.body.status}`);
    }
    await invoice.save();
    if (req.body.items && invoice.status !== 'void') await syncBilledWork(invoice, true);
    res.json(await invoice.populate(POPULATE));
  } catch (error) {
    next(error);
  }
};

// @route DELETE /api/invoices/:id — drafts only; frees the billed time
const deleteInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, company: req.user.company });
    if (!invoice) {
      res.status(404);
      throw new Error('Invoice not found');
    }
    if (invoice.status !== 'draft') {
      res.status(400);
      throw new Error('Only drafts can be deleted — void the invoice instead');
    }
    await syncBilledWork(invoice, false);
    await invoice.deleteOne();
    log(req, invoice, 'invoice.deleted', `deleted draft invoice ${invoice.number}`);
    res.json({ message: 'Invoice deleted' });
  } catch (error) {
    next(error);
  }
};

// @route POST /api/invoices/:id/payments { amount, date?, method?, note? }
const addPayment = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, company: req.user.company });
    if (!invoice) {
      res.status(404);
      throw new Error('Invoice not found');
    }
    if (invoice.status === 'void') {
      res.status(400);
      throw new Error('Cannot record a payment on a void invoice');
    }
    const amount = round2(req.body.amount);
    if (!(amount > 0)) {
      res.status(400);
      throw new Error('Enter a payment amount');
    }
    if (invoice.status === 'draft') {
      invoice.status = 'sent';
      invoice.sentAt = invoice.sentAt || new Date();
    }
    invoice.payments.push({
      amount,
      date: req.body.date ? new Date(req.body.date) : new Date(),
      method: req.body.method || 'Bank transfer',
      note: req.body.note,
      recordedBy: req.user._id,
    });
    await invoice.save();
    log(req, invoice, 'invoice.payment', `recorded ${money(amount, invoice.currency)} on ${invoice.number}${invoice.status === 'paid' ? ' — paid in full' : ''}`);
    if (invoice.status === 'paid') {
      notify(req.user.company, 'admins', { kind: 'invoice_paid', title: `${invoice.number} paid in full`, body: money(invoice.total, invoice.currency), link: `/invoices/${invoice._id}` }, { exclude: req.user._id });
    }
    res.json(await invoice.populate(POPULATE));
  } catch (error) {
    next(error);
  }
};

// @route DELETE /api/invoices/:id/payments/:paymentId
const deletePayment = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, company: req.user.company });
    if (!invoice) {
      res.status(404);
      throw new Error('Invoice not found');
    }
    invoice.payments.pull({ _id: req.params.paymentId });
    await invoice.save();
    res.json(await invoice.populate(POPULATE));
  } catch (error) {
    next(error);
  }
};

function streamPdf(res, invoice, company, disposition) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${disposition}; filename="${invoice.number.replace(/[^\w.-]/g, '_')}.pdf"`);
  res.setHeader('Cache-Control', 'no-store');
  renderInvoicePdf(invoice, company, res);
}

// @route GET /api/invoices/:id/pdf?inline=1
const downloadPdf = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, company: req.user.company }).populate(POPULATE);
    if (!invoice) {
      res.status(404);
      throw new Error('Invoice not found');
    }
    const company = await Company.findById(req.user.company);
    streamPdf(res, invoice, company, req.query.inline ? 'inline' : 'attachment');
  } catch (error) {
    next(error);
  }
};

// @route POST /api/invoices/:id/send — emails the client a link + the PDF (via the company mailbox)
const sendInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, company: req.user.company }).populate(POPULATE);
    if (!invoice) {
      res.status(404);
      throw new Error('Invoice not found');
    }
    if (invoice.status === 'void') {
      res.status(400);
      throw new Error('Void invoices cannot be sent');
    }
    const to = req.body.to || invoice.client?.email;
    if (!to) {
      res.status(400);
      throw new Error('This client has no email address — add one or enter a recipient');
    }
    const company = await Company.findById(req.user.company);
    const link = appUrl(`/public/invoice/${invoice.publicToken}`);
    const pdf = await new Promise((resolve, reject) => {
      const chunks = [];
      const { PassThrough } = require('stream');
      const sink = new PassThrough();
      sink.on('data', (c) => chunks.push(c));
      sink.on('end', () => resolve(Buffer.concat(chunks)));
      sink.on('error', reject);
      renderInvoicePdf(invoice, company, sink);
    });
    const brand = company.billing?.businessName || company.name;
    const result = await sendMail(company, {
      to,
      subject: `Invoice ${invoice.number} from ${brand} — ${money(invoice.total, invoice.currency)}`,
      text: `Hi ${invoice.client?.contactPerson || invoice.client?.name || ''},\n\nPlease find invoice ${invoice.number} for ${money(invoice.total, invoice.currency)}, due ${invoice.dueDate?.toDateString()}.\n\nView online: ${link}\n\n${req.body.message || ''}\n\n— ${brand}`,
      html: renderEmail({
        brand,
        heading: `Invoice ${invoice.number}`,
        body: `<p>Hi ${escapeHtml(invoice.client?.contactPerson || invoice.client?.name || '')},</p><p>Your invoice for <strong>${escapeHtml(money(invoice.total, invoice.currency))}</strong> is ready${invoice.dueDate ? `, due <strong>${escapeHtml(invoice.dueDate.toDateString())}</strong>` : ''}. The PDF is attached.</p>${req.body.message ? `<p>${escapeHtml(req.body.message)}</p>` : ''}`,
        cta: { label: 'View invoice', url: link },
      }),
      attachments: [{ filename: `${invoice.number}.pdf`, content: pdf, contentType: 'application/pdf' }],
    });
    if (!result.sent) {
      res.status(400);
      throw new Error(result.reason === 'SMTP not configured' ? 'Set up outgoing email in Settings → Email first, or copy the invoice link instead' : result.reason);
    }
    if (invoice.status === 'draft') invoice.status = 'sent';
    invoice.sentAt = new Date();
    await invoice.save();
    log(req, invoice, 'invoice.sent', `emailed invoice ${invoice.number} to ${to}`);
    res.json(await invoice.populate(POPULATE));
  } catch (error) {
    next(error);
  }
};

// ───── Public (client-facing) ─────

async function loadPublic(req, res) {
  const invoice = await Invoice.findOne({ publicToken: req.params.token, status: { $ne: 'draft' } }).populate(POPULATE);
  if (!invoice) {
    res.status(404);
    throw new Error('Invoice not found');
  }
  const company = await Company.findById(invoice.company);
  return { invoice, company };
}

// @route GET /api/public/invoices/:token
const getPublicInvoice = async (req, res, next) => {
  try {
    const { invoice, company } = await loadPublic(req, res);
    const b = company.billing || {};
    res.json({
      number: invoice.number,
      status: invoice.displayStatus,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      currency: invoice.currency,
      client: { name: invoice.client?.name, contactPerson: invoice.client?.contactPerson, email: invoice.client?.email, address: invoice.client?.address },
      projectName: invoice.project?.name,
      items: invoice.items.map((i) => ({ description: i.description, quantity: i.quantity, unit: i.unit, unitPrice: i.unitPrice })),
      subtotal: invoice.subtotal,
      discountPercent: invoice.discountPercent,
      discountAmount: invoice.discountAmount,
      taxRate: invoice.taxRate,
      taxLabel: invoice.taxLabel,
      taxAmount: invoice.taxAmount,
      total: invoice.total,
      amountPaid: invoice.amountPaid,
      balanceDue: invoice.balanceDue,
      notes: invoice.notes,
      terms: invoice.terms,
      business: {
        name: b.businessName || company.name,
        address: b.businessAddress,
        email: b.businessEmail,
        phone: b.businessPhone,
        taxId: b.taxId,
        logoUrl: b.logoUrl,
        paymentInstructions: b.paymentInstructions,
        footerNote: b.footerNote,
      },
      template: invoice.template || b.template || 'modern',
      accentColor: invoice.accentColor || b.accentColor || '#047857',
    });
  } catch (error) {
    next(error);
  }
};

// @route GET /api/public/invoices/:token/pdf
const getPublicInvoicePdf = async (req, res, next) => {
  try {
    const { invoice, company } = await loadPublic(req, res);
    streamPdf(res, invoice, company, req.query.inline ? 'inline' : 'attachment');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listInvoices,
  getUnbilled,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  addPayment,
  deletePayment,
  downloadPdf,
  sendInvoice,
  getPublicInvoice,
  getPublicInvoicePdf,
};
