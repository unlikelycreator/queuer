import { Paperclip, X, FileText, Image as ImageIcon, Download } from 'lucide-react';
import { cn, formatBytes } from '@/lib/utils';

const isImage = (name = '') => /\.(png|jpe?g|gif|webp)$/i.test(name);

export function AttachButton({ uploading, onPick, label = 'Attach', className, disabled }) {
  return (
    <label
      className={cn(
        'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
        (uploading || disabled) && 'pointer-events-none opacity-60',
        className
      )}
    >
      <Paperclip className="h-3.5 w-3.5" />
      {uploading ? 'Uploading…' : label}
      <input type="file" multiple className="hidden" onChange={onPick} disabled={uploading || disabled} />
    </label>
  );
}

export function PendingFiles({ files, onRemove }) {
  if (!files.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {files.map((f) => (
        <span key={f.filename} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/60 px-2 py-1 text-xs">
          {isImage(f.originalName) ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
          <span className="max-w-[160px] truncate">{f.originalName}</span>
          <button type="button" onClick={() => onRemove(f.filename)} className="text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

// Read-only attachment list: image thumbnails + file chips.
export function AttachmentGrid({ files = [], className }) {
  if (!files.length) return null;
  const images = files.filter((f) => isImage(f.originalName || f.filename || f.url));
  const others = files.filter((f) => !isImage(f.originalName || f.filename || f.url));
  return (
    <div className={cn('space-y-2', className)}>
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((f, i) => (
            <a
              key={f._id || f.url || i}
              href={f.url}
              target="_blank"
              rel="noreferrer"
              className="group relative block h-20 w-28 overflow-hidden rounded-lg border border-border bg-secondary"
              title={f.originalName}
            >
              <img src={f.url} alt={f.originalName || 'attachment'} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
            </a>
          ))}
        </div>
      )}
      {others.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {others.map((f, i) => (
            <a
              key={f._id || f.url || i}
              href={f.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-accent/40"
            >
              <Download className="h-3 w-3" />
              <span className="max-w-[200px] truncate">{f.originalName || f.filename || 'File'}</span>
              {f.size ? <span className="text-muted-foreground">{formatBytes(f.size)}</span> : null}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
