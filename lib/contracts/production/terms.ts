import {
  ARRANGEMENT_SMALL_PRICE,
  SINGLE_BUNDLE_PRICE,
  VOCAL_TUNING_ADDON_PRICE,
} from '../../../data/pricing';
import { BANK_ACCOUNT } from '../../payments/bankAccount';
import { CONTROL_CHARS, type ValidationError } from '../validation';

/**
 * 제작 계약의 조건 — 계약마다 굳혀 `production_contracts.terms_json`에 둔다.
 *
 * 금액·분할·수정 횟수·기한 일수가 전부 여기 있다. 템플릿은 이 값을 본문에 찍기만 하고, 나중에
 * 기한을 계산하는 코드(진행 기록)도 코드 상수가 아니라 **그 계약의 terms**를 읽는다. 정본 상수나
 * 템플릿이 바뀌어도 이미 맺은 계약의 약속은 그대로여야 하기 때문이다.
 *
 * 형식이 바뀌면 version을 올리고 옛 version을 읽는 길을 남긴다(지문의 버전 레지스트리와 같은 이유).
 */

export const REFUND_ITEM_KEYS = ['arrangement', 'recording', 'tuning', 'mixmaster', 'planning'] as const;
export type RefundItemKey = (typeof REFUND_ITEM_KEYS)[number];

export const REVISION_STAGES = ['arrangement', 'mixing', 'mastering'] as const;
export type RevisionStage = (typeof REVISION_STAGES)[number];

/**
 * 해지 정산(제10조 3항)에서 "작업분"으로 보는 시점. 진행 기록(events)의 사건 이름과 같다 — 정산 계산
 * (ledger.ts)이 이 이름으로 기록을 찾는다.
 */
export const REFUND_MILESTONE_EVENTS = [
  'kickoff',
  'arrangement_delivered',
  'recording_completed',
  'tuning_delivered',
  'mixing_delivered',
  'mastering_delivered',
  'distribution_submitted',
] as const;
export type RefundMilestoneEvent = (typeof REFUND_MILESTONE_EVENTS)[number];

/** 이 사건이 기록되면 그 항목 금액의 ratio만큼을 작업분으로 본다. 같은 항목의 경계는 비율 오름차순. */
export interface RefundMilestone {
  event: RefundMilestoneEvent;
  ratio: number;
}

export interface RefundItem {
  key: RefundItemKey;
  /** 계약서 제10조 항목표에 그대로 인쇄된다. */
  label: string;
  amount: number;
  /** 작업분으로 보는 경계. 마지막 경계의 ratio가 1이면 그때 그 항목이 완료다. */
  milestones: RefundMilestone[];
}

export interface ProductionTerms {
  version: 1;
  /** 곡 제목. 미정이면 null — 제2조가 "제목이 정해지거나 바뀌어도 동일한 곡"이라 정한다. */
  songTitle: string | null;
  scope: {
    arrangementTracks: number;
    recordingHours: number;
    mixingTracks: number;
  };
  amount: {
    /** 계약금액(부가세 포함). */
    total: number;
    deposit: number;
    balance: number;
    /** 계약금 기한: 체결일부터. */
    depositDueDays: number;
    /** 잔금 기한: 최종 마스터 승인일부터. */
    balanceDueDays: number;
  };
  payment: { bank: string; account: string; holder: string };
  /** 작업 기간(주). 계약금 입금과 1차 완성본 수령이 모두 끝난 날부터. */
  workWeeks: number;
  revisions: Record<RevisionStage, number>;
  extraRevisionFees: Record<RevisionStage, number>;
  /** 결과물 전달 후 이 일수 안에 수정 요청이 없으면 승인으로 본다(제5조 5항). */
  deemedApprovalDays: number;
  /** 착수 후 해지 때 공제하는 항목표(제10조 3항). 합계 = 계약금액. */
  refundSchedule: RefundItem[];
  clientUnresponsiveDays: number;
  paymentDelayDays: number;
  /** 스튜디오 사유 지연이 이 주수를 넘으면 의뢰인이 해지할 수 있다(제12조 2항). */
  studioDelayWeeks: number;
  /** 의뢰인이 유통 정보·크레딧에 표기할 문구(제7조 3항). */
  credits: string;
}

const REFUND_LABELS: Record<RefundItemKey, string> = {
  arrangement: '편곡 (제2조 2호)',
  recording: '보컬 녹음 (제2조 3호)',
  tuning: '보컬 음정·박자 보정 (제2조 4호)',
  mixmaster: '믹싱·마스터링 (제2조 5호)',
  planning: '기획 상담·유통 등록·발매 홍보 (제2조 1·6·7호)',
};

/**
 * 싱글 번들(SINGLE_BUNDLE_PRICE)을 환불 항목표로 나눈 비율 — 녹음 4 : 믹싱·마스터링 4 : 기획·유통·홍보 2.
 *
 * 정본(data/pricing.ts)에 없는 계약 전용 값이다. 사이트에 쓰지 않으므로 상수로 올리지 않고 여기 둔다.
 * 비율로 적어 두면 번들 가격이 바뀌어도 항목표 합계가 계약금액과 맞는다(나머지는 기획 항목이 받는다).
 */
const BUNDLE_SPLIT = { recording: 0.4, mixmaster: 0.4 } as const;

/**
 * 해지 정산 경계 — 운영자 결정(2026-10-18). 결과물이 나간 시점이면 그 작업의 대부분이 끝났다고 본다:
 * 편곡은 1차 시안, 믹싱·마스터링은 믹싱 1차, 보정은 보정본을 전달한 때, 녹음은 세션을 마친 때 전액.
 * 기획·유통·홍보는 착수(기획 상담) 때 30%, 유통 등록을 마친 때 전액.
 */
const DEFAULT_MILESTONES: Record<RefundItemKey, RefundMilestone[]> = {
  arrangement: [{ event: 'arrangement_delivered', ratio: 1 }],
  recording: [{ event: 'recording_completed', ratio: 1 }],
  tuning: [{ event: 'tuning_delivered', ratio: 1 }],
  mixmaster: [{ event: 'mixing_delivered', ratio: 1 }],
  planning: [
    { event: 'kickoff', ratio: 0.3 },
    { event: 'distribution_submitted', ratio: 1 },
  ],
};

/**
 * 초과 수정 요금(회당, 부가세 포함). 계약 전용 값이다 — 사이트에도 싣게 되면 data/pricing.ts로 올린다
 * (그쪽 가격 리터럴 스캔은 lib/를 보지 않는다).
 */
const DEFAULT_EXTRA_REVISION_FEES: Record<RevisionStage, number> = {
  arrangement: 100_000,
  mixing: 50_000,
  mastering: 30_000,
};

const DEFAULT_CREDITS = 'Arranged by 황경하 / Recorded · Mixed by 스튜디오 놀';

/**
 * 싱글 제작 계약의 기본 조건. 계약금액은 정본 상수의 합이다 — 소편성 편곡 + 싱글 번들 + 보컬 보정.
 * 작성 폼이 이 값으로 시작하고, 운영자가 견적에 맞춰 고친다.
 */
export const buildDefaultProductionTerms = (): ProductionTerms => {
  const total = ARRANGEMENT_SMALL_PRICE + SINGLE_BUNDLE_PRICE + VOCAL_TUNING_ADDON_PRICE;
  const deposit = Math.round(total / 2);
  const recording = Math.round(SINGLE_BUNDLE_PRICE * BUNDLE_SPLIT.recording);
  const mixmaster = Math.round(SINGLE_BUNDLE_PRICE * BUNDLE_SPLIT.mixmaster);

  const amounts: Record<RefundItemKey, number> = {
    arrangement: ARRANGEMENT_SMALL_PRICE,
    recording,
    tuning: VOCAL_TUNING_ADDON_PRICE,
    mixmaster,
    planning: SINGLE_BUNDLE_PRICE - recording - mixmaster,
  };

  return {
    version: 1,
    songTitle: null,
    scope: { arrangementTracks: 10, recordingHours: 3, mixingTracks: 10 },
    amount: { total, deposit, balance: total - deposit, depositDueDays: 3, balanceDueDays: 7 },
    payment: {
      bank: BANK_ACCOUNT.bankName,
      account: BANK_ACCOUNT.accountNumber,
      holder: BANK_ACCOUNT.accountHolder,
    },
    workWeeks: 8,
    revisions: { arrangement: 2, mixing: 2, mastering: 1 },
    extraRevisionFees: { ...DEFAULT_EXTRA_REVISION_FEES },
    deemedApprovalDays: 7,
    refundSchedule: REFUND_ITEM_KEYS.map((key) => ({
      key,
      label: REFUND_LABELS[key],
      amount: amounts[key],
      milestones: DEFAULT_MILESTONES[key].map((milestone) => ({ ...milestone })),
    })),
    clientUnresponsiveDays: 30,
    paymentDelayDays: 14,
    studioDelayWeeks: 4,
    credits: DEFAULT_CREDITS,
  };
};

/** 실수로 0을 하나 더 붙이는 입력을 막는 상한(1억). 연습실은 월 1,000만원이지만 정규 앨범 계약을 염두에 둔다. */
const MAX_AMOUNT = 100_000_000;

type TermsValidation = { ok: true; data: ProductionTerms } | { ok: false; errors: ValidationError[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * 작성 폼·API가 보낸 조건을 검증한다. 오류의 field는 `terms.amount.deposit`처럼 경로로 적어
 * 폼이 해당 칸 아래에 붙일 수 있게 한다.
 *
 * 합계 불변식이 핵심이다. 계약금 + 잔금, 항목표 합계가 계약금액과 어긋나면 같은 계약서 안에서
 * 제3조와 제10조가 서로 다른 금액을 말하게 되고, 해지 정산 때 어느 쪽이 맞는지가 곧 돈 문제가 된다.
 */
export const validateProductionTerms = (raw: unknown): TermsValidation => {
  const errors: ValidationError[] = [];
  const push = (field: string, message: string) => errors.push({ field, message });

  if (!isRecord(raw)) {
    return { ok: false, errors: [{ field: 'terms', message: '계약 조건 형식이 올바르지 않습니다.' }] };
  }

  const readInt = (
    source: unknown,
    key: string,
    field: string,
    { min, max }: { min: number; max: number },
  ): number => {
    const value = isRecord(source) ? source[key] : undefined;
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      push(field, '정수를 입력해 주세요.');
      return 0;
    }
    if (value < min || value > max) {
      push(field, `${min.toLocaleString('ko-KR')}~${max.toLocaleString('ko-KR')} 사이로 입력해 주세요.`);
      return 0;
    }
    return value;
  };

  const readText = (
    value: unknown,
    field: string,
    { maxLength, required }: { maxLength: number; required: boolean },
  ): string | null => {
    if (typeof value !== 'string' || value.trim() === '') {
      if (required) push(field, '필수 항목입니다.');
      return null;
    }
    const trimmed = value.trim();
    if (trimmed.length > maxLength) {
      push(field, `${maxLength}자 이내로 입력해 주세요.`);
      return null;
    }
    // 표 셀·크레딧 줄에 그대로 인쇄된다 — 한 줄 입력과 같은 규칙(validation.ts CONTROL_CHARS 주석).
    if (CONTROL_CHARS.test(trimmed)) {
      push(field, '줄바꿈이나 보이지 않는 문자는 사용할 수 없습니다.');
      return null;
    }
    return trimmed;
  };

  const money = { min: 0, max: MAX_AMOUNT };

  /**
   * 경계는 하나 이상, 사건 이름은 정해진 것만, 비율은 0 초과 1 이하로 오름차순이고 마지막은 1이어야 한다 —
   * 끝까지 가도 항목이 완료되지 않는 경계표는 정산을 끝낼 수 없다.
   */
  const readMilestones = (raw: unknown, field: string): RefundMilestone[] => {
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > 5) {
      push(field, '정산 경계는 1~5개여야 합니다.');
      return [];
    }
    const milestones: RefundMilestone[] = [];
    for (const entry of raw) {
      const event = isRecord(entry) ? entry.event : undefined;
      const ratio = isRecord(entry) ? entry.ratio : undefined;
      if (typeof event !== 'string' || !(REFUND_MILESTONE_EVENTS as readonly string[]).includes(event)) {
        push(field, '알 수 없는 정산 경계입니다.');
        return [];
      }
      if (typeof ratio !== 'number' || !(ratio > 0 && ratio <= 1)) {
        push(field, '정산 비율은 0보다 크고 1 이하여야 합니다.');
        return [];
      }
      milestones.push({ event: event as RefundMilestoneEvent, ratio });
    }
    const ascending = milestones.every((m, i) => i === 0 || m.ratio > milestones[i - 1].ratio);
    if (!ascending || milestones[milestones.length - 1].ratio !== 1) {
      push(field, '정산 비율은 오름차순이고 마지막 경계가 100%여야 합니다.');
      return [];
    }
    return milestones;
  };
  const days = { min: 1, max: 90 };

  const songTitle = readText(raw.songTitle, 'terms.songTitle', { maxLength: 100, required: false });

  const scope = {
    arrangementTracks: readInt(raw.scope, 'arrangementTracks', 'terms.scope.arrangementTracks', { min: 1, max: 200 }),
    recordingHours: readInt(raw.scope, 'recordingHours', 'terms.scope.recordingHours', { min: 1, max: 100 }),
    mixingTracks: readInt(raw.scope, 'mixingTracks', 'terms.scope.mixingTracks', { min: 1, max: 200 }),
  };

  const amount = {
    total: readInt(raw.amount, 'total', 'terms.amount.total', { min: 1, max: MAX_AMOUNT }),
    deposit: readInt(raw.amount, 'deposit', 'terms.amount.deposit', money),
    balance: readInt(raw.amount, 'balance', 'terms.amount.balance', money),
    depositDueDays: readInt(raw.amount, 'depositDueDays', 'terms.amount.depositDueDays', days),
    balanceDueDays: readInt(raw.amount, 'balanceDueDays', 'terms.amount.balanceDueDays', days),
  };

  if (amount.total > 0 && amount.deposit + amount.balance !== amount.total) {
    push(
      'terms.amount.balance',
      `계약금과 잔금의 합이 계약금액(${amount.total.toLocaleString('ko-KR')}원)과 같아야 합니다.`,
    );
  }

  const paymentRaw = isRecord(raw.payment) ? raw.payment : {};
  const payment = {
    bank: readText(paymentRaw.bank, 'terms.payment.bank', { maxLength: 30, required: true }) ?? '',
    account: readText(paymentRaw.account, 'terms.payment.account', { maxLength: 40, required: true }) ?? '',
    holder: readText(paymentRaw.holder, 'terms.payment.holder', { maxLength: 60, required: true }) ?? '',
  };

  const workWeeks = readInt(raw, 'workWeeks', 'terms.workWeeks', { min: 1, max: 52 });

  const revisions = Object.fromEntries(
    REVISION_STAGES.map((stage) => [stage, readInt(raw.revisions, stage, `terms.revisions.${stage}`, { min: 0, max: 10 })]),
  ) as Record<RevisionStage, number>;

  const extraRevisionFees = Object.fromEntries(
    REVISION_STAGES.map((stage) => [
      stage,
      readInt(raw.extraRevisionFees, stage, `terms.extraRevisionFees.${stage}`, money),
    ]),
  ) as Record<RevisionStage, number>;

  const deemedApprovalDays = readInt(raw, 'deemedApprovalDays', 'terms.deemedApprovalDays', days);
  const clientUnresponsiveDays = readInt(raw, 'clientUnresponsiveDays', 'terms.clientUnresponsiveDays', days);
  const paymentDelayDays = readInt(raw, 'paymentDelayDays', 'terms.paymentDelayDays', days);
  const studioDelayWeeks = readInt(raw, 'studioDelayWeeks', 'terms.studioDelayWeeks', { min: 1, max: 26 });
  const credits = readText(raw.credits, 'terms.credits', { maxLength: 200, required: true }) ?? '';

  /**
   * 항목표는 다섯 항목이 정해진 순서로 한 번씩 — 제10조가 제2조의 각 호를 하나씩 가리키기 때문이다.
   * 항목을 빼거나 늘리면 어느 작업분이 어느 금액인지가 조항과 어긋난다. 라벨은 서버가 다시 붙인다
   * (클라이언트가 보낸 라벨을 그대로 인쇄하지 않는다).
   */
  const refundSchedule: RefundItem[] = [];
  if (!Array.isArray(raw.refundSchedule) || raw.refundSchedule.length !== REFUND_ITEM_KEYS.length) {
    push('terms.refundSchedule', `환불 항목표는 ${REFUND_ITEM_KEYS.length}개 항목이어야 합니다.`);
  } else {
    REFUND_ITEM_KEYS.forEach((key, index) => {
      const item = (raw.refundSchedule as unknown[])[index];
      if (!isRecord(item) || item.key !== key) {
        push(`terms.refundSchedule.${key}`, '환불 항목의 순서나 이름이 올바르지 않습니다.');
        return;
      }
      refundSchedule.push({
        key,
        label: REFUND_LABELS[key],
        amount: readInt(item, 'amount', `terms.refundSchedule.${key}`, money),
        milestones: readMilestones(item.milestones, `terms.refundSchedule.${key}.milestones`),
      });
    });
    const sum = refundSchedule.reduce((acc, item) => acc + item.amount, 0);
    if (refundSchedule.length === REFUND_ITEM_KEYS.length && amount.total > 0 && sum !== amount.total) {
      push(
        'terms.refundSchedule',
        `환불 항목표 합계(${sum.toLocaleString('ko-KR')}원)가 계약금액(${amount.total.toLocaleString('ko-KR')}원)과 같아야 합니다.`,
      );
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      version: 1,
      songTitle,
      scope,
      amount,
      payment,
      workWeeks,
      revisions,
      extraRevisionFees,
      deemedApprovalDays,
      refundSchedule,
      clientUnresponsiveDays,
      paymentDelayDays,
      studioDelayWeeks,
      credits,
    },
  };
};

/**
 * 키를 정렬한 JSON. 저장과 지문이 같은 문자열을 쓴다 — 객체 키 순서가 바뀌었다는 이유로 같은 조건의
 * 지문이 달라지면 안 된다.
 */
export const canonicalTermsJson = (terms: ProductionTerms): string => {
  const sortKeys = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (isRecord(value)) {
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => [key, sortKeys(value[key])]),
      );
    }
    return value;
  };
  return JSON.stringify(sortKeys(terms));
};

/**
 * 저장된 조건을 읽는다. 저장 때 검증을 거쳤으므로 다시 검증하지 않고 형식만 본다 — 읽지 못하면 던진다.
 * 조건을 모르는 계약으로 본문·PDF를 만들면 빈 금액이 인쇄되므로, 조용히 기본값으로 메우지 않는다.
 */
export const parseStoredTerms = (raw: string): ProductionTerms => {
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed) || parsed.version !== 1) {
    throw new Error('알 수 없는 제작 계약 조건 형식입니다.');
  }
  return parsed as unknown as ProductionTerms;
};
