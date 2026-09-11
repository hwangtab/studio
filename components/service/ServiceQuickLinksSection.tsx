import React from 'react';
import ServiceLinkPill, { type ServiceLinkTone } from '../ui/ServiceLinkPill';
import { Section, SectionVariant } from '../ui/Section';

export interface ServiceQuickLink {
  href: string;
  label: string;
  color: ServiceLinkTone;
}

interface ServiceQuickLinksSectionProps {
  links: ServiceQuickLink[];
  variant?: SectionVariant;
  className?: string;
}

// 서비스 5페이지가 각자 반복하던 "관련 서비스 바로가기" pill 목록의 공통 셸.
// pill 자체(색 3규칙·prefetch={false}·포커스 링·44px 타깃)는 ServiceLinkPill이 소유한다.
const ServiceQuickLinksSection = ({
  links,
  variant = 'alternate',
  className = 'py-10',
}: ServiceQuickLinksSectionProps) => (
  <Section variant={variant} className={className}>
    <div className="flex flex-wrap justify-center gap-4">
      {links.map((link) => (
        <ServiceLinkPill key={link.href} href={link.href} tone={link.color}>
          {link.label}
        </ServiceLinkPill>
      ))}
    </div>
  </Section>
);

export default ServiceQuickLinksSection;
