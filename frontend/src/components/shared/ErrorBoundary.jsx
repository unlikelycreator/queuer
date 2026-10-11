import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Catches render errors so one broken widget never blanks the whole app. */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('UI error:', error, info);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    // A new deploy can invalidate lazily-loaded chunks — a reload fixes that.
    const chunkError = /Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
      String(this.state.error?.message)
    );
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h2 className="font-display text-xl font-bold">{chunkError ? 'A new version is available' : 'Something went wrong'}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {chunkError ? 'Reload the page to get the latest version of Queuer.' : 'This part of the page failed to load. Try again — if it keeps happening, let your admin know.'}
          </p>
          <Button className="mt-5" variant="gradient" onClick={() => (chunkError ? window.location.reload() : this.setState({ error: null }))}>
            <RotateCcw /> {chunkError ? 'Reload' : 'Try again'}
          </Button>
        </div>
      </div>
    );
  }
}
