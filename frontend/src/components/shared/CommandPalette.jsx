import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Search,
  Users2,
  FolderKanban,
  Ticket as TicketIcon,
  Loader2,
  LayoutDashboard,
  Plus,
  Settings,
  UserCog,
  ShieldCheck,
  CornerDownLeft,
  Moon,
} from 'lucide-react';
import * as api from '@/api/endpoints';
import { useTheme } from '@/context/ThemeContext';
import { StatusDot } from '@/components/shared/Badges';
import { Kbd } from '@/components/shared/Common';
import { cn } from '@/lib/utils';

/**
 * ⌘K / Ctrl+K command palette: jump anywhere, run quick actions, and search clients,
 * projects and tickets (type "#42" to jump straight to a ticket number).
 */
export default function CommandPalette({ open, onOpenChange }) {
  const navigate = useNavigate();
  const { toggle } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults(null);
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      return undefined;
    }
    setLoading(true);
    const t = setTimeout(() => {
      api
        .globalSearch(query.trim())
        .then((res) => setResults(res.data))
        .catch(() => setResults({ clients: [], projects: [], tickets: [] }))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const actions = useMemo(
    () => [
      { id: 'nav-dash', group: 'Go to', label: 'Dashboard', icon: LayoutDashboard, run: () => navigate('/') },
      { id: 'nav-tickets', group: 'Go to', label: 'Tickets', icon: TicketIcon, run: () => navigate('/tickets') },
      { id: 'nav-projects', group: 'Go to', label: 'Projects', icon: FolderKanban, run: () => navigate('/projects') },
      { id: 'nav-clients', group: 'Go to', label: 'Clients', icon: Users2, run: () => navigate('/clients') },
      { id: 'nav-team', group: 'Go to', label: 'Team', icon: UserCog, run: () => navigate('/team') },
      { id: 'nav-settings', group: 'Go to', label: 'Settings', icon: Settings, run: () => navigate('/settings') },
      { id: 'nav-account', group: 'Go to', label: 'Account & security', icon: ShieldCheck, run: () => navigate('/account') },
      { id: 'new-ticket', group: 'Actions', label: 'Create a new ticket', icon: Plus, run: () => navigate('/tickets?new=1') },
      { id: 'theme', group: 'Actions', label: 'Toggle dark mode', icon: Moon, run: toggle },
    ],
    [navigate, toggle]
  );

  const items = useMemo(() => {
    if (!query.trim()) return actions;
    const q = query.toLowerCase();
    const matchedActions = actions.filter((a) => a.label.toLowerCase().includes(q));
    if (!results) return matchedActions;
    return [
      ...results.tickets.map((t) => ({
        id: `t-${t._id}`,
        group: 'Tickets',
        label: t.title,
        meta: `#${t.ticketNumber}`,
        status: t.status,
        icon: TicketIcon,
        run: () => navigate(`/tickets/${t._id}`),
      })),
      ...results.projects.map((p) => ({
        id: `p-${p._id}`,
        group: 'Projects',
        label: p.name,
        meta: p.client?.name,
        icon: FolderKanban,
        run: () => navigate(`/projects/${p._id}`),
      })),
      ...results.clients.map((c) => ({
        id: `c-${c._id}`,
        group: 'Clients',
        label: c.name,
        icon: Users2,
        run: () => navigate(`/clients/${c._id}`),
      })),
      ...matchedActions,
    ];
  }, [query, results, actions, navigate]);

  useEffect(() => setActive(0), [items.length]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const run = (item) => {
    if (!item) return;
    onOpenChange(false);
    item.run();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(items[active]);
    }
  };

  let lastGroup = null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 dark:bg-black/60" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-popover shadow-soft-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          onKeyDown={onKeyDown}
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">Search and commands</DialogPrimitive.Title>
          <div className="flex items-center gap-3 border-b border-border px-4">
            {loading ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tickets, projects, clients… or type #42"
              className="h-14 w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/70"
            />
            <Kbd>Esc</Kbd>
          </div>
          <div ref={listRef} className="max-h-[min(60vh,420px)] overflow-y-auto p-2 scrollbar-thin">
            {items.length === 0 ? (
              <p className="px-3 py-10 text-center text-sm text-muted-foreground">
                {loading ? 'Searching…' : 'No matches. Try a ticket number like #12.'}
              </p>
            ) : (
              items.map((item, i) => {
                const header = item.group !== lastGroup ? item.group : null;
                lastGroup = item.group;
                return (
                  <React.Fragment key={item.id}>
                    {header && (
                      <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground first:pt-1">
                        {header}
                      </p>
                    )}
                    <button
                      data-index={i}
                      onMouseMove={() => setActive(i)}
                      onClick={() => run(item)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                        i === active ? 'bg-accent text-accent-foreground' : 'text-foreground'
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0 opacity-70" />
                      {item.status && <StatusDot status={item.status} />}
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.meta && <span className="shrink-0 font-mono text-xs text-muted-foreground">{item.meta}</span>}
                      {i === active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 opacity-60" />}
                    </button>
                  </React.Fragment>
                );
              })
            )}
          </div>
          <div className="flex items-center gap-4 border-t border-border bg-secondary/40 px-4 py-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> navigate
            </span>
            <span className="flex items-center gap-1">
              <Kbd>↵</Kbd> open
            </span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
