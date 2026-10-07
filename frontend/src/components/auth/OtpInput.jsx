import React, { useRef } from 'react';
import { cn } from '@/lib/utils';

/** Six separate digit boxes with paste support and auto-advance. */
export default function OtpInput({ value, onChange, onComplete, length = 6, autoFocus = true, disabled }) {
  const refs = useRef([]);
  const digits = Array.from({ length }, (_, i) => value[i] || '');

  const setAt = (index, char) => {
    const next = digits.slice();
    next[index] = char;
    const joined = next.join('').slice(0, length);
    onChange(joined);
    if (next.every(Boolean) && joined.length === length && onComplete) onComplete(joined);
  };

  const handleChange = (i, e) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) {
      setAt(i, '');
      return;
    }
    if (raw.length > 1) {
      const pasted = (value.slice(0, i) + raw).slice(0, length);
      onChange(pasted);
      refs.current[Math.min(pasted.length, length - 1)]?.focus();
      if (pasted.length === length && onComplete) onComplete(pasted);
      return;
    }
    setAt(i, raw);
    if (i < length - 1) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
    if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1]?.focus();
  };

  return (
    <div className="flex justify-between gap-2">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          value={d}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={length}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          aria-label={`Digit ${i + 1}`}
          className={cn(
            'h-12 w-full min-w-0 rounded-lg border border-input bg-card text-center font-mono text-xl font-semibold shadow-sm outline-none transition-all',
            'focus:border-primary/60 focus:ring-4 focus:ring-primary/15',
            d && 'border-primary/40 bg-accent/40'
          )}
        />
      ))}
    </div>
  );
}
