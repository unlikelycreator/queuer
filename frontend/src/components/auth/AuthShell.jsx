import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ShieldCheck, Globe2, CalendarCheck2 } from 'lucide-react';
import Logo from '@/components/shared/Logo';
import ThemeToggle from '@/components/shared/ThemeToggle';

const HIGHLIGHTS = [
  { icon: Globe2, title: 'Client portal', text: 'Clients submit, track and reply to requests from one link.' },
  { icon: CalendarCheck2, title: 'Daily project plans', text: 'Date-based to-dos keep every project moving.' },
  { icon: ShieldCheck, title: 'Secure by default', text: 'Two-factor auth, session revocation and audit-friendly timelines.' },
];

/**
 * Split-screen layout for login/signup/reset pages: a brand panel on the left (hidden on
 * small screens) and the form on the right.
 */
export default function AuthShell({ children, title, subtitle, footer }) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex lg:flex-col">
        <div className="pointer-events-none absolute inset-0 bg-noise opacity-70" />
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.35] [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_70%)]" />
        <div className="pointer-events-none absolute -left-32 top-1/3 h-[420px] w-[420px] rounded-full bg-emerald-500/25 blur-[100px]" />
        <div className="pointer-events-none absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-lime-400/15 blur-[90px]" />

        <Link to="/" className="relative">
          <Logo textClassName="text-white" />
        </Link>

        <div className="relative my-auto max-w-lg py-12">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-sidebar-active-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-spark shadow-[0_0_10px_hsl(var(--spark))]" />
            Built for software studios
          </p>
          <h1 className="font-display text-4xl font-bold leading-[1.1] tracking-tight text-white xl:text-5xl">
            Calm, organised client work —{' '}
            <span className="bg-gradient-to-r from-emerald-300 to-lime-300 bg-clip-text text-transparent">
              from request to resolved.
            </span>
          </h1>
          <div className="mt-10 space-y-5">
            {HIGHLIGHTS.map((h) => (
              <div key={h.title} className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-spark">
                  <h.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-white">{h.title}</p>
                  <p className="text-sm text-sidebar-foreground/70">{h.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Floating preview card */}
        <div className="relative mb-2 w-fit animate-float rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl backdrop-blur">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-spark" />
            <div>
              <p className="text-sm font-semibold text-white">#128 Checkout button fixed</p>
              <p className="text-xs text-sidebar-foreground/60">Marked resolved · client notified</p>
            </div>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="relative flex flex-col">
        <div className="flex items-center justify-between p-5 sm:p-6">
          <Link to="/" className="lg:invisible">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-5 pb-10 sm:px-8">
          <div className="w-full max-w-[400px] animate-fade-in">
            {(title || subtitle) && (
              <div className="mb-7">
                {title && <h2 className="font-display text-3xl font-bold tracking-tight">{title}</h2>}
                {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
              </div>
            )}
            {children}
            {footer && <div className="mt-8 space-y-2 text-center text-sm text-muted-foreground">{footer}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Divider({ label = 'or' }) {
  return (
    <div className="my-6 flex items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
