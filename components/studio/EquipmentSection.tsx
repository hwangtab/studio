import React from 'react';
import BaseCard from '../ui/BaseCard';

export interface EquipmentSectionProps {
    title: string;
    items: string[] | readonly string[];
    icon: React.ElementType;
}

const EquipmentSection = ({ title, items, icon: Icon }: EquipmentSectionProps) => {
    return (
        <BaseCard variant="default" hover className="mb-6">
            <h3 className="typo-card-title mb-4 flex items-center text-ink dark:text-on-dark">
                <Icon className="mr-2 text-primary dark:text-primary-light" size={20} aria-hidden="true" />
                {title}
            </h3>
            <ul className="grid gap-2">
                {items.map((item, index) => (
                    <li key={index} className="flex items-center typo-card-body text-ink-muted-80 dark:text-on-dark-soft">
                        <span className="w-2 h-2 bg-primary dark:bg-primary-light rounded-full mr-2 flex-shrink-0" aria-hidden="true"></span>
                        {item}
                    </li>
                ))}
            </ul>
        </BaseCard>
    );
};

export default EquipmentSection;
