import React from 'react';
import { render, screen } from '@testing-library/react';
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

  it('모든 variant가 44px 이상 터치 타깃과 focus-visible 링을 갖는다', () => {
    const variants = ['solid', 'outline', 'ghost', 'secondary', 'glass', 'kakao', 'scrim'] as const;
    for (const variant of variants) {
      const cls = buttonVariants({ variant });
      expect(cls).toMatch(/focus-visible:ring-2/);
      expect(cls).toMatch(/\bh-11\b/); // size md 기본
    }
  });
});
