import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export function PageHeader({ title, description, eyebrow, children, className }) {
  return (
    <div className={cn('mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>
        )}
        <h1 className="font-display text-[26px] font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className, compact = false }) {
  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-card/50 px-6 text-center animate-fade-in',
        compact ? 'py-10' : 'py-16',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      {Icon && (
        <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground ring-8 ring-accent/40">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <h3 className="relative font-display text-base font-semibold text-foreground">{title}</h3>
      {description && <p className="relative mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="relative mt-5">{action}</div>}
    </div>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmLabel = 'Delete',
  destructive = true,
  loading,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant={destructive ? 'destructive' : 'default'} onClick={onConfirm} disabled={loading}>
            {loading ? 'Please wait...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Small stat tile used on dashboards and the portal.
export function StatTile({ label, value, hint, icon: Icon, tone = 'default', className }) {
  const tones = {
    default: 'bg-accent text-accent-foreground',
    spark: 'bg-spark/25 text-lime-800 dark:text-spark',
    warn: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    danger: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
    info: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  };
  return (
    <div className={cn('rounded-xl border border-border/80 bg-card p-4 shadow-soft', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1.5 font-display text-2xl font-bold tracking-tight tabular-nums">{value}</p>
          {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', tones[tone])}>
            <Icon className="h-4.5 w-4.5" />
          </div>
        )}
      </div>
    </div>
  );
}

export function SectionTitle({ children, action, className }) {
  return (
    <div className={cn('mb-3 flex items-center justify-between gap-3', className)}>
      <h2 className="font-display text-base font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}

// Keyboard key hint, e.g. <Kbd>⌘K</Kbd>
export function Kbd({ children, className }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-secondary px-1 font-mono text-[10px] font-semibold text-muted-foreground',
        className
      )}
    >
      {children}
    </kbd>
  );
}
