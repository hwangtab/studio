import React from 'react';
import { Check } from '@/lib/lucide-icons';
import BaseCard from './BaseCard';

interface PricingCardProps {
    id: string;
    title: string;
    price: string;
    unit?: string;
    description: string;
    features: string[];
    recommended?: boolean;
    delay?: number;
    ctaLabel?: string;
    ctaHref?: string;
}

const PricingCard = ({ title, price, unit, description, features, recommended, delay, ctaLabel, ctaHref }: PricingCardProps) => {
    return (
        <BaseCard
            className="p-8 h-full flex flex-col"
            delay={delay}
            variant={recommended ? 'highlight' : 'default'}
            hoverEffect={true}
        >
            {recommended && (
                <div className="absolute top-0 right-0 bg-primary text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">
                    RECOMMENDED
                </div>
            )}
            <h3 className="typo-card-title mb-2">{title}</h3>
            <div className="flex items-baseline mb-4">
                <span className="text-3xl font-extrabold text-primary dark:text-primary-light">{price}</span>
                {unit && <span className="text-gray-500 dark:text-gray-400 ml-1 text-sm">{unit}</span>}
            </div>
            <p className="typo-card-body mb-6">{description}</p>

            <div className="border-t border-gray-100 dark:border-gray-700 my-4"></div>

            <ul className="space-y-3 flex-grow">
                {features.map((feature, index) => (
                    <li key={index} className="flex items-start text-sm text-gray-600 dark:text-gray-300">
                        <Check className="text-green-500 mt-1 mr-2 flex-shrink-0" size={14} aria-hidden="true" />
                        <span>{feature}</span>
                    </li>
                ))}
            </ul>

            {ctaLabel && ctaHref && (
                <a
                    href={ctaHref}
                    target={ctaHref.startsWith('http') ? '_blank' : undefined}
                    rel={ctaHref.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className="mt-6 block w-full text-center py-3 px-4 rounded-lg font-semibold text-sm transition-colors bg-primary hover:bg-primary-dark text-white"
                >
                    {ctaLabel}
                </a>
            )}
        </BaseCard>
    );
};

export default PricingCard;
