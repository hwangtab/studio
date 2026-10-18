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
  kickoff: { label: '착수 (기획 상담·편곡 시작)', note: 'optional', notifies: true },
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
  extra_cost_agreed: { label: '추가 비용 동의 (제6조)', amount: 'required', note: 'required', notifies: true },
  client_contacted: { label: '의뢰인에게 연락함', note: 'required', notifies: false },
  client_responded: { label: '의뢰인이 응답함', note: 'optional', notifies: false },
  final_delivered: { label: '최종 파일 인도', link: 'optional', note: 'optional', notifies: true },
  distribution_submitted: { label: '유통 등록', note: 'optional', notifies: true },
  released: { label: '발매', note: 'optional', notifies: true },
  termination_notice: { label: '해지 통지 (제10조 5항)', note: 'required', notifies: true },
  note: { label: '메모', note: 'required', notifies: false },
  reminder_sent: { label: '기한 안내 발송', notifies: false, internal: true },
  void: { label: '기록 무효', notifies: false, internal: true },
};

/** 관리자 폼에서 고를 수 있는 종류. */
export const ADMIN_EVENT_TYPES = (Object.keys(EVENT_SPEC) as ProductionEventType[]).filter(
  (type) => !EVENT_SPEC[type].internal,
);
