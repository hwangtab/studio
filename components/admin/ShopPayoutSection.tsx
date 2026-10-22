import Link from 'next/link';
import React, { useState } from 'react';

import { Button } from '../ui/Button';
import { formatPriceAmount, SHOP_ARTIST_SHARE_PERCENT } from '../../data/pricing';
import type { AdjustmentView, ShopPayoutRowView } from '../../lib/partnerPayouts/shopView';
import { DANGER_TEXT_CLASS } from './adminDanger';

/**
 * `/admin/shop`의 「아티스트 정산」 — 달별 미리보기 + 기록·지급 완료·기록 취소·계좌 보기 (docs/settlement-record-design-2026-10.md §5).
 * 시스템은 계산하고 기록한다. **송금은 운영자가 은행 앱으로** 하고 "지급 완료"로 끝났다고 적는다.
 *
 * 계좌는 props에 없다. "계좌 보기"를 누르면 개설자 단위 열람 라우트(`/api/admin/creators/<id>/payout-account`, 접속기록 `creator_payout_account_view`)에서
 * 받아 이 컴포넌트의 state에만 둔다 — 파일 갈래 아티스트(`file:<slug>`)는 계정이 없어 버튼이 없다(운영자가 따로 안다).
 */

const won = (n: number) => `${formatPriceAmount(n)}원`;
const signed = (n: number) => `${n < 0 ? '−' : '+'}${formatPriceAmount(Math.abs(n))}원`;

const BLOCKER_LABEL: Record<string, string> = {
  no_tax_type: '세금 처리 구분이 등록되지 않았습니다',
  no_payout_account: '정산 계좌가 등록되지 않았습니다',
  business_profile_unavailable: '사업자 정보를 읽지 못했습니다(마이그레이션 0058)',
  no_business_number: '사업자 정보(사업자등록번호·상호·대표자명)가 없습니다',
  terms_not_agreed: '상점 위탁 약관 현재 판본에 동의하지 않았습니다',
};

const WARNING_LABEL: Record<string, string> = {
  no_resident_number: '주민등록번호 미등록 — 기록·이체는 되지만 지급명세서 때 필요합니다',
  creator_missing: '개설자 계정을 찾지 못했습니다',
};

const REASON_LABEL: Record<AdjustmentView['reason'], string> = {
  late_refund: '정산 뒤 환불',
  showtime_cancel_fee: '회차 취소 수수료',
  manual: '수기 조정',
};

interface ActionResponse { ok?: boolean; message?: string; code?: string; warnings?: string[] }

const post = async (body: Record<string, unknown>): Promise<{ ok: boolean; message?: string; warnings?: string[] }> => {
  try {
    const res = await fetch('/api/admin/shop/payouts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as ActionResponse;
    if (!res.ok || !data.ok) return { ok: false, message: data.message ?? '요청을 처리하지 못했습니다.' };
    return { ok: true, warnings: data.warnings };
  } catch {
    return { ok: false, message: '네트워크 오류가 발생했습니다.' };
  }
};

interface RevealedAccount { bankName: string; account: string; holder: string }

function AdjustmentList({ items, onDelete, busy }: { items: AdjustmentView[]; onDelete?: (id: string) => void; busy?: boolean }) {
  return (
    <ul className="mt-1 space-y-0.5 text-xs text-gray-600">
      {items.map((a) => (
        <li key={a.id}>
          {REASON_LABEL[a.reason]} {signed(a.amount)}
          {a.sourceRef && !a.sourceRef.startsWith('carryover:') ? ` · ${a.sourceRef}` : ''}
          {a.sourceRef?.startsWith('carryover:') ? ' · 이월' : ''}
          {a.memo ? <span className="block text-gray-500">{a.memo}</span> : null}
          {onDelete && a.deletable && (
            <button type="button" disabled={busy} onClick={() => onDelete(a.id)} className={`ml-2 disabled:opacity-50 ${DANGER_TEXT_CLASS}`}>삭제</button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function ShopPayoutSection({ rows, month, prevMonth, nextMonth, otherAdjustments }: {
  rows: ShopPayoutRowView[];
  month: string;
  prevMonth: string;
  nextMonth: string;
  /** 이 달 표에 행이 없는 수취인의 미적용 조정(다음 정산에 실린다). */
  otherAdjustments: Array<AdjustmentView & { payeeName: string | null }>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notified, setNotified] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Record<string, RevealedAccount | 'loading' | { error: string }>>({});

  const run = async (key: string, confirmText: string, action: () => Promise<{ ok: boolean; message?: string; warnings?: string[] }>) => {
    if (!window.confirm(confirmText)) return;
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
    setAccounts((prev) => ({ ...prev, [creatorId]: 'loading' }));
    try {
      const r = await fetch(`/api/admin/creators/${encodeURIComponent(creatorId)}/payout-account`, { credentials: 'same-origin' });
      const body = (await r.json()) as { ok: boolean; message?: string; account?: RevealedAccount };
      setAccounts((prev) => ({ ...prev, [creatorId]: !r.ok || !body.ok || !body.account ? { error: body.message ?? '계좌 정보를 읽지 못했습니다.' } : body.account }));
    } catch {
      setAccounts((prev) => ({ ...prev, [creatorId]: { error: '네트워크 오류' } }));
    }
  };

  const addAdjustment = async (r: ShopPayoutRowView) => {
    const amountText = window.prompt(`${r.payeeName} — 수기 조정 금액(아티스트 몫 기준, 원).\n차감은 음수(예: -5000), 가산은 양수. 다음 정산에 실립니다.`, '');
    if (amountText === null) return;
    const amount = Number(amountText.replace(/,/g, ''));
    if (!Number.isInteger(amount) || amount === 0) { setMessage('0이 아닌 정수 금액을 입력해 주세요.'); return; }
    const memo = window.prompt('조정 사유(필수 — 나중에 읽을 길이 이것뿐입니다)', '');
    if (memo === null || !memo.trim()) { setMessage('사유를 적어 주세요.'); return; }
    setBusy(`${r.subjectKey}:adj`);
    const result = await post({ action: 'add_adjustment', subjectKey: r.subjectKey, amount, memo: memo.trim() });
    if (result.ok) window.location.reload();
    else { setMessage(result.message ?? '조정을 추가하지 못했습니다.'); setBusy(null); }
  };

  const deleteAdjustment = async (id: string) => {
    if (!window.confirm('이 수기 조정을 지울까요? 아직 어느 정산에도 실리지 않은 조정만 지워집니다.')) return;
    setBusy(`adj:${id}`);
    const result = await post({ action: 'delete_adjustment', id });
    if (result.ok) window.location.reload();
    else { setMessage(result.message ?? '지우지 못했습니다.'); setBusy(null); }
  };

  return (
    <section className="mb-6 rounded-2xl bg-white p-4 text-sm text-gray-900 shadow-sm md:p-6" aria-labelledby="shop-payout-heading">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 id="shop-payout-heading" className="text-lg font-bold text-gray-900 dark:text-gray-900">아티스트 정산 · {month}</h2>
        <div className="flex gap-3 text-xs">
          <Link href={`/admin/shop?month=${prevMonth}`} className="text-primary hover:underline">← {prevMonth}</Link>
          <Link href={`/admin/shop?month=${nextMonth}`} className="text-primary hover:underline">{nextMonth} →</Link>
        </div>
      </div>
      <p className="mb-3 text-gray-600">
        그 달에 발송한 결제 완료 주문의 위탁 상품만 셉니다. 배송 없는 디지털 주문은 결제 승인 월로 세고, 내려받기 전 주문은 철회할 수 있어 세지 않습니다. 아티스트 몫 {SHOP_ARTIST_SHARE_PERCENT}%(상품 판매가 기준).
        아티스트가 직접 보낸 주문은 배송비 전액을 더합니다. 개인 아티스트는 부가세 상당액과 원천징수 3.3%를 뺍니다.
        <strong className="font-semibold"> 정산 기록은 그 시점의 숫자를 고정합니다</strong> — 송금은 은행 앱에서 하고 「지급 완료」로 끝났다고 적어 주세요.
        정산한 달의 주문이 나중에 환불되면 「정산 뒤 환불」 조정이 자동으로 쌓여 다음 정산에서 빠집니다(몫이 모자라면 0원이 되고 나머지는 이월).
      </p>
      {/* 세무사용 정산 CSV — 수취인 이름과 금액만 담긴다(계좌·주민등록번호·연락처 없음). 내려받으면 접속기록에 남는다. */}
      <form method="GET" action="/api/admin/partner-payouts/export" className="mb-3 flex flex-wrap items-center gap-2 text-xs text-gray-700" aria-label="정산 CSV 내려받기">
        <span className="font-semibold text-gray-900">정산 CSV</span>
        <select name="kind" defaultValue="all" className="rounded-lg border border-gray-300 px-2 py-1" aria-label="구분">
          <option value="all">상점·공연</option>
          <option value="shop">상점</option>
          <option value="show">공연</option>
        </select>
        <input type="month" name="from" defaultValue={month} required className="rounded-lg border border-gray-300 px-2 py-1" aria-label="시작 월" />
        <span aria-hidden="true">~</span>
        <input type="month" name="to" defaultValue={month} required className="rounded-lg border border-gray-300 px-2 py-1" aria-label="종료 월" />
        <Button type="submit" light size="sm" variant="weak">내려받기</Button>
        <span className="text-gray-500">공연은 정산을 기록한 달로 셉니다. 최대 24개월. 내려받은 기록이 남습니다.</span>
      </form>
      {notified && (
        <div role="alert" className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          {notified} <button type="button" className="ml-2 text-primary underline" onClick={() => window.location.reload()}>새로고침</button>
        </div>
      )}
      {message && <div role="alert" className="mb-3 rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-900">{message}</div>}
      {rows.length === 0 ? (
        <p className="text-gray-600">이 달에 발송한 아티스트 상품이 없습니다.</p>
      ) : (
        <table className="admin-table w-full text-left">
          <thead className="text-xs text-gray-500">
            <tr><th className="py-2 pr-3">아티스트</th><th className="py-2 pr-3">판매</th><th className="py-2 pr-3">공제·조정</th><th className="py-2 pr-3">이체액</th><th className="py-2">정산</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const rec = r.recorded;
              const key = r.subjectKey;
              const blocked = r.blockers.filter((b) => b !== 'already_recorded' && b !== 'nothing_to_pay');
              const account = r.creatorId ? accounts[r.creatorId] : undefined;
              return (
                <tr key={key} className="border-t border-gray-100 align-top">
                  <td className="py-2 pr-3" data-label="아티스트">
                    {r.payeeName}
                    <span className="block text-xs text-gray-500">
                      {r.taxType === 'invoice' ? '사업자 · 세금계산서' : r.taxType === 'withholding' ? '개인 · 원천징수' : key.startsWith('creator:') ? '세금 유형 미설정' : 'data/artists에 없음'}
                      {!r.creatorId && key.startsWith('file:') ? ' · 계정 없음(계좌 열람 없음)' : ''}
                    </span>
                    {!rec && blocked.map((b) => <span key={b} className="block text-xs font-semibold text-red-600">{BLOCKER_LABEL[b] ?? b}</span>)}
                    {r.warnings.filter((w) => WARNING_LABEL[w]).map((w) => <span key={w} className="block text-xs text-amber-800">{WARNING_LABEL[w]}</span>)}
                    {r.withdrawableOrderCount > 0 && (
                      <span className="block text-xs text-amber-800">철회 가능 {r.withdrawableOrderCount}건 — 내려받기 전 디지털 주문이라 정산에 넣지 않았습니다</span>
                    )}
                    {r.needsReviewOrderNos.length > 0 && (
                      <span className="block text-xs text-amber-800">부분 환불 주문은 빼고 계산했습니다 — 직접 확인: {r.needsReviewOrderNos.join(', ')}</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 tabular-nums" data-label="판매">
                    {r.itemCount}개 · {won(r.salesAmount)}
                    {r.shippingAmount > 0 && <span className="block text-xs text-gray-600">+ 배송비 {won(r.shippingAmount)} ({r.shippingOrderCount}건, 전액 아티스트 몫)</span>}
                  </td>
                  <td className="py-2 pr-3 text-xs tabular-nums text-gray-600" data-label="공제·조정">
                    상점 {won(r.storeAmount)}
                    {r.vatDeductionAmount > 0 && <><br />부가세 상당 {won(r.vatDeductionAmount)}</>}
                    {r.withholdingAmount > 0 && <><br />원천징수 {won(r.withholdingAmount)}</>}
                    {!rec && r.adjustments.length > 0 && (
                      <>
                        <br /><span className="font-semibold text-gray-800">이월 조정 {signed(r.adjustmentAmount)}</span>
                        <AdjustmentList items={r.adjustments} onDelete={deleteAdjustment} busy={busy !== null} />
                      </>
                    )}
                    {!rec && r.carryOverAmount < 0 && (
                      <span className="mt-1 block font-semibold text-amber-800">몫이 모자라 {won(-r.carryOverAmount)}은 다음 정산으로 이월됩니다</span>
                    )}
                    {rec && r.appliedAdjustments.length > 0 && (
                      <>
                        <br /><span className="font-semibold text-gray-800">이 정산에 반영된 조정 {signed(rec.adjustmentAmount)}</span>
                        <AdjustmentList items={r.appliedAdjustments} />
                      </>
                    )}
                    {rec && rec.shortfallAmount > 0 && <span className="mt-1 block text-amber-800">다음 정산으로 이월 {won(rec.shortfallAmount)}</span>}
                    {rec && r.adjustments.length > 0 && (
                      <>
                        <br /><span className="font-semibold text-gray-800">다음 정산에 실릴 조정 {signed(r.adjustmentAmount)}</span>
                        <AdjustmentList items={r.adjustments} onDelete={deleteAdjustment} busy={busy !== null} />
                      </>
                    )}
                  </td>
                  <td className="py-2 pr-3 font-semibold tabular-nums" data-label="이체액">
                    {rec ? won(rec.netAmount) : r.taxType ? won(r.netAmount) : '세금 유형을 몰라 계산하지 않음'}
                    {rec && r.drift && (
                      <span className="block text-xs font-normal text-red-600">
                        기록 뒤 판매액이 바뀌었습니다(지금 집계 {won(r.salesAmount)} · 기록 {won(rec.grossAmount)}) — 뒤늦은 환불은 다음 정산 조정으로 반영됩니다.
                        {rec.status === 'pending' ? ' 이체 전이라면 「기록 취소」 후 다시 기록해도 됩니다(환불 조정도 함께 취소됩니다).' : ''}
                      </span>
                    )}
                  </td>
                  <td className="py-2" data-label="정산">
                    <div className="flex flex-wrap items-center gap-2">
                      {rec ? (
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${rec.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'}`}>
                          {rec.status === 'paid' ? '지급 완료' : '이체 대기'}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">미기록</span>
                      )}
                      {!rec && r.taxType && r.blockers.every((b) => b !== 'nothing_to_pay') && (
                        <Button
                          light size="sm" variant="weak"
                          disabled={busy === key || blocked.length > 0}
                          title={blocked.length > 0 ? blocked.map((b) => BLOCKER_LABEL[b] ?? b).join(' / ') : undefined}
                          onClick={() => run(
                            key,
                            `${r.payeeName} ${r.period} 정산을 ${won(r.netAmount)}으로 기록할까요?${r.adjustmentAmount !== 0 ? `\n\n이월 조정 ${signed(r.adjustmentAmount)}이 함께 실립니다.` : ''}${r.carryOverAmount < 0 ? `\n몫이 모자라 ${won(-r.carryOverAmount)}은 다음 정산으로 이월됩니다.` : ''}\n\n기록하면 이 숫자가 고정됩니다.`,
                            () => post({ action: 'record', subjectKey: key, period: r.period, expected: { netAmount: r.netAmount, adjustmentAmount: r.adjustmentAmount } }),
                          )}
                        >
                          정산 기록
                        </Button>
                      )}
                      {rec?.status === 'pending' && (
                        <Button
                          light size="sm" disabled={busy === key}
                          onClick={() => run(
                            key,
                            `${r.payeeName}에게 ${won(rec.netAmount)}을 이체했나요? 지급 완료로 기록합니다.${rec.netAmount === 0 ? '\n\n이체할 금액이 0원인 기록입니다(조정으로 상계).' : ''}`,
                            async () => {
                              // 이체 메모(선택) — 이체일·실제 보낸 금액. 기록 행은 불변이라 달라진 것은 여기 적어 둔다.
                              const memo = window.prompt('이체 메모 (선택 — 이체일, 실제 보낸 금액, 세금계산서 수취 여부 등)\n※ 이 메모는 아티스트에게 가는 「정산금을 보냈어요」 메일에 그대로 실립니다. 아티스트에게 보여도 되는 말만 적어 주세요.', '');
                              if (memo === null) return { ok: false, message: '지급 완료 기록을 취소했습니다.' };
                              return post({ action: 'mark_paid', id: rec.id, memo: memo.trim() });
                            },
                          )}
                        >
                          지급 완료
                        </Button>
                      )}
                      {rec?.status === 'pending' && (
                        <Button
                          light size="sm" variant="weak" disabled={busy === key}
                          onClick={() => run(
                            key,
                            `${r.payeeName} ${r.period}의 기록(${won(rec.netAmount)})을 취소할까요?\n\n기록된 금액은 버려지고 이력도 남지 않으며, 이 정산에 실렸던 조정은 풀립니다. 아직 이체하지 않은 기록만 취소할 수 있습니다.`,
                            () => post({ action: 'delete', id: rec.id }),
                          )}
                        >
                          기록 취소(이체 전)
                        </Button>
                      )}
                      {r.creatorId && (
                        <Button light size="sm" variant="weak" disabled={account === 'loading'} onClick={() => showAccount(r.creatorId as string)}>
                          계좌 보기
                        </Button>
                      )}
                      <Button light size="sm" variant="weak" disabled={busy !== null} onClick={() => addAdjustment(r)}>조정 추가</Button>
                    </div>
                    {rec?.memo && <span className="mt-1 block text-xs text-gray-500">메모: {rec.memo}</span>}
                    {rec?.paidAt && <span className="mt-1 block text-xs text-gray-500">지급 {new Date(rec.paidAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}</span>}
                    {account && account !== 'loading' && (
                      'error' in account ? (
                        <span role="alert" className="mt-1 block text-xs text-red-600">{account.error}</span>
                      ) : (
                        <span className="mt-1 block rounded-lg bg-gray-50 p-2 text-xs text-gray-800">
                          {account.bankName} {account.account} · {account.holder}
                          <button type="button" className="ml-2 text-primary hover:underline" onClick={() => setAccounts((prev) => { const next = { ...prev }; delete next[r.creatorId as string]; return next; })}>닫기</button>
                          <span className="block text-gray-500">조회 기록이 남습니다.</span>
                        </span>
                      )
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {otherAdjustments.length > 0 && (
        <div className="mt-4 rounded-lg bg-gray-50 p-3 text-xs text-gray-700">
          <p className="mb-1 font-semibold text-gray-900">이 달 표에 없는 수취인의 이월 조정 (다음 정산에 실림)</p>
          <ul className="space-y-0.5">
            {otherAdjustments.map((a) => (
              <li key={a.id}>
                {a.payeeName ?? a.payeeKey} · {REASON_LABEL[a.reason]} {signed(a.amount)}{a.memo ? ` · ${a.memo}` : ''}
                {a.deletable && <button type="button" disabled={busy !== null} onClick={() => deleteAdjustment(a.id)} className={`ml-2 disabled:opacity-50 ${DANGER_TEXT_CLASS}`}>삭제</button>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
