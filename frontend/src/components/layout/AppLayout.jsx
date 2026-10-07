import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users2,
  FolderKanban,
  Ticket,
  UserCog,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  ChevronsUpDown,
  Search,
  ShieldCheck,
  Plus,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/shared/UserAvatar';
import CommandPalette from '@/components/shared/CommandPalette';
import ThemeToggle from '@/components/shared/ThemeToggle';
import { Kbd } from '@/components/shared/Common';
import { LogoMark } from '@/components/shared/Logo';

const navSections = [
  {
    label: 'Workspace',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/tickets', label: 'Tickets', icon: Ticket },
      { to: '/projects', label: 'Projects', icon: FolderKanban },
      { to: '/clients', label: 'Clients', icon: Users2 },
    ],
  },
  {
    label: 'Organisation',
    items: [
      { to: '/team', label: 'Team', icon: UserCog },
      { to: '/settings', label: 'Settings', icon: SettingsIcon },
    ],
  },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // The shell manages its own scrolling (only <main> scrolls).
  useEffect(() => {
    document.body.classList.add('app-shell-active');
    return () => document.body.classList.remove('app-shell-active');
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar — a deep forest panel in both themes */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-noise opacity-60" />
        <div className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />

        <div className="relative flex h-16 items-center gap-2.5 px-5">
          <LogoMark className="h-8 w-8 drop-shadow" />
          <span className="font-display text-[19px] font-bold tracking-tight text-white">ZoopDesk</span>
          <button className="ml-auto text-sidebar-muted hover:text-white lg:hidden" onClick={() => setMobileOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative px-3 pb-2">
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex w-full items-center gap-2 rounded-lg border border-sidebar-border bg-white/[0.04] px-3 py-2 text-sm text-sidebar-muted transition-colors hover:bg-white/[0.07] hover:text-sidebar-foreground"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Search…</span>
            <Kbd className="border-white/10 bg-white/5 text-sidebar-muted">⌘K</Kbd>
          </button>
        </div>

        <nav className="relative flex-1 space-y-6 overflow-y-auto px-3 py-4 scrollbar-none">
          {navSections.map((section) => (
            <div key={section.label}>
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-sidebar-muted/80">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-all',
                        isActive
                          ? 'bg-sidebar-active text-sidebar-active-foreground'
                          : 'text-sidebar-foreground/75 hover:bg-white/[0.05] hover:text-white'
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-spark shadow-[0_0_12px_hsl(var(--spark))]" />
                        )}
                        <item.icon className={cn('h-[18px] w-[18px]', isActive ? 'text-spark' : 'opacity-80')} />
                        {item.label}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="relative border-t border-sidebar-border p-3">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-lg p-2 text-left outline-none transition-colors hover:bg-white/[0.05]">
              <UserAvatar user={user} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
                <p className="truncate text-xs text-sidebar-muted">{user?.company?.name}</p>
              </div>
              <ChevronsUpDown className="h-4 w-4 text-sidebar-muted" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-60">
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-semibold text-foreground">{user?.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                <Badge variant="lime" className="mt-2 capitalize">
                  {user?.role}
                </Badge>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/account')}>
                <ShieldCheck className="mr-2 h-4 w-4" />
                Account & security
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <SettingsIcon className="mr-2 h-4 w-4" />
                Workspace settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="glass sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border/70 px-4 sm:px-6">
          <button className="text-muted-foreground hover:text-foreground lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <button
            onClick={() => setPaletteOpen(true)}
            className="hidden h-9 w-full max-w-sm items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground shadow-sm transition-colors hover:border-primary/30 sm:flex"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Search or jump to…</span>
            <Kbd>Ctrl K</Kbd>
          </button>
          <div className="flex-1" />
          {!user?.twoFactor?.enabled && (
            <button
              onClick={() => navigate('/account')}
              className="hidden items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-500/15 dark:text-amber-300 md:flex"
            >
              <ShieldAlert className="h-3.5 w-3.5" /> Enable 2FA
            </button>
          )}
          <ThemeToggle />
          <Button variant="gradient" size="sm" onClick={() => navigate('/tickets?new=1')}>
            <Plus /> <span className="hidden sm:inline">New ticket</span>
          </Button>
        </header>

        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="mx-auto w-full max-w-[1400px] p-4 sm:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
