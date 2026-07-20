import React from 'react';
import { CheckCircle } from '@/lib/lucide-icons';
import BaseCard from '../ui/BaseCard';
import type { LucideIcon } from '@/lib/lucide-icons';

export interface CurriculumCardProps {
    step: string;
    title: string;
    subtitle: string;
    phaseLabel?: string;
    description: string[];
    icon: LucideIcon;
    delay?: number;
}

const CurriculumCard = ({ step, title, subtitle, phaseLabel, description, icon: Icon, delay = 0 }: CurriculumCardProps) => (
    <BaseCard variant="default" delay={delay} className="p-8 h-full relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10 font-bold text-6xl text-primary transition-transform group-hover:scale-110">
            {step}
        </div>
        <div className="relative z-10">
            <div className="bg-primary/10 dark:bg-primary/20 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 text-primary dark:text-primary-light">
                <Icon size={32} />
            </div>
            {phaseLabel && (
                <span className="inline-block mb-3 px-3 py-1 rounded-full bg-primary/10 dark:bg-primary/20 text-xs font-bold text-primary tracking-wide uppercase">
                    {phaseLabel}
                </span>
            )}
            <h3 className="typo-card-title mb-1">{title}</h3>
            <p className="text-sm font-semibold text-primary mb-4">{subtitle}</p>
            <ul className="space-y-2">
                {description.map((item, idx) => (
                    <li key={idx} className="flex items-start typo-card-body text-body-2">
                        <CheckCircle size={14} className="mt-1 mr-2 text-primary flex-shrink-0" aria-hidden="true" />
                        <span>{item}</span>
                    </li>
                ))}
            </ul>
        </div>
    </BaseCard>
);

export default CurriculumCard;
