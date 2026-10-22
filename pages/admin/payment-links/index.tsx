import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useState } from 'react';

import { AdminShell } from '../../../components/admin/AdminShell';
import { formatPriceAmount } from '../../../data/pricing';
import { PAYMENT_LINKS } from '../../../data/paymentLinks';
import { splitInclusiveAmount } from '../../../lib/booking/amounts';
import { kstDateString } from '../../../lib/booking/kst';
import { authenticateAdminRequest } from '../../../lib/contracts/admin-auth';
import { PAYMENT_LINK_LIMITS } from '../../../lib/payments/paymentLinkRules';
import { listPaymentLinks, type PaymentLinkListRow } from '../../../lib/payments/paymentLinks';
import { BUSINESS_LINE_LABELS, BUSINESS_LINES, type BusinessLine } from '../../../lib/ops/businessLine';
import { loadPaymentLinkLines } from '../../../lib/ops/businessLineStore';
import { buttonVariants } from '../../../components/ui/Button';
import { Notice } from '../../../components/ui/Notice';
import { formatAdminDate, formatAdminDateTimeFromSeconds } from '../../../lib/admin/displayDate';
import { useAdminDialog } from '../../../components/admin/useAdminDialog';

/**
 * 목록 행 + 매출 분야(지정이 없으면 기본 '녹음·제작'). `lineFixed`면 제작·믹싱 계약 링크라 바꿀 수 없다.
 * `lineSetBy`·`lineSetAt`은 분야를 마지막으로 정한 사람·시각(unix 초) — 고른 적 없으면 null.
 */
type LinkView = PaymentLinkListRow & { lineLabel: string; line?: BusinessLine; lineFixed?: boolean; lineSetBy?: string | null; lineSetAt?: number | null };

interface Props {
  links: LinkView[];
  /** 목록이 상한(200개)에서 잘렸는가. */
  truncated: boolean;
  /** 표가 아직 없는 DB(마이그레이션 0060 전) — 목록 조회가 실패했다. */
  tableMissing: boolean;
  /** 옛 파일 링크(data/paymentLinks.ts) — 읽기 전용. */
  fileLinks: Array<{ slug: string; itemName: string; totalAmount: number; expiresOn: string | null; open: boolean }>;
}

const LINK_LIST_LIMIT = 200;

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return { redirect: { destination: '/admin/login', permanent: false } };
  let rows: PaymentLinkListRow[] = [];
  let tableMissing = false;
  try {
    rows = await listPaymentLinks(LINK_LIST_LIMIT + 1);
  } catch {
    tableMissing = true;
  }
  // 분야 지정 표(0084)가 없으면 빈 지정 — 모두 기본(녹음·제작)으로 보인다.
  const lines = await loadPaymentLinkLines(rows.map((r) => r.slug));
  const links: LinkView[] = rows.map((r) => {
    const found = lines.get(r.slug);
    return {
      ...r,
      lineLabel: found ? `${BUSINESS_LINE_LABELS[found.line]}${found.fixed ? '(제작 계약)' : ''}` : BUSINESS_LINE_LABELS.recording,
      line: found?.line ?? 'recording',
      lineFixed: found?.fixed ?? false,
      lineSetBy: found?.by ?? null,
      lineSetAt: found?.at ?? null,
    };
  });
  const today = kstDateString(new Date());
  const fileLinks = Object.entries(PAYMENT_LINKS).map(([slug, l]) => ({
    slug, itemName: l.itemName, totalAmount: l.totalAmount, expiresOn: l.expiresOn ?? null, open: !(l.expiresOn && today > l.expiresOn),
  }));
  const truncated = links.length > LINK_LIST_LIMIT;
  return { props: { links: links.slice(0, LINK_LIST_LIMIT), truncated, tableMissing, fileLinks } };
};

const inputClass = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70';
const buttonClass = buttonVariants({ variant: 'solid', size: 'sm', light: true });
const rowButtonClass = buttonVariants({ variant: 'weak', size: 'sm', light: true });
const kstFull = (sec: number) => formatAdminDateTimeFromSeconds(sec);
const kst = (sec: number) => formatAdminDateTimeFromSeconds(sec);

export default function AdminPaymentLinksPage({ links: initialLinks, truncated, tableMissing, fileLinks }: Props) {
  // 만든 링크를 목록 맨 위에 바로 보인다(SSR 목록은 새로고침 전엔 낡는다 — 방금 만든 링크가 안 보이면 두 번 만들게 된다).
  const [links, setLinks] = useState(initialLinks);
  const { ask, dialog } = useAdminDialog();
  const [itemName, setItemName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [memo, setMemo] = useState('');
  const [sessionAt, setSessionAt] = useState('');
  const [sessionHours, setSessionHours] = useState('3');
  const [blockSlot, setBlockSlot] = useState(true);
  const [businessLine, setBusinessLine] = useState('recording');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const amount = Number(amountText.replace(/[,\s원]/g, ''));
  const split = Number.isInteger(amount) && amount > 0 ? splitInclusiveAmount(amount) : null;
  const origin = typeof window === 'undefined' ? 'https://studionol.co.kr' : window.location.origin;
  const urlOf = (slug: string) => `${origin}/ko/pay/${slug}`;

  const copy = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(urlOf(slug));
      setCopied(slug);
    } catch {
      // 클립보드를 쓸 수 없는 브라우저(권한 거부·비보안 문맥) — 주소를 칸에 띄워 손으로 복사하게 한다.
      await ask({
        title: '주소 복사',
        description: '자동 복사가 막혀 있어요. 아래 주소를 길게 눌러(또는 전체 선택해) 복사해 주세요.',
        fields: [{ name: 'url', label: '결제 링크 주소', defaultValue: urlOf(slug) }],
        confirmLabel: '닫기',
        cancelLabel: '취소',
      });
    }
  };

  type PostResult = { ok?: boolean; message?: string; slug?: string; blocked?: boolean; blockReleased?: boolean; code?: string; warning?: string };
  const post = async (body: Record<string, unknown>): Promise<PostResult | null> => {
    const res = await fetch('/api/admin/payment-links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return (await res.json().catch(() => null)) as PostResult | null;
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const sessionNote = sessionAt ? `\n이용 일시 ${sessionAt.replace('T', ' ')} · ${sessionHours}시간${blockSlot ? ' — 그 시간대를 예약 불가로 막아요' : ' (슬롯은 막지 않아요)'}` : '';
    if (!window.confirm(`${formatPriceAmount(amount)}원(부가세 포함)짜리 링크를 만들까요? 만든 뒤에는 금액을 바꿀 수 없어요.${sessionNote}`)) return;
    setBusy(true);
    setError(null);
    try {
      const payload = { action: 'create', itemName, totalAmount: amount, expiresOn, memo, sessionAt, businessLine, ...(sessionAt ? { sessionHours, blockSlot } : {}) };
      let data = await post(payload);
      if (data && !data.ok && data.code === 'conflicts') {
        // 이미 잡힌 예약과 겹친다 — 그대로 막으면 그 예약은 남은 채 시간만 "휴무"가 된다. 알고도 만들겠다고 해야 통과한다(예약 목록의 블록 등록과 같다).
        if (!window.confirm(`${data.message}\n\n그래도 링크를 만들고 이 시간을 막을까요?`)) return;
        data = await post({ ...payload, force: true });
      }
      if (data?.ok && data.slug) {
        setLinks((prev) => [{
          slug: data.slug as string, itemName: itemName.trim(), totalAmount: amount, expiresOn: expiresOn || null,
          memo: memo.trim() || null, closedAt: null, createdAt: Math.floor(Date.now() / 1000), open: true,
          sessionAt: sessionAt ? Math.floor(new Date(`${sessionAt}:00+09:00`).getTime() / 1000) : null,
          sessionHours: sessionAt ? Number(sessionHours) : null, blocked: Boolean(data.blocked),
          lineLabel: data.warning ? BUSINESS_LINE_LABELS.recording : BUSINESS_LINE_LABELS[businessLine as keyof typeof BUSINESS_LINE_LABELS] ?? BUSINESS_LINE_LABELS.recording,
          line: data.warning ? 'recording' : (businessLine as BusinessLine), lineFixed: false, lineSetBy: null, lineSetAt: null,
        }, ...prev]);
        setCreated(data.slug);
        if (data.warning) setError(data.warning);
        await copy(data.slug);
        setItemName(''); setAmountText(''); setExpiresOn(''); setMemo(''); setSessionAt(''); setSessionHours('3'); setBlockSlot(true); setBusinessLine('recording');
      } else setError(data?.message ?? '만들지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  /** 매출 분야 바꾸기 — 이미 받은 결제에도 소급된다(매출은 링크의 분야로 센다). */
  const changeLine = async (l: LinkView, next: BusinessLine) => {
    if (next === l.line) return;
    if (!window.confirm(`"${l.itemName}" 링크의 매출 분야를 ${BUSINESS_LINE_LABELS[l.line ?? 'recording']} → ${BUSINESS_LINE_LABELS[next]}(으)로 바꿀까요? 이미 받은 결제도 바뀐 분야로 셉니다.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/payment-links', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: l.slug, businessLine: next }) });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (data?.ok) {
        setLinks((prev) => prev.map((x) => (x.slug === l.slug ? { ...x, line: next, lineLabel: BUSINESS_LINE_LABELS[next], lineSetBy: null, lineSetAt: Math.floor(Date.now() / 1000) } : x)));
      } else setError(data?.message ?? '분야를 바꾸지 못했어요.');
    } catch {
      setError('네트워크 오류로 분야를 바꾸지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  const close = async (slug: string, name: string) => {
    if (!window.confirm(`"${name}" 링크를 닫을까요? 닫으면 열리지 않고, 되돌릴 수 없어요.`)) return;
    setBusy(true);
    try {
      const data = await post({ action: 'close', slug });
      if (data?.ok) window.location.reload();
      else setError(data?.message ?? '닫지 못했어요.');
    } catch {
      setError('네트워크 오류로 닫지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Head>
        <title>결제 링크 | 관리자</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <AdminShell title="결제 링크" description="고객에게 보낼 맞춤 결제 주소를 바로 만듭니다 — 배포 없이 즉시 열려요.">
        {tableMissing && (
          <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            결제 링크 표가 아직 없어요(마이그레이션 0060 미적용). 아래 옛 링크만 동작하고, 새 링크는 표를 만든 뒤에 만들 수 있어요.
          </div>
        )}
        {error && <Notice tone="error" light className="mb-4">{error}</Notice>}
        {created && (
          <div role="status" className="mb-4 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900">
            링크를 만들었어요{copied === created ? '(주소를 복사했어요)' : ''}: <span className="break-all font-mono">{urlOf(created)}</span>
          </div>
        )}

        <section className="mb-6 rounded-2xl bg-white p-4 text-sm text-gray-900 shadow-sm md:p-6">
          <h2 className="mb-3 text-lg font-bold text-gray-900">새 링크</h2>
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">상품명(고객에게 보여요)
              <input value={itemName} onChange={(e) => setItemName(e.target.value)} maxLength={PAYMENT_LINK_LIMITS.itemNameMax} required placeholder="예: 보컬 녹음 3시간 (10/17 11:00)" className={`mt-1 ${inputClass}`} />
            </label>
            <label className="block">금액 — <strong>부가세 포함 총액</strong>(원)
              <input value={amountText} onChange={(e) => setAmountText(e.target.value)} inputMode="numeric" required placeholder="250000" className={`mt-1 ${inputClass}`} />
              <span className="mt-1 block text-xs text-gray-600">
                {split ? `공급가 ${formatPriceAmount(split.itemAmount)}원 + 부가세 ${formatPriceAmount(split.vatAmount)}원 = ${formatPriceAmount(split.totalAmount)}원` : '고객이 결제하는 금액 그대로 적어요(부가세를 또 얹지 않아요).'}
              </span>
            </label>
            <label className="block">만료일(선택, 이 날 끝까지)
              <input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className={`mt-1 ${inputClass}`} />
            </label>
            <label className="block">이용 일시(선택, 한국시간)
              <input type="datetime-local" step={1800} value={sessionAt} onChange={(e) => setSessionAt(e.target.value)} className={`mt-1 ${inputClass}`} />
              <span className="mt-1 block text-xs text-gray-600">적으면 결제된 뒤 대시보드 “이번 주 세션”·예약 목록에 이 시각으로 보여요.</span>
            </label>
            <label className="block">이용 시간(시간)
              <input type="number" min={1} max={12} value={sessionHours} onChange={(e) => setSessionHours(e.target.value)} disabled={!sessionAt} className={`mt-1 ${inputClass}`} />
              <span className="mt-1 flex items-center gap-2 text-xs text-gray-700">
                <input type="checkbox" checked={blockSlot} onChange={(e) => setBlockSlot(e.target.checked)} disabled={!sessionAt} />
                그 시간대를 예약 불가로 막기(웹 이중 예약 방지)
              </span>
            </label>
            <label className="block">매출 분야(매출 현황의 분야별 표)
              <select value={businessLine} onChange={(e) => setBusinessLine(e.target.value)} className={`mt-1 ${inputClass}`}>
                {BUSINESS_LINES.map((line) => <option key={line} value={line}>{BUSINESS_LINE_LABELS[line]}</option>)}
              </select>
              <span className="mt-1 block text-xs text-gray-600">녹음·제작 대금이 아니면(예: 연습실 이용료) 바꿔 주세요. 제작 계약 링크는 늘 녹음·제작이에요.</span>
            </label>
            <label className="block">메모(선택, 고객에게 안 보여요)
              <input value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={PAYMENT_LINK_LIMITS.memoMax} placeholder="예: 김준호님" className={`mt-1 ${inputClass}`} />
            </label>
            <div className="sm:col-span-2">
              <button type="submit" disabled={busy || tableMissing} className={buttonClass}>{busy ? '처리 중…' : '링크 만들기'}</button>
            </div>
          </form>
        </section>

        <section className="mb-6 rounded-2xl bg-white p-4 text-sm text-gray-900 shadow-sm md:p-6">
          <h2 className="mb-3 text-lg font-bold text-gray-900">만든 링크</h2>
          {truncated && (
            <p className="mb-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">최근 {LINK_LIST_LIMIT}개만 표시합니다. 더 오래된 링크는 이 화면에서 볼 수 없습니다.</p>
          )}
          {links.length === 0 ? <p className="text-gray-600">아직 없어요.</p> : (
            <ul className="divide-y divide-gray-100">
              {links.map((l) => (
                <li key={l.slug} className="flex flex-wrap items-center gap-2 py-3">
                  <div className="min-w-0 flex-1 basis-full sm:basis-0">
                    <p className="font-semibold">{l.itemName} · {formatPriceAmount(l.totalAmount)}원{l.memo && <span className="ml-2 font-normal text-gray-600">({l.memo})</span>}</p>
                    {l.sessionAt && (
                      <p className="text-xs font-medium text-gray-800">
                        이용 {kstFull(l.sessionAt)} · {l.sessionHours}시간 · {l.blocked ? '슬롯 차단 중' : '슬롯 차단 없음'}
                      </p>
                    )}
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                      {l.lineFixed ? (
                        <span title="제작·믹싱 계약의 결제 링크는 늘 녹음·제작 매출이라 바꿀 수 없어요">{l.lineLabel} · 계약 링크라 분야 고정</span>
                      ) : (
                        <select
                          aria-label={`${l.itemName} 매출 분야`}
                          value={l.line ?? 'recording'}
                          disabled={busy}
                          onChange={(e) => changeLine(l, e.target.value as BusinessLine)}
                          className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                        >
                          {BUSINESS_LINES.map((line) => <option key={line} value={line}>{BUSINESS_LINE_LABELS[line]}</option>)}
                        </select>
                      )}
                      {l.lineSetAt && <span>분야 지정 {kst(l.lineSetAt)}{l.lineSetBy ? ` · ${l.lineSetBy}` : ''}</span>}
                    </p>
                    <p className="text-xs text-gray-600">
                      {kst(l.createdAt)} 생성 · {l.closedAt ? `${kst(l.closedAt)} 닫음` : l.expiresOn ? (l.open ? `${formatAdminDate(l.expiresOn)}까지` : `${formatAdminDate(l.expiresOn)} 만료`) : '만료일 없음'} · {l.open ? '열림' : '닫힘'}
                    </p>
                  </div>
                  {l.open && (
                    <>
                      <button type="button" onClick={() => copy(l.slug)} className={rowButtonClass}>{copied === l.slug ? '복사함' : '주소 복사'}</button>
                      <button type="button" disabled={busy} onClick={() => close(l.slug, l.itemName)} className={rowButtonClass}>닫기</button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {fileLinks.length > 0 && (
          <section className="rounded-2xl bg-white p-4 text-sm text-gray-900 shadow-sm md:p-6">
            <h2 className="mb-3 text-lg font-bold text-gray-900">옛 링크(파일)</h2>
            <ul className="divide-y divide-gray-100">
              {fileLinks.map((l) => (
                <li key={l.slug} className="flex flex-wrap items-center gap-2 py-3">
                  <p className="min-w-0 flex-1 basis-full sm:basis-0">{l.itemName} · {formatPriceAmount(l.totalAmount)}원 · {l.expiresOn ? (l.open ? `${formatAdminDate(l.expiresOn)}까지` : `${formatAdminDate(l.expiresOn)} 만료`) : '만료일 없음'}</p>
                  {l.open && <button type="button" onClick={() => copy(l.slug)} className={rowButtonClass}>{copied === l.slug ? '복사함' : '주소 복사'}</button>}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-gray-600">파일 링크는 읽기 전용이에요(닫으려면 코드에서 만료일을 지나간 날짜로).</p>
          </section>
        )}
        {dialog}
      </AdminShell>
    </>
  );
}
