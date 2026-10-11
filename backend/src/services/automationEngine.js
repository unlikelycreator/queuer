const Automation = require('../models/Automation');
const Ticket = require('../models/Ticket');
const Company = require('../models/Company');
const User = require('../models/User');
const Todo = require('../models/Todo');
const { notify } = require('./notify');
const { logActivity } = require('./activity');
const { renderTemplate } = require('./templateVars');
const { sendTicketReply } = require('./mailSender');
const { applySla, recordFirstResponse, recordResolution } = require('./sla');

const STATUSES = ['open', 'in_progress', 'in_review', 'resolved', 'closed', 'reopened'];
const ACTIVE = ['open', 'in_progress', 'in_review', 'reopened'];
const LABEL = { open: 'Open', in_progress: 'In Progress', in_review: 'In Review', resolved: 'Resolved', closed: 'Closed', reopened: 'Reopened' };

function fieldValue(ticket, field) {
  if (field.startsWith('cf.')) {
    const v = ticket.customFields?.[field.slice(3)];
    return v === undefined || v === null ? '' : String(v);
  }
  switch (field) {
    case 'project':
    case 'client':
      return String(ticket[field]?._id || ticket[field] || '');
    case 'assignedTo':
      return ticket.assignedTo ? String(ticket.assignedTo._id || ticket.assignedTo) : 'unassigned';
    case 'tags':
      return (ticket.tags || []).map((t) => t.toLowerCase());
    default:
      return String(ticket[field] ?? '');
  }
}

function conditionMatches(ticket, c) {
  const actual = fieldValue(ticket, c.field);
  const expected = String(c.value || '').toLowerCase();
  if (Array.isArray(actual)) {
    const has = c.operator === 'contains' || c.operator === 'not_contains'
      ? actual.some((a) => a.includes(expected))
      : actual.includes(expected);
    return c.operator === 'is_not' || c.operator === 'not_contains' ? !has : has;
  }
  const a = actual.toLowerCase();
  switch (c.operator) {
    case 'is_not':
      return a !== expected;
    case 'contains':
      return a.includes(expected);
    case 'not_contains':
      return !a.includes(expected);
    default:
      return a === expected;
  }
}

function matches(automation, ticket) {
  const conds = automation.conditions || [];
  if (!conds.length) return true;
  return automation.matchAll ? conds.every((c) => conditionMatches(ticket, c)) : conds.some((c) => conditionMatches(ticket, c));
}

// Private/loopback targets are refused so a rule can't be used to probe the server's network.
function webhookAllowed(url) {
  try {
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    if (process.env.ALLOW_PRIVATE_WEBHOOKS === 'true') return true;
    return !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[?::1\]?$)|^172\.(1[6-9]|2\d|3[01])\./i.test(u.hostname);
  } catch {
    return false;
  }
}

async function pickRoundRobin(companyId, value) {
  const ids = String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const filter = { company: companyId, isActive: true };
  if (ids.length) filter._id = { $in: ids };
  const users = await User.find(filter).select('_id name email');
  if (!users.length) return null;
  // Load-balanced: whoever has the fewest active tickets right now.
  const loads = await Promise.all(
    users.map((u) => Ticket.countDocuments({ company: companyId, assignedTo: u._id, status: { $in: ACTIVE } }))
  );
  let best = 0;
  loads.forEach((l, i) => l < loads[best] && (best = i));
  return users[best];
}

/** Runs one automation's actions against a ticket document (saved by the caller). */
async function executeActions(automation, ticket, company) {
  const by = `Automation: ${automation.name}`;
  const done = [];
  const after = []; // side effects that need the ticket saved first

  for (const action of automation.actions) {
    const message = renderTemplate(action.message, { ticket, company });
    switch (action.type) {
      case 'set_status':
        if (STATUSES.includes(action.value) && ticket.status !== action.value) {
          ticket.status = action.value;
          if (['resolved', 'closed'].includes(action.value)) {
            ticket.resolvedAt = new Date();
            recordResolution(ticket);
          } else ticket.resolvedAt = undefined;
          ticket.updates.push({ authorName: by, message: `Status changed to ${LABEL[action.value]}`, statusChangeTo: action.value });
          done.push(`status → ${LABEL[action.value]}`);
        }
        break;
      case 'set_priority':
        if (['low', 'medium', 'high', 'critical'].includes(action.value) && ticket.priority !== action.value) {
          ticket.priority = action.value;
          if (!['resolved', 'closed'].includes(ticket.status)) applySla(ticket, company);
          ticket.updates.push({ authorName: by, message: `Priority set to ${action.value}`, isInternal: true });
          done.push(`priority → ${action.value}`);
        }
        break;
      case 'assign_to':
      case 'assign_round_robin': {
        const user =
          action.type === 'assign_to'
            ? await User.findOne({ _id: action.value, company: company._id, isActive: true }).select('_id name')
            : await pickRoundRobin(company._id, action.value);
        if (user && String(ticket.assignedTo || '') !== String(user._id)) {
          ticket.assignedTo = user._id;
          ticket.updates.push({ authorName: by, message: `Assigned to ${user.name}`, isInternal: true });
          after.push(() =>
            notify(company._id, user._id, {
              kind: 'assigned',
              title: `#${ticket.ticketNumber} assigned to you`,
              body: ticket.title,
              link: `/tickets/${ticket._id}`,
            })
          );
          done.push(`assigned → ${user.name}`);
        }
        break;
      }
      case 'add_tag': {
        const tag = String(action.value || '').trim().toLowerCase();
        if (tag && !ticket.tags.includes(tag)) {
          ticket.tags.push(tag);
          done.push(`tag +${tag}`);
        }
        break;
      }
      case 'add_note':
        if (message) {
          ticket.updates.push({ authorName: by, message, isInternal: true });
          done.push('internal note');
        }
        break;
      case 'reply_to_client':
        if (message) {
          ticket.updates.push({ authorName: company.name, message, isInternal: false });
          recordFirstResponse(ticket);
          ticket.awaitingTeamReply = false;
          if (ticket.submitterEmail) {
            after.push(() => sendTicketReply(company, ticket, { message, authorName: company.name }));
          }
          done.push('replied to client');
        }
        break;
      case 'notify': {
        const target = action.value === 'assignee' ? ticket.assignedTo : action.value || 'admins';
        after.push(() =>
          notify(company._id, target || 'admins', {
            kind: 'automation',
            title: message || `${automation.name}: #${ticket.ticketNumber}`,
            body: ticket.title,
            link: `/tickets/${ticket._id}`,
          })
        );
        done.push('notified');
        break;
      }
      case 'send_webhook':
        if (webhookAllowed(action.value)) {
          after.push(() =>
            fetch(action.value, {
              method: 'POST',
              headers: { 'content-type': 'application/json', 'user-agent': 'ZoopDesk-Automation/1.0' },
              body: JSON.stringify({
                automation: automation.name,
                trigger: automation.trigger,
                ticket: {
                  id: ticket._id,
                  number: ticket.ticketNumber,
                  title: ticket.title,
                  type: ticket.type,
                  status: ticket.status,
                  priority: ticket.priority,
                  submitterEmail: ticket.submitterEmail,
                  url: `${(process.env.CLIENT_URL || '').split(',')[0]}/tickets/${ticket._id}`,
                },
                firedAt: new Date().toISOString(),
              }),
              signal: AbortSignal.timeout(5000),
            }).catch((err) => console.error('Automation webhook failed:', err.message))
          );
          done.push('webhook');
        }
        break;
      case 'create_todo': {
        const days = Number(action.value) || 0;
        const d = new Date();
        const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days));
        after.push(() =>
          Todo.create({
            company: company._id,
            project: ticket.project,
            title: (message || `Follow up on #${ticket.ticketNumber} ${ticket.title}`).slice(0, 300),
            date: day,
            priority: ['high', 'critical'].includes(ticket.priority) ? 'high' : 'medium',
            assignedTo: ticket.assignedTo || undefined,
            ticket: ticket._id,
          })
        );
        done.push('to-do created');
        break;
      }
      case 'set_due_in_days': {
        const days = Number(action.value);
        if (Number.isFinite(days)) {
          ticket.dueDate = new Date(Date.now() + days * 864e5);
          done.push(`due in ${days}d`);
        }
        break;
      }
      default:
        break;
    }
  }
  return { done, after };
}

async function recordRun(automation, ticket, ok, summary) {
  await Automation.updateOne(
    { _id: automation._id },
    {
      $inc: { runCount: 1 },
      $set: { lastRunAt: new Date() },
      $push: { recentRuns: { $each: [{ at: new Date(), ticket: ticket._id, ticketNumber: ticket.ticketNumber, ok, summary }], $slice: -20 } },
    }
  );
}

/** Applies one automation to one ticket, saves, runs side effects, logs. */
async function applyAutomation(automation, ticketId, company) {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket || !matches(automation, ticket)) return false;
  try {
    const { done, after } = await executeActions(automation, ticket, company);
    if (automation.trigger === 'ticket.idle') ticket.automationsFired.addToSet(automation._id);
    if (done.length) ticket.lastActivityAt = automation.trigger === 'ticket.idle' ? ticket.lastActivityAt : new Date();
    await ticket.save();
    await Promise.all(after.map((fn) => Promise.resolve().then(fn).catch((e) => console.error('Automation side effect:', e.message))));
    const summary = done.length ? done.join(', ') : 'matched, nothing to change';
    await recordRun(automation, ticket, true, summary);
    if (done.length) {
      logActivity({
        company: company._id,
        actorName: `Automation: ${automation.name}`,
        entityType: 'ticket',
        entityId: ticket._id,
        entityLabel: `#${ticket.ticketNumber}`,
        action: 'automation.run',
        summary: `ran on #${ticket.ticketNumber}: ${summary}`,
        link: `/tickets/${ticket._id}`,
      });
    }
    return true;
  } catch (err) {
    console.error(`Automation "${automation.name}" failed:`, err.message);
    await recordRun(automation, ticket, false, err.message);
    return false;
  }
}

/**
 * Fires every enabled automation for an event. Actions taken by automations do not
 * trigger further automations, which keeps rules from looping.
 */
async function runAutomations(event, ticketId, companyId) {
  try {
    const automations = await Automation.find({ company: companyId, enabled: true, trigger: event }).sort({ createdAt: 1 });
    if (!automations.length) return;
    const company = await Company.findById(companyId);
    for (const a of automations) await applyAutomation(a, ticketId, company);
  } catch (err) {
    console.error('Automation run failed:', err.message);
  }
}

module.exports = { runAutomations, applyAutomation, matches, conditionMatches, webhookAllowed };
