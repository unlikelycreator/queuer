const Automation = require('../models/Automation');
const Ticket = require('../models/Ticket');
const Company = require('../models/Company');
const User = require('../models/User');
const { matches, applyAutomation, webhookAllowed } = require('../services/automationEngine');
const { logActivity } = require('../services/activity');

const TRIGGERS = ['ticket.created', 'ticket.status_changed', 'ticket.assigned', 'ticket.client_replied', 'ticket.idle', 'sla.breached'];
const ACTIONS = ['set_status', 'set_priority', 'assign_to', 'assign_round_robin', 'add_tag', 'add_note', 'reply_to_client', 'notify', 'send_webhook', 'create_todo', 'set_due_in_days'];

// Ready-made rules users can add in one click (and then tweak).
const RECIPES = [
  {
    key: 'auto_assign_critical',
    name: 'Escalate critical tickets',
    description: 'Critical tickets go to the least-busy team member, get a tag and notify admins.',
    trigger: 'ticket.created',
    conditions: [{ field: 'priority', operator: 'is', value: 'critical' }],
    actions: [
      { type: 'assign_round_robin', value: '' },
      { type: 'add_tag', value: 'escalated' },
      { type: 'notify', value: 'admins', message: '🔥 Critical: {{ticket_number}} {{ticket_title}}' },
    ],
  },
  {
    key: 'round_robin',
    name: 'Round-robin assignment',
    description: 'Every new unassigned ticket is assigned to whoever has the fewest open tickets.',
    trigger: 'ticket.created',
    conditions: [{ field: 'assignedTo', operator: 'is', value: 'unassigned' }],
    actions: [{ type: 'assign_round_robin', value: '' }],
  },
  {
    key: 'portal_ack',
    name: 'Acknowledge portal requests',
    description: 'Instantly reply to clients who submit through the portal, so first response is never late.',
    trigger: 'ticket.created',
    conditions: [{ field: 'source', operator: 'is', value: 'public_form' }],
    actions: [
      {
        type: 'reply_to_client',
        message: "Hi {{submitter_name}}, thanks for your request {{ticket_number}}! We've received it and will update you here: {{tracking_link}}",
      },
    ],
  },
  {
    key: 'auto_close',
    name: 'Auto-close resolved tickets',
    description: 'Resolved tickets with no reply for 7 days are closed automatically.',
    trigger: 'ticket.idle',
    idleHours: 168,
    conditions: [{ field: 'status', operator: 'is', value: 'resolved' }],
    actions: [
      { type: 'set_status', value: 'closed' },
      { type: 'add_note', message: 'Closed automatically after 7 days without a reply.' },
    ],
  },
  {
    key: 'stale_nudge',
    name: 'Nudge stale tickets',
    description: 'In-progress tickets untouched for 3 days notify their assignee and get a follow-up to-do.',
    trigger: 'ticket.idle',
    idleHours: 72,
    conditions: [{ field: 'status', operator: 'is', value: 'in_progress' }],
    actions: [
      { type: 'notify', value: 'assignee', message: '⏰ {{ticket_number}} has had no activity for 3 days' },
      { type: 'create_todo', value: '0', message: 'Follow up on {{ticket_number}} {{ticket_title}}' },
    ],
  },
  {
    key: 'sla_escalate',
    name: 'Escalate SLA breaches',
    description: 'When an SLA is missed, bump priority to high and alert admins.',
    trigger: 'sla.breached',
    conditions: [],
    actions: [
      { type: 'set_priority', value: 'high' },
      { type: 'add_tag', value: 'sla-breached' },
      { type: 'notify', value: 'admins', message: 'SLA breached on {{ticket_number}}' },
    ],
  },
  {
    key: 'client_reply_reopen',
    name: 'Client replies move work forward',
    description: 'When a client replies on a ticket waiting in review, move it back to in progress.',
    trigger: 'ticket.client_replied',
    conditions: [{ field: 'status', operator: 'is', value: 'in_review' }],
    actions: [{ type: 'set_status', value: 'in_progress' }, { type: 'notify', value: 'assignee', message: 'Client replied on {{ticket_number}}' }],
  },
  {
    key: 'resolved_webhook',
    name: 'Post resolved tickets to Slack/Teams',
    description: 'Send a webhook (e.g. a Slack/Zapier/Make incoming URL) whenever a ticket is resolved.',
    trigger: 'ticket.status_changed',
    conditions: [{ field: 'status', operator: 'is', value: 'resolved' }],
    actions: [{ type: 'send_webhook', value: 'https://hooks.example.com/your-webhook' }],
  },
];

async function validate(req, res, body, companyId) {
  const out = {};
  if (body.name !== undefined) {
    if (!String(body.name).trim()) {
      res.status(400);
      throw new Error('Give the automation a name');
    }
    out.name = String(body.name).trim().slice(0, 120);
  }
  if (body.trigger !== undefined) {
    if (!TRIGGERS.includes(body.trigger)) {
      res.status(400);
      throw new Error('Unknown trigger');
    }
    out.trigger = body.trigger;
  }
  if (body.idleHours !== undefined) out.idleHours = Math.max(1, Math.min(24 * 90, Number(body.idleHours) || 72));
  if (body.enabled !== undefined) out.enabled = !!body.enabled;
  if (body.matchAll !== undefined) out.matchAll = !!body.matchAll;
  if (body.conditions !== undefined) {
    out.conditions = (Array.isArray(body.conditions) ? body.conditions : [])
      .filter((c) => c && c.field)
      .slice(0, 20)
      .map((c) => ({
        field: String(c.field).slice(0, 60),
        operator: ['is', 'is_not', 'contains', 'not_contains'].includes(c.operator) ? c.operator : 'is',
        value: String(c.value ?? '').slice(0, 200),
      }));
  }
  if (body.actions !== undefined) {
    const actions = (Array.isArray(body.actions) ? body.actions : []).filter((a) => a && ACTIONS.includes(a.type)).slice(0, 15);
    if (!actions.length) {
      res.status(400);
      throw new Error('Add at least one action');
    }
    for (const a of actions) {
      if (a.type === 'send_webhook' && !webhookAllowed(a.value)) {
        res.status(400);
        throw new Error('Webhook URL must be a public http(s) address');
      }
      if (a.type === 'assign_to' && !(await User.exists({ _id: a.value, company: companyId }))) {
        res.status(400);
        throw new Error('Choose a team member to assign to');
      }
    }
    out.actions = actions.map((a) => ({ type: a.type, value: String(a.value ?? '').slice(0, 500), message: String(a.message ?? '').slice(0, 4000) }));
  }
  return out;
}

const listAutomations = async (req, res, next) => {
  try {
    const automations = await Automation.find({ company: req.user.company }).sort({ createdAt: 1 });
    res.json({ automations, recipes: RECIPES });
  } catch (error) {
    next(error);
  }
};

const createAutomation = async (req, res, next) => {
  try {
    let body = req.body;
    if (req.body.recipe) {
      const recipe = RECIPES.find((r) => r.key === req.body.recipe);
      if (!recipe) {
        res.status(400);
        throw new Error('Unknown recipe');
      }
      body = { ...recipe, enabled: !recipe.actions.some((a) => a.type === 'send_webhook') };
    }
    const data = await validate(req, res, { name: body.name, trigger: body.trigger, actions: body.actions, conditions: body.conditions || [], idleHours: body.idleHours, matchAll: body.matchAll ?? true, enabled: body.enabled ?? true }, req.user.company);
    const automation = await Automation.create({ ...data, company: req.user.company, createdBy: req.user._id });
    logActivity({ company: req.user.company, actor: req.user, entityType: 'automation', entityId: automation._id, entityLabel: automation.name, action: 'automation.created', summary: `created automation “${automation.name}”`, link: '/automations' });
    res.status(201).json(automation);
  } catch (error) {
    next(error);
  }
};

const updateAutomation = async (req, res, next) => {
  try {
    const automation = await Automation.findOne({ _id: req.params.id, company: req.user.company });
    if (!automation) {
      res.status(404);
      throw new Error('Automation not found');
    }
    Object.assign(automation, await validate(req, res, req.body, req.user.company));
    await automation.save();
    if (req.body.enabled !== undefined) {
      logActivity({ company: req.user.company, actor: req.user, entityType: 'automation', entityId: automation._id, entityLabel: automation.name, action: 'automation.toggled', summary: `${automation.enabled ? 'enabled' : 'paused'} automation “${automation.name}”`, link: '/automations' });
    }
    res.json(automation);
  } catch (error) {
    next(error);
  }
};

const deleteAutomation = async (req, res, next) => {
  try {
    const automation = await Automation.findOneAndDelete({ _id: req.params.id, company: req.user.company });
    if (!automation) {
      res.status(404);
      throw new Error('Automation not found');
    }
    res.json({ message: 'Automation deleted' });
  } catch (error) {
    next(error);
  }
};

// @route POST /api/automations/:id/test { ticketNumber, apply? } — would this rule match? optionally run it now.
const testAutomation = async (req, res, next) => {
  try {
    const automation = await Automation.findOne({ _id: req.params.id, company: req.user.company });
    if (!automation) {
      res.status(404);
      throw new Error('Automation not found');
    }
    const ticket = await Ticket.findOne({ company: req.user.company, ticketNumber: Number(String(req.body.ticketNumber).replace('#', '')) });
    if (!ticket) {
      res.status(404);
      throw new Error('No ticket with that number');
    }
    const matched = matches(automation, ticket);
    let applied = false;
    if (matched && req.body.apply) {
      applied = await applyAutomation(automation, ticket._id, await Company.findById(req.user.company));
    }
    res.json({ matched, applied, ticket: { _id: ticket._id, ticketNumber: ticket.ticketNumber, title: ticket.title } });
  } catch (error) {
    next(error);
  }
};

module.exports = { listAutomations, createAutomation, updateAutomation, deleteAutomation, testAutomation, RECIPES };
