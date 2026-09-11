import React from 'react';
import NextLink from 'next/link';
import { type Locale } from '../../lib/i18n';
import {
  PRACTICE_ROOM_MONTHLY_PRICE,
  RECORDING_HOURLY_PRICE,
} from '../../data/pricing';

interface PracticeRoomTermsProps {
  locale?: Locale;
}

const man = (won: number) => `${(won / 10000).toLocaleString()}만원`;

/**
 * 연습실 월세 입주 조건 요약.
 *
 * 16편의 본문에 같은 목록이 복붙돼 있던 것을 모았다. 금액은 문자열로 적지 않고
 * data/pricing.ts 상수에서 계산한다 — 요금이 바뀌면 여기도 자동으로 따라가고,
 * scripts/check-fact-consistency.mjs가 스토리 본문과 정본이 어긋나는 것을 잡는다.
 *
 * 조건 문구는 연습실 페이지(public/locales/ko/common.json practiceRoom) 정본과 같다:
 * 보증금 0 · 최소 계약 1개월 · 1년 계약 시 첫 달 50% 할인 · 매월 녹음실 1시간 무료.
 */
const PracticeRoomTerms: React.FC<PracticeRoomTermsProps> = ({ locale = 'ko' }) => {
  const rows: { label: string; body: string }[] = [
    { label: '월세', body: `${man(PRACTICE_ROOM_MONTHLY_PRICE)} (보증금 0원)` },
    { label: '최소 계약', body: '1개월' },
    { label: '1년 계약', body: `첫 달 50% 할인 (첫 달 ${man(PRACTICE_ROOM_MONTHLY_PRICE / 2)})` },
    { label: '장비 보관', body: '본인 장비는 무료로 두고 다닐 수 있습니다' },
    { label: '녹음실', body: `매월 1시간 무료 (정규요금 시간당 ${man(RECORDING_HOURLY_PRICE)})` },
  ];

  return (
    <div className="my-8 rounded-xl glass-card overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h4 className="text-base font-semibold text-gray-900 dark:text-white">월세 입주 조건</h4>
      </div>
      <dl className="px-6 py-4 space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="sm:flex sm:gap-4">
            <dt className="sm:w-24 shrink-0 text-sm font-medium text-gray-900 dark:text-white">{r.label}</dt>
            <dd className="text-sm text-gray-700 dark:text-gray-300">{r.body}</dd>
          </div>
        ))}
      </dl>
      <p className="px-6 pb-4 text-sm text-gray-600 dark:text-gray-400">
        방 상태와 남은 자리는{' '}
        <NextLink href={`/${locale}/practice-room`} prefetch={false} className="text-primary dark:text-primary-lighter hover:underline underline-offset-4">
          음악연습실 안내
        </NextLink>
        에서 확인하실 수 있습니다.
      </p>
    </div>
  );
};

export default PracticeRoomTerms;
