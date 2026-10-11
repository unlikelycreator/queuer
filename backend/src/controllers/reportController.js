const Ticket = require('../models/Ticket');
const TimeEntry = require('../models/TimeEntry');
const Invoice = require('../models/Invoice');
const Company = require('../models/Company');
const User = require('../models/User');
const Client = require('../models/Client');
const { isObjectId } = require('../utils/sanitize');

const ACTIVE = ['open', 'in_progress', 'in_review', 'reopened'];
const DAY = 864e5;
const r1 = (n) => (n === null || n === undefined || Number.isNaN(n) ? null : Math.round(n * 10) / 10);
const r2 = (n) => Math.round((n || 0) * 100) / 100;
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
const pct = (num, den) => (den ? Math.round((num / den) * 1000) / 10 : null);

function parseRange(q) {
  const to = q.to ? new Date(`${q.to}T23:59:59.999`) : new Date();
  const from = q.from ? new Date(`${q.from}T00:00:00`) : new Date(to.getTime() - 29 * DAY);
  const span = Math.min(Math.max(to - from, DAY), 366 * DAY);
  return { from: new Date(to.getTime() - span), to, span };
}

function scopeFilter(req) {
  const f = { company: req.user.company };
  if (isObjectId(req.query.project)) f.project = req.query.project;
  if (isObjectId(req.query.client)) f.client = req.query.client;
  return f;
}

// Core numbers for one window (used for the current and the previous period).
async function core(req, from, to, rate) {
  const scope = scopeFilter(req);
  const [created, resolved, csat, time] = await Promise.all([
    Ticket.find({ ...scope, createdAt: { $gte: from, $lte: to } })
      .select('createdAt firstResponseAt type priority client project assignedTo source updates.statusChangeTo updates.createdAt')
      .lean(),
    Ticket.find({ ...scope, resolvedAt: { $gte: from, $lte: to } })
      .select('createdAt resolvedAt slaResponseDueAt slaResolutionDueAt slaResponseBreached slaResolutionBreached assignedTo client')
      .lean(),
    Ticket.find({ ...scope, 'csat.submittedAt': { $gte: from, $lte: to } }).select('csat assignedTo').lean(),
    TimeEntry.find({ ...scope, endedAt: { $ne: null }, startedAt: { $gte: from, $lte: to } }).select('minutes billable hourlyRate user client startedAt').lean(),
  ]);

  const firstResponseHrs = created.filter((t) => t.firstResponseAt).map((t) => (new Date(t.firstResponseAt) - new Date(t.createdAt)) / 36e5);
  const resolutionHrs = resolved.map((t) => (new Date(t.resolvedAt) - new Date(t.createdAt)) / 36e5);
  const withSla = resolved.filter((t) => t.slaResolutionDueAt || t.slaResponseDueAt);
  const slaMet = withSla.filter((t) => !t.slaResolutionBreached && !t.slaResponseBreached).length;
  const reopened = created.filter((t) => (t.updates || []).some((u) => u.statusChangeTo === 'reopened')).length;
  const ratings = csat.map((t) => t.csat.rating);
  const minutes = time.reduce((a, e) => a + e.minutes, 0);
  const billableMinutes = time.filter((e) => e.billable).reduce((a, e) => a + e.minutes, 0);
  const billableValue = time.filter((e) => e.billable).reduce((a, e) => a + (e.minutes / 60) * (e.hourlyRate || rate), 0);

  return {
    raw: { created, resolved, csat, time },
    kpis: {
      created: created.length,
      resolved: resolved.length,
      avgFirstResponseHours: r1(avg(firstResponseHrs)),
      medianResolutionHours: r1(resolutionHrs.length ? resolutionHrs.sort((a, b) => a - b)[Math.floor(resolutionHrs.length / 2)] : null),
      avgResolutionHours: r1(avg(resolutionHrs)),
      slaCompliance: pct(slaMet, withSla.length),
      slaMeasured: withSla.length,
      reopenRate: pct(reopened, created.length),
      csatAverage: r1(avg(ratings)),
      csatResponses: ratings.length,
      csatSatisfied: pct(ratings.filter((r) => r >= 4).length, ratings.length),
      hoursLogged: r1(minutes / 60),
      billableHours: r1(billableMinutes / 60),
      utilization: pct(billableMinutes, minutes),
      billableValue: r2(billableValue),
    },
  };
}

function delta(cur, prev) {
  if (cur === null || prev === null || prev === undefined) return null;
  if (prev === 0) return cur === 0 ? 0 : null;
  return Math.round(((cur - prev) / Math.abs(prev)) * 1000) / 10;
}

// @route GET /api/reports/overview?from&to&project&client&tz
const overview = async (req, res, next) => {
  try {
    const { from, to, span } = parseRange(req.query);
    const tz = Math.max(-840, Math.min(840, Number(req.query.tz) || 0)); // minutes east of UTC
    const company = await Company.findById(req.user.company).select('billing workspace');
    const rate = company.billing?.defaultHourlyRate || 0;
    const scope = scopeFilter(req);

    const [cur, prev, backlog, users, clients, invoices] = await Promise.all([
      core(req, from, to, rate),
      core(req, new Date(from.getTime() - span), new Date(from.getTime() - 1), rate),
      Ticket.find({ ...scope, status: { $in: ACTIVE } }).select('createdAt priority assignedTo client status slaResolutionDueAt dueDate').lean(),
      User.find({ company: req.user.company }).select('name avatarColor avatarUrl isActive').lean(),
      Client.find({ company: req.user.company }).select('name').lean(),
      Invoice.find({ company: req.user.company, status: { $ne: 'void' }, ...(isObjectId(req.query.client) ? { client: req.query.client } : {}) })
        .select('issueDate total amountPaid status dueDate payments client')
        .lean(),
    ]);

    const now = new Date();
    // Money
    const inRange = (d) => d && new Date(d) >= from && new Date(d) <= to;
    const issued = invoices.filter((i) => i.status !== 'draft' && inRange(i.issueDate));
    const payments = invoices.flatMap((i) => (i.payments || []).map((p) => ({ ...p, client: i.client })));
    const collected = payments.filter((p) => inRange(p.date)).reduce((a, p) => a + p.amount, 0);
    const prevCollected = payments
      .filter((p) => new Date(p.date) >= new Date(from.getTime() - span) && new Date(p.date) < from)
      .reduce((a, p) => a + p.amount, 0);
    const open = invoices.filter((i) => i.status === 'sent');
    const outstanding = open.reduce((a, i) => a + (i.total - i.amountPaid), 0);
    const overdue = open.filter((i) => i.dueDate && new Date(i.dueDate) < now).reduce((a, i) => a + (i.total - i.amountPaid), 0);

    const k = cur.kpis;
    const p = prev.kpis;
    const kpis = {
      ...k,
      backlog: backlog.length,
      overdueTickets: backlog.filter((t) => t.dueDate && new Date(t.dueDate) < now).length,
      atRiskSla: backlog.filter((t) => t.slaResolutionDueAt && new Date(t.slaResolutionDueAt) - now < 4 * 36e5).length,
      invoiced: r2(issued.reduce((a, i) => a + i.total, 0)),
      collected: r2(collected),
      outstanding: r2(outstanding),
      overdueAmount: r2(overdue),
      currency: company.billing?.currency || 'USD',
    };
    const deltas = {
      created: delta(k.created, p.created),
      resolved: delta(k.resolved, p.resolved),
      avgFirstResponseHours: delta(k.avgFirstResponseHours, p.avgFirstResponseHours),
      avgResolutionHours: delta(k.avgResolutionHours, p.avgResolutionHours),
      slaCompliance: delta(k.slaCompliance, p.slaCompliance),
      csatAverage: delta(k.csatAverage, p.csatAverage),
      hoursLogged: delta(k.hoursLogged, p.hoursLogged),
      billableValue: delta(k.billableValue, p.billableValue),
      collected: delta(collected, prevCollected),
    };

    // Daily (or weekly for long ranges) trend
    const days = Math.ceil(span / DAY);
    const bucketDays = days > 120 ? 7 : 1;
    const buckets = [];
    for (let t = from.getTime(); t <= to.getTime(); t += bucketDays * DAY) buckets.push({ start: t, created: 0, resolved: 0, hours: 0 });
    const idx = (d) => Math.min(buckets.length - 1, Math.max(0, Math.floor((new Date(d).getTime() - from.getTime()) / (bucketDays * DAY))));
    cur.raw.created.forEach((t) => buckets[idx(t.createdAt)].created++);
    cur.raw.resolved.forEach((t) => buckets[idx(t.resolvedAt)].resolved++);
    cur.raw.time.forEach((e) => (buckets[idx(e.startedAt)].hours += e.minutes / 60));
    const trend = buckets.map((b) => ({ date: new Date(b.start).toISOString().slice(0, 10), created: b.created, resolved: b.resolved, hours: r1(b.hours) }));

    // Breakdowns
    const count = (arr, key) => arr.reduce((m, x) => ((m[x[key]] = (m[x[key]] || 0) + 1), m), {});
    const types = company.workspace?.ticketTypes || [];
    const byTypeMap = count(cur.raw.created, 'type');
    const byType = Object.entries(byTypeMap)
      .map(([value, n]) => {
        const t = types.find((x) => x.value === value);
        return { value, label: t?.label || value.replace(/_/g, ' '), color: t?.color || '#64748b', count: n };
      })
      .sort((a, b) => b.count - a.count);
    const byPriority = ['critical', 'high', 'medium', 'low'].map((pr) => ({ priority: pr, open: backlog.filter((t) => t.priority === pr).length, created: cur.raw.created.filter((t) => t.priority === pr).length }));
    const bySource = Object.entries(count(cur.raw.created, 'source')).map(([source, n]) => ({ source, count: n }));

    // Aging of open tickets
    const AGE = [
      ['< 1 day', 0, 1],
      ['1–3 days', 1, 3],
      ['3–7 days', 3, 7],
      ['1–2 weeks', 7, 14],
      ['2–4 weeks', 14, 30],
      ['30+ days', 30, Infinity],
    ];
    const aging = AGE.map(([label, lo, hi]) => ({
      label,
      count: backlog.filter((t) => {
        const age = (now - new Date(t.createdAt)) / DAY;
        return age >= lo && age < hi;
      }).length,
    }));

    // When do requests arrive? weekday × hour (viewer's timezone)
    const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0));
    cur.raw.created.forEach((t) => {
      const d = new Date(new Date(t.createdAt).getTime() + tz * 60000);
      heatmap[(d.getUTCDay() + 6) % 7][d.getUTCHours()]++;
    });

    // Team leaderboard
    const byMember = users
      .map((u) => {
        const id = String(u._id);
        const res = cur.raw.resolved.filter((t) => String(t.assignedTo) === id);
        const mins = cur.raw.time.filter((e) => String(e.user) === id);
        const ratings = cur.raw.csat.filter((t) => String(t.assignedTo) === id).map((t) => t.csat.rating);
        const minutes = mins.reduce((a, e) => a + e.minutes, 0);
        return {
          _id: u._id,
          name: u.name,
          avatarColor: u.avatarColor,
          avatarUrl: u.avatarUrl,
          open: backlog.filter((t) => String(t.assignedTo) === id).length,
          resolved: res.length,
          avgResolutionHours: r1(avg(res.map((t) => (new Date(t.resolvedAt) - new Date(t.createdAt)) / 36e5))),
          hours: r1(minutes / 60),
          billableHours: r1(mins.filter((e) => e.billable).reduce((a, e) => a + e.minutes, 0) / 60),
          csat: r1(avg(ratings)),
        };
      })
      .filter((m) => m.open || m.resolved || m.hours)
      .sort((a, b) => b.resolved - a.resolved || b.hours - a.hours);

    // Clients
    const byClient = clients
      .map((c) => {
        const id = String(c._id);
        const mins = cur.raw.time.filter((e) => String(e.client) === id).reduce((a, e) => a + e.minutes, 0);
        return {
          _id: c._id,
          name: c.name,
          created: cur.raw.created.filter((t) => String(t.client) === id).length,
          open: backlog.filter((t) => String(t.client) === id).length,
          hours: r1(mins / 60),
          invoiced: r2(issued.filter((i) => String(i.client) === id).reduce((a, i) => a + i.total, 0)),
          collected: r2(payments.filter((p) => String(p.client) === id && inRange(p.date)).reduce((a, p) => a + p.amount, 0)),
        };
      })
      .filter((c) => c.created || c.open || c.hours || c.invoiced)
      .sort((a, b) => b.created - a.created || b.invoiced - a.invoiced)
      .slice(0, 10);

    // Revenue — last 6 calendar months
    const revenue = [];
    for (let m = 5; m >= 0; m--) {
      const start = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - m + 1, 1);
      revenue.push({
        month: start.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        invoiced: r2(invoices.filter((i) => i.status !== 'draft' && new Date(i.issueDate) >= start && new Date(i.issueDate) < end).reduce((a, i) => a + i.total, 0)),
        collected: r2(payments.filter((p) => new Date(p.date) >= start && new Date(p.date) < end).reduce((a, p) => a + p.amount, 0)),
      });
    }

    res.json({
      range: { from, to, bucketDays },
      kpis,
      deltas,
      trend,
      byType,
      byPriority,
      bySource,
      aging,
      heatmap,
      byMember,
      byClient,
      revenue,
    });
  } catch (error) {
    next(error);
  }
};

function csv(rows) {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = v instanceof Date ? v.toISOString() : String(v);
    // Neutralise spreadsheet formula injection.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return rows.map((r) => r.map(esc).join(',')).join('\n');
}

// @route GET /api/reports/export?type=tickets|time|invoices&from&to
const exportCsv = async (req, res, next) => {
  try {
    const { from, to } = parseRange(req.query);
    const scope = scopeFilter(req);
    let rows;
    const type = req.query.type || 'tickets';
    if (type === 'time') {
      const entries = await TimeEntry.find({ ...scope, endedAt: { $ne: null }, startedAt: { $gte: from, $lte: to } })
        .populate('user', 'name')
        .populate('project', 'name')
        .populate('client', 'name')
        .populate('ticket', 'ticketNumber title')
        .sort({ startedAt: 1 });
      rows = [
        ['Date', 'Person', 'Client', 'Project', 'Ticket', 'Description', 'Minutes', 'Hours', 'Billable', 'Invoiced'],
        ...entries.map((e) => [e.startedAt.toISOString().slice(0, 10), e.user?.name, e.client?.name, e.project?.name, e.ticket ? `#${e.ticket.ticketNumber} ${e.ticket.title}` : '', e.description, e.minutes, (e.minutes / 60).toFixed(2), e.billable ? 'yes' : 'no', e.invoice ? 'yes' : 'no']),
      ];
    } else if (type === 'invoices') {
      const invoices = await Invoice.find({ company: req.user.company, issueDate: { $gte: from, $lte: to } }).populate('client', 'name').sort({ issueDate: 1 });
      rows = [
        ['Number', 'Client', 'Status', 'Issued', 'Due', 'Currency', 'Subtotal', 'Tax', 'Total', 'Paid', 'Balance'],
        ...invoices.map((i) => [i.number, i.client?.name, i.displayStatus, i.issueDate?.toISOString().slice(0, 10), i.dueDate?.toISOString().slice(0, 10), i.currency, i.subtotal, i.taxAmount, i.total, i.amountPaid, i.balanceDue]),
      ];
    } else {
      const company = await Company.findById(req.user.company).select('workspace');
      const fields = company.workspace?.customFields || [];
      const tickets = await Ticket.find({ ...scope, createdAt: { $gte: from, $lte: to } })
        .populate('client', 'name')
        .populate('project', 'name')
        .populate('assignedTo', 'name')
        .sort({ createdAt: 1 });
      rows = [
        ['Number', 'Title', 'Type', 'Status', 'Priority', 'Client', 'Project', 'Assignee', 'Source', 'Created', 'First response', 'Resolved', 'SLA breached', 'Hours logged', 'CSAT', 'Tags', ...fields.map((f) => f.label)],
        ...tickets.map((t) => [
          t.ticketNumber,
          t.title,
          t.type,
          t.status,
          t.priority,
          t.client?.name,
          t.project?.name,
          t.assignedTo?.name,
          t.source,
          t.createdAt,
          t.firstResponseAt,
          t.resolvedAt,
          t.slaResponseBreached || t.slaResolutionBreached ? 'yes' : 'no',
          ((t.timeSpentMinutes || 0) / 60).toFixed(2),
          t.csat?.rating,
          (t.tags || []).join(' '),
          ...fields.map((f) => t.customFields?.[f.key]),
        ]),
      ];
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="queuer-${type}-${from.toISOString().slice(0, 10)}-to-${to.toISOString().slice(0, 10)}.csv"`);
    res.send(`﻿${csv(rows)}`);
  } catch (error) {
    next(error);
  }
};

module.exports = { overview, exportCsv };
