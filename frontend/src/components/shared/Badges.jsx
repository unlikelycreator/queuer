import { Badge } from '@/components/ui/badge';
import { Globe, Mail, User, Timer } from 'lucide-react';
import {
  findType,
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  PROJECT_STATUSES,
  CLIENT_STATUSES,
  findMeta,
} from '@/lib/constants';
import { cn } from '@/lib/utils';

export function TypeBadge({ type, short = false, className }) {
  const meta = findType(type);
  const Icon = meta.icon;
  return (
    <Badge
      variant="outline"
      className={cn('border-transparent', className)}
      style={{ backgroundColor: `${meta.color}1a`, color: meta.color, borderColor: `${meta.color}33` }}
    >
      <Icon className="h-3 w-3" />
      {short ? meta.short : meta.label}
    </Badge>
  );
}

// SLA countdown / breach indicator for active tickets.
export function SlaBadge({ ticket, className }) {
  if (!ticket || ['resolved', 'closed'].includes(ticket.status)) return null;
  const breached = ticket.slaResolutionBreached || ticket.slaResponseBreached;
  const awaitingResponse = !ticket.firstResponseAt && ticket.slaResponseDueAt;
  const due = awaitingResponse ? ticket.slaResponseDueAt : ticket.slaResolutionDueAt;
  if (!due && !breached) return null;
  const ms = due ? new Date(due) - Date.now() : -1;
  const label = awaitingResponse ? 'Response' : 'Resolve';
  if (breached || ms < 0) {
    return (
      <Badge variant="danger" className={className} title="SLA breached">
        <Timer className="h-3 w-3" /> SLA breached
      </Badge>
    );
  }
  const h = ms / 36e5;
  const text = h < 1 ? `${Math.max(1, Math.round(ms / 60000))}m` : h < 48 ? `${Math.round(h)}h` : `${Math.round(h / 24)}d`;
  return (
    <Badge variant={h < 4 ? 'warning' : 'slate'} className={className} title={`${label} due ${new Date(due).toLocaleString()}`}>
      <Timer className="h-3 w-3" /> {label} in {text}
    </Badge>
  );
}

export function StatusBadge({ status, className }) {
  const meta = findMeta(TICKET_STATUSES, status);
  return (
    <Badge variant={meta.badge} className={className}>
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </Badge>
  );
}

export function PriorityBadge({ priority, className }) {
  const meta = findMeta(TICKET_PRIORITIES, priority);
  const Icon = meta.icon;
  return (
    <Badge variant={meta.badge} className={className}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
}

// Compact icon + label used in dense lists.
export function PriorityIndicator({ priority, showLabel = true, className }) {
  const meta = findMeta(TICKET_PRIORITIES, priority);
  const Icon = meta.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', meta.text, className)} title={`${meta.label} priority`}>
      <Icon className="h-3.5 w-3.5" />
      {showLabel && meta.label}
    </span>
  );
}

export function StatusDot({ status, className }) {
  const meta = findMeta(TICKET_STATUSES, status);
  return <span className={cn('inline-block h-2 w-2 rounded-full', meta.dot, className)} title={meta.label} />;
}

export function ProjectStatusBadge({ status }) {
  const meta = findMeta(PROJECT_STATUSES, status);
  return <Badge variant={meta.badge}>{meta.label}</Badge>;
}

export function ClientStatusBadge({ status }) {
  const meta = findMeta(CLIENT_STATUSES, status);
  return <Badge variant={meta.badge}>{meta.label}</Badge>;
}

const SOURCE_META = {
  public_form: { icon: Globe, label: 'Client portal' },
  email: { icon: Mail, label: 'Email' },
  internal: { icon: User, label: 'Internal' },
};

export function SourceIcon({ source, className }) {
  const meta = SOURCE_META[source] || SOURCE_META.internal;
  const Icon = meta.icon;
  return (
    <span title={`Source: ${meta.label}`} className="inline-flex">
      <Icon className={className || 'h-3.5 w-3.5 text-muted-foreground'} />
    </span>
  );
}

export function SourceLabel({ source }) {
  const meta = SOURCE_META[source] || SOURCE_META.internal;
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5" /> {meta.label}
    </span>
  );
}
