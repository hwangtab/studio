import React from 'react';
import type { Locale } from '../../lib/i18n';
import ServiceLinkPill, { type ServiceLinkTone } from '../ui/ServiceLinkPill';
import { Section } from '../ui/Section';

interface ServiceLinkItem {
  href: string;
  label: string;
  tone: ServiceLinkTone;
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
    { href: `/${locale}/lesson`, label: labels.lesson, tone: 'primary' },
    { href: `/${locale}/pricing`, label: labels.pricing, tone: 'secondary' },
    { href: `/${locale}/stories`, label: labels.stories, tone: 'accent' },
    { href: `/${locale}/contact`, label: labels.contact, tone: 'primary' },
  ];

  return (
    <Section variant="alternate" spacing="tight" defer>
      <div className="flex flex-wrap justify-center gap-4">
        {serviceLinks.map((link) => (
          <ServiceLinkPill key={link.href} href={link.href} tone={link.tone}>
            {link.label}
          </ServiceLinkPill>
        ))}
      </div>
    </Section>
  );
};

export default ServiceLinksSection;
