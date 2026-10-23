import type { ProductionEventType } from '../../../db/schema';

/**
 * 진행 기록 종류별 규칙 — 무엇을 적어야 하고, 의뢰인에게 통지하는가. 관리자 기록 폼과 기록 API가 이 표 하나를
 * 읽는다(폼이 받는 칸과 서버가 요구하는 칸이 갈리지 않게). 클라이언트 번들도 가져가므로 아무것도 import하지 않는다
 * (타입만).
 */
export const PRODUCTION_STAGES = ['arrangement', 'recording', 'tuning', 'mixing', 'mastering'] as const;
export type ProductionStage = (typeof PRODUCTION_STAGES)[number];

export const STAGE_LABEL: Record<ProductionStage, string> = {
  arrangement: '편곡',
  recording: '보컬 녹음',
  tuning: '음정·박자 보정',
  mixing: '믹싱',
  mastering: '마스터링',
};

export interface EventSpec {
  label: string;
  /** 단계를 고르게 하고, 고를 수 있는 단계를 좁힌다. */
  stages?: readonly ProductionStage[];
  amount?: 'required';
  link?: 'optional';
  note?: 'optional' | 'required';
  cause?: 'required';
  /** 기록과 함께 의뢰인에게 메일을 보낸다. 결과물 전달은 이 통지가 간주 승인의 근거다. */
  notifies: boolean;
  /** 관리자 폼에 보이지 않는 종류(시스템·의뢰인이 남긴다). */
  internal?: boolean;
}

export const EVENT_SPEC: Record<ProductionEventType, EventSpec> = {
  payment_received: { label: '입금 확인', amount: 'required', note: 'optional', notifies: true },
  source_received: { label: '1차 완성본 수령', link: 'optional', note: 'optional', notifies: true },
  source_replaced: { label: '1차 완성본 교체', link: 'optional', note: 'optional', notifies: true },
  kickoff: { label: '작업 시작(착수) — 기획 상담·편곡', note: 'optional', notifies: true },
  stage_delivered: {
    label: '결과물 전달',
    stages: ['arrangement', 'tuning', 'mixing', 'mastering'],
    link: 'optional',
    note: 'optional',
    notifies: true,
  },
  recording_completed: { label: '보컬 녹음 세션 마침', note: 'optional', notifies: true },
  revision_requested: {
    label: '수정 요청 (의뢰인 대신 기록)',
    stages: ['arrangement', 'mixing', 'mastering'],
    note: 'required',
    notifies: true,
  },
  stage_approved: {
    label: '승인 (의뢰인 대신 기록)',
    stages: ['arrangement', 'mixing', 'mastering'],
    note: 'optional',
    notifies: true,
  },
  pause_started: { label: '작업 정지 시작', cause: 'required', note: 'required', notifies: true },
  pause_ended: { label: '작업 정지 끝', note: 'optional', notifies: true },
  extra_cost_agreed: { label: '추가 비용 동의(계약서 제6조)', amount: 'required', note: 'required', notifies: true },
  client_contacted: { label: '의뢰인에게 연락함', note: 'required', notifies: false },
  client_responded: { label: '의뢰인이 응답함', note: 'optional', notifies: false },
  final_delivered: { label: '최종 파일 인도', link: 'optional', note: 'optional', notifies: true },
  distribution_submitted: { label: '유통 등록', note: 'optional', notifies: true },
  released: { label: '발매', note: 'optional', notifies: true },
  termination_notice: { label: '해지 통지(의뢰인 사정, 계약서 제10조 5항)', note: 'required', notifies: true },
  note: { label: '메모', note: 'required', notifies: false },
  reminder_sent: { label: '기한 안내 발송', notifies: false, internal: true },
  void: { label: '기록 무효', notifies: false, internal: true },
};

/** 관리자 폼에서 고를 수 있는 종류. */
export const ADMIN_EVENT_TYPES = (Object.keys(EVENT_SPEC) as ProductionEventType[]).filter(
  (type) => !EVENT_SPEC[type].internal,
);

/**
 * 믹싱·마스터링 계약인가 — 편곡도 녹음도 범위에 없다(terms.scope.arrangementTracks = 0, recordingHours = 0). 장부(ledger.ts)와
 * 화면이 계약 종류 대신 이 값을 본다 — 장부는 종류를 받지 않고 terms만 읽는다. 녹음 시간까지 보는 이유: 편곡 없는 AI 리워크
 * (arrangementTracks = 0)는 녹음·유통 등록·발매가 범위에 있어 믹싱·마스터링처럼 그 기록을 숨기면 안 된다.
 * 믹싱·마스터링 계약은 작성 폼·CLI가 녹음 시간을 0으로만 만든다(terms.ts MIXMASTER_BASE).
 */
export const isMixMasterTerms = (terms: { scope: { arrangementTracks: number; recordingHours: number } }): boolean =>
  terms.scope.arrangementTracks === 0 && terms.scope.recordingHours === 0;

/**
 * AI 리워크 계약인가 — 지급 비율 환불(refundPolicy)은 리워크 계약에만 붙는다(terms.ts 검증). 장부·화면은 종류를 받지 않으므로
 * terms로 알아본다(isMixMasterTerms와 같은 이유).
 */
export const isReworkTerms = (terms: { refundPolicy?: { mode: string } }): boolean => terms.refundPolicy?.mode === 'paid_ratio';

/** 의뢰인이 처음 보내는 자료의 이름 — terms.ts sourceLabelFor(종류 기준)와 같은 말을 terms로. */
export const sourceLabelForTerms = (terms: {
  scope: { arrangementTracks: number; recordingHours: number };
  refundPolicy?: { mode: string };
}): string => (isMixMasterTerms(terms) ? '작업 파일' : isReworkTerms(terms) ? 'AI 데모 파일' : '1차 완성본');

/** 믹싱·마스터링 계약에서 쓰지 않는 기록 — 녹음·유통 등록·발매가 범위 밖이다(mixmaster-template.md 제2조·제9조). */
const MIXMASTER_HIDDEN_TYPES: ReadonlySet<ProductionEventType> = new Set(['recording_completed', 'distribution_submitted', 'released']);

/** 믹싱·마스터링 계약에서 이름이 다른 기록 — 처음 받는 자료가 "작업 파일"이고 착수는 믹싱 시작이다(제1조·제10조 1항). */
const MIXMASTER_LABEL: Partial<Record<ProductionEventType, string>> = {
  source_received: '작업 파일 수령',
  source_replaced: '작업 파일 교체',
  kickoff: '작업 시작(착수) — 믹싱',
};

/** AI 리워크 계약에서 이름이 다른 기록 — 처음 받는 자료가 "AI 데모 파일"이고, 착수에 녹음 시작도 든다(rework-template.md 제1조·제10조 1항). */
const REWORK_LABEL: Partial<Record<ProductionEventType, string>> = {
  source_received: 'AI 데모 파일 수령',
  source_replaced: 'AI 데모 파일 교체',
  kickoff: '작업 시작(착수) — 기획 상담·편곡·녹음',
};

export const eventLabelFor = (type: ProductionEventType, mixMaster: boolean, rework = false): string =>
  (mixMaster ? MIXMASTER_LABEL[type] : rework ? REWORK_LABEL[type] : undefined) ?? EVENT_SPEC[type].label;

export const adminEventTypesFor = (mixMaster: boolean): ProductionEventType[] =>
  mixMaster ? ADMIN_EVENT_TYPES.filter((type) => !MIXMASTER_HIDDEN_TYPES.has(type)) : ADMIN_EVENT_TYPES;

/** 기록 종류의 단계 선택지 — 믹싱·마스터링 계약은 믹싱·마스터링만. */
export const eventStagesFor = (type: ProductionEventType, mixMaster: boolean): readonly ProductionStage[] | undefined => {
  const stages = EVENT_SPEC[type].stages;
  if (!stages || !mixMaster) return stages;
  return stages.filter((stage) => stage === 'mixing' || stage === 'mastering');
};

/**
 * 곡마다 일어나는 사건인가 — 1차 완성본 수령·교체, 녹음 세션 마침, 그리고 마스터링을 뺀 단계의 전달·수정 요청·승인.
 * 이 사건만 곡 번호(events.song)를 가진다. 마스터링은 음반 전체다.
 */
export const isPerSongEvent = (type: ProductionEventType, stage: string | null): boolean =>
  type === 'source_received' ||
  type === 'source_replaced' ||
  type === 'recording_completed' ||
  ((type === 'stage_delivered' || type === 'revision_requested' || type === 'stage_approved') && stage !== null && stage !== 'mastering');
