import React from 'react';
import Link from 'next/link';
import { MapPin } from '@/lib/lucide-icons';
import { PRACTICE_ROOM_REGION_LPS, PRACTICE_ROOM_REGION_GROUP_LABELS } from '../../data/practiceRoomRegionLPs';
import type { Locale } from '../../lib/i18n';
import SectionHeading from '../ui/SectionHeading';
import { Section } from '../ui/Section';

interface RegionLinksSectionProps {
  locale: Locale;
}

const RegionLinksSection = ({ locale }: RegionLinksSectionProps) => {
  if (locale !== 'ko') {
    return null;
  }

  return (
    <Section variant="alternate" spacing="tight" defer>
      <div className="max-w-5xl mx-auto">
        <SectionHeading
          icon={MapPin}
          title="지역별 음악연습실 안내"
          className="mb-2"
        />
        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mb-3">
          연신내 동명여고 옆 — 인근 21개 지역에서의 동선·거리 한눈에
        </p>
        <p className="text-center text-xs text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
          연신내 · 불광 · 대조동 · 녹번 · 독바위 · 구산 · 역촌 · 응암 · 새절 · 증산 · 상암 · 서대문 · 구파발 · 지축 · 삼송 · 원흥 · 원당 · 덕양구 · 고양시 · 일산 · 은평구
        </p>
        <div className="space-y-6">
          {(['walk', 'eunpyeong', 'seodaemun', 'goyang'] as const).map((group) => {
            const items = PRACTICE_ROOM_REGION_LPS.filter((lp) => lp.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group}>
                <h3 className="text-sm font-bold text-primary dark:text-primary-lighter mb-3 uppercase tracking-wide">
                  {PRACTICE_ROOM_REGION_GROUP_LABELS[group]}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {items.map((lp) => (
                    <Link
                      key={lp.slug}
                      href={`/${locale}/stories/${lp.slug}`}
                      prefetch={false}
                      className="group block px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary-light hover:shadow-md transition-all duration-200"
                    >
                      <div className="font-semibold text-gray-900 dark:text-white group-hover:text-primary dark:group-hover:text-primary-lighter transition-colors">
                        {lp.region} 음악연습실
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {lp.distance}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Section>
  );
};

export default RegionLinksSection;
