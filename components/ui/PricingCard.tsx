import React from 'react';
import { Check } from 'lucide-react';
import BaseCard from './BaseCard';
import GradientOrb from './GradientOrb';
import { Button } from './Button';

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

const PricingCard = ({ title, price, unit, description, features, recommended, ctaLabel, ctaHref }: PricingCardProps) => {
    return (
        <BaseCard
            className={`p-8 h-full flex flex-col${recommended ? ' relative overflow-hidden' : ''}`}
            variant={recommended ? 'featured' : 'default'}
            hover={true}
        >
            {recommended && (
                <>
                    <GradientOrb color="mint" size={200} opacity={0.3} blur={60} style={{ top: 0, right: 0 }} />
                    <div className="absolute top-0 right-0 bg-ink text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-hero">
                        RECOMMENDED
                    </div>
                </>
            )}
            <h3 className="text-title-md text-ink dark:text-on-dark mb-2">{title}</h3>
            <div className="flex items-baseline mb-4">
                <span className="font-display font-light text-display-xl text-ink dark:text-on-dark">{price}</span>
                {unit && <span className="text-ink-muted-60 dark:text-on-dark-soft ml-1">{unit}</span>}
            </div>
            <p className="text-ink-muted-80 dark:text-on-dark-soft leading-[1.6] mb-6">{description}</p>

            <div className="border-t border-hairline dark:border-white/10 my-4"></div>

            <ul className="space-y-3 flex-grow">
                {features.map((feature, index) => (
                    <li key={index} className="flex items-start text-ink-muted-80 dark:text-on-dark-soft leading-[1.6]">
                        <Check className="text-ink dark:text-on-dark mt-1 mr-2 flex-shrink-0" size={14} aria-hidden="true" />
                        <span>{feature}</span>
                    </li>
                ))}
            </ul>

            {ctaLabel && ctaHref && (
                <a
                    href={ctaHref}
                    target={ctaHref.startsWith('http') ? '_blank' : undefined}
                    rel={ctaHref.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className="mt-6 block"
                >
                    <Button variant={recommended ? 'primary' : 'outline'} fullWidth>
                        {ctaLabel}
                    </Button>
                </a>
            )}
        </BaseCard>
    );
};

export default PricingCard;
