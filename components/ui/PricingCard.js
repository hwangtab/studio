import React from 'react';
import { Check } from 'lucide-react';
import BaseCard from './BaseCard';

const PricingCard = ({ id, title, price, unit, description, features, recommended, delay }) => {
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
            <h3 className="typo-card-title font-bold text-gray-800 dark:text-white mb-2">{title}</h3>
            <div className="flex items-baseline mb-4">
                <span className="text-3xl font-extrabold text-primary dark:text-primary-light">{price}</span>
                {unit && <span className="text-gray-500 dark:text-gray-400 ml-1 text-sm">{unit}</span>}
            </div>
            <p className="typo-card-body text-gray-600 dark:text-gray-300 mb-6 min-h-[96px]">{description}</p>

            <div className="border-t border-gray-100 dark:border-gray-700 my-4"></div>

            <ul className="space-y-3 flex-grow">
                {features.map((feature, index) => (
                    <li key={index} className="flex items-start text-sm text-gray-600 dark:text-gray-300">
                        <Check className="text-green-500 mt-1 mr-2 flex-shrink-0" size={14} />
                        <span>{feature}</span>
                    </li>
                ))}
            </ul>
        </BaseCard>
    );
};

export default PricingCard;
