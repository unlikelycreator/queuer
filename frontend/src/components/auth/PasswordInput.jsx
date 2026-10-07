import React, { useState } from 'react';
import { Eye, EyeOff, Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function scorePassword(pw = '') {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(4, score);
}

export function passwordIsValid(pw = '') {
  return pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw);
}

const LABELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
const COLORS = ['bg-rose-500', 'bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 'bg-emerald-500'];

export default function PasswordInput({ value, onChange, showStrength = false, id = 'password', ...props }) {
  const [show, setShow] = useState(false);
  const score = scorePassword(value);
  const rules = [
    { ok: value.length >= 8, label: '8+ characters' },
    { ok: /[A-Za-z]/.test(value), label: 'A letter' },
    { ok: /\d/.test(value), label: 'A number' },
  ];

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          className="pr-10"
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {showStrength && value && (
        <div className="space-y-2 animate-fade-in">
          <div className="flex items-center gap-2">
            <div className="flex flex-1 gap-1">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn('h-1.5 flex-1 rounded-full transition-colors', i < score ? COLORS[score] : 'bg-secondary')}
                />
              ))}
            </div>
            <span className="w-16 text-right text-[11px] font-semibold text-muted-foreground">{LABELS[score]}</span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {rules.map((r) => (
              <span
                key={r.label}
                className={cn(
                  'inline-flex items-center gap-1 text-[11px] font-medium',
                  r.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                )}
              >
                {r.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} {r.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
