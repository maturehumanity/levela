import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  message: string | null;
};

function sanitizeKnownLocalStorageKeys() {
  if (typeof window === 'undefined') return;

  const keysToValidateAsJson = [
    'customPillarCustomizations',
  ];

  keysToValidateAsJson.forEach((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return;
    try {
      JSON.parse(raw);
    } catch {
      window.localStorage.removeItem(key);
    }
  });
}

export class AppCrashBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    message: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || 'Unknown error',
    };
  }

  componentDidMount() {
    sanitizeKnownLocalStorageKeys();
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught app error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetLocalCache = () => {
    if (typeof window === 'undefined') return;

    const safePrefixes = [
      'levela-',
      'customPillar',
      'sb-',
    ];

    const keysToRemove = Object.keys(window.localStorage).filter((key) =>
      safePrefixes.some((prefix) => key.startsWith(prefix)),
    );

    keysToRemove.forEach((key) => window.localStorage.removeItem(key));
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
        <div className="w-full max-w-md rounded-3xl border border-border/70 bg-card/80 p-6 space-y-4">
          <h1 className="text-xl font-semibold">Levela hit a startup issue</h1>
          <p className="text-sm text-muted-foreground">
            We can recover safely by reloading, or resetting local cache if needed.
          </p>
          {this.state.message && (
            <p className="text-xs text-muted-foreground break-words">
              Error: {this.state.message}
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
              onClick={this.handleReload}
            >
              Reload app
            </button>
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-border px-4 text-sm font-medium"
              onClick={this.handleResetLocalCache}
            >
              Reset local cache
            </button>
          </div>
        </div>
      </div>
    );
  }
}

