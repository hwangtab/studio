import { render, screen, fireEvent } from '@testing-library/react';
import BaseCard from './BaseCard';

// jsdom은 PointerEvent를 전역에 정의하지 않는다(실제 브라우저는 전부 지원 —
// BaseCard가 이미 onPointerEnter/onPointerMove로 의존하고 있다). 테스트 환경에만 필요.
const globalWithPointerEvent = globalThis as typeof globalThis & { PointerEvent?: typeof PointerEvent };
if (typeof globalWithPointerEvent.PointerEvent === 'undefined') {
  globalWithPointerEvent.PointerEvent = MouseEvent as unknown as typeof PointerEvent;
}

describe('BaseCard', () => {
  it('target="_blank" 링크는 클릭 시 합성 pointerleave를 보내 hover 리프트를 되돌린다', async () => {
    // 새 탭이 열리면 원래 탭에는 pointerleave가 오지 않아 whileHover 리프트가 클릭 뒤에도
    // 얼어붙는다(2026-09-30 실측: about.tsx 카카오톡·네이버 지도 카드, 목자르기 출연진
    // 카드에서 재현). dispatchEvent를 감시해 합성 이벤트가 실제로 나가는지만 검증한다 —
    // framer-motion의 실제 애니메이션 재생은 jsdom에서 신뢰성 있게 관찰할 수 없다.
    render(
      <BaseCard href="https://example.com" target="_blank">
        내용
      </BaseCard>
    );
    const link = screen.getByRole('link');
    const dispatchSpy = jest.spyOn(link, 'dispatchEvent');

    fireEvent.click(link);
    dispatchSpy.mockClear(); // click 자신이 낸 dispatchEvent 호출은 제외하고 본다

    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'pointerleave' }));
  });

  it('target 없는 링크는 클릭해도 합성 pointerleave를 보내지 않는다', async () => {
    const onClick = jest.fn();
    render(
      <BaseCard href="/internal" onClick={onClick}>
        내용
      </BaseCard>
    );
    const link = screen.getByRole('link');
    const dispatchSpy = jest.spyOn(link, 'dispatchEvent');

    fireEvent.click(link);
    dispatchSpy.mockClear();

    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(onClick).toHaveBeenCalled();
    expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'pointerleave' }));
  });

  it('href·onClick이 없으면 클릭 불가능한 카드로 렌더한다', () => {
    const { container } = render(<BaseCard>내용</BaseCard>);
    expect(container.querySelector('a')).toBeNull();
    expect(container.querySelector('button')).toBeNull();
  });

  // padding은 세 단(§3)이고 기본은 none — 소비처 className의 p-*를 조용히 덮지 않는다.
  it.each([
    ['none', undefined, null],
    ['compact', 'compact', 'p-4'],
    ['default', 'default', 'p-6'],
    ['roomy', 'roomy', 'p-6 sm:p-8'],
  ] as const)('padding=%s 는 정해진 클래스만 더한다', (_label, padding, expected) => {
    const { container } = render(<BaseCard padding={padding}>내용</BaseCard>);
    const cls = (container.firstElementChild as HTMLElement).className;
    if (expected === null) {
      expect(cls).not.toMatch(/(^|\s)p-\d/);
    } else {
      for (const token of expected.split(' ')) expect(cls.split(/\s+/)).toContain(token);
    }
  });

  it('호출부 className의 패딩 조정이 padding prop을 이긴다(twMerge)', () => {
    const { container } = render(
      <BaseCard padding="default" className="pt-8">
        내용
      </BaseCard>
    );
    const cls = (container.firstElementChild as HTMLElement).className.split(/\s+/);
    expect(cls).toContain('p-6');
    expect(cls).toContain('pt-8');
  });
});
