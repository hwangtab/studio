import type { ProductionContractEvent } from '../../../db/schema';
import type { TerminationCause } from './termination';
import {
  songLabel,
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
 *
 * 여러 곡(EP·정규, 0073): 편곡·녹음·보정·믹싱과 1차 완성본은 **곡마다**, 마스터링·입금·착수·인도·유통은 음반 전체다.
 * 곡마다 일어나는 단계는 (단계, 곡)마다 수정 횟수·승인·간주 승인 기한을 따로 센다. 0073 전 싱글 기록은 곡 번호가
 * 비어 있고 1번 곡(0)으로 읽는다(songOf).
 */

/** 곡마다 일어나는 단계. 나머지(마스터링)는 음반 전체다. */
export const PER_SONG_STAGES: ReadonlySet<string> = new Set(['arrangement', 'recording', 'tuning', 'mixing']);

/** 기록의 곡 번호. 곡별 사건인데 비어 있으면(0073 전 싱글) 1번 곡이다. */
export const songOf = (event: Pick<ProductionContractEvent, 'song'>): number => event.song ?? 0;

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

/**
 * 간주 승인 기한을 세기 시작하는 날 — 전달한 날과 통지가 실제로 나간 날 중 늦은 날(제5조 5항). 통지가 실패했다가
 * 나중에 다시 나갔거나 전달을 소급해 기록했으면, 의뢰인이 알게 된 날부터 세야 7일을 온전히 받는다. 통지를 아직
 * 보내지 않았으면 `notifyingAt`(지금 보내는 중이면 그 시각)을 쓴다.
 */
export const deemedBaseDay = (
  delivery: Pick<ProductionContractEvent, 'occurredAt' | 'noticeSentAt'>,
  notifyingAt: Date | null = null,
): number => {
  const noticeAt = delivery.noticeSentAt ?? notifyingAt;
  return Math.max(kstDay(delivery.occurredAt), noticeAt ? kstDay(noticeAt) : -Infinity);
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
  stage: RevisionStage;
  /** 곡 번호(0부터). 마스터링(음반 전체)은 null. */
  song: number | null;
  deliveries: number;
  revisions: number;
  freeRemaining: number;
  extraRevisions: number;
  extraFee: number;
  /** 무료 횟수를 넘은 수정 중 다시 전달까지 마친 것의 요금 — 해지 정산의 공제 대상. */
  performedExtraFee: number;
  approved: { mode: ApprovalMode; at: Date; eventId: string } | null;
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
    distributionSubmitted: boolean;
    released: boolean;
  };
  /** (단계, 곡)마다 하나 — 곡 순서대로 편곡·믹싱, 마지막에 음반 마스터링. findStage로 찾는다. */
  stages: StageState[];
  /** 곡마다: 1차 완성본 수령(마지막 수령·교체), 녹음 세션 마침, 보정 전달. */
  songs: Array<{ sourceReceivedAt: Date | null; recordingCompleted: boolean; tuningDelivered: boolean }>;
  /**
   * 해지 정산(제10조). `extras`는 동의한 추가 비용(제6조)과 이행한 초과 수정 요금(제5조 3항) — 착수 후 의뢰인
   * 사정의 해지(3·5항)에서만 돌려주지 않는다(3항). 착수 전(2항)·스튜디오 사정(4항)은 0이다. `deduction`은
   * 항목표 공제 + extras. 해지 전에는 의뢰인 사정으로 가정하고, 스튜디오 사정이면 얼마인지 `refundableIfStudio`로 함께 준다.
   */
  refund: { lines: RefundLine[]; extras: number; deduction: number; refundable: number; refundableIfStudio: number };
  unresponsive: { since: Date | null; days: number; exceeded: boolean };
  todos: Todo[];
}

const STAGE_NAME: Record<RevisionStage, string> = { arrangement: '편곡', mixing: '믹싱', mastering: '마스터링' };

/** (단계, 곡)의 상태. 마스터링은 곡을 무시한다(음반 전체). 곡별 단계에 곡이 없으면 1번 곡. */
export const findStage = (
  ledger: Pick<ProductionLedger, 'stages'>,
  stage: RevisionStage,
  song: number | null = null,
): StageState | undefined =>
  ledger.stages.find((s) => s.stage === stage && (stage === 'mastering' ? true : s.song === (song ?? 0)));

/** 화면·메일에 쓰는 단계 이름 — 여러 곡이면 곡 이름을 붙인다("2번 곡 「제목」 편곡"). */
export const stageTitle = (terms: Pick<ProductionTerms, 'songs'>, stage: RevisionStage, song: number | null): string =>
  stage === 'mastering' || terms.songs.length === 1 ? STAGE_NAME[stage] : `${songLabel(terms, song ?? 0)} ${STAGE_NAME[stage]}`;

/** 날짜 구간들([시작일, 끝일), KST 일련번호)이 덮는 날수 — 겹치는 날은 한 번, `fromDay` 앞은 뺀다. */
const coveredDays = (intervals: ReadonlyArray<[number, number]>, fromDay: number): number => {
  const clipped = intervals
    .map(([start, end]) => [Math.max(start, fromDay), end] as [number, number])
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let cursor = -Infinity;
  for (const [start, end] of clipped) {
    const from = Math.max(start, cursor);
    if (end > from) total += end - from;
    cursor = Math.max(cursor, end);
  }
  return total;
};

export const computeProductionLedger = (input: {
  terms: ProductionTerms;
  signedAt: Date | null;
  events: readonly ProductionContractEvent[];
  now: Date;
  /** 해지한 계약의 해지 사유(termination.ts). 진행 중이면 비운다. */
  terminationCause?: TerminationCause | null;
}): ProductionLedger => {
  const { terms, signedAt, now } = input;
  const events = activeEvents(input.events);
  const today = kstDay(now);
  const songCount = Math.max(1, terms.songs.length);
  const of = (type: ProductionContractEvent['type'], stage?: string, song?: number) =>
    events.filter(
      (e) => e.type === type && (stage === undefined || e.stage === stage) && (song === undefined || songOf(e) === song),
    );
  const last = (list: ProductionContractEvent[]) => list[list.length - 1] ?? null;

  // ── 단계별 수정·승인(제5조) — 편곡·믹싱은 곡마다, 마스터링은 음반 전체 ──────────
  // 편곡이 범위에 없는 계약(믹싱·마스터링, scope.arrangementTracks = 0)은 편곡 단계를 만들지 않는다 —
  // 만들면 영영 끝나지 않는 "편곡" 카드가 의뢰인·관리자 진행 화면에 남는다.
  const hasArrangement = terms.scope.arrangementTracks > 0;
  const stageKeys: Array<{ stage: RevisionStage; song: number | null }> = [
    ...Array.from({ length: songCount }, (_, song) => [
      ...(hasArrangement ? [{ stage: 'arrangement' as const, song }] : []),
      { stage: 'mixing' as const, song },
    ]).flat(),
    { stage: 'mastering', song: null },
  ];
  // 의뢰인 피드백 대기(제4조 2항): 결과물을 전달한 날부터 의뢰인이 답한 날(수정 요청·승인, 간주 승인 포함)까지.
  // 답 없이 다음 결과물이 나가면 그날까지, 아직 답이 없으면 오늘까지. 작업 기간에서 빼는 구간이다.
  const feedbackWaits: Array<[number, number]> = [];
  const stages: StageState[] = stageKeys.map(({ stage, song }) => {
    const pick = (type: ProductionContractEvent['type']) => of(type, stage, song ?? undefined);
    const deliveries = pick('stage_delivered');
    const revisions = pick('revision_requested');
    // 승인은 효력 있는 결과물에 걸려 있어야 한다 — 그 전달을 무효로 했으면 승인도 근거를 잃는다. 근거 전달 id가
    // 없는 옛 대리 승인은 그보다 앞선 전달이 하나라도 남아 있으면 인정한다.
    const deliveryIds = new Set(deliveries.map((d) => d.id));
    const approval = last(
      pick('stage_approved').filter((a) => {
        const ref = parseEventData(a).deliveryEventId;
        return ref ? deliveryIds.has(ref) : deliveries.some((d) => isAfter(a, d));
      }),
    );
    const lastDelivery = last(deliveries);
    const lastRevision = last(revisions);

    const extraRevisions = Math.max(0, revisions.length - terms.revisions[stage]);
    // 이행한 수정 = 그 뒤에 결과물을 다시 전달한 수정 요청. 해지 정산은 이행한 초과 수정만 공제한다(제10조 3항).
    const performedRevisions = revisions.filter((r) => deliveries.some((d) => isAfter(d, r))).length;
    const responses = [...revisions, ...pick('stage_approved')];
    deliveries.forEach((delivery, index) => {
      const next = deliveries[index + 1] ?? null;
      const answer = responses
        .filter((r) => isAfter(r, delivery) && (next === null || isAfter(next, r)))
        .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())[0];
      const end = answer ?? next;
      feedbackWaits.push([kstDay(delivery.occurredAt), end ? kstDay(end.occurredAt) : today]);
    });
    let pending: PendingApproval | null = null;
    if (!approval && lastDelivery && isAfter(lastDelivery, lastRevision)) {
      const lastDay = deemedBaseDay(lastDelivery) + terms.deemedApprovalDays;
      pending = {
        deliveryEventId: lastDelivery.id,
        deliveredAt: lastDelivery.occurredAt,
        lastDayToRespond: kstDayStart(lastDay),
        deemedFromDay: lastDay + 1,
        noticeSent: lastDelivery.noticeStatus === 'sent',
      };
    }

    return {
      stage,
      song,
      deliveries: deliveries.length,
      revisions: revisions.length,
      freeRemaining: Math.max(0, terms.revisions[stage] - revisions.length),
      extraRevisions,
      extraFee: extraRevisions * terms.extraRevisionFees[stage],
      performedExtraFee: Math.max(0, performedRevisions - terms.revisions[stage]) * terms.extraRevisionFees[stage],
      approved: approval ? { mode: parseEventData(approval).mode ?? 'proxy', at: approval.occurredAt, eventId: approval.id } : null,
      pending,
      revising: !approval && isAfter(lastRevision, lastDelivery),
    };
  });

  // ── 곡별 상태 ─────────────────────────────────────────────────────────
  // 1차 완성본은 교체했으면 교체한 날부터 다시 센다(제4조 2항) — events가 시간순이라 마지막 수령·교체가 기준이다.
  const songs = Array.from({ length: songCount }, (_, song) => ({
    sourceReceivedAt: last([...of('source_received', undefined, song), ...of('source_replaced', undefined, song)].sort(
      (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime() || a.seq - b.seq,
    ))?.occurredAt ?? null,
    recordingCompleted: of('recording_completed', undefined, song).length > 0,
    tuningDelivered: of('stage_delivered', 'tuning', song).length > 0,
  }));

  // ── 대금(제3조·제10조 5항) ───────────────────────────────────────────────
  const payments = of('payment_received');
  const received = payments.reduce((sum, e) => sum + (e.amount ?? 0), 0);
  const extraCosts = of('extra_cost_agreed').reduce((sum, e) => sum + (e.amount ?? 0), 0);
  const revisionFees = stages.reduce((sum, state) => sum + state.extraFee, 0);
  const totalDue = terms.amount.total + extraCosts + revisionFees;

  let running = 0;
  // 계약금이 0원인 계약은 체결로 계약금 조건이 채워진 것으로 본다(입금 기록을 기다리면 작업 기간이 시작되지 않는다).
  const depositEvent =
    terms.amount.deposit > 0 ? (payments.find((e) => (running += e.amount ?? 0) >= terms.amount.deposit) ?? null) : null;
  const depositMetAt = depositEvent?.occurredAt ?? (terms.amount.deposit === 0 ? signedAt : null);
  const depositLastDay = signedAt ? kstDay(signedAt) + terms.amount.depositDueDays : null;
  const depositOverdueDays = !depositMetAt && depositLastDay !== null ? Math.max(0, today - depositLastDay) : 0;

  const masteringApproval = findStage({ stages }, 'mastering')?.approved ?? null;
  const balanceLastDay = masteringApproval ? kstDay(masteringApproval.at) + terms.amount.balanceDueDays : null;
  const paidInFull = received >= totalDue;
  const balanceOverdueDays = !paidInFull && balanceLastDay !== null ? Math.max(0, today - balanceLastDay) : 0;

  // ── 작업 기간(제4조) ─────────────────────────────────────────────────────
  // 계약금 입금과 **모든 곡**의 1차 완성본 수령이 끝난 날부터 센다(제4조 1항).
  const allSources = songs.every((song) => song.sourceReceivedAt !== null);
  const startDay =
    depositMetAt && allSources
      ? Math.max(kstDay(depositMetAt), ...songs.map((song) => kstDay(song.sourceReceivedAt as Date)))
      : null;

  // 의뢰인 사유로 미루는 구간(제4조 2항): 운영자가 기록한 의뢰인 사유 정지(시작~끝, 없으면 오늘)와 피드백 대기.
  // 겹치는 날은 한 번만 센다(여러 곡의 결과물을 동시에 기다리는 날). 작업 기간이 시작되기 전은 미룰 예정일이 없으니
  // 시작일 앞부분을 잘라 센다. 스튜디오 사유 정지는 미루지 않는다.
  const clientWaits: Array<[number, number]> = [...feedbackWaits];
  let openPause: { cause: PauseCause; since: Date } | null = null;
  for (const event of events) {
    if (event.type === 'pause_started' && !openPause) {
      openPause = { cause: parseEventData(event).cause ?? 'client', since: event.occurredAt };
    } else if (event.type === 'pause_ended' && openPause) {
      if (openPause.cause === 'client') clientWaits.push([kstDay(openPause.since), kstDay(event.occurredAt)]);
      openPause = null;
    }
  }
  if (openPause?.cause === 'client') clientWaits.push([kstDay(openPause.since), today]);
  const clientPauseDays = startDay === null ? 0 : coveredDays(clientWaits, startDay);

  const finalDelivered = last(of('final_delivered'));
  const dueDay = startDay !== null ? startDay + terms.workWeeks * 7 + clientPauseDays : null;
  const endDay = finalDelivered ? kstDay(finalDelivered.occurredAt) : today;
  const delayDays = dueDay !== null ? Math.max(0, endDay - dueDay) : 0;

  // ── 해지 정산(제10조 3항) ────────────────────────────────────────────────
  // 착수(제10조 1항)는 기록이 없어도 결과물 전달·녹음이 있었다면 이미 일어난 것이다 — 착수 기록을 빠뜨린 채
  // 해지하면 받은 금액 전액이 환불로 잡히던 문제.
  const kickedOff = of('kickoff').length > 0 || of('stage_delivered').length > 0 || of('recording_completed').length > 0;
  /**
   * 그 곡에서 경계에 닿았는가. 곡마다 일어나는 사건은 그 곡의 기록을, 음반 전체 사건(착수·마스터링·유통)은 모든 곡에
   * 같은 답을 준다.
   */
  const reachedFor: Record<RefundMilestoneEvent, (song: number) => boolean> = {
    kickoff: () => kickedOff,
    arrangement_delivered: (song) => of('stage_delivered', 'arrangement', song).length > 0,
    recording_completed: (song) => songs[song].recordingCompleted,
    tuning_delivered: (song) => songs[song].tuningDelivered,
    mixing_delivered: (song) => of('stage_delivered', 'mixing', song).length > 0,
    mastering_delivered: () => of('stage_delivered', 'mastering').length > 0,
    distribution_submitted: () => of('distribution_submitted').length > 0,
  };
  /**
   * 항목의 작업분 비율 = 곡마다 (닿은 경계 중 가장 큰 비율)의 평균. 계약서 제10조 3항 "곡마다 … 그 곡 몫의 N%"와
   * 같은 말이다(template.ts describeRefundMilestones). 곡이 하나면 그냥 닿은 경계 중 가장 큰 비율이다.
   */
  const itemRatio = (milestones: ProductionTerms['refundSchedule'][number]['milestones']) =>
    Array.from({ length: songCount }, (_, song) =>
      milestones.reduce((best, m) => (reachedFor[m.event](song) ? Math.max(best, m.ratio) : best), 0),
    ).reduce((sum, ratio) => sum + ratio, 0) / songCount;
  // 착수 전 해지는 받은 금액 전액 환불(제10조 2항) — 경계를 보지 않는다.
  const lines: RefundLine[] = terms.refundSchedule.map((item) => {
    const ratio = kickedOff ? itemRatio(item.milestones) : 0;
    return { key: item.key, label: item.label, amount: item.amount, ratio, deducted: Math.round(item.amount * ratio) };
  });
  // 3항 — 착수 후 의뢰인 사정의 해지에서만. 해지 전에는 의뢰인 사정으로 가정한다(관리자 미리보기).
  const performedFees = stages.reduce((sum, state) => sum + state.performedExtraFee, 0);
  const extrasForClientCause = kickedOff ? extraCosts + performedFees : 0;
  const refundExtras = input.terminationCause === 'studio' ? 0 : extrasForClientCause;
  const workDeduction = lines.reduce((sum, line) => sum + line.deducted, 0);
  const deduction = workDeduction + refundExtras;

  // ── 의뢰인 무응답(제10조 5항) ────────────────────────────────────────────
  const lastContact = last(of('client_contacted'));
  const clientActivityAfter = lastContact
    ? events.some(
        (e) =>
          e.occurredAt.getTime() >= lastContact.occurredAt.getTime() &&
          e.id !== lastContact.id &&
          (e.actor === 'client' ||
            e.type === 'client_responded' ||
            e.type === 'revision_requested' ||
            e.type === 'payment_received' ||
            e.type === 'source_received' ||
            e.type === 'source_replaced'),
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
      depositMetAt,
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
      // "N주 이상 지연"은 그 기간이 다 지난 뒤에 성립한다(초일불산입) — 마지막 날 당일은 아직이다.
      delayExceeded: delayDays > terms.studioDelayWeeks * 7,
      finalDeliveredAt: finalDelivered?.occurredAt ?? null,
      distributionSubmitted: reachedFor.distribution_submitted(0),
      released: of('released').length > 0,
    },
    stages,
    songs,
    refund: {
      lines,
      extras: refundExtras,
      deduction,
      refundable: Math.max(0, received - deduction),
      refundableIfStudio: Math.max(0, received - workDeduction),
    },
    unresponsive: {
      since: unresponsiveSince,
      days: unresponsiveDays,
      exceeded: unresponsiveDays > terms.clientUnresponsiveDays,
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
      severity: payments.depositOverdueDays > delayLimit ? 'alert' : 'warn',
      message:
        `계약금 기한이 ${payments.depositOverdueDays}일 지났어요.` +
        (payments.depositOverdueDays > delayLimit ? ` ${delayLimit}일 이상 지체 — 통지 후 해지할 수 있어요(제10조 5항).` : ''),
    });
  }
  if (payments.balanceOverdueDays > 0) {
    todos.push({
      severity: payments.balanceOverdueDays > delayLimit ? 'alert' : 'warn',
      message:
        `잔금 기한이 ${payments.balanceOverdueDays}일 지났어요.` +
        (payments.balanceOverdueDays > delayLimit ? ` ${delayLimit}일 이상 지체 — 통지 후 해지할 수 있어요(제10조 5항).` : ''),
    });
  }
  if (!work.startedOn && payments.depositMetAt) todos.push({ severity: 'info', message: '1차 완성본을 받으면 기록해 주세요. 그날부터 작업 기간을 셉니다.' });

  for (const state of stages) {
    const name = stageTitle(terms, state.stage, state.song);
    if (state.pending && !state.pending.noticeSent) {
      todos.push({
        severity: 'alert',
        message: `${name} 결과물 전달 통지가 의뢰인에게 가지 않았어요. 통지를 다시 보내야 간주 승인이 성립해요.`,
      });
    } else if (state.pending && today >= state.pending.deemedFromDay) {
      todos.push({ severity: 'info', message: `${name} 승인 간주 기한이 지났어요. 오늘 기한 점검에서 기록돼요.` });
    }
    if (state.revising) todos.push({ severity: 'info', message: `${name} 수정 요청을 반영해 다시 전달해 주세요.` });
  }

  if (findStage(ledger, 'mastering')?.approved && payments.paidInFull && !work.finalDeliveredAt) {
    todos.push({ severity: 'info', message: '마스터링 승인과 잔금 입금이 끝났어요. 최종 파일을 인도해 주세요.' });
  }
  if (work.finalDeliveredAt) {
    // 진행이 끝났으면 완료로 닫아 둔다 — 완료일은 최종 인도일로 기록되고(제13조 보관 기산점), 닫지 않으면 진행 중
    // 계약으로 남아 기한 점검·할 일에 계속 오른다(파기는 retention.ts가 최종 인도일 기준으로 따로 챙긴다).
    todos.push({
      severity: 'warn',
      message: '최종 파일을 인도했어요. 일이 다 끝났으면 "완료 처리"를 눌러 주세요 — 완료일부터 3년 뒤 개인정보를 파기해요(제13조).',
    });
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
