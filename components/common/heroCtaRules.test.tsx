import fs from 'fs';
import path from 'path';
import React from 'react';
import { render } from '@testing-library/react';
import HeroKakaoCta from './HeroKakaoCta';
import { crowdfundingDesignCopy } from '../../data/crowdfundingDesign';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
jest.mock('../../utils/analytics', () => ({ trackMicroEvent: jest.fn(), trackLeadEvent: jest.fn() }));

/**
 * 히어로 CTA 규칙(docs/hero-cta-audit-2026-10.md, docs/design-system.md §4 "히어로 CTA").
 * 2026-10-09 전수 점검 전엔 히어로마다 버튼 수(1~2)·2차 목적지(전화·다른 페이지·돌아가기)가 제각각이었고,
 * 카톡으로 가는 버튼에 "예약하기"가 붙어 글자와 도착지가 달랐다(축가·성우·커버 — 온라인 예약은 따로 있다).
 */
const ko = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/locales/ko/common.json'), 'utf8'));

const KAKAO_LABELS: Array<[string, string]> = [
  ...['recording', 'voiceActing', 'coverVideo', 'weddingSong', 'practiceRoom', 'mixingMastering', 'lesson', 'compositionArrangement', 'musicPromotion'].map(
    (k): [string, string] => [`${k}.cta.inquiry`, ko[k].cta.inquiry],
  ),
  ['pricing.hero.ctaKakao', ko.pricing.hero.ctaKakao],
  ['releaseProject.hero.ctaConsult', ko.releaseProject.hero.ctaConsult],
  ['crowdfundingDesign hero.cta', crowdfundingDesignCopy.hero.cta],
];

describe('히어로 1차(카톡) 문구 — "카톡으로 …", 예약·신청이라 부르지 않는다', () => {
  it.each(KAKAO_LABELS)('%s: %s', (_key, label) => {
    expect(label).toMatch(/^카톡으로 /);
    expect(label).not.toMatch(/예약|신청/);
  });
});

describe('HeroKakaoCta — 버튼은 최대 둘, 전화는 버튼이 아니라 텍스트 줄', () => {
  it('secondary와 phone을 함께 줘도 버튼 모양 링크는 둘이다', () => {
    const { container } = render(
      <HeroKakaoCta
        locale="ko"
        kakaoUrl="https://pf.kakao.com/x"
        component="c"
        ctaId="hero"
        label="카톡으로 녹음 상담"
        phone="010-4255-7893"
        secondary={{ label: '온라인 예약하기', href: '/ko/booking/recording', ctaId: 'hero_book' }}
      />,
    );
    const links = [...container.querySelectorAll('a[href]')];
    const tel = links.filter((a) => a.getAttribute('href')!.startsWith('tel:'));
    const buttons = links.filter((a) => !a.getAttribute('href')!.startsWith('tel:'));
    expect(buttons).toHaveLength(2);
    expect(tel).toHaveLength(1);
    // 전화 줄은 버튼 면(배경색)을 갖지 않는다.
    expect(tel[0].className).not.toMatch(/\bbg-/);
  });
});

describe('히어로에 "돌아가기" 버튼이 없다 — 되돌아가기는 빵부스러기가 맡는다', () => {
  it.each(['components/release/TierPage.tsx', 'components/release/ReleaseHeroCtas.tsx', 'components/common/HeroKakaoCta.tsx', 'components/guides/BuyerIntentHubPage.tsx'])(
    '%s',
    (rel) => {
      const src = fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
      expect(src).not.toMatch(/돌아가기|backTo|ArrowLeft/);
    },
  );
});
