import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';

import { AdminShell } from '../../../../components/admin/AdminShell';
import ShopProductDetail from '../../../../components/shop/ShopProductDetail';
import { formatPriceAmount } from '../../../../data/pricing';
import type { ShopProduct } from '../../../../data/shop/catalog';
import { authenticateAdminRequest } from '../../../../lib/contracts/admin-auth';
import { loadShopProductForAdmin, type AdminShopProductDetail } from '../../../../lib/shop/adminProducts';
import { splitShopDescription } from '../../../../lib/shop/creatorValidation';
import { SHOP_STATUS_LABELS } from '../../../../lib/shop/productRules';

interface Props {
  product: AdminShopProductDetail;
}

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return { redirect: { destination: '/admin/login', permanent: false } };
  const id = typeof context.params?.id === 'string' ? context.params.id : '';
  const product = id ? await loadShopProductForAdmin(id) : null;
  if (!product) return { notFound: true };
  return { props: { product } };
};

const inputClass = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70';
const primaryBtn = 'rounded-lg bg-gray-900 px-4 py-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 disabled:opacity-60';
const secondaryBtn = 'rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 disabled:opacity-60';
const card = 'mb-6 rounded-2xl bg-white p-4 text-sm text-gray-900 shadow-sm md:p-6';

const kst = (sec: number) => new Date(sec * 1000).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const toPreview = (p: AdminShopProductDetail): ShopProduct => ({
  slug: p.slug,
  category: p.category,
  title: p.title || '제목 없음',
  ...(p.subtitle ? { subtitle: p.subtitle } : {}),
  description: splitShopDescription(p.description),
  images: p.images,
  skus: p.skus.map((s) => ({ id: s.id, ...(s.optionLabel ? { optionLabel: s.optionLabel } : {}), price: s.price, ...(s.retired ? { retired: true } : {}) })),
  published: p.published,
  kind: p.kind,
});

async function post(id: string, body: Record<string, unknown>): Promise<{ ok: boolean; message?: string; warnings?: string[]; locked?: number }> {
  try {
    const res = await fetch(`/api/admin/shop/products/${encodeURIComponent(id)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string; warnings?: string[]; locked?: number } | null;
    return res.ok && data?.ok ? { ok: true, warnings: data.warnings, locked: data.locked } : { ok: false, message: data?.message ?? '처리하지 못했습니다.' };
  } catch {
    return { ok: false, message: '연결에 실패했습니다.' };
  }
}

const filesToText = (p: AdminShopProductDetail) => p.digitalFiles.map((f) => `${f.label}|${f.key}`).join('\n');

const parseFiles = (text: string): Array<{ label: string; key: string }> =>
  text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const i = l.indexOf('|');
    return i === -1 ? { label: l.slice(l.lastIndexOf('/') + 1), key: l } : { label: l.slice(0, i).trim(), key: l.slice(i + 1).trim() };
  });

export default function AdminShopProductPage({ product }: Props) {
  const [note, setNote] = useState('');
  const [slug, setSlug] = useState(product.slug.startsWith('draft-') ? '' : product.slug);
  const [shipsOn, setShipsOn] = useState(product.shipsOn ?? '');
  const [filesText, setFilesText] = useState(filesToText(product));
  const [internalNote, setInternalNote] = useState(product.internalNote ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const run = async (body: Record<string, unknown>, doneText: string) => {
    setBusy(true);
    setMessage(null);
    const result = await post(product.id, body);
    if (!result.ok) {
      setMessage({ tone: 'error', text: result.message ?? '처리하지 못했습니다.' });
      setBusy(false);
      return;
    }
    const warn = result.warnings?.length ? ` (${result.warnings.join(' / ')})` : '';
    const extra = typeof result.locked === 'number' ? ` — 옵션 ${result.locked}개` : '';
    setMessage({ tone: 'ok', text: `${doneText}${extra}${warn}` });
    window.setTimeout(() => window.location.reload(), result.warnings?.length ? 2500 : 600);
  };

  const decide = (action: 'approve' | 'request_changes' | 'reject') =>
    run({ action, note: note || undefined, slug: action === 'approve' ? slug || undefined : undefined, expectedSubmittedAt: product.submittedAt },
      action === 'approve' ? '승인했습니다.' : action === 'request_changes' ? '보완을 요청했습니다.' : '반려했습니다.');

  const unlocked = product.skus.filter((s) => !s.locked);
  const totalStock = product.skus.filter((s) => s.locked).reduce((sum, s) => sum + (s.stock ?? 0), 0);
  const approved = product.reviewStatus === 'approved';

  return (
    <>
      <Head>
        <title>{product.title || '상품'} 심사 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <AdminShell
        title={product.title || '제목 없는 상품'}
        description={`${SHOP_STATUS_LABELS[product.reviewStatus]} · ${product.creatorName} <${product.creatorEmail}>`}
        backHref="/admin/shop/products"
        backLabel="상품 심사"
        width="wide"
      >
        {product.shadowedByFileSlug && (
          <div role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
            사이트 상품(data/shop/catalog.ts)이 같은 주소 &quot;{product.slug}&quot;를 쓰고 있어, 이 상품은 어떤 주소로도 열리지 않습니다. 승인할 때 다른 주소로 바꿔 주세요.
          </div>
        )}
        {!product.artistSlug && (
          <div role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
            상점 아티스트로 등재되지 않은 계정입니다. <Link href="/admin/shop/artists" className="underline">아티스트 등재</Link>를 먼저 해 주세요.
          </div>
        )}
        {approved && product.creatorEditedAt && (
          <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">승인 뒤 아티스트가 수정했습니다 ({kst(product.creatorEditedAt)}). 아래 미리보기에서 내용을 확인해 주세요.</div>
        )}
        {approved && unlocked.length > 0 && (
          <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">승인 대기 중인 새 옵션이 {unlocked.length}개 있습니다. 확인한 뒤 &quot;새 옵션 승인&quot;을 눌러야 판매가 시작됩니다.</div>
        )}
        {approved && totalStock === 0 && (
          <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            재고가 0입니다. <Link href="/admin/shop" className="underline">상점 관리</Link>에서 옵션별 총 재고를 넣어 주세요.
          </div>
        )}
        {message && (
          <div role={message.tone === 'error' ? 'alert' : 'status'} className={`mb-4 rounded-lg p-3 text-sm ${message.tone === 'error' ? 'border border-red-300 bg-red-50 text-red-900' : 'bg-green-50 text-green-900'}`}>
            {message.text}
          </div>
        )}

        <section className={card}>
          <h2 className="mb-3 font-semibold">미리보기</h2>
          <ShopProductDetail product={toPreview(product)} layout="stack" headingAs="h2" titleFallbackFont />
          <dl className="mt-4 grid gap-1 text-xs text-gray-600 sm:grid-cols-2">
            <div>분류: {product.category === 'album' ? '음반' : '굿즈'} · {product.kind === 'digital' ? '디지털' : '실물'}</div>
            <div>주소: {product.slug.startsWith('draft-') ? '미정' : `/ko/shop/${product.slug}`}</div>
            <div>한정 수량: {product.editionSize ?? '없음'}</div>
            <div>예약 발송일: {product.shipsOn ?? '없음'}</div>
            <div>제출: {product.submittedAt ? kst(product.submittedAt) : '—'}</div>
            <div>승인: {product.approvedAt ? kst(product.approvedAt) : '—'}</div>
          </dl>
        </section>

        <section className={card}>
          <h2 className="mb-3 font-semibold">옵션</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-xs text-gray-500"><tr><th className="py-2 pr-3">옵션</th><th className="py-2 pr-3">가격</th><th className="py-2 pr-3">상태</th><th className="py-2">총 재고</th></tr></thead>
              <tbody>
                {product.skus.map((s) => (
                  <tr key={s.id} className="border-t border-gray-100">
                    <td className="py-2 pr-3">{s.optionLabel ?? '(옵션 없음)'}<span className="block text-xs text-gray-500">{s.id}</span></td>
                    <td className="py-2 pr-3 tabular-nums">{formatPriceAmount(s.price)}원</td>
                    <td className="py-2 pr-3">{s.locked ? (s.retired ? '판매 종료' : '판매 중') : '승인 대기'}</td>
                    <td className="py-2 tabular-nums">{s.locked ? (s.stock ?? '미입력') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {approved && unlocked.length > 0 && (
            <button type="button" disabled={busy} onClick={() => run({ action: 'lock_new_skus' }, '새 옵션을 승인했습니다.')} className={`${primaryBtn} mt-3`}>새 옵션 승인</button>
          )}
        </section>

        {product.reviewStatus === 'submitted' && (
          <section className={card}>
            <h2 className="mb-3 font-semibold">판정</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">주소(slug) — 승인할 때 확정됩니다
                <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="비우면 아티스트가 적은 주소" className={`${inputClass} mt-1`} />
              </label>
              <label className="block md:col-span-2">아티스트에게 보이는 메모 (보완 요청·반려에는 필수)
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} className={`${inputClass} mt-1`} />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => decide('approve')} className={primaryBtn}>승인</button>
              <button type="button" disabled={busy || !note.trim()} onClick={() => decide('request_changes')} className={secondaryBtn}>보완 요청</button>
              <button type="button" disabled={busy || !note.trim()} onClick={() => decide('reject')} className={secondaryBtn}>반려</button>
            </div>
          </section>
        )}
        {product.reviewNote && (
          <section className={card}>
            <h2 className="mb-2 font-semibold">아티스트에게 보인 메모</h2>
            <p className="whitespace-pre-line text-gray-700">{product.reviewNote}</p>
          </section>
        )}

        <section className={card}>
          <h2 className="mb-3 font-semibold">운영</h2>
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="block">예약 발송일
                <input type="date" value={shipsOn} onChange={(e) => setShipsOn(e.target.value)} className={`${inputClass} mt-1`} />
              </label>
              <button type="button" disabled={busy} onClick={() => run({ action: 'set_ships_on', shipsOn: shipsOn || null }, '발송 예정일을 저장했습니다.')} className={`${secondaryBtn} mt-2`}>저장</button>
            </div>
            {approved && (
              <div>
                <p className="mb-1">공개 상태: {product.published ? '공개' : '비공개'}</p>
                <button type="button" disabled={busy} onClick={() => run({ action: 'set_published', published: !product.published }, product.published ? '비공개로 바꿨습니다.' : '공개했습니다.')} className={secondaryBtn}>
                  {product.published ? '비공개로 바꾸기' : '공개하기'}
                </button>
              </div>
            )}
            <div className="md:col-span-2">
              <label className="block">내려받기 파일 — 한 줄에 하나, &quot;이름|저장소 키&quot; (키는 shop/로 시작)
                <textarea value={filesText} onChange={(e) => setFilesText(e.target.value)} rows={3} placeholder="앨범 (WAV)|shop/album-name/album.zip" className={`${inputClass} mt-1 font-mono`} />
              </label>
              <button type="button" disabled={busy} onClick={() => run({ action: 'set_digital_files', files: parseFiles(filesText) }, '파일을 저장했습니다.')} className={`${secondaryBtn} mt-2`}>파일 저장</button>
              {product.kind === 'digital' && product.digitalFiles.length === 0 && <span className="ml-3 text-xs text-amber-800">디지털 상품은 파일이 있어야 승인됩니다.</span>}
            </div>
            <div className="md:col-span-2">
              <label className="block">내부 메모 (아티스트에게 보이지 않습니다)
                <textarea value={internalNote} onChange={(e) => setInternalNote(e.target.value)} rows={3} className={`${inputClass} mt-1`} />
              </label>
              <button type="button" disabled={busy} onClick={() => run({ action: 'set_internal_note', note: internalNote }, '메모를 저장했습니다.')} className={`${secondaryBtn} mt-2`}>메모 저장</button>
            </div>
          </div>
        </section>
      </AdminShell>
    </>
  );
}
