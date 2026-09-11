import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { Button, buttonVariants } from './Button';

describe('Button', () => {
  it('기본은 button 엘리먼트를 렌더한다', () => {
    render(<Button>보내기</Button>);
    expect(screen.getByRole('button', { name: '보내기' })).toBeInTheDocument();
  });

  it('asChild면 자식 엘리먼트를 렌더하고 클래스를 합성한다', () => {
    render(
      <Button asChild variant="kakao" shape="pill">
        <a href="https://open.kakao.com/x" data-cta="k">카카오톡 문의</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: '카카오톡 문의' });
    expect(link).toHaveAttribute('href', 'https://open.kakao.com/x');
    expect(link).toHaveAttribute('data-cta', 'k'); // 자식 속성 보존
    expect(link.className).toMatch(/bg-kakao/);
    expect(link.className).toMatch(/rounded-full/);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('asChild가 자식의 기존 className을 잃지 않는다', () => {
    render(
      <Button asChild>
        {/* href는 이 케이스의 관심사가 아니다. 내부 경로를 쓰면
            @next/next/no-html-link-for-pages에 걸리므로 외부 URL로 둔다 —
            규칙을 파일 전체에서 끄는 것보다 이쪽이 안전하다. */}
        <a href="https://example.com/x" className="custom-class">링크</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: '링크' });
    expect(link.className).toMatch(/custom-class/);
    expect(link.className).toMatch(/bg-primary/);
  });

  it('kakao variant는 옐로 배경에 kakao-ink 글자와 kakao-ink 포커스 링을 쓴다', () => {
    const cls = buttonVariants({ variant: 'kakao' });
    expect(cls).toMatch(/bg-kakao\b/);
    expect(cls).toMatch(/text-kakao-ink/);
    expect(cls).toMatch(/focus-visible:ring-kakao-ink/);
    expect(cls).not.toMatch(/text-white/);
  });

  it('shape이 반경을 정한다 — pill은 full, block은 xl', () => {
    expect(buttonVariants({ shape: 'pill' })).toMatch(/rounded-full/);
    expect(buttonVariants({ shape: 'block' })).toMatch(/rounded-xl/);
    expect(buttonVariants({ shape: 'pill' })).not.toMatch(/rounded-xl/);
  });

  // light는 className이 아니라 prop이다 — Field.test.tsx의 같은 이름 블록과 짝이다.
  // theme-init.js가 pages/admin/**·계약 화면에도 <html class="dark">를 붙이기 때문에
  // 다크 오버라이드가 흰 카드 위로 새어 나온다(outline: #a78bfa on #fff = 2.72:1).
  //
  // 단언은 반드시 **렌더 결과**로 한다. buttonVariants()는 cva의 단순 연결이라
  // 나중 클래스가 앞 클래스를 지우지 않는다 — twMerge는 컴포넌트의 cn()에서만 돈다.
  const classesOf = (el: React.ReactElement) => {
    const { container } = render(el);
    return (container.firstElementChild as HTMLElement).className;
  };

  describe('light 옵트인', () => {
    it('outline + light면 다크 보라(primary-lighter)가 사라지고 라이트 보라가 남는다', () => {
      const cls = classesOf(<Button light variant="outline">x</Button>);
      expect(cls).not.toMatch(/dark:text-primary-lighter/);
      expect(cls).not.toMatch(/dark:border-primary-lighter/);
      expect(cls).toMatch(/(^|\s)dark:text-primary(\s|$)/);
      expect(cls).toMatch(/(^|\s)dark:border-primary\/20(\s|$)/);
      expect(cls).toMatch(/(^|\s)text-primary(\s|$)/); // 라이트 값 자체는 그대로
    });

    it.each([
      ['ghost', /dark:text-gray-300/, /(^|\s)dark:text-gray-600(\s|$)/],
      ['secondary', /dark:bg-gray-800/, /(^|\s)dark:bg-white(\s|$)/],
    ] as const)('%s + light면 다크 전용 색이 라이트 값으로 돌아간다', (variant, gone, kept) => {
      const cls = classesOf(<Button light variant={variant}>x</Button>);
      expect(cls).not.toMatch(gone);
      expect(cls).toMatch(kept);
    });

    it('light면 포커스 오프셋도 라이트 배경 기준으로 돌아간다', () => {
      for (const variant of ['solid', 'outline', 'ghost', 'secondary'] as const) {
        const cls = classesOf(<Button light variant={variant}>x</Button>);
        expect(cls).not.toMatch(/dark:focus-visible:ring-offset-gray-900/);
        expect(cls).toMatch(/dark:focus-visible:ring-offset-white/);
        cleanup();
      }
    });

    it('light 없이는 다크 오버라이드가 그대로다(공개 페이지는 다크가 정상)', () => {
      expect(classesOf(<Button variant="outline">x</Button>)).toMatch(/dark:text-primary-lighter/);
    });

    it('호출부 className은 light보다 뒤에 와서 이긴다', () => {
      const cls = classesOf(<Button light variant="outline" className="dark:text-white">x</Button>);
      expect(cls).toMatch(/dark:text-white/);
      expect(cls).not.toMatch(/dark:text-primary\b/);
    });

    it('light는 DOM 속성으로 새지 않는다', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      render(<Button light variant="outline">x</Button>);
      expect(screen.getByRole('button', { name: 'x' }).getAttribute('light')).toBeNull();
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  it('모든 variant가 44px 이상 터치 타깃과 focus-visible 링을 갖는다', () => {
    const variants = ['solid', 'outline', 'ghost', 'secondary', 'glass', 'kakao', 'scrim'] as const;
    for (const variant of variants) {
      const cls = buttonVariants({ variant });
      expect(cls).toMatch(/focus-visible:ring-2/);
      expect(cls).toMatch(/\bh-11\b/); // size md 기본
    }
  });
});
