import React from 'react';
import { LayoutGrid, List } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ViewToggle({ view, onChange }) {
  return (
    <div className="flex items-center rounded-lg border border-border bg-secondary/40 p-0.5">
      <button
        onClick={() => onChange('grid')}
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
          view === 'grid' ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground'
        )}
        title="Card view"
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => onChange('table')}
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
          view === 'table' ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground'
        )}
        title="Table view"
      >
        <List className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
