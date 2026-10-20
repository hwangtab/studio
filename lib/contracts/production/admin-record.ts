import type { ProductionContractEvent } from '../../../db/schema';
import { loadRefundAccountSummary } from '../../payments/refundAccount';
import { parseAdminEventInput, parseVoidInput } from './events';
import { loadProgressContext, recordProgressEvent } from './progress';

/**
 * 관리자 진행 기록(기록 추가·무효 처리)의 입력 파싱 → 해지 환불 확인 → 장부 판정·기록. 관리자 기록 API와
 * scripts/contract-link.ts(log)가 **같은 함수**를 부른다 — 화면에서 누른 것과 터미널에서 남긴 것이 같은 규칙을 지나야
 * 하므로 검증을 두 곳에 베끼지 않는다. 통지 메일(sendEventNotice)은 호출부가 보낸다(API는 waitUntil, 스크립트는 await).
 */
export type AdminRecordResult =
  | { ok: true; event: ProductionContractEvent }
  | { ok: false; status: 400 | 404 | 409 | 503; message: string };

export const recordAdminProgress = async (
  contractId: string,
  action: 'record' | 'void',
  body: Record<string, unknown>,
  actor: { actor: string; ip: string | null },
): Promise<AdminRecordResult> => {
  const parsed = action === 'void' ? parseVoidInput(body) : parseAdminEventInput(body);
  if (!parsed.ok) return { ok: false, status: 400, message: parsed.message };

  // 해지 환불을 이미 보냈으면 정산을 바꾸는 무효 처리를 받지 않는다 — 보낸 금액과 의뢰인 화면의 금액이 갈린다.
  // 환불은 해지한 계약에만 있다 — 진행 중 계약의 무효 처리는 환불 기록과 무관하게 받는다.
  const terminated = action === 'void' && (await loadProgressContext(contractId))?.contract.status === 'terminated';
  if (terminated) {
    const refund = await loadRefundAccountSummary({ kind: 'production', orderNo: contractId });
    if (refund.status === 'unavailable') {
      return { ok: false, status: 503, message: '환불 기록을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.' };
    }
    if (refund.status === 'present' && refund.refundedAt) {
      return { ok: false, status: 409, message: '환불을 이미 보낸 계약입니다. 정산을 바꾸려면 의뢰인과 먼저 협의해 주세요.' };
    }
  }

  const recorded = await recordProgressEvent(contractId, parsed.input, actor);
  return recorded.ok ? { ok: true, event: recorded.event } : { ok: false, status: recorded.status, message: recorded.message };
};
