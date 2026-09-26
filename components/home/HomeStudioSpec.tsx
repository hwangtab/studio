import React from 'react';
import Link from 'next/link';
import { ArrowRight } from '@/lib/lucide-icons';

export interface StudioSpaceItem {
  title: string;
  body: string;
}

export interface StudioGearRow {
  label: string;
  items: string[];
}

interface HomeStudioSpecProps {
  spaceTitle: string;
  space: StudioSpaceItem[];
  gearTitle: string;
  gear: StudioGearRow[];
  viewAllLabel: string;
  viewAllHref: string;
}

/**
 * 디자인 v2 홈 — 스튜디오 사진 아래 "공간"과 "대표 장비".
 *
 * 사진 캐러셀만으로는 무엇이 좋은지 말해 주지 않았다. 공간 문구는 운영자가 사실로 확인한
 * 것만 싣는다(2026-09-26: 부스·컨트롤룸 분리, 흡음·확산 처리). "최고" 같은 근거 없는 최상급은
 * 쓰지 않는다 — 표시광고법상 부당 광고가 될 수 있다. 장비는 data/equipment.ts에서 뽑아
 * 스튜디오 정보 페이지의 전체 목록과 갈라지지 않게 한다.
 */
const HomeStudioSpec = ({ spaceTitle, space, gearTitle, gear, viewAllLabel, viewAllHref }: HomeStudioSpecProps) => (
  <div className="mt-14 grid gap-12 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-16">
    <div>
      <h3 className="typo-eyebrow mb-5">{spaceTitle}</h3>
      <ul className="space-y-8">
        {space.map((item) => (
          <li key={item.title} className="border-t-2 border-gray-950 dark:border-white pt-4">
            <p className="font-title text-xl font-bold leading-snug text-gray-950 dark:text-white mb-2 break-keep">
              {item.title}
            </p>
            <p className="typo-card-body text-gray-600 dark:text-gray-300">{item.body}</p>
          </li>
        ))}
      </ul>
    </div>

    <div>
      <h3 className="typo-eyebrow mb-5">{gearTitle}</h3>
      {/* 장비 스펙시트 — 분류는 로케일 문구, 모델명은 원어 그대로 */}
      <dl className="border-t-2 border-gray-950 dark:border-white divide-y divide-gray-200 dark:divide-gray-800">
        {gear.map((row) => (
          <div key={row.label} className="grid grid-cols-[7rem_minmax(0,1fr)] sm:grid-cols-[9rem_minmax(0,1fr)] gap-x-4 py-3.5">
            <dt className="text-sm text-gray-600 dark:text-gray-300 break-keep">{row.label}</dt>
            <dd className="text-sm sm:text-base font-semibold text-gray-950 dark:text-white">
              {row.items.join(' · ')}
            </dd>
          </div>
        ))}
      </dl>
      <Link
        href={viewAllHref}
        prefetch={false}
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary dark:text-primary-lighter hover:underline underline-offset-4 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70"
      >
        {viewAllLabel}
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </div>
  </div>
);

export default HomeStudioSpec;
