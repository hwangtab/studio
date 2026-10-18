import { eq } from 'drizzle-orm';

import { getDb } from '../../../db/client';
import {
  productionContracts,
  type ProductionContract,
  type ProductionContractEvent,
  type ProductionContractSigner,
} from '../../../db/schema';
import {
  appendProductionEvent,
  checkEventAllowed,
  EventSeqConflictError,
  loadProductionEvents,
  recordNoticeResult,
  type EventInput,
} from './events';
import { EVENT_SPEC } from './event-spec';
import { computeProductionLedger, kstDay, kstDayStart, parseEventData, type ProductionLedger } from './ledger';
import { buildProductionProgressUrl } from './links';
import { sendDueReminderEmail, sendProgressNotice, sendTerminationEmail, type DueReminder } from './progress-email';
import { recordProductionNotificationResult } from './service';
import { parseTerminationCause } from './termination';
import { parseStoredTerms, type ProductionTerms } from './terms';

/**
 * 진행 기록의 서비스 층 — 기록 남기기·통지·기한 처리. 판정은 ledger.ts(순수), 쓰기 규칙은 events.ts, 문구는
 * progress-email.ts에 있고 여기는 그 셋을 잇기만 한다.
 */

export interface ProgressContext {
  contract: ProductionContract & { signers: ProductionContractSigner[] };
  terms: ProductionTerms;
  events: ProductionContractEvent[];
  ledger: ProductionLedger;
}

export const loadProgressContext = async (contractId: string, now: Date = new Date()): Promise<ProgressContext | null> => {
  const contract = await getDb().query.productionContracts.findFirst({
    where: eq(productionContracts.id, contractId),
    with: { signers: true },
  });
  if (!contract) return null;
  const terms = parseStoredTerms(contract.termsJson);
  const events = await loadProductionEvents(contractId);
  const terminationCause = contract.status === 'terminated' ? parseTerminationCause(contract.terminationReason) : null;
  return {
    contract,
    terms,
    events,
    ledger: computeProductionLedger({ terms, signedAt: contract.signedAt, events, now, terminationCause }),
  };
};

const clientToken = (context: ProgressContext): string | null =>
  context.contract.signers.find((signer) => signer.role === 'client')?.signToken ?? null;

/**
 * 기록 하나의 통지 메일을 보내고 결과를 그 기록에 남긴다. 장부는 이 기록까지 반영해 다시 계산한다 — 메일에
 * 들어가는 남은 금액·기한이 방금 기록을 포함해야 한다.
 */
export const sendEventNotice = async (contractId: string, eventId: string, now: Date = new Date()): Promise<void> => {
  const context = await loadProgressContext(contractId, now);
  const event = context?.events.find((e) => e.id === eventId);
  if (!context || !event || !EVENT_SPEC[event.type].notifies) return;

  const token = clientToken(context);
  if (!token) {
    await recordNoticeResult(eventId, { ok: false, error: '의뢰인 링크가 없어 통지하지 못했습니다.' });
    return;
  }
  try {
    const result = await sendProgressNotice(
      context.contract,
      context.terms,
      event,
      context.ledger,
      buildProductionProgressUrl(contractId, token),
      now,
    );
    if (!result) return;
    await recordNoticeResult(
      eventId,
      result.ok ? { ok: true } : { ok: false, error: `${result.errorCode ?? 'UNKNOWN'}${result.errorDetail ? `: ${result.errorDetail}` : ''}` },
      now,
    );
  } catch (error: unknown) {
    console.error('[contracts/production/progress] Notice failed:', error);
    await recordNoticeResult(eventId, { ok: false, error: '통지 메일 발송 중 오류' });
  }
};

/** 해지 처리 직후 의뢰인 안내(waitUntil). 실패는 계약의 알림 오류 칸에 남겨 관리자 화면에 드러낸다. */
export const sendTerminationNotice = async (contractId: string): Promise<void> => {
  try {
    const context = await loadProgressContext(contractId);
    const cause = context ? parseTerminationCause(context.contract.terminationReason) : null;
    const token = context ? clientToken(context) : null;
    if (!context || context.contract.status !== 'terminated' || !cause || !token) return;
    const result = await sendTerminationEmail(context.contract, context.ledger, cause, buildProductionProgressUrl(contractId, token));
    if (!result.ok) await recordProductionNotificationResult(contractId, `해지 안내 메일 실패: ${result.errorCode ?? 'UNKNOWN'}`);
  } catch (error: unknown) {
    console.error('[contracts/production/progress] Termination notice failed:', error);
    await recordProductionNotificationResult(contractId, '해지 안내 메일 발송 중 오류').catch(() => undefined);
  }
};

export type RecordResult = { ok: true; event: ProductionContractEvent } | { ok: false; status: 404 | 409; message: string };

/**
 * 기록을 남긴다(관리자·의뢰인 공용). 지금 장부로 허용 여부를 판정한 뒤 추가한다. 통지는 호출부가
 * sendEventNotice로 응답 뒤에 보낸다(waitUntil).
 */
export const recordProgressEvent = async (
  contractId: string,
  input: EventInput,
  actor: { actor: string; ip: string | null },
): Promise<RecordResult> => {
  // 판정한 장부의 다음 순번으로 넣는다. 그 사이 다른 기록이 들어왔으면(같은 결과물에 동시 승인·수정 요청, 크론의
  // 간주 승인과 의뢰인 요청이 겹친 경우) 새 장부로 다시 판정한다 — 두 번째 요청은 대개 여기서 거절된다.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const context = await loadProgressContext(contractId);
    if (!context) return { ok: false, status: 404, message: '계약을 찾을 수 없습니다.' };

    const refusal = checkEventAllowed(context.contract, context.ledger, context.events, input);
    if (refusal) return { ok: false, status: 409, message: refusal };

    const nextSeq = context.events.reduce((max, e) => Math.max(max, e.seq), 0) + 1;
    try {
      const event = await appendProductionEvent(contractId, withDeliveryRef(input, context.ledger), actor, new Date(), nextSeq);
      return { ok: true, event };
    } catch (error: unknown) {
      if (!(error instanceof EventSeqConflictError)) throw error;
    }
  }
  return { ok: false, status: 409, message: '다른 기록과 겹쳤습니다. 새로고침한 뒤 다시 시도해 주세요.' };
};

/** 승인·수정 요청은 어느 결과물에 대한 답인지 남긴다 — 그 전달을 무효로 하면 답도 근거를 잃는다(ledger). */
const withDeliveryRef = (input: EventInput, ledger: ProductionLedger): EventInput => {
  if ((input.type !== 'stage_approved' && input.type !== 'revision_requested') || input.data.deliveryEventId) return input;
  const stage = ledger.stages.find(
    (s) => s.stage === input.stage && (s.stage === 'mastering' || s.song === (input.song ?? 0)),
  );
  return stage?.pending ? { ...input, data: { ...input.data, deliveryEventId: stage.pending.deliveryEventId } } : input;
};

export interface DeadlineRunResult {
  deemedApprovals: number;
  reminders: number;
  todoContracts: Array<{ contract: ProductionContract; todos: ProductionLedger['todos'] }>;
  failed: number;
}

/**
 * 하루 한 번 진행 중인 계약을 훑는다(/api/cron/production-contract-deadlines).
 *
 * 1. **간주 승인 기록**(제5조 5항): 결과물 전달 뒤 기한이 지났고 수정 요청이 없으면 stage_approved(deemed)를
 *    system으로 남긴다. 일어난 때는 기한 다음 날 0시(KST)다. **전달 통지가 나가지 않은 전달에는 남기지 않는다** —
 *    알리지 않은 기한으로 승인을 의제할 수 없다. 그 경우는 운영자 할 일에 오른다.
 * 2. **기한 안내**: 간주 승인 이틀 전, 계약금·잔금 기한 전날 의뢰인에게 한 번씩. 보냈다는 사실을 reminder_sent
 *    기록으로 남겨 같은 안내가 두 번 가지 않게 한다(기록은 고치지 않으므로 "보냈음" 표시도 새 기록이다).
 * 3. 운영자 할 일 목록을 모은다(메일은 호출부가 보낸다).
 *
 * 같은 날 두 번 돌아도 같은 결과다 — 간주 승인은 장부가 이미 승인됨을 보면 다시 남기지 않는다.
 */
export const runProductionDeadlines = async (now: Date = new Date()): Promise<DeadlineRunResult> => {
  const contracts = await getDb().query.productionContracts.findMany({
    where: eq(productionContracts.status, 'signed'),
    columns: { id: true },
  });
  const result: DeadlineRunResult = { deemedApprovals: 0, reminders: 0, todoContracts: [], failed: 0 };
  const today = kstDay(now);
  const system = { actor: 'system', ip: null };

  for (const { id } of contracts) {
    try {
      let context = await loadProgressContext(id, now);
      if (!context) continue;

      for (const { stage, song, pending } of context.ledger.stages) {
        if (!pending || !pending.noticeSent || today < pending.deemedFromDay) continue;
        const recorded = await recordProgressEvent(
          id,
          {
            type: 'stage_approved',
            stage,
            song,
            amount: null,
            occurredAt: kstDayStart(pending.deemedFromDay),
            data: { mode: 'deemed', deliveryEventId: pending.deliveryEventId },
            voidsEventId: null,
          },
          system,
        );
        if (recorded.ok) {
          result.deemedApprovals += 1;
          await sendEventNotice(id, recorded.event.id, now);
        }
      }

      context = (await loadProgressContext(id, now)) ?? context;
      result.reminders += await sendDueReminders(context, today, now);
      if (context.ledger.todos.length > 0) result.todoContracts.push({ contract: context.contract, todos: context.ledger.todos });
    } catch (error: unknown) {
      console.error(`[contracts/production/progress] Deadline run failed for ${id}:`, error);
      result.failed += 1;
    }
  }
  return result;
};

/** 기한 안내 — 보낸 적이 없는 것만. 몇 건 보냈는지 돌려준다. */
const sendDueReminders = async (context: ProgressContext, today: number, now: Date): Promise<number> => {
  const { ledger, contract } = context;
  const sentKeys = new Set(
    ledger.events
      .filter((e) => e.type === 'reminder_sent')
      .map((e) => {
        const data = parseEventData(e);
        return `${data.kind}:${data.refEventId ?? ''}`;
      }),
  );

  const due: DueReminder[] = [];
  for (const { stage, song, pending } of ledger.stages) {
    if (pending?.noticeSent && pending.deemedFromDay - 2 === today) {
      due.push({ kind: 'deemed_approval_soon', refEventId: pending.deliveryEventId, stage, song, lastDay: pending.lastDayToRespond });
    }
  }
  const { payments } = ledger;
  if (!payments.depositMetAt && payments.depositLastDay && kstDay(payments.depositLastDay) - 1 === today) {
    due.push({ kind: 'deposit_due', lastDay: payments.depositLastDay });
  }
  // 잔금 기한은 마스터링 승인에서 나온다 — 그 승인을 무효로 하고 다시 승인하면 기한도 새로 생기니 안내도 그 승인마다.
  const masteringApproval = ledger.stages.find((s) => s.stage === 'mastering')?.approved ?? null;
  if (!payments.paidInFull && payments.balanceLastDay && kstDay(payments.balanceLastDay) - 1 === today) {
    due.push({ kind: 'balance_due', refEventId: masteringApproval?.eventId, lastDay: payments.balanceLastDay });
  }

  const token = clientToken(context);
  if (!token) return 0;

  let sent = 0;
  for (const reminder of due) {
    if (sentKeys.has(`${reminder.kind}:${reminder.refEventId ?? ''}`)) continue;
    // 실패해도 기록한다(사유와 함께) — 기한 전날에만 보내는 안내라 다음 날 다시 보낼 기회가 없고, 보내려 했다는
    // 사실과 실패가 운영자 화면에 남아야 한다.
    const mail = await sendDueReminderEmail(contract, context.terms, ledger, reminder, buildProductionProgressUrl(contract.id, token));
    await appendProductionEvent(
      contract.id,
      {
        type: 'reminder_sent',
        stage: null,
        song: null,
        amount: null,
        occurredAt: now,
        data: { kind: reminder.kind, refEventId: reminder.refEventId, ...(mail.ok ? {} : { reason: mail.errorCode ?? 'UNKNOWN' }) },
        voidsEventId: null,
      },
      { actor: 'system', ip: null },
      now,
    );
    if (mail.ok) sent += 1;
  }
  return sent;
};
