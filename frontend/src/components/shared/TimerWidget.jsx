import { useNavigate } from 'react-router-dom';
import { Square } from 'lucide-react';
import { useTimer } from '@/context/TimerContext';
import { formatClock } from '@/lib/utils';

/** Header pill shown while the current user has a timer running. */
export default function TimerWidget() {
  const { running, elapsed, stop } = useTimer();
  const navigate = useNavigate();
  if (!running) return null;
  const label = running.ticket ? `#${running.ticket.ticketNumber} ${running.ticket.title}` : running.project?.name;
  return (
    <div className="flex items-center gap-1 rounded-full border border-primary/30 bg-accent/60 py-1 pl-3 pr-1 shadow-soft animate-fade-in">
      <span className="relative mr-1 flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
      </span>
      <button
        onClick={() => navigate(running.ticket ? `/tickets/${running.ticket._id}` : '/time')}
        className="hidden max-w-[160px] truncate text-xs font-semibold text-accent-foreground hover:underline md:block"
        title={label}
      >
        {label}
      </button>
      <span className="px-1.5 font-mono text-xs font-bold tabular-nums">{formatClock(elapsed)}</span>
      <button
        onClick={stop}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-500 text-white transition-transform hover:scale-105"
        title="Stop timer"
        aria-label="Stop timer"
      >
        <Square className="h-3 w-3 fill-current" />
      </button>
    </div>
  );
}
