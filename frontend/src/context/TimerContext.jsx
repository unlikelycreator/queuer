import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import * as api from '@/api/endpoints';
import { useAuth } from '@/context/AuthContext';
import { apiError, formatMinutes } from '@/lib/utils';

const TimerContext = createContext(null);

/** The current user's running timer, shared by the header widget and ticket pages. */
export function TimerProvider({ children }) {
  const { user } = useAuth();
  const [running, setRunning] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [version, setVersion] = useState(0); // bumps whenever time is logged, so lists can refresh

  const refresh = useCallback(() => {
    if (!user) return;
    api
      .getRunningTimer()
      .then((r) => setRunning(r.data || null))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  useEffect(() => {
    if (!running) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  const start = async ({ ticket, project, description }) => {
    try {
      const res = await api.startTimer({ ticket, project, description });
      setRunning(res.data);
      setNow(Date.now());
      toast.success('Timer started');
      return res.data;
    } catch (err) {
      toast.error(apiError(err, 'Could not start timer'));
      return null;
    }
  };

  const stop = async () => {
    try {
      const res = await api.stopTimer();
      setRunning(null);
      setVersion((v) => v + 1);
      toast.success(`Logged ${formatMinutes(res.data.minutes)}`);
      return res.data;
    } catch (err) {
      toast.error(apiError(err, 'Could not stop timer'));
      setRunning(null);
      return null;
    }
  };

  const elapsed = running ? now - new Date(running.startedAt).getTime() : 0;

  return (
    <TimerContext.Provider value={{ running, elapsed, start, stop, refresh, version, bump: () => setVersion((v) => v + 1) }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimer must be used within TimerProvider');
  return ctx;
}
