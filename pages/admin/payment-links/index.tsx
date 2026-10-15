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

interface Props {
  links: PaymentLinkListRow[];
  /** 표가 아직 없는 DB(마이그레이션 0060 전) — 목록 조회가 실패했다. */
  tableMissing: boolean;
  /** 옛 파일 링크(data/paymentLinks.ts) — 읽기 전용. */
  fileLinks: Array<{ slug: string; itemName: string; totalAmount: number; expiresOn: string | null; open: boolean }>;
}

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return { redirect: { destination: '/admin/login', permanent: false } };
  let links: PaymentLinkListRow[] = [];
  let tableMissing = false;
  try {
    links = await listPaymentLinks();
  } catch {
    tableMissing = true;
  }
  const today = kstDateString(new Date());
  const fileLinks = Object.entries(PAYMENT_LINKS).map(([slug, l]) => ({
    slug, itemName: l.itemName, totalAmount: l.totalAmount, expiresOn: l.expiresOn ?? null, open: !(l.expiresOn && today > l.expiresOn),
  }));
  return { props: { links, tableMissing, fileLinks } };
};

const inputClass = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70';
const buttonClass = 'rounded-lg bg-gray-900 px-4 py-2 text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70';
const kst = (sec: number) => new Date(sec * 1000).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function AdminPaymentLinksPage({ links: initialLinks, tableMissing, fileLinks }: Props) {
  // 만든 링크를 목록 맨 위에 바로 보인다(SSR 목록은 새로고침 전엔 낡는다 — 방금 만든 링크가 안 보이면 두 번 만들게 된다).
  const [links, setLinks] = useState(initialLinks);
  const [itemName, setItemName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [memo, setMemo] = useState('');
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
      window.prompt('주소를 복사해 주세요', urlOf(slug));
    }
  };

  const post = async (body: Record<string, unknown>): Promise<{ ok?: boolean; message?: string; slug?: string } | null> => {
    const res = await fetch('/api/admin/payment-links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return (await res.json().catch(() => null)) as { ok?: boolean; message?: string; slug?: string } | null;
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!window.confirm(`${formatPriceAmount(amount)}원(부가세 포함)짜리 링크를 만들까요? 만든 뒤에는 금액을 바꿀 수 없어요.`)) return;
    setBusy(true);
    setError(null);
    try {
      const data = await post({ action: 'create', itemName, totalAmount: amount, expiresOn, memo });
      if (data?.ok && data.slug) {
        setLinks((prev) => [{
          slug: data.slug as string, itemName: itemName.trim(), totalAmount: amount, expiresOn: expiresOn || null,
          memo: memo.trim() || null, closedAt: null, createdAt: Math.floor(Date.now() / 1000), open: true,
        }, ...prev]);
        setCreated(data.slug);
        await copy(data.slug);
        setItemName(''); setAmountText(''); setExpiresOn(''); setMemo('');
      } else setError(data?.message ?? '만들지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  const close = async (slug: string, name: string) => {
    if (!window.confirm(`"${name}" 링크를 닫을까요? 닫으면 열리지 않고, 되돌릴 수 없어요.`)) return;
    setBusy(true);
    const data = await post({ action: 'close', slug });
    setBusy(false);
    if (data?.ok) window.location.reload();
    else setError(data?.message ?? '닫지 못했어요.');
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
        {error && <div role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</div>}
        {created && (
          <div role="status" className="mb-4 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900">
            링크를 만들었어요{copied === created ? '(주소를 복사했어요)' : ''}: <span className="break-all font-mono">{urlOf(created)}</span>
          </div>
        )}

        <section className="mb-6 rounded-2xl bg-white p-4 text-sm text-gray-900 shadow-sm md:p-6">
          <h2 className="mb-3 text-lg font-bold text-gray-900">새 링크</h2>
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">상품명(고객에게 보여요)
              <input value={itemName} onChange={(e) => setItemName(e.target.value)} maxLength={PAYMENT_LINK_LIMITS.itemNameMax} required placeholder="예: 보컬 녹음 1프로 (10/17 11:00)" className={`mt-1 ${inputClass}`} />
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
            <label className="block sm:col-span-2">메모(선택, 고객에게 안 보여요)
              <input value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={PAYMENT_LINK_LIMITS.memoMax} placeholder="예: 김준호님" className={`mt-1 ${inputClass}`} />
            </label>
            <div className="sm:col-span-2">
              <button type="submit" disabled={busy || tableMissing} className={buttonClass}>{busy ? '처리 중…' : '링크 만들기'}</button>
            </div>
          </form>
        </section>

        <section className="mb-6 rounded-2xl bg-white p-4 text-sm text-gray-900 shadow-sm md:p-6">
          <h2 className="mb-3 text-lg font-bold text-gray-900">만든 링크</h2>
          {links.length === 0 ? <p className="text-gray-600">아직 없어요.</p> : (
            <ul className="divide-y divide-gray-100">
              {links.map((l) => (
                <li key={l.slug} className="flex flex-wrap items-center gap-2 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{l.itemName} · {formatPriceAmount(l.totalAmount)}원{l.memo && <span className="ml-2 font-normal text-gray-600">({l.memo})</span>}</p>
                    <p className="text-xs text-gray-600">
                      {kst(l.createdAt)} 생성 · {l.closedAt ? `${kst(l.closedAt)} 닫음` : l.expiresOn ? (l.open ? `${l.expiresOn}까지` : `${l.expiresOn} 만료`) : '만료일 없음'} · {l.open ? '열림' : '닫힘'}
                    </p>
                  </div>
                  {l.open && (
                    <>
                      <button type="button" onClick={() => copy(l.slug)} className={buttonClass}>{copied === l.slug ? '복사함' : '주소 복사'}</button>
                      <button type="button" disabled={busy} onClick={() => close(l.slug, l.itemName)} className={buttonClass}>닫기</button>
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
                  <p className="min-w-0 flex-1">{l.itemName} · {formatPriceAmount(l.totalAmount)}원 · {l.expiresOn ? (l.open ? `${l.expiresOn}까지` : `${l.expiresOn} 만료`) : '만료일 없음'}</p>
                  {l.open && <button type="button" onClick={() => copy(l.slug)} className={buttonClass}>{copied === l.slug ? '복사함' : '주소 복사'}</button>}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-gray-600">파일 링크는 읽기 전용이에요(닫으려면 코드에서 만료일을 지나간 날짜로).</p>
          </section>
        )}
      </AdminShell>
    </>
  );
}
