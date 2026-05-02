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
            <h3 className="text-title-md text-ink dark:text-on-dark font-medium mb-4 flex items-center">
                <Icon className="mr-2 text-ink-muted-60 dark:text-on-dark-soft" size={20} aria-hidden="true" />
                {title}
            </h3>
            <ul className="grid gap-2">
                {items.map((item, index) => (
                    <li key={index} className="flex items-center text-[15px] text-ink-muted-80 dark:text-on-dark-soft leading-[1.6]">
                        <span className="w-2 h-2 bg-ink-muted-40 dark:bg-on-dark-soft rounded-full mr-2 flex-shrink-0" aria-hidden="true"></span>
                        {item}
                    </li>
                ))}
            </ul>
        </BaseCard>
    );
};

export default EquipmentSection;
