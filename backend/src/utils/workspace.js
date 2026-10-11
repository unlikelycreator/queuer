// Helpers for workspace-defined ticket types and custom fields.

function ticketTypes(company) {
  return company?.workspace?.ticketTypes?.length ? company.workspace.ticketTypes : [];
}

/** Returns a valid type value: the requested one if the workspace has it, else the fallback. */
function resolveType(company, type, { strict = false } = {}) {
  const types = ticketTypes(company);
  if (!types.length) return type;
  if (types.some((t) => t.value === type)) return type;
  if (strict) return null;
  return types[0].value;
}

/**
 * Keeps only fields the workspace defines (optionally only the portal-visible ones),
 * coerced to the field's type. Returns { values, missing } where missing lists required
 * labels that were left empty.
 */
function cleanCustomFields(company, input = {}, { portalOnly = false, checkRequired = false } = {}) {
  const defs = (company?.workspace?.customFields || []).filter((f) => !portalOnly || f.showInPortal);
  const values = {};
  const missing = [];
  for (const f of defs) {
    let v = input?.[f.key];
    if (v === undefined || v === null || v === '') {
      if (checkRequired && f.required && f.type !== 'checkbox') missing.push(f.label);
      continue;
    }
    switch (f.type) {
      case 'number':
        v = Number(v);
        if (!Number.isFinite(v)) continue;
        break;
      case 'checkbox':
        v = v === true || v === 'true';
        break;
      case 'select':
        v = String(v);
        if (f.options?.length && !f.options.includes(v)) continue;
        break;
      case 'date':
        v = String(v).slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) continue;
        break;
      case 'url':
        v = String(v).trim().slice(0, 500);
        if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
        break;
      default:
        v = String(v).slice(0, 1000);
    }
    values[f.key] = v;
  }
  return { values, missing };
}

module.exports = { ticketTypes, resolveType, cleanCustomFields };
