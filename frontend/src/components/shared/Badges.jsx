import { Badge } from '@/components/ui/badge';
import { Globe, Mail, User } from 'lucide-react';
import {
  TICKET_TYPES,
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  PROJECT_STATUSES,
  CLIENT_STATUSES,
  findMeta,
} from '@/lib/constants';
import { cn } from '@/lib/utils';

export function TypeBadge({ type, short = false, className }) {
  const meta = findMeta(TICKET_TYPES, type);
  const Icon = meta.icon;
  return (
    <Badge variant={meta.badge} className={className}>
      <Icon className="h-3 w-3" />
      {short ? meta.short : meta.label}
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
