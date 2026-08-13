/** @jest-environment jsdom */
import React from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render } from '@testing-library/react';

import ContractContent from './ContractContent';

const CONTRACT_MD = `# 음악연습실 이용계약서

## 제5조 (보증금 및 그 납부 면제)

① 본 계약의 보증금은 **월 이용료와 동일한 금액**으로 한다.

| 구분 | 금액 |
| --- | --- |
| 월 이용료 | 금 300,000 원 |
`;

/** styled-jsx는 jsdom에 <style>을 주입하지 않는다. 소스에서 CSS를 꺼내 직접 넣는다. */
const contractCss = (): string => {
  const src = readFileSync(
    path.join(process.cwd(), 'components/contracts/ContractContent.tsx'),
    'utf-8',
  );
  return src.match(/<style jsx global>\{`([\s\S]*?)`\}<\/style>/)?.[1] ?? '';
};

const setup = (dark: boolean) => {
  document.documentElement.className = dark ? 'dark' : '';
  document.head.innerHTML = '';

  // globals.css가 거는 전역 색. 다크에서 본문을 밝게, 제목을 흰색으로 만드는 그 규칙이다.
  const base = document.createElement('style');
  base.textContent = `
    body { color: #1F2937; }
    .dark body { color: #E5E7EB; }
    h1,h2,h3,h4,h5,h6 { color: #111827; }
    .dark h1,.dark h2,.dark h3,.dark h4,.dark h5,.dark h6 { color: #FFFFFF; }
  `;
  document.head.appendChild(base);

  // 계약 스타일을 뒤에 둔다 — 순서로 이기는 게 아니라 우선순위로 이겨야 하므로,
  // 실제로는 반대 순서로 실릴 수도 있다는 점을 감안해 불리하지 않은 쪽으로 확인한다.
  const contract = document.createElement('style');
  contract.textContent = contractCss();
  document.head.appendChild(contract);

  return render(<ContractContent content={CONTRACT_MD} />);
};

const colorOf = (el: Element | null): string => (el ? getComputedStyle(el).color : '');

/**
 * 계약 본문은 흰 카드 위에 놓인다. 다크 모드에서 전역 규칙을 따라가면 흰 바탕에 흰 글씨가
 * 되는데, 화면이 깨져 보이지도 않아서 고객은 본문이 원래 없는 줄 알고 서명한다.
 */
describe('계약 본문 가독성', () => {
  it.each([
    [false, '라이트'],
    [true, '다크'],
  ])('%p (%s) 모드에서 본문 글자가 흰색이 아니다', (dark) => {
    const { container } = setup(dark as boolean);

    const targets = {
      h1: container.querySelector('h1'),
      h2: container.querySelector('h2'),
      p: container.querySelector('p'),
      td: container.querySelector('td'),
      strong: container.querySelector('strong'),
      th: container.querySelector('th'),
    };

    for (const [name, el] of Object.entries(targets)) {
      expect(el).not.toBeNull();
      const color = colorOf(el);
      // 흰 배경 위에서 읽을 수 없게 되는 두 색.
      expect(`${name}=${color}`).not.toBe(`${name}=rgb(255, 255, 255)`);
      expect(`${name}=${color}`).not.toBe(`${name}=rgb(229, 231, 235)`);
    }
  });

  it('조문 각 호에 번호가 붙는다 (조문을 인용할 수 있어야 한다)', () => {
    const { container } = setup(false);
    document.body.appendChild(container);

    const ol = document.createElement('ol');
    ol.className = '';
    container.querySelector('.contract-body')?.appendChild(ol);

    expect(getComputedStyle(ol).listStyleType).toBe('decimal');
  });

  it('표에 테두리가 있다 — PDF와 같은 모습이어야 한다', () => {
    const { container } = setup(false);
    const td = container.querySelector('td');

    expect(getComputedStyle(td!).borderTopStyle).toBe('solid');
  });
});
