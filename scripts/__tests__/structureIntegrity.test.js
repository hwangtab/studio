const { fingerprint, diffFingerprint } = require('../structureIntegrity');

const BASE = [
  '---',
  'title: "글 제목"',
  'date: 2026-04-07',
  'tags:',
  '  - 태그1',
  '---',
  '![대표](/images/a.webp)',
  '',
  '## 섹션 하나',
  '',
  '산문입니다. [내부 링크](/stories/x1)를 포함합니다.',
  '',
  '| 항목 | 값 |',
  '|---|---|',
  '| 가격 | 36만원 |',
  '',
  '%%service:lesson%%',
  '',
  '### 하위 제목',
  '',
  '전화는 %%phone%% 입니다.',
  '',
].join('\n');

describe('fingerprint', () => {
  test('프론트매터 최상위 키를 뽑는다', () => {
    expect(fingerprint(BASE).frontmatterKeys).toEqual(['title', 'date', 'tags']);
  });

  test('제목 텍스트를 순서대로 뽑는다', () => {
    expect(fingerprint(BASE).headings).toEqual(['2:섹션 하나', '3:하위 제목']);
  });

  test('표 행·이미지 수를 센다', () => {
    const fp = fingerprint(BASE);
    expect(fp.tableRows).toBe(3);
    expect(fp.images).toBe(1);
  });

  test('링크 URL과 디렉티브를 뽑는다', () => {
    const fp = fingerprint(BASE);
    expect(fp.links).toEqual(['/stories/x1']);
    expect(fp.directives).toEqual(['%%service:lesson%%', '%%phone%%']);
  });
});

describe('diffFingerprint', () => {
  test('동일하면 빈 배열', () => {
    expect(diffFingerprint(fingerprint(BASE), fingerprint(BASE))).toEqual([]);
  });

  test('제목이 바뀌면 잡는다', () => {
    const after = BASE.replace('## 섹션 하나', '## 섹션 하나로 바꿈');
    const diffs = diffFingerprint(fingerprint(BASE), fingerprint(after));
    expect(diffs.join(' ')).toMatch(/headings/);
  });

  test('디렉티브가 사라지면 잡는다', () => {
    const after = BASE.replace('%%phone%%', '010-4255-7893');
    const diffs = diffFingerprint(fingerprint(BASE), fingerprint(after));
    expect(diffs.join(' ')).toMatch(/directives/);
  });

  test('표 행이 줄면 잡는다', () => {
    const after = BASE.replace('| 가격 | 36만원 |\n', '');
    const diffs = diffFingerprint(fingerprint(BASE), fingerprint(after));
    expect(diffs.join(' ')).toMatch(/tableRows/);
  });

  test('산문만 바뀌면 차이 없음', () => {
    const after = BASE.replace('산문입니다.', '산문을 고쳤습니다. 리듬도 바꿨고요.');
    expect(diffFingerprint(fingerprint(BASE), fingerprint(after))).toEqual([]);
  });

  test('제목 레벨이 바뀌면 잡는다', () => {
    const after = BASE.replace('## 섹션 하나', '### 섹션 하나');
    const diffs = diffFingerprint(fingerprint(BASE), fingerprint(after));
    expect(diffs.join(' ')).toMatch(/headings/);
  });

  test('프론트매터 값이 바뀌면 잡는다', () => {
    const after = BASE.replace('title: "글 제목"', 'title: "바뀐 제목"');
    const diffs = diffFingerprint(fingerprint(BASE), fingerprint(after));
    expect(diffs.join(' ')).toMatch(/frontmatter/);
  });

  test('표 열 개수가 바뀌면 잡는다', () => {
    const after = BASE.replace('| 항목 | 값 |', '| 항목 | 값 | 추가 |').replace('|---|---|', '|---|---|---|');
    const diffs = diffFingerprint(fingerprint(BASE), fingerprint(after));
    expect(diffs.join(' ')).toMatch(/tableShape/);
  });

  test('숫자를 포함한 디렉티브를 뽑는다', () => {
    const withDigitDirective = BASE.replace('%%phone%%', '%%review:review-1%%');
    const fp = fingerprint(withDigitDirective);
    expect(fp.directives).toContain('%%review:review-1%%');
  });
});
