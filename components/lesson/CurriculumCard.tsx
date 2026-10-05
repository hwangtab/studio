import React from 'react';
import { CheckCircle } from '@/lib/lucide-icons';
import BaseCard from '../ui/BaseCard';
import { Badge } from '../ui/Badge';
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
    <BaseCard variant="default" delay={delay} padding="roomy" className="h-full relative overflow-hidden">
        {/* 모션은 BaseCard(리프트)가 소유한다 — 장식 숫자의 hover 스케일은 두지 않는다(§4). */}
        <div className="absolute top-0 right-0 p-4 opacity-10 font-bold text-6xl text-primary">
            {step}
        </div>
        <div className="relative z-10">
            <div className="bg-primary/10 dark:bg-primary/20 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 text-primary dark:text-primary-lighter">
                <Icon size={32} />
            </div>
            {phaseLabel && (
                <Badge tone="brand" size="md" className="mb-3 uppercase tracking-wide">
                    {phaseLabel}
                </Badge>
            )}
            <h3 className="typo-card-title mb-1">{title}</h3>
            <p className="text-sm font-semibold text-primary dark:text-primary-lighter mb-4">{subtitle}</p>
            <ul className="space-y-2">
                {description.map((item, idx) => (
                    <li key={idx} className="flex items-start typo-card-body text-body-2">
                        <CheckCircle size={14} className="mt-1 mr-2 text-primary dark:text-primary-lighter flex-shrink-0" aria-hidden="true" />
                        <span>{item}</span>
                    </li>
                ))}
            </ul>
        </div>
    </BaseCard>
);

export default CurriculumCard;
