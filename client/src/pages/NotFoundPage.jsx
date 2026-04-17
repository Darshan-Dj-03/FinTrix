import { Link } from "react-router-dom";

import { Button } from "../components/ui/Button";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-hero-mesh px-4">
      <div className="panel max-w-lg p-8 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand-600">404</p>
        <h1 className="mt-3 font-display text-4xl font-bold text-ink">Page not found</h1>
        <p className="mt-3 text-sm text-slate-500">The page you requested isn’t available in this workspace.</p>
        <div className="mt-6">
          <Link to="/">
            <Button>Go to dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
