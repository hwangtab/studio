import { adminEventTypesFor, eventLabelFor, isMixMasterTerms, isReworkTerms, sourceLabelForTerms } from './event-spec';
import {
  ARRANGEMENT_SMALL_PRICE,
  EP_BUNDLE_PER_SONG_PRICE,
  SINGLE_BUNDLE_PRICE,
  VOCAL_TUNING_ADDON_PRICE,
} from '../../../data/pricing';
import {
  buildDefaultProductionTerms,
  buildDefaultReworkTerms,
  canonicalTermsJson,
  isOneSongKind,
  KIND_LABEL,
  reworkScopeOf,
  sourceLabelFor,
  isSinglePayment,
  parseStoredTerms,
  REFUND_ITEM_KEYS,
  releaseTitle,
  splitThreeInstallments,
  THREE_INSTALLMENT_MIN,
  validateProductionTerms,
  type ProductionTerms,
} from './terms';

const clone = (): ProductionTerms => JSON.parse(JSON.stringify(buildDefaultProductionTerms()));
const fields = (raw: unknown) => {
  const result = validateProductionTerms(raw);
  return result.ok ? [] : result.errors.map((error) => error.field);
};

describe('기본 조건', () => {
  it('계약금액은 정본 상수의 합이다 — 소편성 편곡 + 싱글 번들 + 보컬 보정', () => {
    const terms = buildDefaultProductionTerms();
    expect(terms.amount.total).toBe(ARRANGEMENT_SMALL_PRICE + SINGLE_BUNDLE_PRICE + VOCAL_TUNING_ADDON_PRICE);
    expect(terms.amount.deposit + terms.amount.balance).toBe(terms.amount.total);
  });

  it('환불 항목표는 다섯 항목이고 합계가 계약금액이다(제10조 3항)', () => {
    const terms = buildDefaultProductionTerms();
    expect(terms.refundSchedule.map((item) => item.key)).toEqual([...REFUND_ITEM_KEYS]);
    expect(terms.refundSchedule.reduce((sum, item) => sum + item.amount, 0)).toBe(terms.amount.total);
  });

  it('편곡 항목 금액은 소편성 편곡 정가다 — 1차 시안 전달이면 이 금액이 공제된다', () => {
    const arrangement = buildDefaultProductionTerms().refundSchedule.find((item) => item.key === 'arrangement');
    expect(arrangement?.amount).toBe(ARRANGEMENT_SMALL_PRICE);
  });

  it('기본 조건은 그대로 검증을 통과한다', () => {
    expect(validateProductionTerms(buildDefaultProductionTerms()).ok).toBe(true);
  });
});

describe('합계 불변식', () => {
  it('계약금 + 잔금이 계약금액과 다르면 거부한다 — 제3조 안에서 금액이 어긋난다', () => {
    const terms = clone();
    terms.amount.balance += 1;
    expect(fields(terms)).toContain('terms.amount.balance');
  });

  it('환불 항목표 합계가 계약금액과 다르면 거부한다', () => {
    const terms = clone();
    terms.refundSchedule[0].amount += 10_000;
    expect(fields(terms)).toContain('terms.refundSchedule');
  });

  it('환불 항목의 순서나 이름이 바뀌면 거부한다 — 각 항목이 제2조의 호를 가리킨다', () => {
    const terms = clone();
    [terms.refundSchedule[0], terms.refundSchedule[1]] = [terms.refundSchedule[1], terms.refundSchedule[0]];
    expect(fields(terms)).toContain('terms.refundSchedule.arrangement');
  });

  it('클라이언트가 보낸 항목 라벨을 인쇄하지 않는다 — 서버가 다시 붙인다', () => {
    const terms = clone();
    terms.refundSchedule[0].label = '편곡 (환불 없음)';
    const result = validateProductionTerms(terms);
    expect(result.ok && result.data.refundSchedule[0].label).toBe('편곡 (제2조 2호)');
  });
});

describe('입력 규칙', () => {
  it('정수가 아닌 금액·음수를 거부한다', () => {
    const terms = clone() as unknown as { amount: Record<string, unknown> };
    terms.amount.deposit = 575000.5;
    expect(fields(terms)).toContain('terms.amount.deposit');
    terms.amount.deposit = -1;
    expect(fields(terms)).toContain('terms.amount.deposit');
  });

  it('크레딧에 줄바꿈·보이지 않는 문자를 막는다 — 계약서에 그대로 인쇄된다', () => {
    const terms = clone();
    terms.credits = 'Arranged by 황경하\n보증금 면제';
    expect(fields(terms)).toContain('terms.credits');
    terms.credits = 'Arranged by 황‮경하';
    expect(fields(terms)).toContain('terms.credits');
  });

  it('곡 제목은 비워도 된다(제목 미정)', () => {
    const terms = clone();
    terms.songs = [{ title: '   ' }];
    const result = validateProductionTerms(terms);
    expect(result.ok && result.data.songs).toEqual([{ title: null }]);
  });
});

describe('저장 형식', () => {
  it('키 순서가 달라도 같은 JSON이 된다 — 지문이 같은 조건에 같은 값을 낸다', () => {
    const terms = buildDefaultProductionTerms();
    const reordered = Object.fromEntries(Object.entries(terms).reverse()) as unknown as ProductionTerms;
    expect(canonicalTermsJson(reordered)).toBe(canonicalTermsJson(terms));
  });

  it('저장한 값을 그대로 읽는다', () => {
    const terms = buildDefaultProductionTerms();
    expect(parseStoredTerms(canonicalTermsJson(terms))).toEqual(terms);
  });

  it('모르는 버전은 읽지 않고 던진다 — 빈 금액으로 계약서를 만들지 않게', () => {
    expect(() => parseStoredTerms(JSON.stringify({ version: 9 }))).toThrow();
  });
});

describe('해지 정산 경계(제10조 3항)', () => {
  it('기본 경계는 운영자 결정(2026-10-18)과 같다', () => {
    const byKey = Object.fromEntries(buildDefaultProductionTerms().refundSchedule.map((item) => [item.key, item.milestones]));
    expect(byKey).toEqual({
      arrangement: [{ event: 'arrangement_delivered', ratio: 1 }],
      recording: [{ event: 'recording_completed', ratio: 1 }],
      tuning: [{ event: 'tuning_delivered', ratio: 1 }],
      mixmaster: [{ event: 'mixing_delivered', ratio: 1 }],
      planning: [
        { event: 'kickoff', ratio: 0.3 },
        { event: 'distribution_submitted', ratio: 1 },
      ],
    });
  });

  it('마지막 경계가 100%가 아니거나 내림차순이면 거부한다 — 정산을 끝낼 수 없는 표', () => {
    const terms = clone();
    terms.refundSchedule[4].milestones = [{ event: 'kickoff', ratio: 0.3 }];
    expect(fields(terms)).toContain('terms.refundSchedule.planning.milestones');
    terms.refundSchedule[4].milestones = [
      { event: 'distribution_submitted', ratio: 1 },
      { event: 'kickoff', ratio: 0.3 },
    ];
    expect(fields(terms)).toContain('terms.refundSchedule.planning.milestones');
  });

  it('모르는 사건 이름을 거부한다', () => {
    const terms = clone() as unknown as { refundSchedule: Array<{ milestones: unknown }> };
    terms.refundSchedule[0].milestones = [{ event: 'whenever', ratio: 1 }];
    expect(fields(terms)).toContain('terms.refundSchedule.arrangement.milestones');
  });
});

describe('여러 곡(EP·정규, 0073)', () => {
  it('EP 기본 조건은 곡 수 배다 — 곡마다 편곡 + EP 번들 곡당 단가 + 보정', () => {
    const terms = buildDefaultProductionTerms('ep', 4);
    expect(terms.songs).toHaveLength(4);
    expect(terms.amount.total).toBe((ARRANGEMENT_SMALL_PRICE + VOCAL_TUNING_ADDON_PRICE) * 4 + EP_BUNDLE_PER_SONG_PRICE * 4);
    expect(terms.refundSchedule.reduce((sum, item) => sum + item.amount, 0)).toBe(terms.amount.total);
    expect(validateProductionTerms(terms, 'ep').ok).toBe(true);
  });

  it('종류마다 곡 수 범위를 지킨다 — 싱글 1곡, EP 2~7곡, 정규 6~20곡', () => {
    expect(validateProductionTerms(buildDefaultProductionTerms('single'), 'ep').ok).toBe(false);
    expect(validateProductionTerms(buildDefaultProductionTerms('ep', 4), 'single').ok).toBe(false);
    expect(validateProductionTerms(buildDefaultProductionTerms('album', 8), 'album').ok).toBe(true);
    expect(buildDefaultProductionTerms('album', 3).songs).toHaveLength(6);
  });

  it('v1(곡 제목 하나)로 저장된 조건은 곡 하나짜리 v3로 읽는다', () => {
    const { songs: _songs, albumTitle: _albumTitle, ...rest } = buildDefaultProductionTerms();
    const { second: _second, secondDueDays: _secondDueDays, ...amount } = rest.amount;
    const v1 = JSON.stringify({ ...rest, amount, version: 1, songTitle: '파도' });
    expect(parseStoredTerms(v1)).toMatchObject({
      version: 3,
      albumTitle: null,
      songs: [{ title: '파도' }],
      amount: { second: 0, secondDueDays: 7 },
    });
  });

  it('발매 이름 — 싱글은 곡 제목, EP·정규는 음반 제목과 곡 수', () => {
    expect(releaseTitle('single', { albumTitle: null, songs: [{ title: '파도' }] })).toBe('파도');
    expect(releaseTitle('ep', { albumTitle: '바다', songs: [{ title: null }, { title: null }, { title: null }] })).toBe('바다 (EP · 3곡)');
  });
});

describe('3회 분할 규칙', () => {
  it('분할 기준은 100만원이다', () => {
    expect(THREE_INSTALLMENT_MIN).toBe(1_000_000);
  });

  it.each([
    [500_000, 500_000, 0, 0],
    [999_999, 500_000, 0, 499_999],
    [1_000_000, 500_000, 300_000, 200_000],
    [1_100_000, 550_000, 330_000, 220_000],
    [1_500_000, 750_000, 450_000, 300_000],
  ])('%i원 → %i / %i / %i', (total, deposit, second, balance) => {
    expect(splitThreeInstallments(total)).toEqual({ deposit, second, balance });
  });

  it('합계는 항상 총액과 같다', () => {
    for (const total of [500_001, 777_777, 999_999, 1_000_001, 1_333_333]) {
      const parts = splitThreeInstallments(total);
      expect(parts.deposit + parts.second + parts.balance).toBe(total);
    }
  });

  it('1,000,000원 미만은 2회차(second=0)다', () => {
    expect(splitThreeInstallments(999_999).second).toBe(0);
  });
});

describe('한 번에 받는 계약(v3)', () => {
  const amount = (overrides: Partial<ProductionTerms['amount']>): Pick<ProductionTerms, 'amount'> => ({
    amount: {
      total: 500_000,
      deposit: 500_000,
      second: 0,
      balance: 0,
      depositDueDays: 3,
      secondDueDays: 7,
      balanceDueDays: 7,
      ...overrides,
    } as ProductionTerms['amount'],
  });

  it('2회차와 잔금이 모두 0일 때만 일시불이다', () => {
    expect(isSinglePayment(amount({}))).toBe(true);
    expect(isSinglePayment(amount({ second: 100_000, balance: 0 }))).toBe(false);
    expect(isSinglePayment(amount({ total: 500_001, deposit: 250_001, balance: 250_000 }))).toBe(false);
  });
});

describe('3회 분할 조건(terms v3)', () => {
  it('기본 조건은 v3이고 2회차는 0원·7일이다', () => {
    const terms = buildDefaultProductionTerms();
    expect(terms.version).toBe(3);
    expect(terms.amount.second).toBe(0);
    expect(terms.amount.secondDueDays).toBe(7);
  });

  it('계약금 + 2회차 + 잔금이 계약금액과 다르면 거부한다', () => {
    const terms = clone();
    terms.amount.second += 1;
    expect(fields(terms)).toContain('terms.amount.balance');
  });

  it('2회차가 0원이면 secondDueDays 없이도 통과한다', () => {
    const terms = clone() as unknown as { amount: Record<string, unknown> };
    delete terms.amount.secondDueDays;
    expect(fields(terms)).toEqual([]);
  });

  it('2회차가 있으면 secondDueDays가 필요하다', () => {
    const terms = clone() as unknown as { amount: Record<string, number> };
    terms.amount.second = 100_000;
    terms.amount.balance = terms.amount.total - terms.amount.deposit - terms.amount.second;
    delete (terms.amount as Record<string, unknown>).secondDueDays;
    expect(fields(terms)).toContain('terms.amount.secondDueDays');
  });

  it('2회차 금액이 음수면 거부한다', () => {
    const terms = clone();
    terms.amount.second = -1;
    expect(fields(terms)).toContain('terms.amount.second');
  });

  it('2회차 기한은 1~90일이어야 한다', () => {
    const terms = clone();
    terms.amount.second = 100_000;
    terms.amount.balance = terms.amount.total - terms.amount.deposit - terms.amount.second;
    terms.amount.secondDueDays = 0;
    expect(fields(terms)).toContain('terms.amount.secondDueDays');
    terms.amount.secondDueDays = 91;
    expect(fields(terms)).toContain('terms.amount.secondDueDays');
    terms.amount.secondDueDays = 30;
    expect(fields(terms)).toEqual([]);
  });

  it('v2 JSON을 읽으면 2회차를 0원·7일로 보정하고 version 3으로 올린다', () => {
    const current = buildDefaultProductionTerms();
    const { second: _second, secondDueDays: _secondDueDays, ...amount } = current.amount;
    const v2 = JSON.stringify({ ...current, version: 2, amount });
    expect(parseStoredTerms(v2)).toMatchObject({ version: 3, amount: { second: 0, secondDueDays: 7 } });
  });
});

describe('환불 정책(terms v3)', () => {
  // 지급 비율 환불은 AI 리워크 계약에만 붙는다 — 형식 검사는 리워크 조건 위에서 한다.
  const reworkFields = (raw: unknown) => {
    const result = validateProductionTerms(raw, 'rework');
    return result.ok ? [] : result.errors.map((error) => error.field);
  };
  const withPolicy = (stages: unknown): ProductionTerms => {
    const terms = JSON.parse(JSON.stringify(buildDefaultReworkTerms('small'))) as { refundPolicy?: unknown };
    terms.refundPolicy = { mode: 'paid_ratio', stages };
    return terms as unknown as ProductionTerms;
  };

  it('지급 비율 단계는 내림차순이고 마지막이 0이면 통과한다', () => {
    const policy = {
      mode: 'paid_ratio' as const,
      stages: [
        { event: 'kickoff' as const, ratio: 1 },
        { event: 'arrangement_delivered' as const, ratio: 0.5 },
        { event: 'distribution_submitted' as const, ratio: 0 },
      ],
    };
    const result = validateProductionTerms(withPolicy(policy.stages), 'rework');
    expect(result.ok && result.data.refundPolicy).toEqual(policy);
  });

  it('비율이 내림차순이 아니면 거부한다', () => {
    expect(reworkFields(withPolicy([
      { event: 'kickoff', ratio: 0.5 },
      { event: 'arrangement_delivered', ratio: 0.7 },
      { event: 'distribution_submitted', ratio: 0 },
    ]))).toContain('terms.refundPolicy');
  });

  it('마지막 단계가 0이 아니면 거부한다', () => {
    expect(reworkFields(withPolicy([
      { event: 'kickoff', ratio: 1 },
      { event: 'distribution_submitted', ratio: 0.1 },
    ]))).toContain('terms.refundPolicy');
  });

  it('모르는 사건 이름을 거부한다', () => {
    expect(reworkFields(withPolicy([{ event: 'whenever', ratio: 0 }]))).toContain('terms.refundPolicy');
  });

  it('단계는 1~5개여야 한다', () => {
    expect(reworkFields(withPolicy([]))).toContain('terms.refundPolicy');
    expect(reworkFields(withPolicy(Array.from({ length: 6 }, () => ({ event: 'kickoff', ratio: 0 }))))).toContain('terms.refundPolicy');
  });

  it('비율은 0~1 사이여야 한다', () => {
    expect(reworkFields(withPolicy([
      { event: 'kickoff', ratio: 1.2 },
      { event: 'distribution_submitted', ratio: 0 },
    ]))).toContain('terms.refundPolicy');
  });
});

describe('AI 리워크 기본 조건(rework, 2026-10-23)', () => {
  it('편곡 없음은 발매까지 번들 50만원 한 번에 — 2회차·잔금 없음, 지급 비율 환불', () => {
    const terms = buildDefaultReworkTerms('none');
    expect(terms.amount).toMatchObject({ total: 500_000, deposit: 500_000, second: 0, balance: 0 });
    expect(terms.scope.arrangementTracks).toBe(0);
    expect(terms.scope.recordingHours).toBe(3);
    expect(terms.refundPolicy?.mode).toBe('paid_ratio');
    expect(isSinglePayment(terms)).toBe(true);
  });

  it('소편성은 100만원을 50·30·20%로', () => {
    const terms = buildDefaultReworkTerms('small');
    expect(terms.amount).toMatchObject({ total: 1_000_000, deposit: 500_000, second: 300_000, balance: 200_000 });
    expect(terms.scope.arrangementTracks).toBe(10);
    expect(reworkScopeOf(terms)).toBe('small');
  });

  it('풀밴드는 150만원을 75·45·30만원으로, 편곡 상한은 풀밴드 상품의 30트랙', () => {
    const terms = buildDefaultReworkTerms('band');
    expect(terms.amount).toMatchObject({ total: 1_500_000, deposit: 750_000, second: 450_000, balance: 300_000 });
    expect(terms.scope.arrangementTracks).toBe(30);
    expect(reworkScopeOf(terms)).toBe('band');
  });

  it('환불 단계는 착수 70% · 녹음 40% · 믹싱 1차 20% · 마스터링 0%', () => {
    expect(buildDefaultReworkTerms('small').refundPolicy?.stages).toEqual([
      { event: 'kickoff', ratio: 0.7 },
      { event: 'recording_completed', ratio: 0.4 },
      { event: 'mixing_delivered', ratio: 0.2 },
      { event: 'mastering_delivered', ratio: 0 },
    ]);
  });

  it.each(['none', 'small', 'band'] as const)('%s 기본 조건이 검증을 통과하고 그대로 돌아온다', (scope) => {
    const terms = buildDefaultReworkTerms(scope);
    const result = validateProductionTerms(JSON.parse(JSON.stringify(terms)), 'rework');
    expect(result.ok).toBe(true);
    if (result.ok) expect(canonicalTermsJson(result.data)).toBe(canonicalTermsJson(terms));
  });

  it('buildDefaultProductionTerms("rework")는 편곡 없음 기본값', () => {
    expect(buildDefaultProductionTerms('rework')).toEqual(buildDefaultReworkTerms('none'));
  });

  it('리워크에서 환불 정책을 빼면 거절 — 항목표 한 줄로 정산되면 계약서 제10조와 어긋난다', () => {
    const { refundPolicy: _omit, ...terms } = buildDefaultReworkTerms('small');
    const result = validateProductionTerms(JSON.parse(JSON.stringify(terms)), 'rework');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.map((e) => e.field)).toContain('terms.refundPolicy');
  });

  it('다른 종류에는 지급 비율 환불을 붙일 수 없다', () => {
    const terms = { ...clone(), refundPolicy: buildDefaultReworkTerms('small').refundPolicy };
    const result = validateProductionTerms(JSON.parse(JSON.stringify(terms)), 'single');
    expect(result.ok).toBe(false);
  });

  it('회귀 — 싱글·EP·정규 기본 조건은 2회차가 없고 환불 정책도 없다', () => {
    for (const [kind, count] of [['single', 1], ['ep', 4], ['album', 8]] as const) {
      const terms = buildDefaultProductionTerms(kind, count);
      expect(terms.amount.second).toBe(0);
      expect(terms.refundPolicy).toBeUndefined();
    }
  });

  it('리워크 이름·자료 이름·항목표 라벨', () => {
    expect(KIND_LABEL.rework).toBe('AI 리워크');
    expect(sourceLabelFor('rework')).toBe('AI 데모 파일');
    expect(isOneSongKind('rework')).toBe(true);
    expect(buildDefaultReworkTerms('small').refundSchedule).toEqual([
      { key: 'planning', label: 'AI 리워크 제작 일체 (제2조)', amount: 1_000_000, milestones: [{ event: 'mastering_delivered', ratio: 1 }] },
    ]);
  });
});

describe('편곡 없는 AI 리워크는 믹싱·마스터링 계약으로 읽히지 않는다', () => {
  it('녹음·유통 등록 기록을 숨기지 않는다 — 믹싱·마스터링 판정은 편곡·녹음이 모두 0일 때만', () => {
    expect(isMixMasterTerms(buildDefaultReworkTerms('none'))).toBe(false);
    expect(isMixMasterTerms(buildDefaultProductionTerms('mixmaster'))).toBe(true);
    expect(adminEventTypesFor(isMixMasterTerms(buildDefaultReworkTerms('none')))).toEqual(
      expect.arrayContaining(['recording_completed', 'distribution_submitted', 'released']),
    );
  });
});

describe('기록 이름 — 종류별 자료 이름', () => {
  it('리워크는 AI 데모 파일, 믹싱·마스터링은 작업 파일, 제작은 1차 완성본', () => {
    expect(eventLabelFor('source_received', isMixMasterTerms(buildDefaultReworkTerms('none')), isReworkTerms(buildDefaultReworkTerms('none')))).toBe('AI 데모 파일 수령');
    expect(eventLabelFor('source_received', true)).toBe('작업 파일 수령');
    expect(eventLabelFor('source_received', false, isReworkTerms(buildDefaultProductionTerms()))).toBe('1차 완성본 수령');
    expect(sourceLabelForTerms(buildDefaultReworkTerms('band'))).toBe('AI 데모 파일');
    expect(sourceLabelForTerms(buildDefaultProductionTerms('mixmaster'))).toBe('작업 파일');
  });
});
