import React from 'react';
import i18n, { defaultLocale, type Locale } from '../lib/i18n';

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
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
          <div className="text-center max-w-md">
            <h1 className="text-heading-2 font-title text-gray-900 dark:text-white mb-4">
              {t('errors.title')}
            </h1>
            <p className="typo-section-lead text-gray-600 dark:text-gray-300 mb-8">
              {t('errors.description')}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors"
            >
              {t('actions.reload')}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
