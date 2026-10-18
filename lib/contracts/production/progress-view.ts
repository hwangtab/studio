import type { ProductionContractEvent } from '../../../db/schema';
import { EVENT_SPEC, STAGE_LABEL, type ProductionStage } from './event-spec';
import { parseEventData, type ProductionLedger, type Todo } from './ledger';
import { REVISION_STAGES, type ProductionTerms, type RevisionStage } from './terms';

/**
 * 장부 → 화면 props(JSON). getServerSideProps가 돌려주는 값은 HTML에 그대로 실리므로, 의뢰인 화면에는 의뢰인이
 * 볼 기록만 싣는다 — 운영자 메모·연락 기록·기한 안내 발송·무효 처리는 빼고, 통지 대상 기록(이미 메일로 보낸
 * 내용)만 남긴다.
 */

export interface TimelineItem {
  id: string;
  type: ProductionContractEvent['type'];
  label: string;
  stage: string | null;
  amount: number | null;
  occurredAt: string;
  /** 소급 기록(일어난 때와 적은 때가 하루 넘게 다르다) — 화면에 표시한다. */
  backdated: boolean;
  actor: string;
  note: string | null;
  link: string | null;
  mode: string | null;
  noticeStatus: ProductionContractEvent['noticeStatus'];
  noticeError: string | null;
  voided: boolean;
}

export interface StageView {
  stage: RevisionStage;
  label: string;
  deliveries: number;
  revisions: number;
  freeRemaining: number;
  extraFee: number;
  approved: { mode: string; at: string } | null;
  pending: { deliveryEventId: string; deliveredAt: string; lastDayToRespond: string; noticeSent: boolean; link: string | null } | null;
  revising: boolean;
}

export interface ProgressView {
  payments: {
    total: number;
    totalDue: number;
    received: number;
    remaining: number;
    deposit: number;
    depositMetAt: string | null;
    depositLastDay: string | null;
    balanceLastDay: string | null;
    paidInFull: boolean;
  };
  work: { startedOn: string | null; dueOn: string | null; delayDays: number; paused: boolean; finalDeliveredAt: string | null };
  stages: StageView[];
  timeline: TimelineItem[];
  extraRevisionFee: Record<RevisionStage, number>;
}

export interface AdminProgressView extends ProgressView {
  todos: Todo[];
  refund: ProductionLedger['refund'] & { received: number; kickedOff: boolean };
}

const iso = (date: Date | null) => (date ? date.toISOString() : null);

const toTimeline = (events: readonly ProductionContractEvent[], voidedIds: Set<string>): TimelineItem[] =>
  events.map((event) => {
    const data = parseEventData(event);
    return {
      id: event.id,
      type: event.type,
      // 폼 이름의 "(의뢰인 대신 기록)"은 관리자가 남긴 경우에만 맞는 말이다 — 의뢰인·자동 기록에서는 뗀다.
      label: event.actor.startsWith('admin:') ? EVENT_SPEC[event.type].label : EVENT_SPEC[event.type].label.replace(/ \(의뢰인 대신 기록\)$/, ''),
      stage: event.stage ? STAGE_LABEL[event.stage as ProductionStage] ?? event.stage : null,
      amount: event.amount,
      occurredAt: event.occurredAt.toISOString(),
      backdated: Math.abs(event.recordedAt.getTime() - event.occurredAt.getTime()) > 24 * 60 * 60 * 1000,
      actor: event.actor,
      note: data.note ?? data.reason ?? null,
      link: data.link ?? null,
      mode: data.mode ?? null,
      noticeStatus: event.noticeStatus,
      noticeError: event.noticeError,
      voided: voidedIds.has(event.id),
    };
  });

const buildView = (terms: ProductionTerms, ledger: ProductionLedger, timeline: TimelineItem[]): ProgressView => {
  const { payments, work, stages } = ledger;
  const findEvent = (eventId: string) => ledger.events.find((e) => e.id === eventId);
  return {
    payments: {
      total: terms.amount.total,
      totalDue: payments.totalDue,
      received: payments.received,
      remaining: Math.max(0, payments.totalDue - payments.received),
      deposit: terms.amount.deposit,
      depositMetAt: iso(payments.depositMetAt),
      depositLastDay: iso(payments.depositLastDay),
      balanceLastDay: iso(payments.balanceLastDay),
      paidInFull: payments.paidInFull,
    },
    work: {
      startedOn: iso(work.startedOn),
      dueOn: iso(work.dueOn),
      delayDays: work.delayDays,
      paused: work.openPause !== null,
      finalDeliveredAt: iso(work.finalDeliveredAt),
    },
    stages: REVISION_STAGES.map((stage) => {
      const state = stages[stage];
      const delivery = state.pending ? findEvent(state.pending.deliveryEventId) : undefined;
      return {
        stage,
        label: STAGE_LABEL[stage],
        deliveries: state.deliveries,
        revisions: state.revisions,
        freeRemaining: state.freeRemaining,
        extraFee: state.extraFee,
        approved: state.approved ? { mode: state.approved.mode, at: state.approved.at.toISOString() } : null,
        pending: state.pending
          ? {
              deliveryEventId: state.pending.deliveryEventId,
              deliveredAt: state.pending.deliveredAt.toISOString(),
              lastDayToRespond: state.pending.lastDayToRespond.toISOString(),
              noticeSent: state.pending.noticeSent,
              link: delivery ? parseEventData(delivery).link ?? null : null,
            }
          : null,
        revising: state.revising,
      };
    }),
    timeline,
    extraRevisionFee: terms.extraRevisionFees,
  };
};

/** 관리자 화면 — 무효 처리된 기록까지 전부(줄을 그어 보인다), 할 일·정산 포함. */
export const buildAdminProgressView = (
  terms: ProductionTerms,
  ledger: ProductionLedger,
  allEvents: readonly ProductionContractEvent[],
): AdminProgressView => {
  const voided = new Set(allEvents.filter((e) => e.type === 'void' && e.voidsEventId).map((e) => e.voidsEventId as string));
  return {
    ...buildView(terms, ledger, toTimeline(allEvents, voided).reverse()),
    todos: ledger.todos,
    refund: { ...ledger.refund, received: ledger.payments.received, kickedOff: ledger.work.kickedOff },
  };
};

/** 의뢰인 화면 — 효력 있는 기록 중 통지 대상(이미 메일로 알린 것)만. */
export const buildClientProgressView = (terms: ProductionTerms, ledger: ProductionLedger): ProgressView => {
  const visible = ledger.events.filter((e) => EVENT_SPEC[e.type].notifies);
  return buildView(
    terms,
    ledger,
    toTimeline(visible, new Set())
      .map((item) => ({ ...item, actor: item.actor === 'client' ? 'client' : 'studio', noticeError: null }))
      .reverse(),
  );
};
