import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import FundingMobileCta from './FundingMobileCta';
import KakaoFab from '../common/KakaoFab';

/**
 * 펀딩 상세의 전폭 하단 고정 바와 전역 카카오 FAB이 같은 우하단 자리를 두고 겹쳤다 —
 * FAB이 「후원하기」 버튼의 오른쪽 절반을 덮어, 모바일의 주 전환 경로가 반쯤 막혀 있었다.
 *
 * 원인은 두 겹이다.
 * 1. 두 요소가 **같은 z-40**이었다. 저장소의 규약은 "하단 바는 z-50, FAB은 z-40이라 그
 *    아래"인데(KakaoFab 주석) 이 바만 그걸 안 지켰다.
 * 2. FAB 억제가 `/funding/[slug]/pledge`에 걸려 있었는데, 정작 바를 쓰는 건
 *    `/funding/[slug]`(상세)다. 주석이 사실과 달라서 아무도 막지 않고 있었다.
 *
 * 두 조건 모두 눈으로만 확인되던 것이라 여기서 고정한다.
 */

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../utils/analytics', () => ({ trackLeadEvent: jest.fn() }));

const fabRoot = () => document.querySelector('div.fixed.right-6') as HTMLElement;

describe('하단 고정 바 ↔ 카카오 FAB 겹침', () => {
  it('하단 바는 z-50이라 FAB(z-40)보다 위에 온다', () => {
    const { container } = render(<FundingMobileCta visible />);
    const bar = container.querySelector('div.fixed') as HTMLElement;
    expect(bar.className).toContain('z-50');

    render(<KakaoFab locale="ko" />);
    expect(fabRoot().className).toContain('z-40');
  });

  it('바는 데스크톱에 없다 — lg:hidden', () => {
    const { container } = render(<FundingMobileCta visible />);
    expect((container.querySelector('div.fixed') as HTMLElement).className).toContain('lg:hidden');
  });

  it('suppressBelowLg면 FAB이 <lg에서 숨고 데스크톱에서는 남는다', () => {
    render(<KakaoFab locale="ko" suppressBelowLg />);
    const cls = fabRoot().className;
    expect(cls).toContain('hidden');
    expect(cls).toContain('lg:flex');
  });

  it('기본값에서는 FAB이 모든 폭에 뜬다 — 검증된 유일 전환 채널이라 함부로 걷어내지 않는다', () => {
    render(<KakaoFab locale="ko" />);
    const cls = fabRoot().className;
    expect(cls).toContain('flex');
    expect(cls).not.toContain('hidden');
  });

  it('바가 안 보이는 상태면 아무것도 렌더하지 않는다', () => {
    const { container } = render(<FundingMobileCta visible={false} />);
    expect(container.querySelector('div.fixed')).toBeNull();
    expect(screen.queryByText('후원하기')).toBeNull();
  });
});
