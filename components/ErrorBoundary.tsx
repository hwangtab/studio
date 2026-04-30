import React from 'react';
import i18n, { defaultLocale, type Locale } from '../lib/i18n';
import Section from './ui/Section';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  locale?: Locale;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const locale = this.props.locale || defaultLocale;
      const t = i18n.getFixedT(locale, 'common');
      return (
        <Section tone="canvas" className="min-h-screen flex items-center justify-center">
          <div className="text-center max-w-md mx-auto">
            <h1 className="font-display font-light text-display-md text-ink dark:text-on-dark mb-4">
              {t('errors.title')}
            </h1>
            <p className="text-lead text-ink-muted-60 dark:text-on-dark-soft mb-8">
              {t('errors.description')}
            </p>
            <a
              href={`/${locale}`}
              className="inline-flex h-12 px-6 items-center rounded-pill bg-ink text-white font-medium hover:bg-canvas-deep transition-all"
            >
              {t('nav.home')}
            </a>
          </div>
        </Section>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
