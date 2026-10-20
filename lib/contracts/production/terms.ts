import {
  ALBUM_BUNDLE_PER_SONG_PRICE,
  ARRANGEMENT_SMALL_PRICE,
  EP_BUNDLE_PER_SONG_PRICE,
  MASTERING_SINGLE_PRICE,
  MIXING_LEVEL1_PRICE,
  MIXING_LEVEL2_PRICE,
  MIXING_LEVEL3_PRICE,
  SINGLE_BUNDLE_PRICE,
  VOCAL_TUNING_ADDON_PRICE,
} from '../../../data/pricing';
import type { productionContractKindEnum } from '../../../db/schema';
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
 * v2(0073): 곡 목록(songs)과 음반 제목 — EP·정규도 같은 형식이고, 싱글은 곡이 하나인 경우다. v1(songTitle 하나)은
 * 읽을 때 v2로 올린다(parseStoredTerms). 저장된 문자열은 그대로라 지문 대조는 바뀌지 않는다.
 */

export type ProductionKind = (typeof productionContractKindEnum)[number];

/** 종류별 곡 수 범위. EP는 상품이 3~5곡이지만 2곡·6~7곡 계약도 받는다(경계는 상담으로 정한다). */
export const SONG_COUNT_RANGE: Record<ProductionKind, { min: number; max: number }> = {
  single: { min: 1, max: 1 },
  ep: { min: 2, max: 7 },
  album: { min: 6, max: 20 },
  mixmaster: { min: 1, max: 1 },
};

export const KIND_LABEL: Record<ProductionKind, string> = { single: '싱글', ep: 'EP', album: '정규 앨범', mixmaster: '믹싱·마스터링' };

/**
 * 곡이 하나인 종류 — 음반 제목이 없고 곡 제목이 곧 화면 이름이다. 싱글 제작과 믹싱·마스터링(1곡)이 여기 든다.
 * `kind === 'single'`로 "곡 하나"를 판정하던 자리는 이 함수를 쓴다 — 믹싱·마스터링이 EP처럼 읽히지 않게.
 */
export const isOneSongKind = (kind: ProductionKind): boolean => kind === 'single' || kind === 'mixmaster';

/** 믹싱·마스터링만 하는 계약인가 — 편곡·녹음·유통·홍보가 범위에 없다(mixmaster-template.md). */
export const isMixMasterKind = (kind: ProductionKind): boolean => kind === 'mixmaster';

/**
 * 이 금액 이하 계약은 계약금·잔금으로 나누지 않고 한 번에 받는다(운영자 결정 2026-10-20). 체결 후 계약금 기한
 * 안에 전액 — 계약금 = 계약금액, 잔금 = 0. 엔진은 그대로 돌아간다(잔금이 없으면 입금 확인 = 전액).
 */
export const SINGLE_PAYMENT_MAX = 500_000;

/** 계약금액을 계약금·잔금으로 나눈다 — 위 금액 이하면 한 번에, 넘으면 절반씩. */
export const splitPayment = (total: number): { deposit: number; balance: number } => {
  const deposit = total <= SINGLE_PAYMENT_MAX ? total : Math.round(total / 2);
  return { deposit, balance: total - deposit };
};

/** 잔금 없이 한 번에 받는 계약인가. */
export const isSinglePayment = (terms: Pick<ProductionTerms, 'amount'>): boolean => terms.amount.balance === 0;

/** 체결 후 먼저 받는 돈의 이름 — 한 번에 받으면 "대금", 나눠 받으면 "계약금". 계약서·메일·화면이 같은 말을 쓴다. */
export const depositWordFor = (terms: Pick<ProductionTerms, 'amount'>): string => (isSinglePayment(terms) ? '대금' : '계약금');

/** 계약서 이름 — 메일 제목·PDF·서명 화면에 쓴다. */
export const contractNameFor = (kind: ProductionKind): string =>
  isMixMasterKind(kind) ? '믹싱·마스터링 용역 계약서' : '음원 제작 용역 계약서';

/**
 * 의뢰인이 처음 보내는 자료의 이름. 제작 계약은 가이드 음원("1차 완성본", 제1조), 믹싱·마스터링 계약은
 * 녹음이 끝난 트랙별 파일("작업 파일", 제1조)이다. 진행 기록의 `source_received`가 이것을 받은 날이다.
 */
export const sourceLabelFor = (kind: ProductionKind): string => (isMixMasterKind(kind) ? '작업 파일' : '1차 완성본');

export const REFUND_ITEM_KEYS = ['arrangement', 'recording', 'tuning', 'mixmaster', 'planning'] as const;
export type RefundItemKey = (typeof REFUND_ITEM_KEYS)[number];

/**
 * 종류별 환불 항목표의 항목(순서 고정). 제작 계약은 제2조 각 호를 하나씩 가리키는 다섯 항목, 믹싱·마스터링 계약은
 * 제2조 전체인 한 항목이다 — 그 안의 믹싱·마스터링 경계는 milestones가 나눈다.
 */
export const refundItemKeysFor = (kind: ProductionKind): readonly RefundItemKey[] =>
  isMixMasterKind(kind) ? ['mixmaster'] : REFUND_ITEM_KEYS;

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

/** 곡마다 일어나는 사건 — 여러 곡 계약에서는 "곡마다 … 그 곡의 몫"으로 읽는다(template.ts 문장, ledger.ts 계산). */
export const PER_SONG_MILESTONES: ReadonlySet<RefundMilestoneEvent> = new Set([
  'arrangement_delivered',
  'recording_completed',
  'tuning_delivered',
  'mixing_delivered',
]);

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

export interface ProductionSong {
  /** 곡 제목. 미정이면 null — 제2조가 "제목이 정해지거나 바뀌어도 같은 곡(순번)"이라 정한다. */
  title: string | null;
}

export interface ProductionTerms {
  version: 2;
  /** 음반 제목(EP·정규). 싱글은 곡 제목이 곧 발매 제목이라 비운다. */
  albumTitle: string | null;
  /** 수록곡. 싱글은 정확히 하나. 진행 기록의 곡 번호(events.song)는 이 배열의 순번이다. */
  songs: ProductionSong[];
  scope: {
    /** 곡당 편곡 트랙 수 상한. */
    arrangementTracks: number;
    /** 곡당 보컬 녹음 시간. */
    recordingHours: number;
    /** 곡당 믹싱 트랙 수 상한. */
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
  /** 작업 기간(주). 계약금 입금과 1차 완성본 수령이 모두 끝난 날부터 — 최종 마스터 납품 기한이다(제4조 1항). */
  workWeeks: number;
  /**
   * 믹싱·마스터링 계약만 — 믹싱 1차 결과물의 납품 기한(영업일, 제4조 1항). 사이트 약속(파일 수령 후 3~7영업일)의 끝값이
   * 기본이다. 제작 계약에는 없다(1차 결과물이 편곡 시안이라 성격이 다르다). 이 필드가 생기기 전 계약은 없다.
   */
  firstDeliveryBusinessDays?: number;
  /** 무료 수정 횟수 — 편곡·믹싱은 곡마다, 마스터링은 음반 전체에 대해. */
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

/** 제10조 항목표에 인쇄되는 이름. 믹싱·마스터링 계약은 조항 번호가 달라(제2조 전체) 따로 둔다. */
export const refundLabelFor = (kind: ProductionKind, key: RefundItemKey): string =>
  isMixMasterKind(kind) && key === 'mixmaster' ? '믹싱·마스터링 (제2조)' : REFUND_LABELS[key];

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
const MIXMASTER_CREDITS = 'Mixed · Mastered by 스튜디오 놀';

/** 곡당 번들 단가 — 싱글 번들, EP·정규 번들의 곡당 값(정본 상수). 믹싱·마스터링은 번들이 아니라 아래에서 따로 만든다. */
const BUNDLE_PER_SONG: Record<Exclude<ProductionKind, 'mixmaster'>, number> = {
  single: SINGLE_BUNDLE_PRICE,
  ep: EP_BUNDLE_PER_SONG_PRICE,
  album: ALBUM_BUNDLE_PER_SONG_PRICE,
};

/**
 * 작업 기간 기본값(주). 싱글 8주는 계약서 원문, EP·정규는 곡 수를 고려한 출발값이다 — **운영자 확인 필요**
 * (EP·정규 계약서 초안 검토와 함께). 작성 폼에서 계약마다 고친다.
 */
const DEFAULT_WORK_WEEKS: Record<ProductionKind, number> = { single: 8, ep: 12, album: 20, mixmaster: 2 };

/**
 * 믹싱·마스터링 계약의 기본 조건 — 사이트 정가(믹싱 10트랙 이하 + 싱글 마스터링, data/pricing.ts) 그대로.
 * 작업 기간 2주: 사이트 약속은 파일 수령 후 3~7영업일 완성본이고, 수정 2회를 주고받는 시간을 더했다.
 * 해지 정산은 믹싱 1차를 전달하면 믹싱 몫(정가 비율), 마스터링을 전달하면 전액을 작업분으로 본다.
 */
const buildDefaultMixMasterTerms = (): ProductionTerms => {
  return applyMixMasterTracks(MIXMASTER_BASE(), 10);
};

/** 트랙 수 → 믹싱 정가(사이트 표기: 10트랙 이하 / 11~30트랙 / 31트랙 이상, data/pricing.ts). */
export const mixingPriceForTracks = (tracks: number): number =>
  tracks <= 10 ? MIXING_LEVEL1_PRICE : tracks <= 30 ? MIXING_LEVEL2_PRICE : MIXING_LEVEL3_PRICE;

/**
 * 믹싱·마스터링 조건을 트랙 수에 맞춘다 — 믹싱 정가 + 싱글 마스터링, 계약금 절반, 항목표 금액 = 계약금액,
 * 믹싱 1차 전달 경계는 그 금액에서 믹싱이 차지하는 비율. 작성 폼(트랙 수를 바꿀 때)과 링크 계약 스크립트
 * (scripts/contract-link.ts)가 같은 계산을 쓴다. 정가와 다른 금액은 이 뒤에 계약금액을 고친다.
 */
export const applyMixMasterTracks = (terms: ProductionTerms, tracks: number): ProductionTerms => {
  const mixing = mixingPriceForTracks(tracks);
  const total = mixing + MASTERING_SINGLE_PRICE;
  return {
    ...terms,
    scope: { ...terms.scope, mixingTracks: tracks },
    amount: { ...terms.amount, total, ...splitPayment(total) },
    refundSchedule: [
      {
        key: 'mixmaster',
        label: refundLabelFor('mixmaster', 'mixmaster'),
        amount: total,
        milestones: [
          { event: 'mixing_delivered', ratio: Math.round((mixing / total) * 100) / 100 },
          { event: 'mastering_delivered', ratio: 1 },
        ],
      },
    ],
  };
};

const MIXMASTER_BASE = (): ProductionTerms => {
  const total = MIXING_LEVEL1_PRICE + MASTERING_SINGLE_PRICE;
  const deposit = Math.round(total / 2);
  const mixingShare = Math.round((MIXING_LEVEL1_PRICE / total) * 100) / 100;
  return {
    version: 2,
    albumTitle: null,
    songs: [{ title: null }],
    scope: { arrangementTracks: 0, recordingHours: 0, mixingTracks: 10 },
    amount: { total, deposit, balance: total - deposit, depositDueDays: 3, balanceDueDays: 7 },
    payment: {
      bank: BANK_ACCOUNT.bankName,
      account: BANK_ACCOUNT.accountNumber,
      holder: BANK_ACCOUNT.accountHolder,
    },
    workWeeks: DEFAULT_WORK_WEEKS.mixmaster,
    firstDeliveryBusinessDays: 7,
    revisions: { arrangement: 0, mixing: 2, mastering: 1 },
    extraRevisionFees: { arrangement: 0, mixing: DEFAULT_EXTRA_REVISION_FEES.mixing, mastering: DEFAULT_EXTRA_REVISION_FEES.mastering },
    deemedApprovalDays: 7,
    refundSchedule: [
      {
        key: 'mixmaster',
        label: refundLabelFor('mixmaster', 'mixmaster'),
        amount: total,
        milestones: [
          { event: 'mixing_delivered', ratio: mixingShare },
          { event: 'mastering_delivered', ratio: 1 },
        ],
      },
    ],
    clientUnresponsiveDays: 30,
    paymentDelayDays: 14,
    studioDelayWeeks: 2,
    credits: MIXMASTER_CREDITS,
  };
};

/**
 * 기본 조건. 계약금액은 정본 상수의 곡 수 배다 — 곡마다 소편성 편곡 + 번들 곡당 단가 + 보컬 보정.
 * 작성 폼이 이 값으로 시작하고, 운영자가 견적에 맞춰 고친다.
 */
export const buildDefaultProductionTerms = (kind: ProductionKind = 'single', songCount = 1): ProductionTerms => {
  if (kind === 'mixmaster') return buildDefaultMixMasterTerms();
  const count = Math.min(Math.max(songCount, SONG_COUNT_RANGE[kind].min), SONG_COUNT_RANGE[kind].max);
  const bundle = BUNDLE_PER_SONG[kind] * count;
  const total = (ARRANGEMENT_SMALL_PRICE + VOCAL_TUNING_ADDON_PRICE) * count + bundle;
  const { deposit } = splitPayment(total);
  const recording = Math.round(bundle * BUNDLE_SPLIT.recording);
  const mixmaster = Math.round(bundle * BUNDLE_SPLIT.mixmaster);

  const amounts: Record<RefundItemKey, number> = {
    arrangement: ARRANGEMENT_SMALL_PRICE * count,
    recording,
    tuning: VOCAL_TUNING_ADDON_PRICE * count,
    mixmaster,
    planning: bundle - recording - mixmaster,
  };

  return {
    version: 2,
    albumTitle: null,
    songs: Array.from({ length: count }, () => ({ title: null })),
    scope: { arrangementTracks: 10, recordingHours: 3, mixingTracks: 10 },
    amount: { total, deposit, balance: total - deposit, depositDueDays: 3, balanceDueDays: 7 },
    payment: {
      bank: BANK_ACCOUNT.bankName,
      account: BANK_ACCOUNT.accountNumber,
      holder: BANK_ACCOUNT.accountHolder,
    },
    workWeeks: DEFAULT_WORK_WEEKS[kind],
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
export const validateProductionTerms = (raw: unknown, kind: ProductionKind = 'single'): TermsValidation => {
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

  // 곡이 하나인 종류(싱글·믹싱·마스터링)는 음반 제목을 받지 않는다 — 곡 제목이 곧 발매 제목이다.
  const albumTitle = isOneSongKind(kind) ? null : readText(raw.albumTitle, 'terms.albumTitle', { maxLength: 100, required: false });
  const range = SONG_COUNT_RANGE[kind];
  const songs: ProductionSong[] = [];
  if (!Array.isArray(raw.songs) || raw.songs.length < range.min || raw.songs.length > range.max) {
    push('terms.songs', range.min === range.max ? `곡은 ${range.min}곡이어야 합니다.` : `곡 수는 ${range.min}~${range.max}곡이어야 합니다.`);
  } else {
    raw.songs.forEach((song, index) => {
      songs.push({ title: readText(isRecord(song) ? song.title : undefined, `terms.songs.${index}`, { maxLength: 100, required: false }) });
    });
  }

  // 믹싱·마스터링 계약은 편곡·녹음이 범위에 없다 — 0을 받는다(계약서에 인쇄되지 않는다).
  const mixMaster = isMixMasterKind(kind);
  const scope = {
    arrangementTracks: readInt(raw.scope, 'arrangementTracks', 'terms.scope.arrangementTracks', { min: mixMaster ? 0 : 1, max: 200 }),
    recordingHours: readInt(raw.scope, 'recordingHours', 'terms.scope.recordingHours', { min: mixMaster ? 0 : 1, max: 100 }),
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
  // 믹싱·마스터링만 1차 결과물 납품 기한을 둔다(제4조 1항). 다른 종류로 와도 버린다 — 계약서에 인쇄될 자리가 없다.
  const firstDeliveryBusinessDays = mixMaster
    ? readInt(raw, 'firstDeliveryBusinessDays', 'terms.firstDeliveryBusinessDays', { min: 1, max: 60 })
    : undefined;
  if (mixMaster && firstDeliveryBusinessDays !== undefined && workWeeks > 0 && firstDeliveryBusinessDays > workWeeks * 5) {
    push('terms.firstDeliveryBusinessDays', '1차 결과물 기한이 최종 납품 기한보다 길 수 없습니다.');
  }

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
   * 항목표는 종류별로 정해진 항목이 정해진 순서로 한 번씩 — 제10조가 제2조의 각 호를 하나씩 가리키기 때문이다
   * (제작 다섯 항목, 믹싱·마스터링 한 항목 — refundItemKeysFor). 항목을 빼거나 늘리면 어느 작업분이 어느 금액인지가
   * 조항과 어긋난다. 라벨은 서버가 다시 붙인다(클라이언트가 보낸 라벨을 그대로 인쇄하지 않는다).
   */
  const itemKeys = refundItemKeysFor(kind);
  const refundSchedule: RefundItem[] = [];
  if (!Array.isArray(raw.refundSchedule) || raw.refundSchedule.length !== itemKeys.length) {
    push('terms.refundSchedule', `환불 항목표는 ${itemKeys.length}개 항목이어야 합니다.`);
  } else {
    itemKeys.forEach((key, index) => {
      const item = (raw.refundSchedule as unknown[])[index];
      if (!isRecord(item) || item.key !== key) {
        push(`terms.refundSchedule.${key}`, '환불 항목의 순서나 이름이 올바르지 않습니다.');
        return;
      }
      refundSchedule.push({
        key,
        label: refundLabelFor(kind, key),
        amount: readInt(item, 'amount', `terms.refundSchedule.${key}`, money),
        milestones: readMilestones(item.milestones, `terms.refundSchedule.${key}.milestones`),
      });
    });
    const sum = refundSchedule.reduce((acc, item) => acc + item.amount, 0);
    if (refundSchedule.length === itemKeys.length && amount.total > 0 && sum !== amount.total) {
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
      version: 2,
      albumTitle,
      songs,
      scope,
      amount,
      payment,
      workWeeks,
      ...(firstDeliveryBusinessDays !== undefined ? { firstDeliveryBusinessDays } : {}),
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
  if (isRecord(parsed) && parsed.version === 2) return parsed as unknown as ProductionTerms;
  // v1(0073 전 싱글): 곡 제목 하나 → 곡 목록 하나.
  if (isRecord(parsed) && parsed.version === 1) {
    const { songTitle, ...rest } = parsed as Record<string, unknown>;
    return {
      ...(rest as unknown as Omit<ProductionTerms, 'version' | 'albumTitle' | 'songs'>),
      version: 2,
      albumTitle: null,
      songs: [{ title: typeof songTitle === 'string' ? songTitle : null }],
    };
  }
  throw new Error('알 수 없는 제작 계약 조건 형식입니다.');
};

/** n번째 곡(0부터)의 화면 이름 — "2번 곡 「제목」" 또는 "2번 곡". 곡이 하나면 순번 없이 제목만. */
export const songLabel = (terms: Pick<ProductionTerms, 'songs'>, index: number): string => {
  const title = terms.songs[index]?.title;
  if (terms.songs.length === 1) return title ? `「${title}」` : '본 곡';
  return title ? `${index + 1}번 곡 「${title}」` : `${index + 1}번 곡`;
};

/** 발매물의 화면 이름 — 곡이 하나인 종류(싱글·믹싱·마스터링)는 곡 제목, EP·정규는 음반 제목과 곡 수. */
export const releaseTitle = (kind: ProductionKind, terms: Pick<ProductionTerms, 'albumTitle' | 'songs'>): string => {
  if (isOneSongKind(kind)) return terms.songs[0]?.title ?? '1곡 (제목 미정)';
  return `${terms.albumTitle ?? '제목 미정'} (${KIND_LABEL[kind]} · ${terms.songs.length}곡)`;
};
