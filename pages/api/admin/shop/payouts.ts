import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { isMissingTableError } from '../../../../lib/dbErrors';
import { addManualAdjustment, deleteUnappliedManualAdjustment } from '../../../../lib/partnerPayouts/adjustments';
import {
  isValidShopSubjectKey, recordShopPayout, type RecordShopPayoutResult, type ShopPayoutBlocker,
} from '../../../../lib/partnerPayouts/shop';
import { deletePartnerPayoutIfPending, getPartnerPayoutById, markPartnerPayoutPaid } from '../../../../lib/partnerPayouts/store';

/**
 * 관리자 — 상점 아티스트 월 정산 기록·지급·취소 (docs/settlement-record-design-2026-10.md).
 * POST만, no-store. 펀딩 정산 액션(`pages/api/admin/funding/projects/[id].ts`의 record_payout/mark_payout_paid)과 같은 틀이다.
 *
 * - `record`        { subjectKey, period, expected: { netAmount, adjustmentAmount } } — 화면이 보여 준 금액과 지금 계산한 값이 다르면 409 `amount_changed`.
 * - `mark_paid`     { id, memo? } — 이체를 마친 뒤. pending → paid 한 방향.
 * - `delete`        { id } — 이체 전(pending) 기록만. 실렸던 조정이 풀린다.
 * - `add_adjustment`    { subjectKey, amount, memo } — 수기 조정(아티스트 몫 기준, 부호 있음).
 * - `delete_adjustment` { id } — 아직 안 실린 수기 조정만.
 * 계좌는 이 라우트가 다루지 않는다 — 개설자 단위 열람 라우트(`/api/admin/creators/[creatorId]/payout-account`, 접속기록)를 버튼으로 쓴다.
 */

const MIGRATION_MESSAGE = '정산 기록 표가 아직 없습니다. 운영 DB에 마이그레이션 0066(partner_payouts)을 먼저 적용해 주세요.';

const BLOCKER_MESSAGE: Record<ShopPayoutBlocker | 'invalid' | 'not_found' | 'adjustments_changed', { status: number; message: string }> = {
  invalid: { status: 400, message: '정산 대상이나 달 형식이 올바르지 않습니다.' },
  not_found: { status: 404, message: '정산 대상을 찾지 못했습니다.' },
  already_recorded: { status: 409, message: '이미 이 달의 정산이 기록돼 있습니다. 새로고침해 주세요.' },
  nothing_to_pay: { status: 409, message: '이 달에 정산할 판매가 없습니다.' },
  no_tax_type: { status: 409, message: '세금 처리 구분(개인 원천징수/사업자)이 등록되지 않았습니다. 지금 기록하면 사업자에게 원천징수를 떼고 보낼 수 있어 막았습니다. 아티스트에게 정산 정보 등록을 요청해 주세요.' },
  no_payout_account: { status: 409, message: '정산 계좌가 등록되지 않았습니다. 아티스트에게 개설자 콘솔의 정산 정보 탭에서 등록을 요청해 주세요.' },
  business_profile_unavailable: { status: 409, message: '사업자 정보를 읽지 못해 기록할 수 없습니다(마이그레이션 0058 확인).' },
  no_business_number: { status: 409, message: '사업자(세금계산서) 아티스트인데 사업자 정보가 없습니다. 아티스트에게 정산 정보 탭에서 사업자등록번호·상호·대표자명 등록을 요청해 주세요.' },
  terms_not_agreed: { status: 409, message: '상점 위탁 약관의 현재 판본에 동의하지 않은 아티스트입니다. 아티스트에게 동의를 요청해 주세요.' },
  adjustments_changed: { status: 409, message: '기록하는 사이 이월 조정이 바뀌었습니다. 새로고침해 숫자를 다시 확인해 주세요.' },
};

const failure = (result: Exclude<RecordShopPayoutResult, { ok: true }>) => {
  if (result.code === 'amount_changed') {
    return {
      status: 409,
      body: {
        ok: false, code: result.code, expectedNetAmount: result.expectedNetAmount, netAmount: result.netAmount,
        message: `화면에 보인 금액(${(result.expectedNetAmount ?? 0).toLocaleString('ko-KR')}원)과 지금 계산한 금액(${(result.netAmount ?? 0).toLocaleString('ko-KR')}원)이 다릅니다 — 그사이 환불·조정이 바뀌었을 수 있어요. 새로고침해 다시 확인해 주세요.`,
      },
    };
  }
  const mapped = BLOCKER_MESSAGE[result.code];
  return { status: mapped.status, body: { ok: false, code: result.code, blockers: result.blockers, message: mapped.message } };
};

const toInt = (v: unknown): number | null => (typeof v === 'number' && Number.isSafeInteger(v) ? v : null);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }
  const b = ((typeof req.body === 'object' && req.body) || {}) as Record<string, unknown>;
  const now = new Date();

  try {
    if (b.action === 'record') {
      const expectedRaw = (typeof b.expected === 'object' && b.expected ? b.expected : {}) as Record<string, unknown>;
      const netAmount = toInt(expectedRaw.netAmount);
      const adjustmentAmount = toInt(expectedRaw.adjustmentAmount);
      if (typeof b.subjectKey !== 'string' || typeof b.period !== 'string' || netAmount === null || adjustmentAmount === null) {
        return res.status(400).json({ ok: false, message: '잘못된 요청입니다.' });
      }
      const result = await recordShopPayout(b.subjectKey, b.period, now, { netAmount, adjustmentAmount });
      if (!result.ok) {
        const f = failure(result);
        return res.status(f.status).json(f.body);
      }
      return res.status(200).json({ ok: true, payoutId: result.payout.id });
    }

    if (b.action === 'mark_paid' || b.action === 'delete') {
      if (typeof b.id !== 'string' || !b.id) return res.status(400).json({ ok: false, message: '잘못된 요청입니다.' });
      // 상점 정산만 이 라우트로 다룬다 — 공연(P2) 정산 기록을 상점 화면이 건드리지 못하게.
      const row = await getPartnerPayoutById(b.id);
      if (!row || row.kind !== 'shop') return res.status(404).json({ ok: false, message: '정산 기록을 찾지 못했습니다.' });

      if (b.action === 'mark_paid') {
        const memo = typeof b.memo === 'string' && b.memo.trim() ? b.memo.trim().slice(0, 500) : null;
        const done = await markPartnerPayoutPaid(b.id, memo, now);
        return done
          ? res.status(200).json({ ok: true })
          : res.status(409).json({ ok: false, message: '이미 지급 완료로 기록된 정산입니다. 새로고침해 주세요.' });
      }
      const outcome = await deletePartnerPayoutIfPending(b.id);
      if (outcome === 'ok') return res.status(200).json({ ok: true });
      if (outcome === 'already_paid') return res.status(409).json({ ok: false, message: '이미 이체를 마친 기록은 취소할 수 없습니다.' });
      if (outcome === 'adjustment_applied') {
        return res.status(409).json({ ok: false, message: '이 정산이 만든 이월 조정이나 이 정산을 바로잡는 환불 조정이 이미 다른 달 정산에 실려 있어 취소할 수 없습니다. 그 뒤 정산을 먼저 취소해 주세요.' });
      }
      return res.status(404).json({ ok: false, message: '정산 기록을 찾지 못했습니다.' });
    }

    if (b.action === 'add_adjustment') {
      const amount = toInt(b.amount);
      if (typeof b.subjectKey !== 'string' || !isValidShopSubjectKey(b.subjectKey) || amount === null || amount === 0 || typeof b.memo !== 'string' || !b.memo.trim()) {
        return res.status(400).json({ ok: false, message: '대상, 0이 아닌 정수 금액, 사유(메모)가 필요합니다.' });
      }
      if (Math.abs(amount) > 100_000_000) return res.status(400).json({ ok: false, message: '금액이 너무 큽니다.' });
      const result = await addManualAdjustment({ kind: 'shop', payeeKey: b.subjectKey, amount, memo: b.memo });
      return result === 'ok' ? res.status(200).json({ ok: true }) : res.status(400).json({ ok: false, message: '잘못된 요청입니다.' });
    }

    if (b.action === 'delete_adjustment') {
      if (typeof b.id !== 'string' || !b.id) return res.status(400).json({ ok: false, message: '잘못된 요청입니다.' });
      const done = await deleteUnappliedManualAdjustment(b.id);
      return done
        ? res.status(200).json({ ok: true })
        : res.status(409).json({ ok: false, message: '지울 수 없는 조정입니다(이미 정산에 실렸거나, 시스템이 만든 조정이거나, 없는 조정). 잘못 생긴 조정은 반대 부호의 수기 조정으로 상쇄해 주세요.' });
    }

    return res.status(400).json({ ok: false, message: '알 수 없는 작업입니다.' });
  } catch (error: unknown) {
    if (isMissingTableError(error)) return res.status(503).json({ ok: false, code: 'migration_needed', message: MIGRATION_MESSAGE });
    console.error('[admin/shop/payouts] 처리 실패:', error);
    return res.status(500).json({ ok: false, message: '처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.' });
  }
}
