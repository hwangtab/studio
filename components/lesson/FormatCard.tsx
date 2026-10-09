import React from 'react';
import BaseCard from '../ui/BaseCard';
import type { LucideIcon } from '@/lib/lucide-icons';

export interface FormatCardProps {
    icon: LucideIcon;
    label: string;
    value: string;
    caption: string;
}

const FormatCard = ({ icon: Icon, label, value, caption }: FormatCardProps) => (
    <BaseCard variant="default" padding="default" className="h-full">
        <div className="flex items-start gap-4">
            <div className="bg-gray-100 dark:bg-gray-800 w-12 h-12 rounded-xl flex items-center justify-center text-gray-700 dark:text-gray-300 flex-shrink-0">
                <Icon size={24} aria-hidden="true" />
            </div>
            <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 tracking-wide uppercase mb-1">{label}</p>
                <p className="typo-card-title mb-1 break-keep">{value}</p>
                <p className="text-body-2 text-gray-600 dark:text-gray-300 break-keep">{caption}</p>
            </div>
        </div>
    </BaseCard>
);

export default FormatCard;
