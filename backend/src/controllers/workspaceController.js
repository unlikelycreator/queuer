const Company = require('../models/Company');
const Ticket = require('../models/Ticket');
const { TEMPLATES, listTemplates, slaPolicies } = require('../config/workspaceTemplates');
const { logActivity } = require('../services/activity');

const slug = (s) =>
  String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);

function payload(company, { includeTemplates = false } = {}) {
  const b = company.billing || {};
  return {
    workspace: company.workspace,
    sla: company.sla,
    csatEnabled: company.csatEnabled !== false,
    billing: {
      currency: b.currency,
      defaultHourlyRate: b.defaultHourlyRate,
      taxRate: b.taxRate,
      taxLabel: b.taxLabel,
      paymentTermsDays: b.paymentTermsDays,
      invoicePrefix: b.invoicePrefix,
      nextInvoiceNumber: b.nextInvoiceNumber,
      template: b.template,
      accentColor: b.accentColor,
      logoUrl: b.logoUrl,
      businessName: b.businessName,
      businessAddress: b.businessAddress,
      businessEmail: b.businessEmail,
      businessPhone: b.businessPhone,
      taxId: b.taxId,
      paymentInstructions: b.paymentInstructions,
      footerNote: b.footerNote,
    },
    ...(includeTemplates ? { templates: listTemplates() } : {}),
  };
}

// @route GET /api/company/workspace — everyone needs this to render labels & types
const getWorkspace = async (req, res, next) => {
  try {
    const company = await Company.findById(req.user.company);
    res.json(payload(company, { includeTemplates: true }));
  } catch (error) {
    next(error);
  }
};

function cleanTypes(types, res) {
  if (!Array.isArray(types) || !types.length) {
    res.status(400);
    throw new Error('Keep at least one ticket type');
  }
  const seen = new Set();
  return types.slice(0, 20).map((t) => {
    const label = String(t.label || '').trim().slice(0, 40);
    const value = slug(t.value || label);
    if (!label || !value || seen.has(value)) {
      res.status(400);
      throw new Error('Each ticket type needs a unique name');
    }
    seen.add(value);
    return {
      value,
      label,
      short: String(t.short || label).trim().slice(0, 16),
      icon: String(t.icon || 'circle').slice(0, 20),
      color: /^#[0-9a-f]{6}$/i.test(t.color) ? t.color : '#0d9488',
    };
  });
}

function cleanFields(fields, res) {
  if (!Array.isArray(fields)) return [];
  const seen = new Set();
  return fields.slice(0, 30).map((f) => {
    const label = String(f.label || '').trim().slice(0, 60);
    const key = slug(f.key || label);
    if (!label || !key || seen.has(key)) {
      res.status(400);
      throw new Error('Each custom field needs a unique name');
    }
    seen.add(key);
    const type = ['text', 'number', 'select', 'date', 'checkbox', 'url'].includes(f.type) ? f.type : 'text';
    const options = type === 'select' ? (Array.isArray(f.options) ? f.options : String(f.options || '').split(',')).map((o) => String(o).trim()).filter(Boolean).slice(0, 50) : [];
    if (type === 'select' && !options.length) {
      res.status(400);
      throw new Error(`“${label}” needs at least one option`);
    }
    return { key, label, type, options, required: !!f.required, showInPortal: !!f.showInPortal };
  });
}

// Refuses to drop a ticket type that tickets still use, so nothing becomes unlabeled.
async function assertTypesNotInUse(companyId, oldTypes, newTypes, res) {
  const removed = oldTypes.filter((t) => !newTypes.some((n) => n.value === t.value));
  for (const t of removed) {
    const n = await Ticket.countDocuments({ company: companyId, type: t.value });
    if (n) {
      res.status(400);
      throw new Error(`“${t.label}” is used by ${n} ticket${n === 1 ? '' : 's'} — change those first or keep the type`);
    }
  }
}

// @route PUT /api/company/workspace — terminology, types, custom fields, SLA, CSAT
const updateWorkspace = async (req, res, next) => {
  try {
    const company = await Company.findById(req.user.company);
    const { terminology, ticketTypes, customFields, sla, csatEnabled } = req.body;
    if (terminology) {
      ['ticket', 'tickets', 'client', 'clients', 'project', 'projects'].forEach((k) => {
        if (terminology[k] !== undefined && String(terminology[k]).trim()) company.workspace.terminology[k] = String(terminology[k]).trim().slice(0, 30);
      });
    }
    if (ticketTypes) {
      const types = cleanTypes(ticketTypes, res);
      await assertTypesNotInUse(company._id, company.workspace.ticketTypes, types, res);
      company.workspace.ticketTypes = types;
    }
    if (customFields) company.workspace.customFields = cleanFields(customFields, res);
    if (sla) {
      if (sla.enabled !== undefined) company.sla.enabled = !!sla.enabled;
      ['low', 'medium', 'high', 'critical'].forEach((p) => {
        if (!sla[p]) return;
        ['responseHours', 'resolutionHours'].forEach((k) => {
          if (sla[p][k] !== undefined) company.sla[p][k] = Math.max(0, Math.min(24 * 365, Number(sla[p][k]) || 0));
        });
      });
    }
    if (csatEnabled !== undefined) company.csatEnabled = !!csatEnabled;
    company.workspace.configured = true;
    await company.save();
    logActivity({ company: company._id, actor: req.user, entityType: 'workspace', action: 'workspace.updated', summary: 'updated workspace settings', link: '/settings?tab=workspace' });
    res.json(payload(company, { includeTemplates: true }));
  } catch (error) {
    next(error);
  }
};

// @route POST /api/company/workspace/template { key } — one-click setup for a kind of team
const applyTemplate = async (req, res, next) => {
  try {
    const tpl = TEMPLATES[req.body.key];
    if (!tpl) {
      res.status(400);
      throw new Error('Unknown template');
    }
    const company = await Company.findById(req.user.company);
    // Keep any existing types that tickets still use so nothing loses its label.
    const used = await Ticket.distinct('type', { company: company._id });
    const kept = company.workspace.ticketTypes.filter((t) => used.includes(t.value) && !tpl.ticketTypes.some((n) => n.value === t.value));
    company.workspace.template = tpl.key;
    company.workspace.terminology = { ...tpl.terminology };
    company.workspace.ticketTypes = [...tpl.ticketTypes.map((t) => ({ ...t })), ...kept];
    const existingFields = company.workspace.customFields.filter((f) => !tpl.customFields.some((n) => n.key === f.key));
    company.workspace.customFields = [...tpl.customFields.map((f) => ({ options: [], ...f })), ...(req.body.keepFields ? existingFields : [])];
    const policies = slaPolicies(tpl);
    ['low', 'medium', 'high', 'critical'].forEach((p) => (company.sla[p] = policies[p]));
    company.workspace.configured = true;
    await company.save();
    logActivity({ company: company._id, actor: req.user, entityType: 'workspace', action: 'workspace.template', summary: `set the workspace up for ${tpl.name}`, link: '/settings?tab=workspace' });
    res.json(payload(company, { includeTemplates: true }));
  } catch (error) {
    next(error);
  }
};

// @route PUT /api/company/billing
const updateBilling = async (req, res, next) => {
  try {
    const company = await Company.findById(req.user.company);
    const b = req.body || {};
    const str = ['taxLabel', 'invoicePrefix', 'logoUrl', 'businessName', 'businessAddress', 'businessEmail', 'businessPhone', 'taxId', 'paymentInstructions', 'footerNote'];
    str.forEach((k) => b[k] !== undefined && (company.billing[k] = String(b[k]).slice(0, 2000)));
    if (b.currency !== undefined) {
      const c = String(b.currency).toUpperCase().trim();
      try {
        new Intl.NumberFormat('en-US', { style: 'currency', currency: c });
      } catch {
        res.status(400);
        throw new Error('Unknown currency code');
      }
      company.billing.currency = c;
    }
    ['defaultHourlyRate', 'taxRate', 'paymentTermsDays'].forEach((k) => b[k] !== undefined && (company.billing[k] = Math.max(0, Number(b[k]) || 0)));
    if (b.nextInvoiceNumber !== undefined) company.billing.nextInvoiceNumber = Math.max(1, Math.floor(Number(b.nextInvoiceNumber) || 1));
    if (['modern', 'classic', 'minimal'].includes(b.template)) company.billing.template = b.template;
    if (/^#[0-9a-f]{6}$/i.test(b.accentColor || '')) company.billing.accentColor = b.accentColor;
    await company.save();
    logActivity({ company: company._id, actor: req.user, entityType: 'workspace', action: 'billing.updated', summary: 'updated billing & invoice settings', link: '/settings?tab=billing' });
    res.json(payload(company));
  } catch (error) {
    next(error);
  }
};

module.exports = { getWorkspace, updateWorkspace, applyTemplate, updateBilling };
