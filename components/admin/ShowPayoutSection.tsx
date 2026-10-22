import React, { useState } from 'react';

import { Button } from '../ui/Button';
import { formatPriceAmount } from '../../data/pricing';
import { remainingOverpaid } from '../../lib/partnerPayouts/showOverpayment';
import type { ShowPayoutPanelState, ShowPayoutView } from '../../lib/partnerPayouts/showView';
import { formatAdminDate, formatAdminDateFromSeconds } from '../../lib/admin/displayDate';
import { useAdminDialog } from './useAdminDialog';
import { DANGER_GHOST_CLASS } from './adminDanger';
import { DangerActions } from './DangerActions';

/**
 * `/admin/shows/[id]`의 「정산」 — 미리보기 + 기록·지급 완료·기록 취소·계좌 보기 (docs/settlement-record-design-2026-10.md §5).
 * 시스템은 계산하고 기록한다. **송금은 운영자가 은행 앱으로** 하고 「지급 완료」로 끝났다고 적는다. `ShopPayoutSection`과 같은 틀.
 *
 * 계좌는 props에 없다. 「계좌 보기」를 누르면 개설자 단위 열람 라우트(`/api/admin/creators/<id>/payout-account`, 접속기록)에서 받아 이 컴포넌트의 state에만 둔다.
 */

const won = (n: number) => `${formatPriceAmount(n)}원`;
const signed = (n: number) => `${n < 0 ? '−' : '+'}${formatPriceAmount(Math.abs(n))}원`;

const kstDate = (sec: number | null) => formatAdminDateFromSeconds(sec);

const BLOCKER_LABEL: Record<string, string> = {
  no_tax_type: '세금 처리 구분이 등록되지 않았습니다',
  no_payout_account: '정산 계좌가 등록되지 않았습니다',
  business_profile_unavailable: '사업자 정보를 읽지 못했습니다(마이그레이션 0058)',
  no_business_number: '사업자 정보(사업자등록번호·상호·대표자명)가 없습니다',
  terms_not_agreed: '주최자 약관 동의 기록이 없습니다',
};

interface ActionResponse { ok?: boolean; message?: string; warnings?: string[] }
interface RevealedAccount { bankName: string; account: string; holder: string }

export function ShowPayoutSection({ showId, panel, showtimeLabels }: {
  showId: string;
  panel: ShowPayoutPanelState;
  /** 회차 id → 표시 이름(수수료 면제 줄에 쓴다). */
  showtimeLabels: Record<string, string>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { ask, dialog } = useAdminDialog();
  const [notified, setNotified] = useState<string | null>(null);
  const [account, setAccount] = useState<RevealedAccount | 'loading' | { error: string } | null>(null);

  const post = async (body: Record<string, unknown>): Promise<{ ok: boolean; message?: string; warnings?: string[] }> => {
    try {
      const res = await fetch(`/api/admin/shows/${encodeURIComponent(showId)}/payout`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as ActionResponse;
      if (!res.ok || !data.ok) return { ok: false, message: data.message ?? '요청을 처리하지 못했습니다.' };
      return { ok: true, warnings: data.warnings };
    } catch {
      return { ok: false, message: '네트워크 오류가 발생했습니다.' };
    }
  };

  const run = async (key: string, confirmText: string | null, action: () => Promise<{ ok: boolean; message?: string; warnings?: string[] }>) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(key);
    setMessage(null);
    const result = await action();
    if (result.ok && result.warnings && result.warnings.length > 0) {
      // 처리는 끝났고 알림만 못 간 경우 — 바로 새로고침하면 이 안내가 사라진다. 운영자가 읽고 직접 새로고침한다.
      setNotified(`처리는 끝났지만 수취인 알림이 가지 않았습니다. ${result.warnings.join(' / ')}`);
      setBusy(null);
    } else if (result.ok) window.location.reload();
    else {
      setMessage(result.message ?? '처리하지 못했습니다.');
      setBusy(null);
    }
  };

  const showAccount = async (creatorId: string) => {
    setAccount('loading');
    try {
      const r = await fetch(`/api/admin/creators/${encodeURIComponent(creatorId)}/payout-account`, { credentials: 'same-origin' });
      const body = (await r.json()) as { ok: boolean; message?: string; account?: RevealedAccount };
      setAccount(!r.ok || !body.ok || !body.account ? { error: body.message ?? '계좌 정보를 읽지 못했습니다.' } : body.account);
    } catch {
      setAccount({ error: '네트워크 오류' });
    }
  };

  const frame = (children: React.ReactNode) => (
    <section className="mb-6 rounded-2xl bg-white p-4 text-sm text-gray-900 shadow-sm md:p-6" aria-labelledby="show-payout-heading">
      <h2 id="show-payout-heading" className="mb-2 text-lg font-bold text-gray-900 dark:text-gray-900">정산</h2>
      {children}
    </section>
  );

  if (panel.state === 'migration') {
    return frame(<p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">정산 기록 표가 아직 없습니다 — 운영 DB에 마이그레이션 0067(partner_payouts)을 먼저 적용해 주세요. 공연 운영 기능은 그대로 쓸 수 있습니다.</p>);
  }
  if (panel.state === 'error') {
    return frame(<p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-red-900">정산 정보를 불러오지 못했습니다. 잠시 뒤 새로고침해 주세요.</p>);
  }

  const v: ShowPayoutView = panel.view;
  if (!v.settleable) {
    return frame(<p className="text-gray-600">정산 대상 아님(스튜디오 직영 공연) — 주최자가 있는 공연만 이 화면에서 정산합니다.</p>);
  }

  const rec = v.recorded;
  const blocked = v.blockers.filter((b) => b !== 'already_recorded' && b !== 'nothing_to_pay' && b !== 'not_ended');
  const canRecord = !rec && v.ended && v.taxType !== null && !v.blockers.includes('nothing_to_pay');
  const delta = rec ? v.recordedDelta : null;
  const remaining = delta ? remainingOverpaid(delta.overpaidAmount, rec?.memo) : 0;
  const hasCharge = v.adjustmentAmount !== 0 || v.cancelFees.length > 0;

  return frame(
    <>
      <p className="mb-3 text-gray-600">
        주최자 {v.payeeName} · {v.taxType === 'invoice' ? '사업자 · 세금계산서' : v.taxType === 'withholding' ? '개인 · 원천징수' : '세금 유형 미설정'}.
        판매액에서 환불된 금액을 먼저 뺀 뒤 플랫폼·결제 수수료를 떼고(주최자 약관 제6조), 개인은 부가세 상당액과 원천징수를 더 뺍니다.
        <strong className="font-semibold"> 정산 기록은 그 시점의 숫자를 고정합니다</strong> — 송금은 은행 앱에서 하고 「지급 완료」로 끝났다고 적어 주세요.
      </p>
      {notified && (
        <div role="alert" className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          {notified} <button type="button" className="ml-2 text-primary underline" onClick={() => window.location.reload()}>새로고침</button>
        </div>
      )}
      {message && <div role="alert" className="mb-3 rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-900">{message}</div>}

      {!v.ended && !rec ? (
        <p className="rounded-lg bg-gray-50 p-3 text-gray-700">
          종료 후 기록 가능 — 마지막 회차가 {kstDate(v.lastEndAt)} 끝납니다. 끝난 뒤 판매·환불이 모두 정리되면 기록해 주세요.
          {v.dueBy ? ` (약관상 정산 기한: ${kstDate(v.dueBy)}까지)` : ''}
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 tabular-nums sm:grid-cols-2">
            <div className="flex justify-between gap-3"><dt className="text-gray-600">판매액 ({v.itemCount}장)</dt><dd>{won(rec ? rec.grossAmount : v.grossAmount)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-gray-600">환불 (−)</dt><dd>{won(rec ? rec.refundAmount : v.refundAmount)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-gray-600">플랫폼 수수료 (−)</dt><dd>{won(rec ? rec.platformFeeAmount : v.platformFeeAmount)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-gray-600">결제 수수료 (−)</dt><dd>{won(rec ? rec.paymentFeeAmount : v.paymentFeeAmount)}</dd></div>
            {(rec ? rec.vatDeductionAmount : v.vatDeductionAmount) > 0 && (
              <div className="flex justify-between gap-3"><dt className="text-gray-600">부가세 상당액 (−, 개인)</dt><dd>{won(rec ? rec.vatDeductionAmount : v.vatDeductionAmount)}</dd></div>
            )}
            {(rec ? rec.withholdingAmount : v.withholdingAmount) > 0 && (
              <div className="flex justify-between gap-3"><dt className="text-gray-600">원천징수 (−)</dt><dd>{won(rec ? rec.withholdingAmount : v.withholdingAmount)}</dd></div>
            )}
            {(rec ? rec.adjustmentAmount : v.adjustmentAmount) !== 0 && (
              <div className="flex justify-between gap-3"><dt className="text-gray-600">회차 취소 수수료 조정</dt><dd>{signed(rec ? rec.adjustmentAmount : v.adjustmentAmount)}</dd></div>
            )}
            <div className="flex justify-between gap-3 border-t border-gray-100 pt-1 font-semibold sm:col-span-2">
              <dt>실지급액</dt><dd>{v.taxType || rec ? won(rec ? rec.netAmount : v.netAmount) : '세금 유형을 몰라 계산하지 않음'}</dd>
            </div>
          </dl>

          {(rec ? rec.shortfallAmount : v.shortfallAmount) > 0 && (
            <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
              정산금이 모자라 {won(rec ? rec.shortfallAmount : v.shortfallAmount)}을 뺄 수 없었습니다 — 실지급은 0원이고, 이 금액은 이월되지 않고 주최자에게 청구합니다
              (주최자 약관 제7조: 정산금이 모자라면 모자라는 금액을 청구). 청구·협의 결과는 「지급 완료」 메모에 적어 두세요.
            </p>
          )}
        </>
      )}

      {hasCharge && (
        <div className="mt-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-700">
          <p className="mb-1 font-semibold text-gray-900">취소된 회차의 결제 수수료 (주최자 약관 제7조)</p>
          <p className="mb-1 text-gray-600">회차를 취소하면 전액 환불하지만 토스 결제 수수료는 돌려받지 못합니다. 스튜디오 귀책이 아니면 주최자 부담이고, 스튜디오 귀책이면 면제하세요.</p>
          <ul className="space-y-1">
            {v.cancelFees.map((f) => (
              <li key={f.showtimeId} className="flex flex-wrap items-center gap-2">
                <span>{showtimeLabels[f.showtimeId] ?? f.showtimeId} · {won(f.amount)}{f.waived ? ' · 스튜디오 귀책으로 면제됨' : ' · 주최자 부담'}</span>
                {!f.applied && (
                  <button
                    type="button" disabled={busy !== null}
                    className="text-primary hover:underline disabled:opacity-50"
                    onClick={() => run(`fee:${f.showtimeId}`, f.waived ? '면제를 되돌려 주최자 부담으로 돌립니다.' : '스튜디오 귀책으로 이 회차의 결제 수수료를 면제합니다.', () => post({ action: 'set_cancel_fee_waived', showtimeId: f.showtimeId, waived: !f.waived }))}
                  >
                    {f.waived ? '면제 되돌리기' : '스튜디오 귀책 — 면제'}
                  </button>
                )}
                {f.applied && <span className="text-gray-500">정산에 반영됨</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(!rec || rec.status === 'pending') && (
        <div className="mt-3 space-y-0.5 text-xs">
          {!rec && blocked.map((b) => <p key={b} className="font-semibold text-red-600">{BLOCKER_LABEL[b] ?? b}</p>)}
          {v.warnings.includes('no_resident_number') && <p className="text-amber-800">주민등록번호 미등록 — 기록·이체는 되지만 지급명세서 때 필요합니다</p>}
          {v.warnings.includes('creator_missing') && <p className="text-amber-800">개설자 계정을 찾지 못했습니다</p>}
          {v.refundAccountPendingCount > 0 && <p className="text-amber-800">계좌 입금 환불 {v.refundAccountPendingCount}건은 환불 계좌를 받고 아직 송금하지 않았습니다 — 송금 전에도 환불로 기록돼 판매액에서 빠집니다</p>}
          {v.refundDueCancelledOrderCount > 0 && <p className="text-amber-800">취소된 회차에 환불이 끝나지 않은 주문 {v.refundDueCancelledOrderCount}건이 있습니다 — 아직 판매액에 들어 있어 환불 뒤에 기록하는 편이 안전합니다</p>}
        </div>
      )}

      {rec && v.drift && (
        <p className="mt-2 text-xs text-red-600">
          기록 뒤 판매·환불이 바뀌었습니다(지금 판매 {won(v.grossAmount)} · 환불 {won(v.refundAmount)}, 기록 판매 {won(rec.grossAmount)} · 환불 {won(rec.refundAmount)}).
          {rec.status === 'pending' ? ' 이체 전이라면 「기록 취소」 후 다시 기록하세요.' : delta && delta.overpaidAmount === 0 && delta.underpaidAmount === 0 ? ' 실지급액은 그대로입니다.' : ''}
        </p>
      )}

      {rec?.status === 'paid' && delta && remaining > 0 && (
        <div role="alert" className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-semibold">지급 후 환불로 {won(remaining)} 더 지급됐습니다(회수 필요)</p>
          <p className="mt-1">
            기록 실지급 {won(rec.netAmount)} → 지금 계산 {won(delta.currentNetAmount)}.
            {delta.acknowledgedAmount > 0 ? ` 이미 회수 처리를 남긴 금액 ${won(delta.acknowledgedAmount)}을 뺀 몫입니다.` : ''}
            {' '}정산은 공연당 한 번이라 다음 정산에서 빼 줄 곳이 없습니다 — 주최자에게 회수를 요청한 뒤 아래 버튼으로 메모를 남기세요.
          </p>
          {delta.lateRefundOrders.length > 0 && (
            <p className="mt-1">기록 뒤 환불된 주문: {delta.lateRefundOrders.map((o) => `${o.orderNo}(${won(o.amount)})`).join(', ')}</p>
          )}
          <button
            type="button" disabled={busy !== null}
            className="mt-2 text-primary underline disabled:opacity-50"
            onClick={async () => {
              const values = await ask({
                title: '회수 처리 남기기',
                fields: [
                  {
                    name: 'amount',
                    label: '회수 요청을 처리한 금액 (원)',
                    type: 'number',
                    defaultValue: String(remaining),
                    required: '금액을 1원 이상의 숫자로 적어 주세요.',
                    validate: (v) => {
                      const n = Number(v.replace(/,/g, '').trim());
                      return Number.isSafeInteger(n) && n >= 1 ? null : '금액을 1원 이상의 숫자로 적어 주세요.';
                    },
                  },
                  { name: 'memo', label: '메모', type: 'textarea', hint: '회수 요청 방법·일자, 상계·반환 합의 등', required: '메모를 적어 주세요.' },
                ],
                confirmLabel: '기록',
              });
              if (values === null) return;
              const amount = Number(values.amount.replace(/,/g, '').trim());
              await run('ack', null, () => post({ action: 'acknowledge_overpayment', payoutId: rec.id, amount, memo: values.memo.trim() }));
            }}
          >
            회수 처리 남기기
          </button>
        </div>
      )}
      {rec?.status === 'paid' && delta && delta.overpaidAmount > 0 && remaining === 0 && (
        <p className="mt-2 text-xs text-gray-600">지급 후 환불로 더 지급된 {won(delta.overpaidAmount)}은 회수 처리 메모로 남겨져 있습니다.</p>
      )}
      {rec?.status === 'paid' && delta && delta.underpaidAmount > 0 && (
        <p className="mt-2 rounded-lg bg-gray-50 p-2 text-xs text-gray-700">
          지급 뒤 판매가 늘어 지금 계산은 기록보다 {won(delta.underpaidAmount)} 많습니다 — 자동으로 추가 지급하지 않으니 필요하면 주최자와 협의해 따로 보내고 메모에 적어 두세요.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {rec ? (
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${rec.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'}`}>
            {rec.status === 'paid' ? '지급 완료' : '이체 대기'}
          </span>
        ) : (
          <span className="text-xs text-gray-400">미기록</span>
        )}
        {canRecord && (
          <Button
            light size="sm" variant="weak"
            disabled={busy !== null || blocked.length > 0}
            title={blocked.length > 0 ? blocked.map((b) => BLOCKER_LABEL[b] ?? b).join(' / ') : undefined}
            onClick={() => run(
              'record',
              `${v.payeeName} 정산을 ${won(v.netAmount)}으로 기록할까요?${v.shortfallAmount > 0 ? `\n\n정산금이 모자라 ${won(v.shortfallAmount)}은 뺄 수 없고 청구 대상입니다.` : ''}\n\n기록하면 이 숫자가 고정됩니다.`,
              () => post({ action: 'record', expected: { netAmount: v.netAmount, adjustmentAmount: v.adjustmentAmount } }),
            )}
          >
            정산 기록
          </Button>
        )}
        {rec?.status === 'pending' && (
          <Button
            light size="sm" disabled={busy !== null}
            onClick={async () => {
              // 이체 메모(선택) — 이체일·실제 보낸 금액·청구 협의 결과. 기록 행은 불변이라 달라진 것은 여기 적어 둔다.
              const values = await ask({
                title: '지급 완료 기록',
                description: `${v.payeeName}에게 ${won(rec.netAmount)}을 이체했나요? 지급 완료로 기록합니다.${rec.netAmount === 0 ? '\n\n이체할 금액이 0원인 기록입니다(조정으로 상계).' : ''}`,
                fields: [{ name: 'memo', label: '이체 메모 (선택)', type: 'textarea', hint: '이체일, 실제 보낸 금액, 세금계산서 수취·청구 협의 등' }],
                confirmLabel: '지급 완료로 기록',
              });
              if (values === null) return;
              await run('paid', null, () => post({ action: 'mark_paid', payoutId: rec.id, memo: values.memo.trim() }));
            }}
          >
            지급 완료
          </Button>
        )}
        {v.creatorId && (
          <Button light size="sm" variant="weak" disabled={account === 'loading'} onClick={() => showAccount(v.creatorId as string)}>
            계좌 보기
          </Button>
        )}
        <DangerActions>
          {rec?.status === 'pending' && (
            <Button
              light size="sm" variant="ghost" className={DANGER_GHOST_CLASS} disabled={busy !== null}
              onClick={() => run(
                'delete',
                `${v.payeeName}의 기록(${won(rec.netAmount)})을 취소할까요?\n\n기록된 금액은 버려지고 이력도 남지 않으며, 이 정산에 실렸던 조정은 풀립니다. 아직 이체하지 않은 기록만 취소할 수 있습니다.`,
                () => post({ action: 'delete', payoutId: rec.id }),
              )}
            >
              기록 취소(이체 전)
            </Button>
          )}
        </DangerActions>
      </div>
      {rec?.memo && <p className="mt-1 whitespace-pre-line text-xs text-gray-500">메모: {rec.memo}</p>}
      {rec?.paidAt && <p className="mt-1 text-xs text-gray-500">지급 {formatAdminDate(rec.paidAt)}</p>}
      {account && account !== 'loading' && (
        'error' in account ? (
          <p role="alert" className="mt-1 text-xs text-red-600">{account.error}</p>
        ) : (
          <p className="mt-1 break-all rounded-lg bg-gray-50 p-2 text-xs text-gray-800">
            {account.bankName} {account.account} · {account.holder}
            <button type="button" className="ml-2 text-primary hover:underline" onClick={() => setAccount(null)}>닫기</button>
            <span className="block text-gray-500">조회 기록이 남습니다.</span>
          </p>
        )
      )}
      {dialog}
    </>,
  );
}
