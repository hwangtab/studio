import { render } from '@testing-library/react';

import RewardCard from './RewardCard';
import { imageAspectRatio } from '../../lib/funding/imageAspect';

/**
 * 리워드 썸네일은 **그림의 실제 비율**로 뜬다.
 *
 * 예전에는 16:9 틀에 `object-cover`로 밀어 넣었다. 이 프로젝트의 리워드는 정사각 앨범
 * 표지라, 그대로 두면 위아래가 잘려 그림이 무엇인지 알 수 없다. 게다가 정작 어느 리워드에도
 * `image`를 넣지 않아 **썸네일 자리가 통째로 비어 있었다** — 자리를 만들어 두고 채우지 않은
 * 상태로 배포돼 있었다.
 *
 * 비율은 인라인 스타일로 넘긴다(Tailwind `aspect-[…]`는 빌드 때 클래스를 보고 만들어
 * 런타임 값에 적용되지 않는다). **jsdom은 `aspect-ratio`를 CSSOM에서 버리므로** 화면에서
 * 읽어 확인할 수 없다 — 그래서 컴포넌트에 넘어가는 값을 직접 본다.
 */
const captured: Array<Record<string, unknown>> = [];
jest.mock('../ResponsiveImage', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    captured.push(props);
    return <img alt="" src={String(props.src)} />;
  },
}));

const reward = {
  id: 'cd', title: 'CD', description: '설명', amount: 30000, totalQuantity: 10,
  requiresShipping: false, estimatedDelivery: '2026-12', image: null as string | null, downloads: [],
};

beforeEach(() => { captured.length = 0; });

describe('imageAspectRatio', () => {
  it('앨범 표지는 정사각이다 — 메타데이터에서 읽는다', () => {
    expect(imageAspectRatio('/images/funding/keep-singing-for-palestine/album.webp')).toBe('800 / 800');
  });

  it('모르는 그림·빈 값은 null — 호출부가 예전 비율로 떨어진다', () => {
    expect(imageAspectRatio('/images/does-not-exist.webp')).toBeNull();
    expect(imageAspectRatio(null)).toBeNull();
  });
});

describe('리워드 카드의 썸네일', () => {
  const card = (image: string | null) =>
    render(<RewardCard reward={{ ...reward, image }} remaining={3} pledgeHref="/x" canPledge />);

  it('정사각 앨범 표지를 16:9로 자르지 않는다', () => {
    card('/images/funding/keep-singing-for-palestine/album.webp');
    expect(captured[0].containerStyle).toEqual({ aspectRatio: '800 / 800' });
    // 틀을 고정하던 클래스는 남아 있으면 안 된다 — 남으면 인라인 값과 싸운다.
    expect(String(captured[0].containerClassName)).not.toContain('aspect-');
  });

  it('비율을 모르는 그림은 예전대로 16:9', () => {
    card('/images/does-not-exist.webp');
    expect(captured[0].containerStyle).toEqual({ aspectRatio: '16 / 9' });
  });

  it('이미지가 없으면 썸네일을 그리지 않는다', () => {
    card(null);
    expect(captured).toHaveLength(0);
  });
});
