import React from 'react';
import { useTranslation } from 'react-i18next';
import { defaultLocale, type Locale } from '../../lib/i18n';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    className?: string;
    locale?: Locale;
}

const Pagination = ({ currentPage, totalPages, onPageChange, className = '', locale = defaultLocale }: PaginationProps) => {
    const { t } = useTranslation('common', { lng: locale });
    if (totalPages <= 1) return null;

    const getPageNumbers = () => {
        const pageNumbers = [];
        const maxVisiblePages = 5;

        if (totalPages <= maxVisiblePages) {
            for (let i = 1; i <= totalPages; i++) {
                pageNumbers.push(i);
            }
        } else {
            let startPage = Math.max(1, currentPage - 2);
            let endPage = Math.min(totalPages, currentPage + 2);

            if (currentPage <= 3) {
                startPage = 1;
                endPage = 5;
            } else if (currentPage >= totalPages - 2) {
                startPage = totalPages - 4;
                endPage = totalPages;
            }

            for (let i = startPage; i <= endPage; i++) {
                pageNumbers.push(i);
            }
        }
        return pageNumbers;
    };

    const pages = getPageNumbers();

    return (
        <nav className={`flex items-center justify-center gap-2 ${className}`} aria-label="Pagination">
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`flex items-center justify-center min-h-[44px] min-w-[44px] px-3 rounded-pill font-medium transition-colors touch-manipulation
          ${currentPage === 1
                        ? 'border border-hairline-strong text-ink dark:border-white/20 dark:text-on-dark opacity-50 cursor-not-allowed'
                        : 'border border-hairline-strong text-ink hover:bg-ink/[0.04] dark:border-white/20 dark:text-on-dark dark:hover:bg-white/[0.06]'
                    }`}
                aria-label={t('pagination.previousPage')}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
            </button>

            {pages.map((page) => (
                <button
                    key={page}
                    onClick={() => onPageChange(page)}
                    className={`flex items-center justify-center min-h-[44px] min-w-[44px] px-3 rounded-pill font-medium transition-colors touch-manipulation
            ${currentPage === page
                            ? 'bg-ink text-white pointer-events-none dark:bg-white dark:text-ink'
                            : 'border border-hairline-strong text-ink hover:bg-ink/[0.04] dark:border-white/20 dark:text-on-dark dark:hover:bg-white/[0.06]'
                        }`}
                    aria-current={currentPage === page ? 'page' : undefined}
                >
                    {page}
                </button>
            ))}

            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`flex items-center justify-center min-h-[44px] min-w-[44px] px-3 rounded-pill font-medium transition-colors touch-manipulation
          ${currentPage === totalPages
                        ? 'border border-hairline-strong text-ink dark:border-white/20 dark:text-on-dark opacity-50 cursor-not-allowed'
                        : 'border border-hairline-strong text-ink hover:bg-ink/[0.04] dark:border-white/20 dark:text-on-dark dark:hover:bg-white/[0.06]'
                    }`}
                aria-label={t('pagination.nextPage')}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
            </button>
        </nav>
    );
};

export default Pagination;
