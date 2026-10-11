import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as api from '@/api/endpoints';
import { setTicketTypes } from '@/lib/constants';
import { useAuth } from '@/context/AuthContext';

const WorkspaceContext = createContext(null);

const DEFAULT_TERMS = { ticket: 'Ticket', tickets: 'Tickets', client: 'Client', clients: 'Clients', project: 'Project', projects: 'Projects' };

/**
 * Loads the company's workspace configuration (what the team uses ZoopDesk for):
 * terminology, ticket types, custom fields, SLA and billing defaults.
 */
export function WorkspaceProvider({ children }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [ready, setReady] = useState(false);

  const apply = useCallback((d) => {
    setTicketTypes(d.workspace?.ticketTypes);
    setData(d);
  }, []);

  const refresh = useCallback(async () => {
    const res = await api.getWorkspace();
    apply(res.data);
    return res.data;
  }, [apply]);

  useEffect(() => {
    if (!user) {
      setReady(false);
      setData(null);
      return;
    }
    refresh()
      .catch(() => {})
      .finally(() => setReady(true));
  }, [user?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = {
    ready,
    data,
    workspace: data?.workspace,
    terms: { ...DEFAULT_TERMS, ...(data?.workspace?.terminology || {}) },
    customFields: data?.workspace?.customFields || [],
    templates: data?.templates || [],
    billing: data?.billing || { currency: 'USD', defaultHourlyRate: 0 },
    sla: data?.sla,
    csatEnabled: data?.csatEnabled !== false,
    refresh,
    apply,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}

export function useTerms() {
  return useWorkspace().terms;
}
