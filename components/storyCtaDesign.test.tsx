import fs from 'fs';
import path from 'path';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import StoryCTA from './StoryCTA';
import { STORY_CTA, STORY_CTA_SECONDARY_PATH, type CTAType } from '../lib/storyCta';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
jest.mock('../utils/analytics', () => ({ trackMicroEvent: jest.fn() }));

/**
 * 스토리 CTA 기준(docs/design-system.md §4 "스토리 CTA") — 카테고리는 색이 아니라 내용으로만 갈린다.
 * 2026-10-09 이전엔 유형마다 보라·주황·청록·남색·빨강·자주 그라디언트가 따로 있었고, 하단 고정 바·예약 콜아웃은
 * 판매 안내에 경고(앰버) 톤을 썼다. 색은 토큰(primary·kakao·gray·white)에서만 온다.
 */
const FILES = [
  'components/StoryCTA.tsx',
  'lib/storyCta.ts',
  'components/inline/StickyBottomCTA.tsx',
  'components/inline/InlineBookingCallout.tsx',
  'components/inline/InlinePriceCallout.tsx',
  'components/inline/InlineServiceCallout.tsx',
  'components/inline/InlineReviewCallout.tsx',
  'components/ui/RelatedPortfolioInline.tsx',
  'components/common/ContactCTA.tsx',
];
const PALETTE = /\b(?:bg|text|border|ring|ring-offset|from|to|via|fill|stroke|shadow)-(?:purple|indigo|violet|fuchsia|pink|rose|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue)-\d{2,3}\b/g;
const DECOR = /\bbg-gradient-to-[a-z]+\b|\bblur-(?:sm|md|lg|xl|2xl|3xl)\b|repeat:\s*Infinity|initial:\s*\{\s*opacity:\s*0/g;
/** 별점은 관례상 금색이다 — 판매 신호가 아니다. */
const ALLOW = new Set(['components/inline/InlineReviewCallout.tsx:text-amber-500', 'components/inline/InlineReviewCallout.tsx:fill-amber-500']);

describe('스토리 CTA 기준 — 색은 토큰에서만, 장식 없음', () => {
  it.each(FILES)('%s에 팔레트 색·그라디언트·흐림·무한 애니메이션이 없다', (rel) => {
    const src = fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
    const hits = [...(src.match(PALETTE) ?? []), ...(src.match(DECOR) ?? [])].filter((h) => !ALLOW.has(`${rel}:${h}`));
    expect(hits).toEqual([]);
  });
});

describe('StoryCTA — 유형이 달라도 모양은 하나', () => {
  const types = Object.keys(STORY_CTA) as CTAType[];

  it('여섯 유형 모두 같은 바깥 클래스로 그려진다', () => {
    const classes = types.map((type) => {
      const { container } = render(<StoryCTA type={type} locale="ko" />);
      const cls = (container.firstElementChild as HTMLElement).className;
      cleanup();
      return cls;
    });
    expect(new Set(classes).size).toBe(1);
  });

  it.each(types)('%s: 주 버튼은 서비스 LP, 보조 버튼은 /contact', (type) => {
    render(<StoryCTA type={type} locale="ko" />);
    expect(screen.getByRole('link', { name: `stories.cta.${type}.primaryText` }).getAttribute('href')).toBe(`/ko${STORY_CTA[type].primaryPath}`);
    expect(screen.getByRole('link', { name: `stories.cta.${type}.secondaryText` }).getAttribute('href')).toBe(`/ko${STORY_CTA_SECONDARY_PATH}`);
  });
});
