import React from 'react';

export interface PhaseHeaderProps {
    label: string;
    title: string;
    caption: string;
}

const PhaseHeader = ({ label, title, caption }: PhaseHeaderProps) => (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2 mb-6 border-l-4 border-primary pl-4">
        <div>
            <span className="inline-block text-xs font-bold tracking-widest uppercase text-primary dark:text-primary-lighter mb-1">{label}</span>
            <h3 className="typo-card-title">{title}</h3>
        </div>
        <p className="text-body-2 text-gray-600 dark:text-gray-300 md:text-right break-keep max-w-lg">{caption}</p>
    </div>
);

export default PhaseHeader;
