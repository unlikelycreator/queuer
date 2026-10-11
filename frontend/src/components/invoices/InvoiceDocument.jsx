import { cn, formatMoney, formatDate } from '@/lib/utils';

/**
 * On-screen rendering of an invoice in one of the three themes (mirrors the PDF).
 * Always rendered on white "paper" so it looks the same as the printout in dark mode.
 * `inv` is normalised: { number, status, issueDate, dueDate, currency, client, projectName,
 * items, subtotal, discountPercent, discountAmount, taxRate, taxLabel, taxAmount, total,
 * amountPaid, balanceDue, notes, terms }, `business` holds the sender details.
 */
export default function InvoiceDocument({ inv, business = {}, template = 'modern', accent = '#047857', className }) {
  const cur = inv.currency || 'USD';
  const serif = template === 'classic';
  const statusText = { draft: 'DRAFT', sent: 'DUE', partial: 'PARTIALLY PAID', overdue: 'OVERDUE', paid: 'PAID', void: 'VOID' }[inv.status] || '';
  const stamp = ['paid', 'void'].includes(inv.status);

  const header =
    template === 'modern' ? (
      <div className="flex items-start justify-between gap-6 px-10 py-9 text-white" style={{ backgroundColor: accent }}>
        <div className="flex items-start gap-4">
          {business.logoUrl && <img src={business.logoUrl} alt="" className="h-14 w-14 rounded-lg bg-white/90 object-contain p-1" />}
          <div>
            <p className="text-xl font-bold">{business.name}</p>
            <p className="mt-1 whitespace-pre-line text-xs opacity-85">{[business.address, business.email, business.phone].filter(Boolean).join('\n')}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold tracking-tight">INVOICE</p>
          <p className="mt-1 text-sm">{inv.number}</p>
          <p className="mt-2 text-[10px] font-bold tracking-[0.2em]">{statusText}</p>
        </div>
      </div>
    ) : template === 'classic' ? (
      <div className="px-10 pt-9 text-center">
        {business.logoUrl && <img src={business.logoUrl} alt="" className="mx-auto mb-3 h-14 w-14 object-contain" />}
        <p className="text-2xl font-bold">{business.name}</p>
        <p className="mt-1 whitespace-pre-line text-xs text-[#6b7a72]">
          {[business.address, [business.email, business.phone].filter(Boolean).join('  ·  ')].filter(Boolean).join('\n')}
        </p>
        <div className="mt-5 border-t-[3px] border-double" style={{ borderColor: accent }} />
        <p className="mt-4 text-lg font-bold tracking-[0.2em]" style={{ color: accent }}>
          INVOICE {inv.number}
        </p>
      </div>
    ) : (
      <div className="flex items-start justify-between px-10 pt-9">
        <div className="flex items-start gap-3">
          {business.logoUrl && <img src={business.logoUrl} alt="" className="h-11 w-11 object-contain" />}
          <div>
            <p className="font-bold">{business.name}</p>
            <p className="whitespace-pre-line text-[11px] text-[#6b7a72]">{[business.address, business.email].filter(Boolean).join('\n')}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold" style={{ color: accent }}>
            Invoice
          </p>
          <p className="text-sm text-[#6b7a72]">{inv.number}</p>
        </div>
      </div>
    );

  return (
    <div
      className={cn('relative overflow-hidden rounded-xl bg-white text-[#16211c] shadow-soft-lg ring-1 ring-black/5', serif ? 'font-serif' : 'font-sans', className)}
      style={serif ? { fontFamily: 'Georgia, "Times New Roman", serif' } : undefined}
    >
      {header}

      <div className="grid grid-cols-2 gap-8 px-10 pt-8">
        <div>
          <p className="text-[10px] font-bold tracking-[0.15em] text-[#6b7a72]">BILL TO</p>
          <p className="mt-1 font-bold">{inv.client?.name || '—'}</p>
          <p className="whitespace-pre-line text-xs text-[#6b7a72]">
            {[inv.client?.contactPerson, inv.client?.email, inv.client?.address].filter(Boolean).join('\n')}
          </p>
          {inv.projectName && <p className="mt-1 text-xs text-[#6b7a72]">Project: {inv.projectName}</p>}
        </div>
        <div className="space-y-1 text-xs">
          {[
            ['Invoice number', inv.number],
            ['Issue date', formatDate(inv.issueDate)],
            ['Due date', formatDate(inv.dueDate)],
            ...(business.taxId ? [['Tax ID', business.taxId]] : []),
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <span className="text-[#6b7a72]">{k}</span>
              <span className="font-bold">{v}</span>
            </div>
          ))}
          <div className={cn('mt-3 px-3 py-2', template === 'classic' ? '' : 'rounded-md')} style={{ backgroundColor: `${accent}1f` }}>
            <p className="text-[9px] font-bold tracking-[0.12em]" style={{ color: accent }}>
              {inv.status === 'paid' ? 'PAID IN FULL' : 'BALANCE DUE'}
            </p>
            <p className="text-right text-lg font-bold" style={{ color: accent }}>
              {formatMoney(inv.balanceDue ?? inv.total - (inv.amountPaid || 0), cur)}
            </p>
          </div>
        </div>
      </div>

      <div className="px-10 pt-8">
        <table className="w-full text-[13px]">
          <thead>
            <tr
              className={cn('text-[10px] font-bold tracking-[0.1em]', template === 'modern' ? 'text-white' : template === 'minimal' ? 'border-b-2 border-[#16211c] text-[#6b7a72]' : 'border')}
              style={template === 'modern' ? { backgroundColor: accent } : template === 'classic' ? { color: accent, borderColor: accent, backgroundColor: `${accent}12` } : undefined}
            >
              <th className="px-3 py-2 text-left">DESCRIPTION</th>
              <th className="px-2 py-2 text-right">QTY</th>
              <th className="px-2 py-2 text-right">RATE</th>
              <th className="px-3 py-2 text-right">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((it, i) => (
              <tr
                key={it._id || i}
                className={cn(template !== 'modern' && 'border-b border-[#dde5e0]')}
                style={template === 'modern' && i % 2 ? { backgroundColor: `${accent}0d` } : undefined}
              >
                <td className="px-3 py-2.5">{it.description}</td>
                <td className="px-2 py-2.5 text-right tabular-nums">
                  {Number(it.quantity).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  {it.unit ? ` ${it.unit}` : ''}
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums">{formatMoney(it.unitPrice, cur)}</td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums">{formatMoney(it.quantity * it.unitPrice, cur)}</td>
              </tr>
            ))}
            {inv.items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-xs text-[#6b7a72]">
                  No line items yet
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="ml-auto mt-4 w-64 space-y-1.5 text-[13px]">
          <Row label="Subtotal" value={formatMoney(inv.subtotal, cur)} />
          {inv.discountAmount > 0 && <Row label={`Discount (${inv.discountPercent}%)`} value={`-${formatMoney(inv.discountAmount, cur)}`} />}
          {inv.taxRate > 0 && <Row label={`${inv.taxLabel || 'Tax'} (${inv.taxRate}%)`} value={formatMoney(inv.taxAmount, cur)} />}
          <div className="border-t pt-2" style={{ borderColor: template === 'minimal' ? '#16211c' : accent }}>
            <Row label="Total" value={formatMoney(inv.total, cur)} bold color={accent} />
          </div>
          {inv.amountPaid > 0 && (
            <>
              <Row label="Paid" value={`-${formatMoney(inv.amountPaid, cur)}`} />
              <Row label="Balance due" value={formatMoney(inv.total - inv.amountPaid, cur)} bold />
            </>
          )}
        </div>
      </div>

      <div className="space-y-4 px-10 pb-6 pt-6 text-xs">
        {[
          ['Payment instructions', business.paymentInstructions],
          ['Notes', inv.notes],
          ['Terms', inv.terms],
        ]
          .filter(([, t]) => t)
          .map(([title, text]) => (
            <div key={title}>
              <p className="text-[9px] font-bold tracking-[0.15em]" style={{ color: accent }}>
                {title.toUpperCase()}
              </p>
              <p className="mt-1 max-w-md whitespace-pre-line">{text}</p>
            </div>
          ))}
      </div>

      <div className="flex justify-between border-t border-[#dde5e0] px-10 py-3 text-[10px] text-[#6b7a72]">
        <span className="italic">{business.footerNote}</span>
        <span>{inv.number}</span>
      </div>

      {stamp && (
        <span
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[18deg] text-[90px] font-black tracking-widest opacity-[0.1]"
          style={{ color: inv.status === 'paid' ? accent : '#b91c1c' }}
        >
          {inv.status.toUpperCase()}
        </span>
      )}
    </div>
  );
}

function Row({ label, value, bold, color }) {
  return (
    <div className={cn('flex justify-between', bold ? 'text-[15px] font-bold' : 'text-[#6b7a72]')} style={bold && color ? { color } : undefined}>
      <span>{label}</span>
      <span className={cn('tabular-nums', !bold && 'text-[#16211c]')}>{value}</span>
    </div>
  );
}
