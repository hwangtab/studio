import React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { defaultLocale, type Locale } from '../../lib/i18n';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange?: (page: number) => void;
    getPageHref?: (page: number) => string;
    className?: string;
    locale?: Locale;
}

const Pagination = ({
    currentPage,
    totalPages,
    onPageChange,
    getPageHref,
    className = '',
    locale = defaultLocale,
}: PaginationProps) => {
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
    const renderNavigationItem = (
        targetPage: number,
        label: string,
        disabled: boolean,
        children: React.ReactNode
    ) => {
        const className = `flex items-center justify-center min-h-[44px] px-3 py-2 rounded-md text-sm font-medium transition-colors ${disabled
            ? 'text-gray-300 cursor-not-allowed dark:text-gray-600'
            : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'
            }`;

        if (disabled) {
            return (
                <span className={className} aria-disabled="true">
                    {children}
                </span>
            );
        }

        if (getPageHref) {
            return (
                <Link href={getPageHref(targetPage)} className={className} aria-label={label}>
                    {children}
                </Link>
            );
        }

        return (
            <button
                type="button"
                onClick={() => onPageChange?.(targetPage)}
                className={className}
                aria-label={label}
            >
                {children}
            </button>
        );
    };

    return (
        <nav className={`flex justify-center items-center space-x-2 ${className}`} aria-label="Pagination">
            {renderNavigationItem(currentPage - 1, t('pagination.previousPage'), currentPage === 1, (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
            ))}

            {pages.map((page) => (
                currentPage === page ? (
                    <span
                        key={page}
                        className="flex items-center justify-center min-h-[44px] px-4 py-2 rounded-md text-sm font-medium transition-colors bg-primary text-white pointer-events-none"
                        aria-current="page"
                    >
                        {page}
                    </span>
                ) : getPageHref ? (
                    <Link
                        key={page}
                        href={getPageHref(page)}
                        className="flex items-center justify-center min-h-[44px] px-4 py-2 rounded-md text-sm font-medium transition-colors text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                        {page}
                    </Link>
                ) : (
                    <button
                        key={page}
                        type="button"
                        onClick={() => onPageChange?.(page)}
                        className="flex items-center justify-center min-h-[44px] px-4 py-2 rounded-md text-sm font-medium transition-colors text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                        {page}
                    </button>
                )
            ))}

            {renderNavigationItem(currentPage + 1, t('pagination.nextPage'), currentPage === totalPages, (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
            ))}
        </nav>
    );
};

export default Pagination;
