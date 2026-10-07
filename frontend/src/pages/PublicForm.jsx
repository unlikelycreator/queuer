import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import * as api from '@/api/endpoints';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import RequestForm from '@/components/portal/RequestForm';

/** Compact, embeddable (iframe) version of the portal's request form. */
export default function PublicForm() {
  const { token } = useParams();
  const [meta, setMeta] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api
      .getPublicForm(token)
      .then((res) => setMeta(res.data))
      .catch(() => setNotFound(true));
  }, [token]);

  return (
    <div className="min-h-screen bg-background p-3 sm:p-5">
      <Card className="mx-auto max-w-xl p-5 sm:p-7">
        {notFound ? (
          <div className="py-10 text-center">
            <p className="font-display text-lg font-bold">Form not available</p>
            <p className="mt-2 text-sm text-muted-foreground">This form link is invalid or has been disabled.</p>
          </div>
        ) : !meta ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : result ? (
          <div className="py-8 text-center animate-fade-in">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-7 w-7 text-emerald-500" />
            </div>
            <p className="font-display text-xl font-bold">Request submitted!</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Your reference is <span className="font-mono font-semibold text-foreground">#{result.ticketNumber}</span>.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <Button asChild variant="gradient">
                <a href={`/public/ticket/${result.trackingToken}`} target="_blank" rel="noreferrer">
                  Track this request <ArrowRight />
                </a>
              </Button>
              <Button variant="outline" onClick={() => setResult(null)}>
                Submit another
              </Button>
            </div>
            <a href={`/portal/${token}`} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
              Open the full client portal
            </a>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{meta.companyName}</p>
              <h1 className="font-display text-xl font-bold">Submit a request</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                For <span className="font-medium text-foreground">{meta.projectName}</span>
              </p>
            </div>
            <RequestForm token={token} compact onSubmitted={setResult} />
          </>
        )}
      </Card>
    </div>
  );
}
