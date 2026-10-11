const HOUR = 36e5;

// Sets response/resolution due dates from the company's SLA policy for the ticket's priority.
function applySla(ticket, company) {
  if (!company?.sla?.enabled) {
    ticket.slaResponseDueAt = undefined;
    ticket.slaResolutionDueAt = undefined;
    return;
  }
  const policy = company.sla[ticket.priority] || company.sla.medium;
  const base = (ticket.createdAt || new Date()).getTime();
  if (policy?.responseHours && !ticket.firstResponseAt) ticket.slaResponseDueAt = new Date(base + policy.responseHours * HOUR);
  if (policy?.resolutionHours) ticket.slaResolutionDueAt = new Date(base + policy.resolutionHours * HOUR);
}

// Called when the team replies publicly for the first time.
function recordFirstResponse(ticket) {
  if (ticket.firstResponseAt) return;
  ticket.firstResponseAt = new Date();
  if (ticket.slaResponseDueAt && ticket.firstResponseAt > ticket.slaResponseDueAt) ticket.slaResponseBreached = true;
}

// Called when a ticket is resolved/closed.
function recordResolution(ticket) {
  if (ticket.slaResolutionDueAt && ticket.resolvedAt && ticket.resolvedAt > ticket.slaResolutionDueAt) {
    ticket.slaResolutionBreached = true;
  }
}

module.exports = { applySla, recordFirstResponse, recordResolution };
