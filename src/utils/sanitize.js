// Escape user input before dropping it into a MongoDB $regex, so a search like "(a+)+$"
// can't blow up into a catastrophic-backtracking query (ReDoS) or match unintended text.
function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 200);
}

// Escape user-provided text before interpolating it into an HTML email body.
function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function nl2br(value = '') {
  return escapeHtml(value).replace(/\n/g, '<br/>');
}

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;
const isObjectId = (v) => typeof v === 'string' && OBJECT_ID_RE.test(v);

module.exports = { escapeRegex, escapeHtml, nl2br, isObjectId };
