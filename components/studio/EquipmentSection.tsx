import { m } from 'framer-motion';
import React from 'react';
import { createFadeInAnimation } from '../../utils/animationUtils';

export interface EquipmentSectionProps {
    title: string;
    items: string[] | readonly string[];
    icon: React.ElementType;
}

const EquipmentSection = ({ title, items, icon: Icon }: EquipmentSectionProps) => {
    const motionProps = createFadeInAnimation();

    return (
        <m.div
            className="glass-card p-6 rounded-lg mb-6"
            {...motionProps}
        >
            <h3 className="typo-card-title mb-4 flex items-center">
                <Icon className="mr-2 text-primary dark:text-primary-lighter" size={20} aria-hidden="true" />
                {title}
            </h3>
            <ul className="grid gap-2">
                {items.map((item, index) => (
                    <li key={index} className="flex items-center typo-card-body">
                        <span className="w-2 h-2 bg-primary dark:bg-primary-light rounded-full mr-2" aria-hidden="true"></span>
                        {item}
                    </li>
                ))}
            </ul>
        </m.div>
    );
};

export default EquipmentSection;
