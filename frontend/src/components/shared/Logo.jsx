import { cn } from '@/lib/utils';

// The ZoopDesk mark: a "Z" path with a chartreuse spark — drawn inline so it themes cleanly.
export function LogoMark({ className }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('h-8 w-8', className)} aria-hidden="true">
      <defs>
        <linearGradient id="zd-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#065f46" />
          <stop offset="1" stopColor="#10b981" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#zd-g)" />
      <path
        d="M19 21h26L21 43h24"
        fill="none"
        stroke="#ecfdf5"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="47" cy="17" r="5" fill="#bef264" />
    </svg>
  );
}

export default function Logo({ className, markClassName, textClassName, name = 'ZoopDesk' }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className={markClassName} />
      <span className={cn('font-display text-lg font-bold tracking-tight', textClassName)}>{name}</span>
    </span>
  );
}
