const Activity = require('../models/Activity');

/**
 * Records an entry in the workspace audit trail. Never throws — logging must not break
 * the request that triggered it.
 * @param {object} e { company, actor (user doc), actorName, entityType, entityId, entityLabel, action, summary, link }
 */
function logActivity(e) {
  const doc = {
    company: e.company,
    actor: e.actor?._id || e.actor || undefined,
    actorName: e.actorName || e.actor?.name || 'System',
    entityType: e.entityType,
    entityId: e.entityId,
    entityLabel: e.entityLabel,
    action: e.action,
    summary: e.summary,
    link: e.link,
  };
  return Activity.create(doc).catch((err) => console.error('Activity log failed:', err.message));
}

module.exports = { logActivity };
