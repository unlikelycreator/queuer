import {
  Bug,
  Sparkles,
  RefreshCw,
  LifeBuoy,
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

export const TICKET_TYPES = [
  { value: 'bug_report', label: 'Bug Report', short: 'Bug', icon: Bug, badge: 'danger', color: '#e11d48' },
  { value: 'feature_request', label: 'Feature Request', short: 'Feature', icon: Sparkles, badge: 'purple', color: '#7c3aed' },
  { value: 'change_request', label: 'Change Request', short: 'Change', icon: RefreshCw, badge: 'info', color: '#0284c7' },
  { value: 'support_ticket', label: 'Support Ticket', short: 'Support', icon: LifeBuoy, badge: 'warning', color: '#d97706' },
];

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

export function findMeta(list, value) {
  return list.find((i) => i.value === value) || list[0];
}
