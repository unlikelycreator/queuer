const { appUrl, trackingUrl } = require('./mailSender');

// Replaces {{variables}} in saved replies and automation messages.
function renderTemplate(text = '', { ticket, company, agent } = {}) {
  const vars = {
    client_name: ticket?.client?.name || '',
    submitter_name: ticket?.submitterName || ticket?.client?.name || 'there',
    ticket_number: ticket ? `#${ticket.ticketNumber}` : '',
    ticket_title: ticket?.title || '',
    ticket_status: ticket?.status?.replace(/_/g, ' ') || '',
    project_name: ticket?.project?.name || '',
    agent_name: agent?.name || company?.name || '',
    company_name: company?.name || '',
    tracking_link: ticket ? trackingUrl(ticket) || '' : '',
    ticket_link: ticket ? appUrl(`/tickets/${ticket._id}`) : '',
  };
  return String(text).replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (m, key) => (key.toLowerCase() in vars ? vars[key.toLowerCase()] : m));
}

module.exports = { renderTemplate };
