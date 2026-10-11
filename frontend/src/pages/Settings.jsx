import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Wand2, Timer, Receipt, MessageSquareText, Mail } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/shared/Common';
import WorkspaceSettings, { SlaSettings } from '@/components/settings/WorkspaceSettings';
import BillingSettings from '@/components/settings/BillingSettings';
import SavedReplies from '@/components/settings/SavedReplies';
import EmailSettings from '@/components/settings/EmailSettings';
import { cn } from '@/lib/utils';

export default function Settings() {
  const { isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const tabs = [
    ...(isAdmin
      ? [
          { key: 'workspace', label: 'Workspace', icon: Wand2 },
          { key: 'sla', label: 'SLA & ratings', icon: Timer },
          { key: 'billing', label: 'Billing & invoices', icon: Receipt },
        ]
      : []),
    { key: 'replies', label: 'Saved replies', icon: MessageSquareText },
    { key: 'email', label: 'Email', icon: Mail },
  ];
  const tab = tabs.some((t) => t.key === params.get('tab')) ? params.get('tab') : tabs[0].key;

  return (
    <div className="animate-fade-in">
      <PageHeader eyebrow="Workspace" title="Settings" description="Shape Queuer around how your team works." />
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-border scrollbar-none">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setParams({ tab: t.key }, { replace: true })}
            className={cn(
              '-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors',
              tab === t.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>
      {tab === 'workspace' && <WorkspaceSettings />}
      {tab === 'sla' && <SlaSettings />}
      {tab === 'billing' && <BillingSettings />}
      {tab === 'replies' && <SavedReplies />}
      {tab === 'email' && <EmailSettings />}
    </div>
  );
}
