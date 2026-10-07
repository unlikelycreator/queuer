import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Logo from '@/components/shared/Logo';

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_65%)]" />
      <Logo className="relative mb-10" />
      <div className="relative">
        <p className="font-display text-[110px] font-extrabold leading-none tracking-tighter text-gradient">404</p>
        <h1 className="mt-2 font-display text-2xl font-bold">This page wandered off</h1>
        <p className="mt-2 text-sm text-muted-foreground">The link may be broken, or the page may have been removed.</p>
        <Button asChild variant="gradient" className="mt-6">
          <Link to="/">
            <Compass /> Back to ZoopDesk
          </Link>
        </Button>
      </div>
    </div>
  );
}
