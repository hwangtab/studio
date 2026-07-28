const {
  countEndings,
  classifyByCounts,
  classifyStoryText,
  DOMINANCE_THRESHOLD,
  MIN_TOTAL_FOR_CLASSIFICATION,
} = require('../styleDistribution');

function withFrontmatter(body) {
  return ['---', 'title: "테스트 글"', 'date: 2026-07-28', '---', '', body, ''].join('\n');
}

describe('classifyByCounts (경계값)', () => {
  test('임계값(1.5배)은 예상대로 1.5다', () => {
    expect(DOMINANCE_THRESHOLD).toBe(1.5);
  });

  test('4:3(1.5배 미만)은 혼재다', () => {
    expect(classifyByCounts(4, 3)).toBe('mixed');
  });

  test('3:2(정확히 1.5배)는 습니다 우세다', () => {
    expect(classifyByCounts(3, 2)).toBe('formal-dominant');
  });

  test('2:3(콜로키얼이 1.5배)은 어요 우세다', () => {
    expect(classifyByCounts(2, 3)).toBe('colloquial-dominant');
  });

  test('표본 합이 최소치 미만이면 판별 불가다', () => {
    expect(MIN_TOTAL_FOR_CLASSIFICATION).toBe(3);
    expect(classifyByCounts(1, 1)).toBe('undetermined');
    expect(classifyByCounts(2, 0)).toBe('undetermined');
  });

  test('0:0은 판별 불가다', () => {
    expect(classifyByCounts(0, 0)).toBe('undetermined');
  });
});

describe('classifyStoryText — 종합 시나리오', () => {
  test('명백히 습니다체인 글', () => {
    const md = withFrontmatter(
      '이 마이크는 소리를 정확하게 담습니다. 사용법도 어렵지 않습니다. '
      + '초보자에게도 충분히 추천합니다. 가격도 합리적입니다.',
    );
    const result = classifyStoryText(md);
    expect(result.formal).toBe(4);
    expect(result.colloquial).toBe(0);
    expect(result.category).toBe('formal-dominant');
  });

  test('명백히 어요체인 글', () => {
    const md = withFrontmatter(
      '이 마이크는 소리가 정말 좋아요. 사용법도 어렵지 않아요. 처음엔 저도 헷갈리곤 했거든요.',
    );
    const result = classifyStoryText(md);
    expect(result.formal).toBe(0);
    expect(result.colloquial).toBe(3);
    expect(result.category).toBe('colloquial-dominant');
  });

  test('임계값 바로 아래에 걸린 혼재 글 (4 습니다 : 3 어요, 1.5배 미만)', () => {
    const md = withFrontmatter(
      '이 마이크는 소리를 정확하게 담습니다. 사용법도 어렵지 않습니다. '
      + '초보자에게도 충분히 추천합니다. 가격도 합리적입니다. '
      + '그래도 조작법은 살짝 어려워요. 설명서는 친절하지 않아요. 그래도 금방 익숙해지거든요.',
    );
    const result = classifyStoryText(md);
    expect(result.formal).toBe(4);
    expect(result.colloquial).toBe(3);
    expect(result.category).toBe('mixed');
  });

  test('종결 어미 신호가 없는 중립 글은 판별 불가다', () => {
    // "-다" 평서형(이다/아니다 계열)은 습니다체도 어요체도 아니다 — 신호 자체가 없다.
    const md = withFrontmatter('이것은 그냥 설명이다. 참고용 문장이다. 결론은 따로 없다.');
    const result = classifyStoryText(md);
    expect(result.formal).toBe(0);
    expect(result.colloquial).toBe(0);
    expect(result.category).toBe('undetermined');
  });

  test('완전히 빈 본문도 판별 불가로 처리한다', () => {
    const result = classifyStoryText(withFrontmatter(''));
    expect(result.category).toBe('undetermined');
  });

  test('표(table)·제목만 있고 산문이 없으면 그 안의 어미는 세지 않는다', () => {
    const md = [
      '---',
      'title: "표 전용 글"',
      '---',
      '',
      '## 요금 안내',
      '',
      '| 항목 | 설명 |',
      '|---|---|',
      '| 가격 | 문의 바랍니다 |',
      '',
    ].join('\n');
    const result = classifyStoryText(md);
    expect(result.formal).toBe(0);
    expect(result.colloquial).toBe(0);
    expect(result.category).toBe('undetermined');
  });
});

describe('countEndings — 모호성 처리 회귀 테스트', () => {
  test('"고요"의 명사형(고요함/고요한 등)은 어미로 세지 않는다', () => {
    const { colloquial } = countEndings('그 시간의 고요함이 연습의 질을 바꿉니다.');
    expect(colloquial).toBe(0);
  });

  test('"고요"의 연결어미형(용언 어간+고요)은 어미로 센다', () => {
    const { colloquial } = countEndings('설명도 쉽고요, 가격도 착하고요.');
    expect(colloquial).toBe(2);
  });

  test('"아니다"(평서형)는 습니다체로 세지 않는다', () => {
    const { formal } = countEndings('이것은 정답이 아니다.');
    expect(formal).toBe(0);
  });

  test('동사 "다니다"의 사전형은 습니다체로 세지 않지만, 그 활용형(다닙니다 등)은 센다', () => {
    const bare = countEndings('예전에 학원을 다니다 그만두었습니다.');
    expect(bare.formal).toBe(1); // "그만두었습니다"만 카운트, "다니다"는 제외
    const conjugated = countEndings('요즘도 그 학원을 다닙니다.');
    expect(conjugated.formal).toBe(1); // "다닙니다"는 정상적인 하십시오체 활용이므로 카운트
  });

  test('원인·이유의 연결어미 "-니까"는 의문형 하십시오체와 구별해 아예 세지 않는다', () => {
    const { formal, colloquial } = countEndings('시간이 없으니까 서두르세요.');
    expect(formal).toBe(0);
    expect(colloquial).toBe(1); // "세요"만 카운트
  });
});
