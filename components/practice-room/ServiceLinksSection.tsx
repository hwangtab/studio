import React from 'react';
import Link from 'next/link';
import { ArrowRight } from '@/lib/lucide-icons';
import type { Locale } from '../../lib/i18n';
import { Section } from '../ui/Section';

interface ServiceLinkItem {
  href: string;
  label: string;
  className: string;
}

interface ServiceLinksSectionProps {
  locale: Locale;
  labels: {
    lesson: string;
    pricing: string;
    stories: string;
    contact: string;
  };
}

const ServiceLinksSection = ({ locale, labels }: ServiceLinksSectionProps) => {
  const serviceLinks: ServiceLinkItem[] = [
    {
      href: `/${locale}/lesson`,
      label: labels.lesson,
      className: 'border-primary text-primary hover:bg-primary',
    },
    {
      href: `/${locale}/pricing`,
      label: labels.pricing,
      className: 'border-secondary text-secondary hover:bg-secondary',
    },
    {
      href: `/${locale}/stories`,
      label: labels.stories,
      className: 'border-accent text-accent hover:bg-accent',
    },
    {
      href: `/${locale}/contact`,
      label: labels.contact,
      className: 'border-primary text-primary hover:bg-primary',
    },
  ];

  return (
    <Section variant="alternate" spacing="tight" defer>
      <div className="flex flex-wrap justify-center gap-4">
        {serviceLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            prefetch={false}
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 font-semibold hover:text-white transition-colors duration-200 ${link.className}`}
          >
            {link.label} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        ))}
      </div>
    </Section>
  );
};

export default ServiceLinksSection;
