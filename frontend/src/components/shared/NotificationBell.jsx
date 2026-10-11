import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, UserPlus, MessageSquare, Timer, Zap, Wallet, Star, Info } from 'lucide-react';
import * as api from '@/api/endpoints';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn, timeAgo } from '@/lib/utils';

const KIND = {
  assigned: { icon: UserPlus, tone: 'bg-sky-500/10 text-sky-600 dark:text-sky-300' },
  client_reply: { icon: MessageSquare, tone: 'bg-lime-500/15 text-lime-700 dark:text-spark' },
  sla_breach: { icon: Timer, tone: 'bg-rose-500/10 text-rose-600 dark:text-rose-300' },
  automation: { icon: Zap, tone: 'bg-violet-500/10 text-violet-600 dark:text-violet-300' },
  invoice_paid: { icon: Wallet, tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' },
  csat: { icon: Star, tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-300' },
  system: { icon: Info, tone: 'bg-secondary text-muted-foreground' },
};

export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);

  const poll = useCallback(() => {
    api
      .getUnreadCount()
      .then((r) => setUnread(r.data.unread))
      .catch(() => {});
  }, []);

  useEffect(() => {
    poll();
    const t = setInterval(poll, 45000);
    return () => clearInterval(t);
  }, [poll]);

  useEffect(() => {
    if (!open) return;
    api
      .getNotifications()
      .then((r) => {
        setItems(r.data.items);
        setUnread(r.data.unread);
      })
      .catch(() => {});
  }, [open]);

  const markAll = async () => {
    await api.markNotificationsRead();
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  const openItem = async (n) => {
    if (!n.read) {
      api.markNotificationsRead(n._id).catch(() => {});
      setUnread((u) => Math.max(0, u - 1));
    }
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-background">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-bold">Notifications</p>
          {unread > 0 && (
            <button onClick={markAll} className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto scrollbar-thin">
          {items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">You're all caught up 🌿</p>
          ) : (
            items.map((n) => {
              const k = KIND[n.kind] || KIND.system;
              return (
                <button
                  key={n._id}
                  onClick={() => openItem(n)}
                  className={cn('flex w-full gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors last:border-0 hover:bg-secondary/60', !n.read && 'bg-accent/30')}
                >
                  <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', k.tone)}>
                    <k.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{n.title}</span>
                    {n.body && <span className="line-clamp-2 block text-xs text-muted-foreground">{n.body}</span>}
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                  </span>
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                </button>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
