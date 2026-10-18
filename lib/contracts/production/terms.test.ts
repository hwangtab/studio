import {
  ARRANGEMENT_SMALL_PRICE,
  SINGLE_BUNDLE_PRICE,
  VOCAL_TUNING_ADDON_PRICE,
} from '../../../data/pricing';
import {
  buildDefaultProductionTerms,
  canonicalTermsJson,
  parseStoredTerms,
  REFUND_ITEM_KEYS,
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
    terms.songTitle = '   ';
    const result = validateProductionTerms(terms);
    expect(result.ok && result.data.songTitle).toBeNull();
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
    expect(() => parseStoredTerms(JSON.stringify({ version: 2 }))).toThrow();
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
