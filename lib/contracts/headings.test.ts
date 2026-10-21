/** @jest-environment node */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'markdown-to-jsx';

import { CONTRACT_MARKDOWN_OPTIONS } from './html-escape';
import { extractContractHeadings, headingAnchorId } from './headings';

const render = (content: string) =>
  // markdown-to-jsx의 타입이 children을 prop으로만 받는다.
  // eslint-disable-next-line react/no-children-prop
  renderToStaticMarkup(React.createElement(Markdown, { options: { ...CONTRACT_MARKDOWN_OPTIONS, slugify: headingAnchorId }, children: content }));

describe('headingAnchorId', () => {
  it('한글 제목에서 결정적인 id를 만든다', () => {
    expect(headingAnchorId('제5조 (보증금 및 그 납부 면제) — 핵심 조항')).toBe('sec-제5조-보증금-및-그-납부-면제-핵심-조항');
    expect(headingAnchorId('제5조 (보증금 및 그 납부 면제) — 핵심 조항')).toBe(headingAnchorId('제5조 (보증금 및 그 납부 면제) — 핵심 조항'));
  });

  it('글자가 하나도 없으면 빈 id 대신 기본값을 쓴다', () => {
    expect(headingAnchorId('— ()')).toBe('sec-section');
  });
});

describe('extractContractHeadings', () => {
  it('## 제목만 뽑고 # · ### 와 코드 울타리 안은 건너뛴다', () => {
    const content = ['# 큰 제목', '## 제1조 (목적)', '### 소제목', '```', '## 코드 안', '```', '## **제2조** (범위)'].join('\n');
    expect(extractContractHeadings(content).map((h) => h.text)).toEqual(['제1조 (목적)', '제2조 (범위)']);
  });

  it('같은 제목이 두 번 나오면 앞의 것만 남긴다', () => {
    expect(extractContractHeadings('## 안내\n## 안내')).toHaveLength(1);
  });

  it.each([
    ['lib/contracts/contract-template.md'],
    ['lib/contracts/production/single-template.md'],
    ['lib/contracts/production/release-template.md'],
    ['lib/contracts/production/mixmaster-template.md'],
  ])('%s — 목차의 모든 id가 본문 제목에 실제로 있다', (file) => {
    const content = readFileSync(path.join(process.cwd(), file), 'utf-8');
    const headings = extractContractHeadings(content);
    expect(headings.length).toBeGreaterThan(5);
    const html = render(content);
    for (const heading of headings) {
      expect(html).toContain(`id="${heading.id}"`);
    }
  });
});
