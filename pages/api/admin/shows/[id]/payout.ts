import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';
import { getDb } from '../../../../../db/client';
import { isMissingTableError } from '../../../../../lib/dbErrors';
import { computeRecordedShowDelta, loadShowSales, recordShowPayout, SHOW_PAYOUT_PERIOD, type RecordShowPayoutResult, type ShowPayoutBlocker } from '../../../../../lib/partnerPayouts/show';
import { setShowtimeCancelFeeWaived, type SetWaivedResult } from '../../../../../lib/partnerPayouts/showCancelFee';
import { sendPartnerPayoutNotice } from '../../../../../lib/partnerPayouts/notify';
import { formatAckLine, remainingOverpaid } from '../../../../../lib/partnerPayouts/showOverpayment';
import { appendPartnerPayoutMemoIfPaid, deletePartnerPayoutIfPending, getPartnerPayoutById, markPartnerPayoutPaid } from '../../../../../lib/partnerPayouts/store';

/**
 * 관리자 — 공연 주최자 정산 기록·지급·취소 (docs/settlement-record-design-2026-10.md). `pages/api/admin/shop/payouts.ts`와 같은 틀.
 * POST만, no-store. `id`는 공연(shows.id)이고, 정산 기록은 **이 공연의 것인지** 매번 확인한다 — 다른 공연·상점 정산을 이 경로로 건드리지 못하게.
 *
 * - `record`    { expected: { netAmount, adjustmentAmount } } — 화면이 보여 준 금액과 지금 계산한 값이 다르면 409 `amount_changed`.
 * - `mark_paid` { payoutId, memo? } — 이체를 마친 뒤. pending → paid 한 방향.
 * - `delete`    { payoutId } — 이체 전(pending) 기록만. 실렸던 조정이 풀린다.
 * - `acknowledge_overpayment` { payoutId, amount, memo } — 지급 뒤 환불로 더 지급된 몫을 주최자에게 회수 요청했음을 메모에 한 줄로 남긴다(`[회수 처리 N원 · …]`).
 *   금액은 지금 초과 지급액 중 아직 처리 줄로 덮이지 않은 몫 이하여야 한다. 점검은 그 줄들의 합으로 처리 여부를 판정한다.
 * - `set_cancel_fee_waived` { showtimeId, waived } — 회차 취소 결제 수수료를 스튜디오 귀책으로 면제/되돌림(아직 정산에 안 실린 것만).
 * 계좌는 이 라우트가 다루지 않는다 — 개설자 단위 열람 라우트(`/api/admin/creators/[creatorId]/payout-account`, 접속기록)를 버튼으로 쓴다.
 */

const MIGRATION_MESSAGE = '정산 기록 표가 아직 없습니다. 운영 DB에 마이그레이션 0067(partner_payouts)을 먼저 적용해 주세요.';

const BLOCKER_MESSAGE: Record<ShowPayoutBlocker | 'not_found' | 'not_settleable' | 'adjustments_changed', { status: number; message: string }> = {
  not_found: { status: 404, message: '공연을 찾지 못했습니다.' },
  not_settleable: { status: 409, message: '정산 대상이 아닙니다. 주최자가 없는 스튜디오 직영 공연은 정산하지 않습니다.' },
  already_recorded: { status: 409, message: '이미 이 공연의 정산이 기록돼 있습니다. 새로고침해 주세요.' },
  not_ended: { status: 409, message: '마지막 회차가 아직 끝나지 않았습니다. 끝난 뒤에 기록해 주세요(그 사이 판매·환불이 더 생길 수 있습니다).' },
  nothing_to_pay: { status: 409, message: '정산할 판매가 없습니다(받은 돈이 없거나 환불이 판매액을 다 덮었습니다).' },
  no_tax_type: { status: 409, message: '세금 처리 구분(개인 원천징수/사업자)이 등록되지 않았습니다. 지금 기록하면 사업자에게 원천징수를 떼고 보낼 수 있어 막았습니다. 주최자에게 정산 정보 등록을 요청해 주세요.' },
  no_payout_account: { status: 409, message: '정산 계좌가 등록되지 않았습니다. 주최자에게 개설자 콘솔의 정산 정보 탭에서 등록을 요청해 주세요.' },
  business_profile_unavailable: { status: 409, message: '사업자 정보를 읽지 못해 기록할 수 없습니다(마이그레이션 0058 확인).' },
  no_business_number: { status: 409, message: '사업자(세금계산서) 주최자인데 사업자 정보가 없습니다. 주최자에게 정산 정보 탭에서 사업자등록번호·상호·대표자명 등록을 요청해 주세요.' },
  terms_not_agreed: { status: 409, message: '주최자 약관 동의 기록이 없는 공연입니다.' },
  adjustments_changed: { status: 409, message: '기록하는 사이 회차 취소 수수료 조정이 바뀌었습니다. 새로고침해 숫자를 다시 확인해 주세요.' },
};

const WAIVE_MESSAGE: Record<Exclude<SetWaivedResult, 'ok'>, { status: number; message: string }> = {
  not_found: { status: 404, message: '취소된 회차를 찾지 못했습니다.' },
  no_organizer: { status: 409, message: '주최자가 없는 직영 공연입니다.' },
  no_fee: { status: 409, message: '이 회차에는 주최자가 부담할 결제 수수료가 없습니다(토스로 환불한 결제분이 없음).' },
  already_applied: { status: 409, message: '이 수수료가 이미 정산 기록에 실려 있어 바꿀 수 없습니다. 이체 전이라면 정산 기록을 취소한 뒤 다시 시도해 주세요.' },
  unchanged: { status: 200, message: '이미 그 상태입니다.' },
};

const failure = (result: Exclude<RecordShowPayoutResult, { ok: true }>) => {
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
  const showId = typeof req.query.id === 'string' ? req.query.id : '';
  const b = ((typeof req.body === 'object' && req.body) || {}) as Record<string, unknown>;
  const now = new Date();

  try {
    const show = showId ? await getDb().query.shows.findFirst({ where: (s, { eq }) => eq(s.id, showId) }) : undefined;
    if (!show) return res.status(404).json({ ok: false, message: '공연을 찾을 수 없습니다.' });

    if (b.action === 'record') {
      const expectedRaw = (typeof b.expected === 'object' && b.expected ? b.expected : {}) as Record<string, unknown>;
      const netAmount = toInt(expectedRaw.netAmount);
      const adjustmentAmount = toInt(expectedRaw.adjustmentAmount);
      if (netAmount === null || adjustmentAmount === null) return res.status(400).json({ ok: false, message: '잘못된 요청입니다.' });
      const result = await recordShowPayout(show.id, now, { netAmount, adjustmentAmount });
      if (!result.ok) {
        const f = failure(result);
        return res.status(f.status).json(f.body);
      }
      // 기록은 이미 DB에 있다 — 수취인 알림 실패는 warnings로만 올린다(상점 정산·펀딩 notifyPayout과 같은 계약).
      const warnings = await sendPartnerPayoutNotice(result.payout.id, 'recorded', { req, actor: auth.actor });
      return res.status(200).json({ ok: true, payoutId: result.payout.id, ...(warnings.length > 0 ? { warnings } : {}) });
    }

    if (b.action === 'mark_paid' || b.action === 'delete') {
      if (typeof b.payoutId !== 'string' || !b.payoutId) return res.status(400).json({ ok: false, message: '잘못된 요청입니다.' });
      // 이 공연의 공연 정산만 다룬다 — 다른 공연·상점 정산 id를 넣어도 404.
      const row = await getPartnerPayoutById(b.payoutId);
      if (!row || row.kind !== 'show' || row.subjectKey !== show.id || row.period !== SHOW_PAYOUT_PERIOD) {
        return res.status(404).json({ ok: false, message: '정산 기록을 찾지 못했습니다.' });
      }
      if (b.action === 'mark_paid') {
        const memo = typeof b.memo === 'string' && b.memo.trim() ? b.memo.trim().slice(0, 500) : null;
        const done = await markPartnerPayoutPaid(row.id, memo, now);
        if (done) {
          const warnings = await sendPartnerPayoutNotice(row.id, 'paid', { req, actor: auth.actor });
          return res.status(200).json({ ok: true, ...(warnings.length > 0 ? { warnings } : {}) });
        }
        return res.status(409).json({ ok: false, message: '이미 지급 완료로 기록된 정산입니다. 새로고침해 주세요.' });
      }
      const outcome = await deletePartnerPayoutIfPending(row.id);
      if (outcome === 'ok') return res.status(200).json({ ok: true });
      if (outcome === 'already_paid') return res.status(409).json({ ok: false, message: '이미 이체를 마친 기록은 취소할 수 없습니다.' });
      if (outcome === 'adjustment_applied') return res.status(409).json({ ok: false, message: '이 정산에 연결된 조정이 이미 다른 정산에 실려 있어 취소할 수 없습니다.' });
      return res.status(404).json({ ok: false, message: '정산 기록을 찾지 못했습니다.' });
    }

    if (b.action === 'acknowledge_overpayment') {
      const amount = toInt(b.amount);
      const memoText = typeof b.memo === 'string' ? b.memo.trim() : '';
      if (typeof b.payoutId !== 'string' || !b.payoutId || amount === null || amount < 1 || !memoText || memoText.length > 300) {
        return res.status(400).json({ ok: false, message: '잘못된 요청입니다. 처리 금액(1원 이상)과 메모(300자 이내)가 필요합니다.' });
      }
      const row = await getPartnerPayoutById(b.payoutId);
      if (!row || row.kind !== 'show' || row.subjectKey !== show.id || row.period !== SHOW_PAYOUT_PERIOD) {
        return res.status(404).json({ ok: false, message: '정산 기록을 찾지 못했습니다.' });
      }
      if (row.status !== 'paid') return res.status(409).json({ ok: false, message: '지급 완료된 정산만 회수 처리를 남길 수 있습니다. 이체 전이라면 기록을 취소하고 다시 기록하세요.' });
      const delta = computeRecordedShowDelta(row, await loadShowSales(show.id));
      const remaining = remainingOverpaid(delta.overpaidAmount, row.memo);
      if (remaining < 1) return res.status(409).json({ ok: false, message: '회수할 초과 지급이 없습니다(이미 처리했거나 환불이 없습니다). 새로고침해 주세요.' });
      // 오타로 큰 금액을 적으면 이후 환불이 더 생겨도 점검이 안 울린다 — 지금 남은 몫을 넘기지 못하게 한다.
      if (amount > remaining) return res.status(409).json({ ok: false, message: `처리 금액이 남은 초과 지급액(${remaining.toLocaleString('ko-KR')}원)보다 큽니다.` });
      const dateKst = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
      const line = formatAckLine(amount, auth.actor, dateKst, memoText);
      if ((row.memo?.length ?? 0) + line.length + 1 > 4000) return res.status(409).json({ ok: false, message: '메모가 너무 길어 더 덧붙일 수 없습니다.' });
      const done = await appendPartnerPayoutMemoIfPaid(row.id, line, now);
      if (!done) return res.status(409).json({ ok: false, message: '정산 상태가 바뀌었습니다. 새로고침해 주세요.' });
      return res.status(200).json({ ok: true });
    }

    if (b.action === 'set_cancel_fee_waived') {
      if (typeof b.showtimeId !== 'string' || !b.showtimeId || typeof b.waived !== 'boolean') return res.status(400).json({ ok: false, message: '잘못된 요청입니다.' });
      const result = await setShowtimeCancelFeeWaived(show.id, b.showtimeId, b.waived);
      if (result === 'ok') return res.status(200).json({ ok: true });
      const m = WAIVE_MESSAGE[result];
      return res.status(m.status).json({ ok: m.status === 200, code: result, message: m.message });
    }

    return res.status(400).json({ ok: false, message: '알 수 없는 작업입니다.' });
  } catch (error: unknown) {
    if (isMissingTableError(error)) return res.status(503).json({ ok: false, code: 'migration_needed', message: MIGRATION_MESSAGE });
    console.error('[admin/shows/payout] 처리 실패:', error);
    return res.status(500).json({ ok: false, message: '처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.' });
  }
}
