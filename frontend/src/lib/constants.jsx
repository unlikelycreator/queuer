import {
  Bug,
  Sparkles,
  RefreshCw,
  LifeBuoy,
  FlaskConical,
  HelpCircle,
  AlertTriangle,
  CreditCard,
  Receipt,
  MessageSquare,
  PenLine,
  Palette,
  Megaphone,
  Target,
  Globe,
  CheckSquare,
  Inbox,
  Circle,
  Code2,
  Headset,
  Briefcase,
  Rocket,
  Wrench,
  Lightbulb,
  Star,
  CircleDot,
  Loader,
  Eye,
  CheckCircle2,
  Archive,
  RotateCcw,
  SignalLow,
  SignalMedium,
  SignalHigh,
  Flame,
} from 'lucide-react';

// Icon names stored in workspace settings → components.
export const TYPE_ICONS = {
  bug: Bug,
  sparkles: Sparkles,
  refresh: RefreshCw,
  lifebuoy: LifeBuoy,
  flask: FlaskConical,
  help: HelpCircle,
  alert: AlertTriangle,
  card: CreditCard,
  receipt: Receipt,
  message: MessageSquare,
  pen: PenLine,
  palette: Palette,
  megaphone: Megaphone,
  target: Target,
  globe: Globe,
  check: CheckSquare,
  inbox: Inbox,
  rocket: Rocket,
  wrench: Wrench,
  lightbulb: Lightbulb,
  star: Star,
  circle: Circle,
  code: Code2,
  headset: Headset,
  briefcase: Briefcase,
};

function toTypeMeta(t) {
  return { ...t, short: t.short || t.label, icon: TYPE_ICONS[t.icon] || Circle, iconName: t.icon || 'circle', color: t.color || '#0d9488' };
}

// Ticket types come from the workspace settings. This array is filled in place when the
// workspace loads (see WorkspaceContext / portal pages), so every import sees the
// company's own types. The defaults below are the classic software set.
export const TICKET_TYPES = [
  { value: 'bug_report', label: 'Bug Report', short: 'Bug', icon: 'bug', color: '#e11d48' },
  { value: 'feature_request', label: 'Feature Request', short: 'Feature', icon: 'sparkles', color: '#7c3aed' },
  { value: 'change_request', label: 'Change Request', short: 'Change', icon: 'refresh', color: '#0284c7' },
  { value: 'support_ticket', label: 'Support Ticket', short: 'Support', icon: 'lifebuoy', color: '#d97706' },
].map(toTypeMeta);

export function setTicketTypes(types) {
  if (!Array.isArray(types) || !types.length) return;
  TICKET_TYPES.splice(0, TICKET_TYPES.length, ...types.map(toTypeMeta));
}

// Unknown values (e.g. a type that was renamed) still render sensibly.
export function findType(value) {
  return (
    TICKET_TYPES.find((t) => t.value === value) ||
    toTypeMeta({ value, label: String(value || 'Other').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), icon: 'circle', color: '#64748b' })
  );
}

// `dot` is a Tailwind bg class used for the small status indicators (tabs, board columns).
export const TICKET_STATUSES = [
  { value: 'open', label: 'Open', badge: 'info', icon: CircleDot, dot: 'bg-sky-500', color: '#0ea5e9' },
  { value: 'in_progress', label: 'In Progress', badge: 'warning', icon: Loader, dot: 'bg-amber-500', color: '#f59e0b' },
  { value: 'in_review', label: 'In Review', badge: 'purple', icon: Eye, dot: 'bg-violet-500', color: '#8b5cf6' },
  { value: 'reopened', label: 'Reopened', badge: 'danger', icon: RotateCcw, dot: 'bg-rose-500', color: '#f43f5e' },
  { value: 'resolved', label: 'Resolved', badge: 'success', icon: CheckCircle2, dot: 'bg-emerald-500', color: '#10b981' },
  { value: 'closed', label: 'Closed', badge: 'slate', icon: Archive, dot: 'bg-slate-400', color: '#94a3b8' },
];

export const ACTIVE_STATUSES = ['open', 'in_progress', 'in_review', 'reopened'];

export const TICKET_PRIORITIES = [
  { value: 'low', label: 'Low', badge: 'slate', icon: SignalLow, text: 'text-slate-500 dark:text-slate-400' },
  { value: 'medium', label: 'Medium', badge: 'info', icon: SignalMedium, text: 'text-sky-600 dark:text-sky-400' },
  { value: 'high', label: 'High', badge: 'warning', icon: SignalHigh, text: 'text-amber-600 dark:text-amber-400' },
  { value: 'critical', label: 'Critical', badge: 'danger', icon: Flame, text: 'text-rose-600 dark:text-rose-400' },
];

export const PROJECT_STATUSES = [
  { value: 'planning', label: 'Planning', badge: 'slate' },
  { value: 'in_progress', label: 'In Progress', badge: 'info' },
  { value: 'on_hold', label: 'On Hold', badge: 'warning' },
  { value: 'completed', label: 'Completed', badge: 'success' },
  { value: 'cancelled', label: 'Cancelled', badge: 'danger' },
];

export const CLIENT_STATUSES = [
  { value: 'active', label: 'Active', badge: 'success' },
  { value: 'inactive', label: 'Inactive', badge: 'slate' },
];

export const TODO_PRIORITIES = [
  { value: 'low', label: 'Low', color: 'bg-slate-400' },
  { value: 'medium', label: 'Medium', color: 'bg-sky-500' },
  { value: 'high', label: 'High', color: 'bg-rose-500' },
];

export const WORKSPACE_ICONS = { code: Code2, flask: FlaskConical, headset: Headset, megaphone: Megaphone, briefcase: Briefcase };

export const CUSTOM_FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Dropdown' },
  { value: 'date', label: 'Date' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'url', label: 'Link' },
];

export const INVOICE_STATUSES = {
  draft: { label: 'Draft', badge: 'slate' },
  sent: { label: 'Sent', badge: 'info' },
  partial: { label: 'Partially paid', badge: 'warning' },
  overdue: { label: 'Overdue', badge: 'danger' },
  paid: { label: 'Paid', badge: 'success' },
  void: { label: 'Void', badge: 'slate' },
};

export function findMeta(list, value) {
  return list.find((i) => i.value === value) || list[0];
}
