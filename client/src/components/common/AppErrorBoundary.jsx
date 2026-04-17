import React from "react";

import { Button } from "../ui/Button";

export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("Frontend error boundary caught an error", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-hero-mesh px-4">
          <div className="panel max-w-lg p-8 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand-600">Frontend error</p>
            <h1 className="mt-3 font-display text-3xl font-bold text-ink">Something went off track</h1>
            <p className="mt-3 text-sm text-slate-500">
              Refresh the page to recover. If the problem continues, inspect the browser console and API health.
            </p>
            <div className="mt-6">
              <Button onClick={() => window.location.reload()}>Refresh app</Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
