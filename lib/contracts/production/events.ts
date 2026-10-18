import { eq, sql } from 'drizzle-orm';

import { getDb } from '../../../db/client';
import {
  productionContractEvents,
  type ProductionContract,
  type ProductionContractEvent,
  type ProductionEventType,
} from '../../../db/schema';
import { EVENT_SPEC, isPerSongEvent, type ProductionStage } from './event-spec';
import { findStage, type EventData, type PauseCause, type ProductionLedger } from './ledger';
import { REVISION_STAGES, type RevisionStage } from './terms';

/**
 * 진행 기록 쓰기. 규칙 셋:
 *
 * 1. **추가만 한다.** 이 모듈 밖에서 production_contract_events를 UPDATE·DELETE하지 않는다. 고칠 일이 있으면
 *    void 기록을 새로 남긴다. UPDATE는 둘뿐이다 — 의뢰인 통지 결과(recordNoticeResult)와, 보관 기간이 지난
 *    개인정보 파기(retention.ts: 메모·링크·IP만 지우고 기록 자체는 남긴다).
 * 2. **기록 가능 여부는 장부(ledger)로 판정한다.** 화면이 버튼을 숨겨도 서버가 다시 본다 — 예컨대 잔금 전 최종
 *    인도(제5조 6항), 결과물 없이 승인.
 * 3. 순번(seq)은 INSERT 안에서 정한다. 동시 기록이 같은 번호를 잡으면 UNIQUE가 하나를 막고, 한 번 다시 시도한다.
 */

export interface EventInput {
  type: ProductionEventType;
  stage: ProductionStage | null;
  /** 곡 번호(0부터) — 곡마다 일어나는 사건만(isPerSongEvent). 그 밖에는 null. */
  song: number | null;
  amount: number | null;
  occurredAt: Date;
  data: EventData;
  voidsEventId: string | null;
}

const MAX_NOTE = 1000;
const MAX_LINK = 500;
/** 소급 기록을 받는 범위. 실수로 연도를 틀린 기록이 작업 기간 계산을 뒤흔들지 않게. */
const MAX_BACKDATE_DAYS = 120;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * 관리자 폼이 보낸 기록을 읽는다. 일어난 때는 `YYYY-MM-DDTHH:mm`(KST, datetime-local)로 받고, 비우면 지금이다.
 */
export const parseAdminEventInput = (
  raw: unknown,
  now: Date = new Date(),
): { ok: true; input: EventInput } | { ok: false; message: string } => {
  if (!isRecord(raw)) return { ok: false, message: '요청 형식이 올바르지 않습니다.' };

  const type = raw.type;
  if (typeof type !== 'string' || !(type in EVENT_SPEC) || EVENT_SPEC[type as ProductionEventType].internal) {
    // void도 여기서는 받지 않는다 — 무효 처리는 parseVoidInput으로만.
    return { ok: false, message: '기록 종류를 골라 주세요.' };
  }
  const spec = EVENT_SPEC[type as ProductionEventType];

  let stage: ProductionStage | null = null;
  if (spec.stages) {
    if (typeof raw.stage !== 'string' || !(spec.stages as readonly string[]).includes(raw.stage)) {
      return { ok: false, message: '단계를 골라 주세요.' };
    }
    stage = raw.stage as ProductionStage;
  }

  // 곡마다 일어나는 사건은 곡 번호를 받는다. 곡이 하나인 계약은 폼이 보내지 않으니 1번 곡(0)이다. 범위는
  // 장부의 곡 수를 아는 checkEventAllowed가 본다.
  let song: number | null = null;
  if (isPerSongEvent(type as ProductionEventType, stage)) {
    const given = raw.song;
    if (given !== undefined && given !== null && given !== '' && (typeof given !== 'number' || !Number.isInteger(given) || given < 0 || given > 50)) {
      return { ok: false, message: '곡을 골라 주세요.' };
    }
    song = typeof given === 'number' ? given : 0;
  }

  let amount: number | null = null;
  if (spec.amount) {
    if (typeof raw.amount !== 'number' || !Number.isInteger(raw.amount) || raw.amount <= 0 || raw.amount > 100_000_000) {
      return { ok: false, message: '금액을 원 단위 정수로 입력해 주세요.' };
    }
    amount = raw.amount;
  }

  const data: EventData = {};
  const note = typeof raw.note === 'string' ? raw.note.trim() : '';
  if (spec.note === 'required' && note === '') return { ok: false, message: '내용을 적어 주세요.' };
  if (note.length > MAX_NOTE) return { ok: false, message: `내용은 ${MAX_NOTE}자 이내로 적어 주세요.` };
  if (note && spec.note) data.note = note;

  const link = typeof raw.link === 'string' ? raw.link.trim() : '';
  if (link) {
    if (!spec.link) return { ok: false, message: '이 기록에는 링크를 붙일 수 없습니다.' };
    if (link.length > MAX_LINK || !/^https:\/\/\S+$/.test(link)) {
      return { ok: false, message: '링크는 https://로 시작하는 주소여야 합니다.' };
    }
    data.link = link;
  }

  if (spec.cause) {
    if (raw.cause !== 'client' && raw.cause !== 'studio') return { ok: false, message: '정지 사유(의뢰인·스튜디오)를 골라 주세요.' };
    data.cause = raw.cause as PauseCause;
  }

  if (type === 'stage_approved') data.mode = 'proxy';

  const occurredAt = parseOccurredAt(raw.occurredAt, now);
  if (!occurredAt) {
    return { ok: false, message: `일어난 때는 지금부터 ${MAX_BACKDATE_DAYS}일 전 사이로 입력해 주세요.` };
  }

  return { ok: true, input: { type: type as ProductionEventType, stage, song, amount, occurredAt, data, voidsEventId: null } };
};

const parseOccurredAt = (value: unknown, now: Date): Date | null => {
  if (value === undefined || value === null || value === '') return now;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00+09:00`);
  if (Number.isNaN(date.getTime())) return null;
  // 몇 분의 시계 차이는 허용한다. 미래 기록은 받지 않는다 — 간주 승인·기한을 앞당길 수 있다.
  if (date.getTime() > now.getTime() + 5 * 60 * 1000) return null;
  if (date.getTime() < now.getTime() - MAX_BACKDATE_DAYS * 24 * 60 * 60 * 1000) return null;
  return date;
};

/** 기록 무효 처리 입력. 사유는 반드시 받는다 — 무엇을 왜 무효로 했는지가 그 자체로 기록이다. */
export const parseVoidInput = (
  raw: unknown,
  now: Date = new Date(),
): { ok: true; input: EventInput } | { ok: false; message: string } => {
  if (!isRecord(raw) || typeof raw.eventId !== 'string') return { ok: false, message: '무효로 할 기록을 골라 주세요.' };
  const reason = typeof raw.reason === 'string' ? raw.reason.trim() : '';
  if (!reason) return { ok: false, message: '무효로 하는 사유를 적어 주세요.' };
  if (reason.length > MAX_NOTE) return { ok: false, message: `사유는 ${MAX_NOTE}자 이내로 적어 주세요.` };
  return {
    ok: true,
    input: { type: 'void', stage: null, song: null, amount: null, occurredAt: now, data: { reason }, voidsEventId: raw.eventId },
  };
};

const STAGE_NAME: Record<RevisionStage, string> = { arrangement: '편곡', mixing: '믹싱', mastering: '마스터링' };
const isRevisionStage = (stage: ProductionStage | null): stage is RevisionStage =>
  stage !== null && (REVISION_STAGES as readonly string[]).includes(stage);

/**
 * 지금 장부 상태에서 이 기록을 남길 수 있는가. 남길 수 없으면 이유 문구, 있으면 null.
 *
 * 화면 버튼과 무관하게 서버가 판정한다. 의뢰인 진행 페이지의 승인·수정 요청도 같은 판정을 지난다.
 */
export const checkEventAllowed = (
  contract: Pick<ProductionContract, 'status'>,
  ledger: ProductionLedger,
  allEvents: readonly ProductionContractEvent[],
  input: EventInput,
): string | null => {
  if (contract.status !== 'signed') return '진행 중(체결된) 계약에만 기록할 수 있습니다.';
  if (input.song !== null && input.song >= ledger.songs.length) return '계약에 없는 곡입니다.';

  const has = (type: ProductionEventType) => ledger.events.some((event) => event.type === type);
  const song = input.song ?? 0;
  const songState = ledger.songs[song];

  switch (input.type) {
    case 'source_received':
      return songState?.sourceReceivedAt ? '그 곡의 1차 완성본은 이미 받았습니다. 바꿨다면 "1차 완성본 교체"로 기록해 주세요.' : null;
    case 'source_replaced':
      return songState?.sourceReceivedAt ? null : '먼저 그 곡의 "1차 완성본 수령"을 기록해 주세요.';
    case 'kickoff':
      return has('kickoff') ? '착수는 이미 기록했습니다.' : null;
    case 'recording_completed':
      return songState?.recordingCompleted ? '그 곡의 보컬 녹음 세션 마침은 이미 기록했습니다.' : null;
    case 'stage_delivered':
      if (isRevisionStage(input.stage) && findStage(ledger, input.stage, input.song)?.approved) {
        return `${STAGE_NAME[input.stage]}은(는) 이미 승인됐습니다.`;
      }
      return null;
    case 'revision_requested':
    case 'stage_approved': {
      if (!isRevisionStage(input.stage)) return '단계를 골라 주세요.';
      const state = findStage(ledger, input.stage, input.song);
      if (!state?.pending) {
        return state?.approved
          ? `${STAGE_NAME[input.stage]}은(는) 이미 승인됐습니다.`
          : `${STAGE_NAME[input.stage]} 결과물이 전달된 뒤에 기록할 수 있습니다.`;
      }
      return null;
    }
    case 'pause_started':
      return ledger.work.openPause ? '이미 정지 중입니다. 먼저 "작업 정지 끝"을 기록해 주세요.' : null;
    case 'pause_ended':
      return ledger.work.openPause ? null : '정지 중인 구간이 없습니다.';
    case 'final_delivered':
      // 제5조 6항: 잔금 지급을 확인한 뒤 인도한다.
      if (!findStage(ledger, 'mastering')?.approved) return '마스터링 승인 뒤에 최종 파일을 인도할 수 있습니다.';
      if (!ledger.payments.paidInFull) {
        return `잔금이 들어오기 전에는 최종 파일을 인도하지 않습니다(제5조 6항). 남은 금액 ${(ledger.payments.totalDue - ledger.payments.received).toLocaleString('ko-KR')}원.`;
      }
      return has('final_delivered') ? '최종 파일 인도는 이미 기록했습니다.' : null;
    case 'void': {
      const target = allEvents.find((event) => event.id === input.voidsEventId);
      if (!target || target.type === 'void') return '무효로 할 기록을 찾을 수 없습니다.';
      if (allEvents.some((event) => event.type === 'void' && event.voidsEventId === target.id)) return '이미 무효 처리한 기록입니다.';
      return null;
    }
    default:
      return null;
  }
};

export const loadProductionEvents = (contractId: string): Promise<ProductionContractEvent[]> =>
  getDb()
    .select()
    .from(productionContractEvents)
    .where(eq(productionContractEvents.contractId, contractId))
    .orderBy(productionContractEvents.seq);

/**
 * 기록을 하나 추가한다. 통지 대상이면 notice_status를 pending으로 넣고, 메일은 호출부가 보낸다(sendEventNotice).
 */
export const appendProductionEvent = async (
  contractId: string,
  input: EventInput,
  actor: { actor: string; ip: string | null },
  now: Date = new Date(),
): Promise<ProductionContractEvent> => {
  const insert = () =>
    getDb()
      .insert(productionContractEvents)
      .values({
        contractId,
        seq: sql`(SELECT COALESCE(MAX(${productionContractEvents.seq}), 0) + 1 FROM ${productionContractEvents} WHERE ${productionContractEvents.contractId} = ${contractId})`,
        type: input.type,
        stage: input.stage,
        song: input.song,
        amount: input.amount,
        dataJson: Object.keys(input.data).length > 0 ? JSON.stringify(input.data) : null,
        occurredAt: input.occurredAt,
        recordedAt: now,
        actor: actor.actor,
        actorIp: actor.ip,
        voidsEventId: input.voidsEventId,
        noticeStatus: EVENT_SPEC[input.type].notifies ? 'pending' : 'none',
      })
      .returning();

  try {
    const [event] = await insert();
    return event;
  } catch (error: unknown) {
    // 같은 순번을 동시에 잡았다 — 한 번만 다시 시도한다.
    if (error instanceof Error && /UNIQUE/i.test(error.message)) {
      const [event] = await insert();
      return event;
    }
    throw error;
  }
};

/** 통지 메일 결과 — 이 표에서 허용되는 유일한 UPDATE다. */
export const recordNoticeResult = async (
  eventId: string,
  result: { ok: true } | { ok: false; error: string },
): Promise<void> => {
  await getDb()
    .update(productionContractEvents)
    .set(
      result.ok
        ? { noticeStatus: 'sent', noticeSentAt: new Date(), noticeError: null }
        : { noticeStatus: 'failed', noticeError: result.error },
    )
    .where(eq(productionContractEvents.id, eventId));
};
