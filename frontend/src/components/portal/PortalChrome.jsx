import React from 'react';
import { Link } from 'react-router-dom';
import ThemeToggle from '@/components/shared/ThemeToggle';
import { LogoMark } from '@/components/shared/Logo';
import { initials } from '@/lib/utils';

export const PORTAL_EMAIL_KEY = 'queuer_portal_identity';

export function readIdentity() {
  try {
    return JSON.parse(localStorage.getItem(PORTAL_EMAIL_KEY)) || { name: '', email: '' };
  } catch {
    return { name: '', email: '' };
  }
}

export function saveIdentity(identity) {
  try {
    localStorage.setItem(PORTAL_EMAIL_KEY, JSON.stringify(identity));
  } catch {
    /* ignore */
  }
}

/** Shared frame for every client-facing page: brand bar, soft backdrop, footer. */
export default function PortalChrome({ companyName, homeHref, children }) {
  return (
    <div className="relative min-h-screen bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-accent/70 via-accent/20 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-grid opacity-50 [mask-image:linear-gradient(to_bottom,black,transparent)]" />

      <header className="relative z-10 border-b border-border/60 bg-background/60 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6">
          {homeHref ? (
            <Link to={homeHref} className="flex items-center gap-3">
              <CompanyMark name={companyName} />
            </Link>
          ) : (
            <CompanyMark name={companyName} />
          )}
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>

      <footer className="relative z-10 border-t border-border/60 py-6">
        <div className="mx-auto flex max-w-5xl items-center justify-center gap-2 px-4 text-xs text-muted-foreground">
          <LogoMark className="h-4 w-4" /> Powered by <span className="font-semibold text-foreground">Queuer</span>
        </div>
      </footer>
    </div>
  );
}

function CompanyMark({ name }) {
  return (
    <>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand font-display text-sm font-bold text-white shadow-soft">
        {initials(name || 'Support')}
      </span>
      <span className="leading-tight">
        <span className="block font-display text-[15px] font-bold">{name || 'Support portal'}</span>
        <span className="block text-[11px] font-medium text-muted-foreground">Client portal</span>
      </span>
    </>
  );
}
