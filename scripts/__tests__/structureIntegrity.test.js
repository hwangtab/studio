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
    expect(fingerprint(BASE).headings).toEqual(['섹션 하나', '하위 제목']);
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
});
