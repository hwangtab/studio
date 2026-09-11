import React from 'react';
import Link from 'next/link';
import { ArrowRight } from '@/lib/lucide-icons';
import { Section, SectionVariant } from '../ui/Section';

export type ServiceQuickLinkColor = 'primary' | 'secondary' | 'accent';

export interface ServiceQuickLink {
  href: string;
  label: string;
  color: ServiceQuickLinkColor;
}

interface ServiceQuickLinksSectionProps {
  links: ServiceQuickLink[];
  variant?: SectionVariant;
  className?: string;
}

// 서비스 5페이지가 각자 반복하던 "관련 서비스 바로가기" pill 목록의 공통 셸.
// prefetch={false}: 본문 fold 내 button pill들의 무거운 SSG JSON 자동 prefetch
// 방지. hover/focus 시 prefetch는 유지(next/link 기본 동작).
const COLOR_CLASS: Record<ServiceQuickLinkColor, string> = {
  primary: 'border-primary text-primary dark:text-primary-lighter font-semibold hover:bg-primary hover:text-white dark:hover:text-white',
  secondary: 'border-secondary text-secondary dark:text-secondary-light font-semibold hover:bg-secondary hover:text-white dark:hover:text-white',
  accent: 'border-accent text-accent dark:text-accent-light font-semibold hover:bg-accent hover:text-white dark:hover:text-white',
};

const ServiceQuickLinksSection = ({
  links,
  variant = 'alternate',
  className = 'py-10',
}: ServiceQuickLinksSectionProps) => (
  <Section variant={variant} className={className}>
    <div className="flex flex-wrap justify-center gap-4">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          prefetch={false}
          className={`inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 ${COLOR_CLASS[link.color]} transition-colors duration-200`}
        >
          {link.label} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      ))}
    </div>
  </Section>
);

export default ServiceQuickLinksSection;
