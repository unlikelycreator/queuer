import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date) {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function timeAgo(date) {
  if (!date) return '—';
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  const intervals = [
    { label: 'y', secs: 31536000 },
    { label: 'mo', secs: 2592000 },
    { label: 'd', secs: 86400 },
    { label: 'h', secs: 3600 },
    { label: 'm', secs: 60 },
  ];
  for (const i of intervals) {
    const count = Math.floor(seconds / i.secs);
    if (count >= 1) return `${count}${i.label} ago`;
  }
  return 'just now';
}

export function initials(name = '') {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// ── Calendar-day helpers (todos are stored per day as YYYY-MM-DD) ──

// Local calendar day for a Date, as YYYY-MM-DD.
export function dayKey(date = new Date()) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// A stored todo date (midnight UTC) back to its YYYY-MM-DD key.
export function storedDayKey(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : '';
}

export function addDaysKey(key, days) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + days));
}

export function keyToDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function friendlyDay(key) {
  const today = dayKey();
  if (key === today) return 'Today';
  if (key === addDaysKey(today, 1)) return 'Tomorrow';
  if (key === addDaysKey(today, -1)) return 'Yesterday';
  return keyToDate(key).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export function isOverdue(date, status) {
  if (!date) return false;
  if (status && ['resolved', 'closed'].includes(status)) return false;
  return new Date(date) < new Date(new Date().toDateString());
}

export function formatDuration(hours) {
  if (hours === null || hours === undefined) return '—';
  if (hours < 1) return '< 1h';
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function apiError(err, fallback = 'Something went wrong') {
  return err?.response?.data?.message || err?.message || fallback;
}
