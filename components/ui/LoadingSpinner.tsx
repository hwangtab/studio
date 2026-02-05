import React from 'react';
import { useTranslation } from 'react-i18next';
import { defaultLocale, type Locale } from '../../lib/i18n';

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    containerClassName?: string;
    locale?: Locale;
}

const LoadingSpinner = ({
    size = 'md',
    className = '',
    containerClassName = 'container mx-auto px-4 pt-16 pb-12 flex justify-center items-center h-64',
    locale = defaultLocale,
}: LoadingSpinnerProps) => {
    const { t } = useTranslation('common', { lng: locale });
    const sizeClasses = {
        sm: 'w-6 h-6 border-2',
        md: 'w-12 h-12 border-4',
        lg: 'w-16 h-16 border-4',
    };

    return (
        <div className={containerClassName}>
            <div
                className={`${sizeClasses[size]} border-primary border-t-transparent rounded-full animate-spin ${className}`}
                role="status"
                aria-label={t('loading.default')}
            />
        </div>
    );
};

export default LoadingSpinner;
