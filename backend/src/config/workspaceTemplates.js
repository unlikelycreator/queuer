// Workspace templates: one click sets the vocabulary, ticket types, custom fields and SLA
// defaults for the kind of team using ZoopDesk. Everything stays editable afterwards.

const SOFTWARE_TYPES = [
  { value: 'bug_report', label: 'Bug Report', short: 'Bug', icon: 'bug', color: '#e11d48' },
  { value: 'feature_request', label: 'Feature Request', short: 'Feature', icon: 'sparkles', color: '#7c3aed' },
  { value: 'change_request', label: 'Change Request', short: 'Change', icon: 'refresh', color: '#0284c7' },
  { value: 'support_ticket', label: 'Support Ticket', short: 'Support', icon: 'lifebuoy', color: '#d97706' },
];

const TEMPLATES = {
  software: {
    key: 'software',
    name: 'Software development',
    description: 'Bugs, features and change requests from clients, with releases and environments.',
    icon: 'code',
    terminology: { ticket: 'Ticket', tickets: 'Tickets', client: 'Client', clients: 'Clients', project: 'Project', projects: 'Projects' },
    ticketTypes: SOFTWARE_TYPES,
    customFields: [
      { key: 'environment', label: 'Environment', type: 'select', options: ['Production', 'Staging', 'Development'], showInPortal: true },
      { key: 'browser_device', label: 'Browser / device', type: 'text', showInPortal: true },
      { key: 'release', label: 'Target release', type: 'text' },
      { key: 'pr_url', label: 'Pull request', type: 'url' },
    ],
    sla: { low: [48, 240], medium: [24, 120], high: [8, 48], critical: [2, 12] },
  },
  qa: {
    key: 'qa',
    name: 'QA & testing',
    description: 'Defects, test cases and regression runs with builds, severity and reproduction steps.',
    icon: 'flask',
    terminology: { ticket: 'Issue', tickets: 'Issues', client: 'Client', clients: 'Clients', project: 'Product', projects: 'Products' },
    ticketTypes: [
      { value: 'defect', label: 'Defect', short: 'Defect', icon: 'bug', color: '#e11d48' },
      { value: 'test_case', label: 'Test Case', short: 'Test', icon: 'flask', color: '#0d9488' },
      { value: 'regression', label: 'Regression', short: 'Regression', icon: 'refresh', color: '#ea580c' },
      { value: 'improvement', label: 'Improvement', short: 'Improve', icon: 'sparkles', color: '#7c3aed' },
      { value: 'question', label: 'Question', short: 'Question', icon: 'help', color: '#0284c7' },
    ],
    customFields: [
      { key: 'build', label: 'Build / version', type: 'text', required: true, showInPortal: true },
      { key: 'severity', label: 'Severity', type: 'select', options: ['Blocker', 'Major', 'Minor', 'Trivial'] },
      { key: 'environment', label: 'Environment', type: 'select', options: ['QA', 'Staging', 'Production'], showInPortal: true },
      { key: 'reproducible', label: 'Reproducible every time', type: 'checkbox' },
      { key: 'test_run', label: 'Test run / suite', type: 'text' },
    ],
    sla: { low: [24, 168], medium: [12, 72], high: [4, 24], critical: [1, 8] },
  },
  support: {
    key: 'support',
    name: 'Customer support',
    description: 'Questions, incidents and refunds from customers with fast SLAs and satisfaction ratings.',
    icon: 'headset',
    terminology: { ticket: 'Ticket', tickets: 'Tickets', client: 'Customer', clients: 'Customers', project: 'Product', projects: 'Products' },
    ticketTypes: [
      { value: 'question', label: 'Question', short: 'Question', icon: 'help', color: '#0284c7' },
      { value: 'incident', label: 'Incident', short: 'Incident', icon: 'alert', color: '#e11d48' },
      { value: 'account', label: 'Account / Billing', short: 'Account', icon: 'card', color: '#7c3aed' },
      { value: 'refund', label: 'Refund', short: 'Refund', icon: 'receipt', color: '#d97706' },
      { value: 'feedback', label: 'Feedback', short: 'Feedback', icon: 'message', color: '#0d9488' },
    ],
    customFields: [
      { key: 'order_id', label: 'Order / account ID', type: 'text', showInPortal: true },
      { key: 'plan', label: 'Customer plan', type: 'select', options: ['Free', 'Pro', 'Business', 'Enterprise'] },
      { key: 'channel', label: 'Channel', type: 'select', options: ['Portal', 'Email', 'Phone', 'Chat'] },
    ],
    sla: { low: [24, 120], medium: [8, 48], high: [2, 24], critical: [1, 8] },
  },
  marketing: {
    key: 'marketing',
    name: 'Marketing & content',
    description: 'Campaigns, content, design and social requests with channels, budgets and publish dates.',
    icon: 'megaphone',
    terminology: { ticket: 'Request', tickets: 'Requests', client: 'Client', clients: 'Clients', project: 'Campaign', projects: 'Campaigns' },
    ticketTypes: [
      { value: 'content', label: 'Content', short: 'Content', icon: 'pen', color: '#0284c7' },
      { value: 'design', label: 'Design', short: 'Design', icon: 'palette', color: '#db2777' },
      { value: 'social', label: 'Social post', short: 'Social', icon: 'megaphone', color: '#7c3aed' },
      { value: 'ads', label: 'Paid ads', short: 'Ads', icon: 'target', color: '#ea580c' },
      { value: 'seo', label: 'SEO / Web', short: 'SEO', icon: 'globe', color: '#0d9488' },
    ],
    customFields: [
      { key: 'channel', label: 'Channel', type: 'select', options: ['Instagram', 'LinkedIn', 'X / Twitter', 'Facebook', 'Blog', 'Email', 'Google Ads'], showInPortal: true },
      { key: 'publish_date', label: 'Publish date', type: 'date', showInPortal: true },
      { key: 'budget', label: 'Budget', type: 'number' },
      { key: 'asset_link', label: 'Asset / brief link', type: 'url', showInPortal: true },
      { key: 'approved', label: 'Client approved', type: 'checkbox' },
    ],
    sla: { low: [48, 336], medium: [24, 168], high: [8, 72], critical: [4, 24] },
  },
  agency: {
    key: 'agency',
    name: 'Agency / general',
    description: 'A flexible setup for any team: tasks, requests, changes and support.',
    icon: 'briefcase',
    terminology: { ticket: 'Task', tickets: 'Tasks', client: 'Client', clients: 'Clients', project: 'Project', projects: 'Projects' },
    ticketTypes: [
      { value: 'task', label: 'Task', short: 'Task', icon: 'check', color: '#0d9488' },
      { value: 'request', label: 'Request', short: 'Request', icon: 'inbox', color: '#0284c7' },
      { value: 'change_request', label: 'Change', short: 'Change', icon: 'refresh', color: '#7c3aed' },
      { value: 'issue', label: 'Issue', short: 'Issue', icon: 'alert', color: '#e11d48' },
    ],
    customFields: [{ key: 'reference', label: 'Reference', type: 'text', showInPortal: true }],
    sla: { low: [48, 240], medium: [24, 120], high: [8, 48], critical: [4, 24] },
  },
};

function slaPolicies(tpl) {
  const out = {};
  for (const [p, [response, resolution]] of Object.entries(tpl.sla)) {
    out[p] = { responseHours: response, resolutionHours: resolution };
  }
  return out;
}

function listTemplates() {
  return Object.values(TEMPLATES).map((t) => ({
    key: t.key,
    name: t.name,
    description: t.description,
    icon: t.icon,
    terminology: t.terminology,
    ticketTypes: t.ticketTypes,
    customFields: t.customFields,
    sla: slaPolicies(t),
  }));
}

module.exports = { TEMPLATES, SOFTWARE_TYPES, listTemplates, slaPolicies };
