const Ticket = require('../models/Ticket');
const Company = require('../models/Company');
const Automation = require('../models/Automation');
const { notify } = require('./notify');
const { logActivity } = require('./activity');
const { runAutomations, applyAutomation } = require('./automationEngine');

const INTERVAL = Number(process.env.SCHEDULER_INTERVAL_MS) || 60000;
const ACTIVE = ['open', 'in_progress', 'in_review', 'reopened'];
let timer = null;
let running = false;

// Marks tickets that just missed their SLA, notifies people and fires sla.breached rules.
async function checkSla() {
  const now = new Date();
  const breached = await Ticket.find({
    status: { $in: ACTIVE },
    slaBreachNotified: { $ne: true },
    $or: [
      { slaResolutionDueAt: { $lt: now } },
      { firstResponseAt: null, slaResponseDueAt: { $lt: now } },
    ],
  }).limit(200);

  for (const t of breached) {
    const response = !t.firstResponseAt && t.slaResponseDueAt && t.slaResponseDueAt < now;
    const resolution = t.slaResolutionDueAt && t.slaResolutionDueAt < now;
    if (response) t.slaResponseBreached = true;
    if (resolution) t.slaResolutionBreached = true;
    t.slaBreachNotified = true;
    await t.save();
    const what = resolution ? 'resolution' : 'first response';
    await notify(t.company, t.assignedTo ? [t.assignedTo, 'admins'] : 'admins', {
      kind: 'sla_breach',
      title: `SLA breached on #${t.ticketNumber} (${what})`,
      body: t.title,
      link: `/tickets/${t._id}`,
    });
    logActivity({
      company: t.company,
      actorName: 'SLA monitor',
      entityType: 'ticket',
      entityId: t._id,
      entityLabel: `#${t.ticketNumber}`,
      action: 'sla.breached',
      summary: `#${t.ticketNumber} breached its ${what} SLA`,
      link: `/tickets/${t._id}`,
    });
    await runAutomations('sla.breached', t._id, t.company);
  }
}

// "No activity for N hours" rules, e.g. auto-close resolved tickets or nudge stale ones.
async function checkIdle() {
  const rules = await Automation.find({ enabled: true, trigger: 'ticket.idle' });
  for (const rule of rules) {
    const cutoff = new Date(Date.now() - (rule.idleHours || 72) * 36e5);
    const tickets = await Ticket.find({
      company: rule.company,
      lastActivityAt: { $lt: cutoff },
      automationsFired: { $ne: rule._id },
    })
      .select('_id')
      .limit(100);
    if (!tickets.length) continue;
    const company = await Company.findById(rule.company);
    for (const t of tickets) {
      const applied = await applyAutomation(rule, t._id, company);
      // Remember non-matching tickets too, so we don't re-evaluate them every minute.
      if (!applied) await Ticket.updateOne({ _id: t._id }, { $addToSet: { automationsFired: rule._id } });
    }
  }
}

async function tick() {
  if (running) return;
  running = true;
  try {
    await checkSla();
    await checkIdle();
  } catch (err) {
    console.error('Scheduler tick failed:', err.message);
  } finally {
    running = false;
  }
}

function startScheduler() {
  if (timer) return;
  timer = setInterval(tick, INTERVAL);
  setTimeout(tick, 8000);
  console.log(`Scheduler started (SLA + idle automations every ${INTERVAL / 1000}s)`);
}

function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { startScheduler, stopScheduler, tick, checkSla, checkIdle };
