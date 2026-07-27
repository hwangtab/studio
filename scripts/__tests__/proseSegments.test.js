const { extractProse, mergeProse } = require('../proseSegments');

const SAMPLE = [
  '---',
  'title: "테스트 글"',
  'tags: ["a", "b"]',
  '---',
  '![대표 이미지](/images/x.webp)',
  '',
  '## 첫 번째 제목',
  '',
  '첫 산문 단락입니다.',
  '두 번째 줄이 이어집니다.',
  '',
  '| 항목 | 값 |',
  '|---|---|',
  '| 가격 | 10만원 |',
  '',
  '%%service:lesson%%',
  '',
  '- 불릿 하나',
  '- 불릿 둘',
  '',
  '두 번째 산문 단락입니다.',
  '',
  '---',
  '',
  '[문의하기](/contact)',
  '',
  '> 인용문입니다.',
  '',
  '```js',
  'const a = 1;',
  '```',
  '',
  '마지막 산문 단락입니다.',
  '',
].join('\n');

describe('extractProse', () => {
  test('산문 블록만 뽑는다', () => {
    const { segments } = extractProse(SAMPLE);
    expect(segments.map((s) => s.text)).toEqual([
      '첫 산문 단락입니다.\n두 번째 줄이 이어집니다.',
      '두 번째 산문 단락입니다.',
      '마지막 산문 단락입니다.',
    ]);
  });

  test('id는 001부터 3자리 0패딩', () => {
    const { segments } = extractProse(SAMPLE);
    expect(segments.map((s) => s.id)).toEqual(['001', '002', '003']);
  });

  test('marked에 마커가 각 세그먼트 앞에 붙는다', () => {
    const { marked } = extractProse(SAMPLE);
    expect(marked).toBe(
      [
        '<<<SEG:001>>>',
        '첫 산문 단락입니다.',
        '두 번째 줄이 이어집니다.',
        '',
        '<<<SEG:002>>>',
        '두 번째 산문 단락입니다.',
        '',
        '<<<SEG:003>>>',
        '마지막 산문 단락입니다.',
      ].join('\n'),
    );
  });

  test('프론트매터는 절대 포함되지 않는다', () => {
    const { marked } = extractProse(SAMPLE);
    expect(marked).not.toContain('title:');
    expect(marked).not.toContain('tags:');
  });

  test('구조 줄이 한 줄이라도 섞인 블록은 통째로 제외한다', () => {
    const md = ['산문 줄입니다.', '- 그런데 불릿이 붙었습니다', ''].join('\n');
    const { segments } = extractProse(md);
    expect(segments).toEqual([]);
  });

  test('프론트매터가 없는 문서도 처리한다', () => {
    const { segments } = extractProse('그냥 산문입니다.\n');
    expect(segments.map((s) => s.text)).toEqual(['그냥 산문입니다.']);
  });

  test('숫자가 들어간 디렉티브는 구조로 판정된다', () => {
    const md = [
      '산문 줄입니다.',
      '%%review:review-1%%',
      '',
      '또 다른 산문입니다.',
    ].join('\n');
    const { segments } = extractProse(md);
    // 첫 번째 블록은 디렉티브를 포함하므로 제외되어야 함
    const texts = segments.map((s) => s.text);
    expect(texts).not.toContain('산문 줄입니다.');
    expect(texts).toContain('또 다른 산문입니다.');
  });
});

describe('mergeProse', () => {
  test('왕복하면 원본과 같다 (항등성)', () => {
    const { marked } = extractProse(SAMPLE);
    expect(mergeProse(SAMPLE, marked)).toBe(SAMPLE);
  });

  test('윤문된 텍스트가 제자리에 들어간다', () => {
    const { marked } = extractProse(SAMPLE);
    const rewritten = marked.replace('두 번째 산문 단락입니다.', '두 번째 단락을 고쳤습니다.');
    const merged = mergeProse(SAMPLE, rewritten);
    expect(merged).toContain('두 번째 단락을 고쳤습니다.');
    expect(merged).toContain('| 가격 | 10만원 |');
    expect(merged).toContain('%%service:lesson%%');
    expect(merged).toContain('## 첫 번째 제목');
  });

  test('줄 수가 늘어난 윤문도 병합한다', () => {
    const { marked } = extractProse(SAMPLE);
    const rewritten = marked.replace(
      '마지막 산문 단락입니다.',
      '마지막 단락입니다.\n한 줄이 더 늘었습니다.',
    );
    const merged = mergeProse(SAMPLE, rewritten);
    expect(merged).toContain('마지막 단락입니다.\n한 줄이 더 늘었습니다.');
    expect(merged).toContain('```js');
  });

  test('마커가 누락되면 throw', () => {
    const { marked } = extractProse(SAMPLE);
    const broken = marked.replace('<<<SEG:002>>>\n', '');
    expect(() => mergeProse(SAMPLE, broken)).toThrow(/002/);
  });

  test('없던 마커가 추가되면 throw', () => {
    const { marked } = extractProse(SAMPLE);
    const broken = `${marked}\n\n<<<SEG:009>>>\n난입한 단락`;
    expect(() => mergeProse(SAMPLE, broken)).toThrow(/009/);
  });

  test('세그먼트 내용이 비면 throw', () => {
    const { marked } = extractProse(SAMPLE);
    const broken = marked.replace('두 번째 산문 단락입니다.', '');
    expect(() => mergeProse(SAMPLE, broken)).toThrow(/비어/);
  });

  test('앞쪽 세그먼트의 줄 수가 늘어나도 뒤쪽 구조가 제자리에 남는다', () => {
    const { marked } = extractProse(SAMPLE);
    // 첫 번째 세그먼트(001)를 두 줄 늘린다
    const rewritten = marked.replace(
      '첫 산문 단락입니다.\n두 번째 줄이 이어집니다.',
      '첫 산문 단락입니다.\n두 번째 줄이 이어집니다.\n세 번째 줄을 추가했습니다.\n네 번째 줄도 추가했습니다.',
    );
    const merged = mergeProse(SAMPLE, rewritten);
    // 테이블이 여전히 제자리에 있어야 함
    expect(merged).toContain('| 가격 | 10만원 |');
    // 코드펜스도 제자리에 있어야 함
    expect(merged).toContain('```js');
    // 마지막 산문도 제자리에 있어야 함
    expect(merged).toContain('마지막 산문 단락입니다.');
    // 추가된 줄도 포함되어야 함
    expect(merged).toContain('세 번째 줄을 추가했습니다.');
    // 모든 구조 요소가 정확히 한 번씩만 나타나야 함 (중복 방지)
    expect((merged.match(/- 불릿 둘/g) || []).length).toBe(1);
    expect((merged.match(/const a = 1;/g) || []).length).toBe(1);
  });
});
