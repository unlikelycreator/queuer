import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download, Printer, ShieldOff } from 'lucide-react';
import * as api from '@/api/endpoints';
import { API_ORIGIN } from '@/api/axios';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import ThemeToggle from '@/components/shared/ThemeToggle';
import { LogoMark } from '@/components/shared/Logo';
import InvoiceDocument from '@/components/invoices/InvoiceDocument';
import { formatMoney, formatDate } from '@/lib/utils';

/** What the client sees when they open an invoice link. */
export default function PublicInvoice() {
  const { token } = useParams();
  const [inv, setInv] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .getPublicInvoice(token)
      .then((r) => {
        setInv(r.data);
        document.title = `Invoice ${r.data.number} · ${r.data.business.name}`;
      })
      .catch(() => setError(true));
  }, [token]);

  const pdfUrl = `${API_ORIGIN}/api/public/invoices/${token}/pdf`;

  return (
    <div className="min-h-screen bg-secondary/50">
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-3 px-4">
          <span className="font-display font-bold">{inv?.business.name || 'Invoice'}</span>
          <div className="ml-auto flex items-center gap-2">
            {inv && (
              <>
                <Button variant="outline" size="sm" asChild>
                  <a href={`${pdfUrl}?inline=1`} target="_blank" rel="noreferrer">
                    <Printer /> Print
                  </a>
                </Button>
                <Button variant="gradient" size="sm" asChild>
                  <a href={pdfUrl}>
                    <Download /> Download PDF
                  </a>
                </Button>
              </>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">
        {error ? (
          <Card className="mx-auto max-w-md p-10 text-center">
            <ShieldOff className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-display text-lg font-bold">Invoice not available</p>
            <p className="mt-2 text-sm text-muted-foreground">This link is invalid or the invoice has been withdrawn.</p>
          </Card>
        ) : !inv ? (
          <Skeleton className="h-[800px] rounded-xl" />
        ) : (
          <>
            {inv.status !== 'paid' && inv.status !== 'void' && (
              <Card className="mb-6 flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Amount due {inv.dueDate ? `by ${formatDate(inv.dueDate)}` : ''}</p>
                  <p className="font-display text-3xl font-bold tabular-nums">{formatMoney(inv.balanceDue, inv.currency)}</p>
                </div>
                {inv.business.paymentInstructions && (
                  <p className="max-w-sm whitespace-pre-line text-sm text-muted-foreground">{inv.business.paymentInstructions}</p>
                )}
              </Card>
            )}
            <div className="overflow-x-auto">
              <InvoiceDocument inv={inv} business={inv.business} template={inv.template} accent={inv.accentColor} className="mx-auto min-w-[640px]" />
            </div>
          </>
        )}
        <p className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <LogoMark className="h-4 w-4" /> Sent with Queuer
        </p>
      </main>
    </div>
  );
}
