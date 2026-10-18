import type { ProductionContractEvent } from '../../../db/schema';
import {
  REVISION_STAGES,
  type ProductionTerms,
  type RefundItemKey,
  type RefundMilestoneEvent,
  type RevisionStage,
} from './terms';

/**
 * 진행 기록 → 지금 상태. **순수 함수다** — DB도 시계도 읽지 않는다(now는 인자). 관리자 화면·의뢰인 진행 페이지·
 * 기한 크론·해지 정산이 모두 이 결과를 본다. 같은 기록이면 어디서 계산해도 같은 답이 나와야 하기 때문이다.
 *
 * 기한은 전부 **그 계약의 terms**에서 읽는다(코드 상수가 아니다). 날짜는 KST 달력 날짜로 센다 — 경과 시간으로
 * 자르면 밤늦게 전달한 건이 하루 밀린다(후기 요청 크론과 같은 이유). 기간은 민법의 초일 불산입을 따른다:
 * "전달한 날부터 7일 이내"는 전달일 다음 날부터 세어 7일째 날이 끝날 때까지다.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** KST 달력 날짜의 일련번호(1970-01-01 KST = 0). 날짜 비교·더하기를 정수로 한다. */
export const kstDay = (date: Date): number => Math.floor((date.getTime() + KST_OFFSET_MS) / DAY_MS);

/** 일련번호 → 그날 KST 0시의 Date. 화면 표시용. */
export const kstDayStart = (day: number): Date => new Date(day * DAY_MS - KST_OFFSET_MS);

export type ApprovalMode = 'explicit' | 'deemed' | 'proxy';
export type PauseCause = 'client' | 'studio';

export interface EventData {
  link?: string;
  note?: string;
  mode?: ApprovalMode;
  /** 간주·명시 승인이 가리키는 결과물 전달 기록. */
  deliveryEventId?: string;
  cause?: PauseCause;
  kind?: ReminderKind;
  refEventId?: string;
  reason?: string;
}

export type ReminderKind = 'deemed_approval_soon' | 'deposit_due' | 'balance_due';

export const parseEventData = (event: Pick<ProductionContractEvent, 'dataJson'>): EventData => {
  if (!event.dataJson) return {};
  try {
    const parsed: unknown = JSON.parse(event.dataJson);
    return parsed && typeof parsed === 'object' ? (parsed as EventData) : {};
  } catch {
    return {};
  }
};

/** a가 b보다 나중 기록인가(같은 시각이면 순번으로). b가 없으면 참. */
const isAfter = (a: ProductionContractEvent | null, b: ProductionContractEvent | null): boolean =>
  a !== null &&
  (b === null || a.occurredAt.getTime() > b.occurredAt.getTime() || (a.occurredAt.getTime() === b.occurredAt.getTime() && a.seq > b.seq));

const ordered = (events: readonly ProductionContractEvent[]) =>
  [...events].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime() || a.seq - b.seq);

/** 무효(void) 처리된 기록과 void 기록 자체를 뺀, 효력 있는 기록. */
export const activeEvents = (events: readonly ProductionContractEvent[]): ProductionContractEvent[] => {
  const voided = new Set(events.filter((e) => e.type === 'void' && e.voidsEventId).map((e) => e.voidsEventId));
  return ordered(events.filter((e) => e.type !== 'void' && !voided.has(e.id)));
};

export interface PendingApproval {
  deliveryEventId: string;
  deliveredAt: Date;
  /** 이 날이 끝날 때까지 수정 요청이 없으면 승인으로 본다(제5조 5항). */
  lastDayToRespond: Date;
  /** 간주 승인을 기록할 날(위 다음 날). */
  deemedFromDay: number;
  /** 전달 통지 메일이 실제로 나갔는가 — 아니면 간주 승인의 근거가 없다. */
  noticeSent: boolean;
}

export interface StageState {
  deliveries: number;
  revisions: number;
  freeRemaining: number;
  extraRevisions: number;
  extraFee: number;
  approved: { mode: ApprovalMode; at: Date } | null;
  /** 결과물이 나갔고 아직 답이 없다. */
  pending: PendingApproval | null;
  /** 수정 요청을 받아 다음 결과물을 만드는 중. */
  revising: boolean;
}

export interface RefundLine {
  key: RefundItemKey;
  label: string;
  amount: number;
  ratio: number;
  deducted: number;
}

export type TodoSeverity = 'info' | 'warn' | 'alert';

export interface Todo {
  severity: TodoSeverity;
  message: string;
}

export interface ProductionLedger {
  events: ProductionContractEvent[];
  payments: {
    received: number;
    /** 계약금액 + 동의한 추가 비용 + 무료 횟수를 넘은 수정 요금. */
    totalDue: number;
    extraCosts: number;
    revisionFees: number;
    depositMetAt: Date | null;
    depositLastDay: Date | null;
    depositOverdueDays: number;
    balanceLastDay: Date | null;
    balanceOverdueDays: number;
    paidInFull: boolean;
  };
  work: {
    kickedOff: boolean;
    startedOn: Date | null;
    dueOn: Date | null;
    clientPauseDays: number;
    openPause: { cause: PauseCause; since: Date } | null;
    /** 예정일을 넘긴 날수. 의뢰인 사유 정지는 예정일을 이미 미뤘으므로 여기 들어오지 않는다. */
    delayDays: number;
    delayExceeded: boolean;
    finalDeliveredAt: Date | null;
    recordingCompleted: boolean;
    tuningDelivered: boolean;
    distributionSubmitted: boolean;
    released: boolean;
  };
  stages: Record<RevisionStage, StageState>;
  refund: { lines: RefundLine[]; deduction: number; refundable: number };
  unresponsive: { since: Date | null; days: number; exceeded: boolean };
  todos: Todo[];
}

const STAGE_NAME: Record<RevisionStage, string> = { arrangement: '편곡', mixing: '믹싱', mastering: '마스터링' };

export const computeProductionLedger = (input: {
  terms: ProductionTerms;
  signedAt: Date | null;
  events: readonly ProductionContractEvent[];
  now: Date;
}): ProductionLedger => {
  const { terms, signedAt, now } = input;
  const events = activeEvents(input.events);
  const today = kstDay(now);
  const of = (type: ProductionContractEvent['type'], stage?: string) =>
    events.filter((e) => e.type === type && (stage === undefined || e.stage === stage));
  const last = (list: ProductionContractEvent[]) => list[list.length - 1] ?? null;

  // ── 단계별 수정·승인(제5조) ──────────────────────────────────────────────
  const stages = Object.fromEntries(
    REVISION_STAGES.map((stage): [RevisionStage, StageState] => {
      const deliveries = of('stage_delivered', stage);
      const revisions = of('revision_requested', stage);
      const approval = last(of('stage_approved', stage));
      const lastDelivery = last(deliveries);
      const lastRevision = last(revisions);

      const extraRevisions = Math.max(0, revisions.length - terms.revisions[stage]);
      let pending: PendingApproval | null = null;
      if (!approval && lastDelivery && isAfter(lastDelivery, lastRevision)) {
        const lastDay = kstDay(lastDelivery.occurredAt) + terms.deemedApprovalDays;
        pending = {
          deliveryEventId: lastDelivery.id,
          deliveredAt: lastDelivery.occurredAt,
          lastDayToRespond: kstDayStart(lastDay),
          deemedFromDay: lastDay + 1,
          noticeSent: lastDelivery.noticeStatus === 'sent',
        };
      }

      return [
        stage,
        {
          deliveries: deliveries.length,
          revisions: revisions.length,
          freeRemaining: Math.max(0, terms.revisions[stage] - revisions.length),
          extraRevisions,
          extraFee: extraRevisions * terms.extraRevisionFees[stage],
          approved: approval ? { mode: parseEventData(approval).mode ?? 'proxy', at: approval.occurredAt } : null,
          pending,
          revising: !approval && isAfter(lastRevision, lastDelivery),
        },
      ];
    }),
  ) as Record<RevisionStage, StageState>;

  // ── 대금(제3조·제10조 5항) ───────────────────────────────────────────────
  const payments = of('payment_received');
  const received = payments.reduce((sum, e) => sum + (e.amount ?? 0), 0);
  const extraCosts = of('extra_cost_agreed').reduce((sum, e) => sum + (e.amount ?? 0), 0);
  const revisionFees = REVISION_STAGES.reduce((sum, stage) => sum + stages[stage].extraFee, 0);
  const totalDue = terms.amount.total + extraCosts + revisionFees;

  let running = 0;
  const depositEvent = payments.find((e) => (running += e.amount ?? 0) >= terms.amount.deposit) ?? null;
  const depositLastDay = signedAt ? kstDay(signedAt) + terms.amount.depositDueDays : null;
  const depositOverdueDays = !depositEvent && depositLastDay !== null ? Math.max(0, today - depositLastDay) : 0;

  const masteringApproval = stages.mastering.approved;
  const balanceLastDay = masteringApproval ? kstDay(masteringApproval.at) + terms.amount.balanceDueDays : null;
  const paidInFull = received >= totalDue;
  const balanceOverdueDays = !paidInFull && balanceLastDay !== null ? Math.max(0, today - balanceLastDay) : 0;

  // ── 작업 기간(제4조) ─────────────────────────────────────────────────────
  // 교체했으면 교체한 날부터 다시 센다(제4조 2항) — events가 시간순이라 마지막 수령·교체 기록이 기준이다.
  const latestSource = last(events.filter((e) => e.type === 'source_received' || e.type === 'source_replaced'));
  const startDay =
    depositEvent && latestSource ? Math.max(kstDay(depositEvent.occurredAt), kstDay(latestSource.occurredAt)) : null;

  // 정지 구간: 시작 기록부터 다음 종료 기록(없으면 오늘)까지. 의뢰인 사유만 예정일을 미룬다(제4조 2항).
  let clientPauseDays = 0;
  let openPause: { cause: PauseCause; since: Date } | null = null;
  for (const event of events) {
    if (event.type === 'pause_started' && !openPause) {
      openPause = { cause: parseEventData(event).cause ?? 'client', since: event.occurredAt };
    } else if (event.type === 'pause_ended' && openPause) {
      if (openPause.cause === 'client') clientPauseDays += kstDay(event.occurredAt) - kstDay(openPause.since);
      openPause = null;
    }
  }
  if (openPause?.cause === 'client') clientPauseDays += today - kstDay(openPause.since);

  const finalDelivered = last(of('final_delivered'));
  const dueDay = startDay !== null ? startDay + terms.workWeeks * 7 + clientPauseDays : null;
  const endDay = finalDelivered ? kstDay(finalDelivered.occurredAt) : today;
  const delayDays = dueDay !== null ? Math.max(0, endDay - dueDay) : 0;

  // ── 해지 정산(제10조 3항) ────────────────────────────────────────────────
  const kickedOff = of('kickoff').length > 0;
  const milestoneReached: Record<RefundMilestoneEvent, boolean> = {
    kickoff: kickedOff,
    arrangement_delivered: of('stage_delivered', 'arrangement').length > 0,
    recording_completed: of('recording_completed').length > 0,
    tuning_delivered: of('stage_delivered', 'tuning').length > 0,
    mixing_delivered: of('stage_delivered', 'mixing').length > 0,
    mastering_delivered: of('stage_delivered', 'mastering').length > 0,
    distribution_submitted: of('distribution_submitted').length > 0,
  };
  // 착수 전 해지는 받은 금액 전액 환불(제10조 2항) — 경계를 보지 않는다.
  const lines: RefundLine[] = terms.refundSchedule.map((item) => {
    const ratio = kickedOff
      ? item.milestones.reduce((best, m) => (milestoneReached[m.event] && m.ratio > best ? m.ratio : best), 0)
      : 0;
    return { key: item.key, label: item.label, amount: item.amount, ratio, deducted: Math.round(item.amount * ratio) };
  });
  const deduction = lines.reduce((sum, line) => sum + line.deducted, 0);

  // ── 의뢰인 무응답(제10조 5항) ────────────────────────────────────────────
  const lastContact = last(of('client_contacted'));
  const clientActivityAfter = lastContact
    ? events.some(
        (e) =>
          e.occurredAt.getTime() >= lastContact.occurredAt.getTime() &&
          e.id !== lastContact.id &&
          (e.actor === 'client' || e.type === 'client_responded' || e.type === 'revision_requested'),
      )
    : true;
  const unresponsiveSince = lastContact && !clientActivityAfter ? lastContact.occurredAt : null;
  const unresponsiveDays = unresponsiveSince ? today - kstDay(unresponsiveSince) : 0;

  const ledger: ProductionLedger = {
    events,
    payments: {
      received,
      totalDue,
      extraCosts,
      revisionFees,
      depositMetAt: depositEvent?.occurredAt ?? null,
      depositLastDay: depositLastDay !== null ? kstDayStart(depositLastDay) : null,
      depositOverdueDays,
      balanceLastDay: balanceLastDay !== null ? kstDayStart(balanceLastDay) : null,
      balanceOverdueDays,
      paidInFull,
    },
    work: {
      kickedOff,
      startedOn: startDay !== null ? kstDayStart(startDay) : null,
      dueOn: dueDay !== null ? kstDayStart(dueDay) : null,
      clientPauseDays,
      openPause,
      delayDays,
      delayExceeded: delayDays >= terms.studioDelayWeeks * 7,
      finalDeliveredAt: finalDelivered?.occurredAt ?? null,
      recordingCompleted: milestoneReached.recording_completed,
      tuningDelivered: milestoneReached.tuning_delivered,
      distributionSubmitted: milestoneReached.distribution_submitted,
      released: of('released').length > 0,
    },
    stages,
    refund: { lines, deduction, refundable: Math.max(0, received - deduction) },
    unresponsive: {
      since: unresponsiveSince,
      days: unresponsiveDays,
      exceeded: unresponsiveDays >= terms.clientUnresponsiveDays,
    },
    todos: [],
  };
  ledger.todos = buildTodos(ledger, terms, today);
  return ledger;
};

/** 운영자가 오늘 봐야 할 것. 관리자 화면과 기한 크론의 운영자 메일이 같은 목록을 쓴다. */
const buildTodos = (ledger: ProductionLedger, terms: ProductionTerms, today: number): Todo[] => {
  const todos: Todo[] = [];
  const { payments, work, stages, unresponsive } = ledger;
  const delayLimit = terms.paymentDelayDays;

  if (payments.depositOverdueDays > 0) {
    todos.push({
      severity: payments.depositOverdueDays >= delayLimit ? 'alert' : 'warn',
      message:
        `계약금 기한이 ${payments.depositOverdueDays}일 지났어요.` +
        (payments.depositOverdueDays >= delayLimit ? ` ${delayLimit}일 이상 지체 — 통지 후 해지할 수 있어요(제10조 5항).` : ''),
    });
  }
  if (payments.balanceOverdueDays > 0) {
    todos.push({
      severity: payments.balanceOverdueDays >= delayLimit ? 'alert' : 'warn',
      message:
        `잔금 기한이 ${payments.balanceOverdueDays}일 지났어요.` +
        (payments.balanceOverdueDays >= delayLimit ? ` ${delayLimit}일 이상 지체 — 통지 후 해지할 수 있어요(제10조 5항).` : ''),
    });
  }
  if (!work.startedOn && payments.depositMetAt) todos.push({ severity: 'info', message: '1차 완성본을 받으면 기록해 주세요. 그날부터 작업 기간을 셉니다.' });

  for (const stage of REVISION_STAGES) {
    const state = stages[stage];
    if (state.pending && !state.pending.noticeSent) {
      todos.push({
        severity: 'alert',
        message: `${STAGE_NAME[stage]} 결과물 전달 통지가 의뢰인에게 가지 않았어요. 통지를 다시 보내야 간주 승인이 성립해요.`,
      });
    } else if (state.pending && today >= state.pending.deemedFromDay) {
      todos.push({ severity: 'info', message: `${STAGE_NAME[stage]} 승인 간주 기한이 지났어요. 오늘 기한 점검에서 기록돼요.` });
    }
    if (state.revising) todos.push({ severity: 'info', message: `${STAGE_NAME[stage]} 수정 요청을 반영해 다시 전달해 주세요.` });
  }

  if (stages.mastering.approved && payments.paidInFull && !work.finalDeliveredAt) {
    todos.push({ severity: 'info', message: '마스터링 승인과 잔금 입금이 끝났어요. 최종 파일을 인도해 주세요.' });
  }
  if (work.delayExceeded && !work.finalDeliveredAt) {
    todos.push({
      severity: 'alert',
      message: `작업 예정일을 ${work.delayDays}일 넘겼어요. 스튜디오 사유 지연이 ${terms.studioDelayWeeks}주 이상이면 의뢰인이 해지할 수 있어요(제12조 2항).`,
    });
  } else if (work.delayDays > 0 && !work.finalDeliveredAt) {
    todos.push({ severity: 'warn', message: `작업 예정일을 ${work.delayDays}일 넘겼어요.` });
  }
  if (unresponsive.exceeded) {
    todos.push({
      severity: 'alert',
      message: `의뢰인이 ${unresponsive.days}일째 응답하지 않아요. ${terms.clientUnresponsiveDays}일 이상 — 통지 후 해지할 수 있어요(제10조 5항).`,
    });
  }
  return todos;
};
