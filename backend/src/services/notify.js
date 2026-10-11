const Notification = require('../models/Notification');
const User = require('../models/User');

/**
 * In-app notifications. `to` can be user ids, 'admins' (owners + admins) or a mix.
 * The acting user is never notified about their own action.
 */
async function notify(companyId, to, { kind = 'system', title, body, link }, { exclude } = {}) {
  try {
    const targets = new Set();
    for (const t of [].concat(to || [])) {
      if (!t) continue;
      if (t === 'admins') {
        const admins = await User.find({ company: companyId, role: { $in: ['owner', 'admin'] }, isActive: true }).select('_id');
        admins.forEach((u) => targets.add(String(u._id)));
      } else {
        targets.add(String(t._id || t));
      }
    }
    if (exclude) targets.delete(String(exclude._id || exclude));
    if (!targets.size) return;
    await Notification.insertMany(
      [...targets].map((user) => ({ company: companyId, user, kind, title, body: body?.slice(0, 500), link }))
    );
  } catch (err) {
    console.error('Notification failed:', err.message);
  }
}

module.exports = { notify };
