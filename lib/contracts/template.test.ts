/** @jest-environment node */

import { buildContractContent, buildRulesContent } from './template';
import { renderMarkdown } from './markdown';

const baseData = {
  customerName: '홍길동',
  customerPhone: '010-1234-5678',
  roomNumber: 'A',
  startDate: '2026-08-01',
  endDate: '2026-11-01',
  monthlyRent: 300000,
  depositAmount: 300000,
  contractDate: '2026-07-27',
};

describe('계약서 본문 생성', () => {
  it('플레이스홀더를 남기지 않는다', () => {
    const content = buildContractContent({ ...baseData, specialTerms: ['테스트 특약'] });
    expect(content).not.toMatch(/\{\{\w+\}\}/);
  });

  it('이용자 정보와 금액을 한국어 표기로 채운다', () => {
    const content = buildContractContent(baseData);

    expect(content).toContain('홍길동');
    expect(content).toContain('010-1234-5678');
    expect(content).toContain('300,000');
    expect(content).toContain('2026년 8월 1일');
  });

  it('특약사항을 표의 행으로 넣는다', () => {
    const content = buildContractContent({
      ...baseData,
      specialTerms: ['첫 번째 특약', '두 번째 특약'],
    });

    expect(content).toContain('| 1 | 첫 번째 특약 |');
    expect(content).toContain('| 2 | 두 번째 특약 |');
  });

  it('특약사항의 파이프 문자가 표를 깨뜨리지 않게 이스케이프한다', () => {
    const content = buildContractContent({ ...baseData, specialTerms: ['A | B'] });
    expect(content).toContain('A \\| B');
  });

  it('이용자 입력의 HTML을 이스케이프한다', () => {
    const content = buildContractContent({
      ...baseData,
      customerName: '<script>alert(1)</script>',
    });

    expect(content).not.toContain('<script>');
    expect(content).toContain('&lt;script&gt;');
  });

  it('납부일을 생략하면 1일로 채운다', () => {
    const content = buildContractContent(baseData);
    expect(content).toContain('매월 1 일');
  });
});

describe('공동생활 이용수칙', () => {
  it('런타임에서 원본 파일을 읽어온다', () => {
    const rules = buildRulesContent();
    expect(rules.length).toBeGreaterThan(0);
  });
});

describe('마크다운 렌더링', () => {
  it('표를 HTML 표로 변환한다 (PDF에 파이프 문자가 그대로 나오지 않도록)', () => {
    const html = renderMarkdown('| 구분 | 내용 |\n|---|---|\n| 성명 | 홍길동 |');

    expect(html).toContain('<table');
    expect(html).toMatch(/<td>\s*홍길동\s*<\/td>/);
    expect(html).not.toContain('| 구분 |');
  });

  it('계약서 본문 전체를 표가 살아 있는 HTML로 렌더링한다', () => {
    const html = renderMarkdown(buildContractContent(baseData));

    expect(html).toContain('<table');
    expect(html).toContain('음악연습실 이용계약서');
    // 조문 제목이 헤딩으로 남아야 PDF의 페이지 분리 규칙(break-after)이 동작한다.
    expect(html).toMatch(/<h2[^>]*>/);
  });

  it('운영자 날인 자리를 보존한다 (지워지면 갑의 날인이 빈 칸으로 발행된다)', () => {
    const html = renderMarkdown(buildContractContent(baseData));
    expect(html).toContain('class="seal"');
  });

  it('이스케이프된 사용자 입력을 다시 실행 가능한 태그로 되살리지 않는다', () => {
    const content = buildContractContent({
      ...baseData,
      customerName: '<img src=x onerror=alert(1)>',
    });
    const html = renderMarkdown(content);

    // 입력은 텍스트로만 남아야 한다 — 태그로 復元되면 PDF 렌더링 시 실제로 실행된다.
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;img');
  });
});
