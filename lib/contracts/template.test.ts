/** @jest-environment node */

import { buildContractContent, buildRulesContent, resolveRulesContent } from './template';
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

  /**
   * 특약사항은 나머지 필드와 달리 escapeMarkdown만 거쳤다. 파이프는 막혔지만 꺾쇠는
   * 통과해, 특약 문구가 마크업으로 해석되며 계약서에서 사라질 수 있었다. 특약은
   * 당사자가 따로 합의한 조건이라 사라지면 곧바로 분쟁이 된다.
   */
  it('특약사항의 태그가 살아나지 않는다 — 문구가 마크업으로 사라지지 않는다', () => {
    const content = buildContractContent({
      ...baseData,
      specialTerms: ['위약금 <b>면제</b> 없음'],
    });

    expect(content).not.toContain('<b>');
    expect(content).toContain('\\<b\\>');
  });

  it('특약사항이 렌더링 후에도 원문 그대로 남는다', () => {
    const html = renderMarkdown(
      buildContractContent({
        ...baseData,
        specialTerms: ['<span style="display:none">삭제</span> 위약금 300만원'],
      }),
    );

    // 태그로 해석됐다면 "삭제"가 화면에서 사라지고 금액만 남는다.
    expect(html).toContain('삭제');
    expect(html).toContain('위약금 300만원');
    // 원문 문자열은 이스케이프된 형태로 남지만, 태그로는 살아나지 않아야 한다.
    expect(html).not.toContain('<span style');
  });

  it('특약사항이 다른 필드와 같은 이스케이프 규칙을 쓴다', () => {
    const payload = '값 | 칸 <b>굵게</b>';
    const fromName = buildContractContent({ ...baseData, customerName: payload });
    const fromTerms = buildContractContent({ ...baseData, specialTerms: [payload] });

    const escapedName = fromName.split('\n').find((line) => line.includes('성명')) ?? '';
    const escapedTerm = fromTerms.split('\n').find((line) => line.includes('굵게')) ?? '';

    // 같은 입력이 어느 칸에 들어가든 같은 형태로 남아야 한다.
    const extract = (row: string) => row.split('|').map((cell) => cell.trim()).join('|');
    expect(extract(escapedTerm)).toContain(extract(escapedName).split('|').pop());
  });

  it('이용자 입력의 파이프로 표에 칸을 추가하지 못한다', () => {
    // 이름 한 줄로 계약서에 없던 칸과 문구를 심는 경로를 막는다.
    const content = buildContractContent({
      ...baseData,
      customerName: '홍길동 | 보증금 면제 확정 | 위약금 없음',
    });

    const row = content.split('\n').find((line) => line.includes('성명')) ?? '';
    // 이스케이프된 파이프(\|)를 제거하고 남은 실제 구분자만 센다.
    const separators = row.replace(/\\\|/g, '').split('|').length - 1;

    expect(separators).toBe(3); // | 성명 | 값 |
    expect(row).toContain('\\|');
  });

  it('파이프가 섞인 이름도 렌더링 시 한 칸에 담긴다', () => {
    const html = renderMarkdown(
      buildContractContent({ ...baseData, customerName: '홍길동 | 위약금 없음' }),
    );
    const match = html.match(/<tr><td>\s*성명\s*<\/td>[\s\S]*?<\/tr>/);

    expect(match).not.toBeNull();
    expect((match?.[0].match(/<td>/g) ?? []).length).toBe(2);
    expect(match?.[0]).toContain('위약금 없음');
  });

  it('주소의 개행이 표 구조를 깨뜨리지 않는다', () => {
    // 템플릿에는 운영자 주소 행이 먼저 나오므로, 이용자 주소를 고유 문자열로 특정한다.
    const content = buildContractContent({
      ...baseData,
      customerAddress: 'AUDIT_ADDR\n| 특약 | 없음 |',
    });

    const row = content.split('\n').find((line) => line.includes('AUDIT_ADDR')) ?? '';
    expect(row).toContain('<br>');
    expect(row.replace(/\\\|/g, '').split('|').length - 1).toBe(3);
  });

  it('이용자 입력의 태그가 살아나지 않는다', () => {
    const content = buildContractContent({
      ...baseData,
      customerName: '<script>alert(1)</script>',
    });

    expect(content).not.toContain('<script>');
    expect(content).toContain('\\<script\\>');

    // 판정 기준은 렌더링 결과다 — markdown-to-jsx는 인라인 HTML을 실제 태그로 살려낸다.
    const html = renderMarkdown(content);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  /**
   * 이스케이프를 HTML 엔티티로 하면 렌더러가 앰퍼샌드를 한 번 더 처리해, 아포스트로피가
   * 든 이름이 계약서에 O&#039;Brien으로 인쇄된다. 7개 언어로 운영하는 사이트라 실제로
   * 생기는 일이고, 이름이 틀린 계약서는 그 자체로 분쟁거리다.
   */
  it.each([
    ["O'Brien", 'O&#x27;Brien'],
    ['Tom & Jerry', 'Tom &amp; Jerry'],
    ['He said "hi"', 'He said &quot;hi&quot;'],
  ])('%s 같은 이름이 계약서에 그대로 인쇄된다', (name, expected) => {
    const html = renderMarkdown(buildContractContent({ ...baseData, customerName: name }));
    const row = html.match(/<tr><td>\s*성명\s*<\/td>[\s\S]*?<\/tr>/)?.[0] ?? '';

    // 브라우저·PDF가 이 엔티티를 원래 문자로 되돌려 화면에 보여 준다.
    expect(row).toContain(expected);
    // 이중 이스케이프의 흔적이 남으면 화면에 &#039; 같은 것이 그대로 보인다.
    expect(row).not.toContain('&amp;#');
    expect(row).not.toContain('&amp;quot;');
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

  // 파일을 고치면 이미 체결된 계약의 첨부까지 바뀌어, 고객이 동의한 문서와 보관되는
  // 문서가 달라진다. 계약이 들고 있는 사본이 항상 우선해야 한다.
  it('계약이 들고 있는 사본을 원본 파일보다 우선한다', () => {
    const snapshot = '# 계약 시점의 이용수칙\n\n이 계약에 적용되는 판본.';
    const resolved = resolveRulesContent([{ type: 'rules', content: snapshot }]);

    expect(resolved).toBe(snapshot);
    expect(resolved).not.toBe(buildRulesContent());
  });

  it('사본이 없는 과거 계약만 현재 파일로 되돌아간다', () => {
    expect(resolveRulesContent([{ type: 'rules', content: null }])).toBe(buildRulesContent());
    expect(resolveRulesContent([])).toBe(buildRulesContent());
    // 빈 사본으로 백지 첨부를 발행하지 않는다.
    expect(resolveRulesContent([{ type: 'rules', content: '' }])).toBe(buildRulesContent());
  });

  it('rules 이외의 첨부는 이용수칙으로 오인하지 않는다', () => {
    const resolved = resolveRulesContent([{ type: 'appendix', content: '다른 문서' }]);
    expect(resolved).toBe(buildRulesContent());
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
