import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { AdminShell } from '../../../../components/admin/AdminShell';
import { ProductForm } from '../../../../components/shop/creator/ProductForm';
import ShopProductDetail from '../../../../components/shop/ShopProductDetail';
import { formatPriceAmount } from '../../../../data/pricing';
import type { ShopProduct } from '../../../../data/shop/catalog';
import { authenticateAdminRequest } from '../../../../lib/contracts/admin-auth';
import { loadShopProductForAdmin, type AdminShopProductDetail } from '../../../../lib/shop/adminProducts';
import { loadProductFulfillmentMode, type ShopFulfillmentMode } from '../../../../lib/shop/fulfillmentMode';
import { loadProductForCreator, type CreatorProductDetail } from '../../../../lib/shop/creatorProductWrite';
import { splitShopDescription } from '../../../../lib/shop/creatorValidation';
import { SHOP_STATUS_LABELS } from '../../../../lib/shop/productRules';
import { describeShopArtistTerms } from '../../../../lib/shop/artistTerms';
import { loadShopArtistTermsStatus } from '../../../../lib/shop/artistTermsAgreement';
import { isStudioShopArtistSlug } from '../../../../lib/shop/studioArtist';
import { buttonVariants } from '../../../../components/ui/Button';
import { ROW_BTN, Th } from '../../../../components/admin/AdminTable';
import { formatAdminDateTimeFromSeconds } from '../../../../lib/admin/displayDate';
import { DangerActions } from '../../../../components/admin/DangerActions';
import { DANGER_GHOST_CLASS } from '../../../../components/admin/adminDanger';
import { cn } from '../../../../lib/utils';

interface Props {
  product: AdminShopProductDetail;
  /** 편집 폼이 읽는 판본(아티스트 콘솔과 같은 모양). */
  editable: CreatorProductDetail;
  /** 발송 주체. `tableMissing`이면 마이그레이션 0057 전이라 바꿀 수 없다. */
  fulfillment: { mode: ShopFulfillmentMode; tableMissing: boolean };
  /** 위탁 약관 — 현재 판본 동의가 없으면 승인이 `terms_not_agreed`로 거부된다(스튜디오 상품은 해당 없음). */
  terms: { label: string; ok: boolean };
}

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return { redirect: { destination: '/admin/login', permanent: false } };
  const id = typeof context.params?.id === 'string' ? context.params.id : '';
  const product = id ? await loadShopProductForAdmin(id) : null;
  if (!product) return { notFound: true };
  const editable = await loadProductForCreator(product.creatorId, product.id);
  if (!editable) return { notFound: true };
  const fulfillment = await loadProductFulfillmentMode(product.id).catch((error: unknown) => {
    console.error('[admin/shop] 발송 주체 조회 실패:', error);
    return { mode: 'studio' as const, tableMissing: true };
  });
  const studio = isStudioShopArtistSlug(product.artistSlug);
  const termsStatus = studio ? null : await loadShopArtistTermsStatus(product.creatorId).catch((error: unknown) => {
    console.error('[admin/shop] 위탁 약관 동의 조회 실패:', error);
    return null;
  });
  const terms = { label: describeShopArtistTerms(termsStatus, studio), ok: studio || termsStatus?.state === 'agreed' };
  return { props: { product, editable, fulfillment, terms } };
};

const inputClass = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70';
const primaryBtn = buttonVariants({ variant: 'solid', size: 'sm', light: true });
const secondaryBtn = buttonVariants({ variant: 'secondary', size: 'sm', light: true });
const dangerBtn = cn(buttonVariants({ variant: 'ghost', size: 'sm', light: true }), DANGER_GHOST_CLASS);
const card = 'mb-6 rounded-2xl bg-white p-4 text-sm text-gray-900 shadow-sm md:p-6';

const kst = (sec: number) => formatAdminDateTimeFromSeconds(sec);

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

/** 잠긴 옵션의 총 재고 — 승인 직후 "재고 0" 경고 옆에서 바로 넣는다(`/api/admin/shop/stock`). */
function StockCell({ skuId, stock }: { skuId: string; stock: number | null }) {
  const [value, setValue] = useState(stock === null ? '' : String(stock));
  const [state, setState] = useState<string | null>(null);
  const save = async () => {
    setState('저장 중…');
    try {
      const res = await fetch('/api/admin/shop/stock', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ skuId, stock: Number(value) }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (res.ok && data?.ok) window.location.reload();
      else setState(data?.message ?? '저장하지 못했습니다.');
    } catch {
      setState('연결에 실패했습니다.');
    }
  };
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 lg:flex-nowrap">
      <input
        type="number" min={0} inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)}
        aria-label={`${skuId} 총 재고`} className="w-24 rounded-lg border border-gray-300 bg-white px-2 py-1 text-gray-900"
      />
      <button type="button" onClick={save} disabled={value === ''} className={ROW_BTN}>저장</button>
      {state && <span role="alert" className="text-xs text-red-700">{state}</span>}
    </div>
  );
}

const filesToText = (p: AdminShopProductDetail, preview: boolean) =>
  p.digitalFiles.filter((f) => Boolean(f.preview) === preview).map((f) => `${f.label}|${f.key}`).join('\n');

const parseFiles = (text: string, preview: boolean): Array<{ label: string; key: string; preview?: true }> =>
  text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const i = l.indexOf('|');
    const base = i === -1 ? { label: l.slice(l.lastIndexOf('/') + 1), key: l } : { label: l.slice(0, i).trim(), key: l.slice(i + 1).trim() };
    return preview ? { ...base, preview: true as const } : base;
  });

export default function AdminShopProductPage({ product, editable, fulfillment, terms }: Props) {
  // 관리자 화면은 항상 밝은 바탕이다. 미리보기에 들어가는 공개 컴포넌트는 dark: 색을 쓰므로, 운영자 기기가
  // 어두운 모드면 흰 바탕에 연한 글씨가 되어 안 보인다 — 이 화면에서는 dark 클래스를 걷는다(Layout이 없어 다시 붙이는 쪽이 없다).
  useEffect(() => { document.documentElement.classList.remove('dark'); }, []);
  const [note, setNote] = useState('');
  const [slug, setSlug] = useState(product.slug.startsWith('draft-') ? '' : product.slug);
  const [shipsOn, setShipsOn] = useState(product.shipsOn ?? '');
  const [fulfillmentMode, setFulfillmentMode] = useState<ShopFulfillmentMode>(fulfillment.mode);
  const [filesText, setFilesText] = useState(filesToText(product, false));
  const [previewText, setPreviewText] = useState(filesToText(product, true));
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

  const DECISION_CONFIRM = {
    approve: '이 상품을 승인할까요? 바로 공개되고 판매가 시작됩니다(주소는 승인할 때 확정됩니다).',
    request_changes: '보완을 요청할까요? 아티스트에게 메일이 나갑니다.',
    reject: '이 상품을 반려할까요? 사유가 아티스트에게 메일로 전달됩니다.',
  } as const;

  const decide = (action: 'approve' | 'request_changes' | 'reject') =>
    !window.confirm(DECISION_CONFIRM[action]) ? undefined :
    run({ action, note: note || undefined, slug: action === 'approve' ? slug || undefined : undefined, expectedSubmittedAt: product.submittedAt },
      action === 'approve' ? '승인했습니다.' : action === 'request_changes' ? '보완을 요청했습니다.' : '반려했습니다.');

  const unlocked = product.skus.filter((s) => !s.locked);
  const totalStock = product.skus.filter((s) => s.locked).reduce((sum, s) => sum + (s.stock ?? 0), 0);
  const approved = product.reviewStatus === 'approved';

  return (
    <>
      <Head>
        <title>{`${product.title || '상품'} 심사 | Studio NOL`}</title>
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
        {product.artistSlug && (
          <div role={terms.ok ? undefined : 'alert'} className={`mb-4 rounded-lg p-3 text-sm ${terms.ok ? 'bg-gray-50 text-gray-800' : 'border border-red-300 bg-red-50 text-red-900'}`}>
            위탁 약관: {terms.label}
            {!terms.ok && ' — 아티스트가 내 상점 화면에서 현재 판본에 동의하기 전에는 승인할 수 없습니다.'}
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
            재고가 0입니다. 아래 옵션 표에서 옵션별 총 재고를 넣어 주세요(<Link href="/admin/shop" className="underline">상점 관리</Link>에서도 넣을 수 있습니다).
          </div>
        )}
        {message && (
          <div role={message.tone === 'error' ? 'alert' : 'status'} className={`mb-4 rounded-lg p-3 text-sm ${message.tone === 'error' ? 'border border-red-300 bg-red-50 text-red-900' : 'bg-green-50 text-green-900'}`}>
            {message.text}
          </div>
        )}

        <section className={card}>
          <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-gray-900">편집</h2>
          <p className="mb-4 text-xs text-gray-600">
            아티스트가 올린 것과 같은 항목·규칙입니다. 승인된 상품의 제목·주소·분류·종류와 판매 중인 옵션의 가격은 관리자도 바꿀 수 없습니다.
          </p>
          <ProductForm initial={editable} admin onSaved={() => window.setTimeout(() => window.location.reload(), 700)} />
        </section>

        <section className={card}>
          <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-gray-900">미리보기</h2>
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
          <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-gray-900">옵션</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] table-fixed text-left">
              <colgroup>
                <col />
                <col className="w-36" />
                <col className="w-28" />
                <col className="w-48" />
              </colgroup>
              <thead><tr><Th>옵션</Th><Th align="right">가격</Th><Th className="pl-6">상태</Th><Th align="right" className="pr-0">총 재고</Th></tr></thead>
              <tbody>
                {product.skus.map((s) => (
                  <tr key={s.id} className="border-t border-gray-100">
                    <td className="py-2 pr-3">{s.optionLabel ?? '(옵션 없음)'}<span className="block text-xs text-gray-500">{s.id}</span></td>
                    <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap">{formatPriceAmount(s.price)}원</td>
                    <td className="py-2 pl-6 pr-3 whitespace-nowrap">{s.locked ? (s.retired ? '판매 종료' : '판매 중') : '승인 대기'}</td>
                    <td className="py-2 text-right tabular-nums">{s.locked ? <StockCell skuId={s.id} stock={s.stock} /> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {approved && unlocked.length > 0 && (
            <button type="button" disabled={busy} onClick={() => run({ action: 'lock_new_skus', skus: unlocked.map((s) => ({ id: s.id, price: s.price, optionLabel: s.optionLabel ?? null })) }, '새 옵션을 승인했습니다.')} className={`${primaryBtn} mt-3`}>새 옵션 승인</button>
          )}
        </section>

        {product.reviewStatus === 'submitted' && (
          <section className={card}>
            <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-gray-900">판정</h2>
            <p className="mb-3 text-gray-600">발송 주체는 승인 뒤 바꿀 수 없으니 아래 운영에서 먼저 정해 주세요.</p>
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
              <DangerActions>
                <button type="button" disabled={busy || !note.trim()} onClick={() => decide('reject')} className={dangerBtn}>반려</button>
              </DangerActions>
            </div>
          </section>
        )}
        {(product.reviewStatus === 'draft' || product.reviewStatus === 'changes_requested') && (
          <section className={card}>
            <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-gray-900">바로 승인</h2>
            <p className="mb-3 text-gray-600">저장한 내용 그대로 심사를 거치지 않고 승인해 공개합니다. 먼저 위 편집 내용을 저장해 주세요. 승인 조건은 심사와 같습니다. 발송 주체는 승인 뒤 바꿀 수 없으니 아래 운영에서 먼저 정해 주세요.</p>
            <label className="block md:max-w-md">주소(slug) — 승인할 때 확정됩니다
              <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="예: my-album" className={`${inputClass} mt-1`} />
            </label>
            <button type="button" disabled={busy} onClick={() => { if (window.confirm('심사를 거치지 않고 지금 저장된 내용 그대로 승인할까요? 바로 공개되고 판매가 시작됩니다.')) run({ action: 'approve_now', slug: slug || undefined, expectedUpdatedAt: product.updatedAt }, '승인했습니다.'); }} className={`${primaryBtn} mt-3`}>바로 승인</button>
          </section>
        )}
        {product.reviewNote && (
          <section className={card}>
            <h2 className="mb-2 text-lg font-bold text-gray-900 dark:text-gray-900">아티스트에게 보인 메모</h2>
            <p className="whitespace-pre-line text-gray-700">{product.reviewNote}</p>
          </section>
        )}

        <section className={card}>
          <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-gray-900">운영</h2>
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="block">예약 발송일
                <input type="date" value={shipsOn} onChange={(e) => setShipsOn(e.target.value)} className={`${inputClass} mt-1`} />
              </label>
              <button type="button" disabled={busy} onClick={() => run({ action: 'set_ships_on', shipsOn: shipsOn || null }, '발송 예정일을 저장했습니다.')} className={`${secondaryBtn} mt-2`}>저장</button>
            </div>
            <div>
              <label className="block">발송 주체
                <select
                  value={fulfillmentMode} disabled={approved || fulfillment.tableMissing || busy}
                  onChange={(e) => setFulfillmentMode(e.target.value === 'artist' ? 'artist' : 'studio')}
                  className={`${inputClass} mt-1`}
                >
                  <option value="studio">스튜디오가 보내요</option>
                  <option value="artist">아티스트가 직접 보내요</option>
                </select>
              </label>
              <p className="mt-1 text-xs text-gray-600">
                {fulfillment.tableMissing
                  ? '마이그레이션 0057이 적용되기 전이라 바꿀 수 없습니다(모든 상품을 스튜디오가 보냅니다).'
                  : approved
                    ? '승인된 상품은 바꿀 수 없습니다. 이미 들어온 주문의 발송 책임이 갈리기 때문입니다.'
                    : '승인 전에만 정할 수 있습니다. 아티스트가 보내면 주문자의 받는 분 정보가 그 아티스트에게 제공되고, 배송비 전액이 아티스트 몫입니다.'}
              </p>
              {!approved && !fulfillment.tableMissing && (
                <button type="button" disabled={busy || fulfillmentMode === fulfillment.mode} onClick={() => run({ action: 'set_fulfillment_mode', mode: fulfillmentMode }, '발송 주체를 저장했습니다.')} className={`${secondaryBtn} mt-2`}>저장</button>
              )}
            </div>
            {approved && (
              <div>
                <p className="mb-1">공개 상태: {product.published ? '공개' : '비공개'}</p>
                <button type="button" disabled={busy} onClick={() => run({ action: 'set_published', published: !product.published }, product.published ? '비공개로 바꿨습니다.' : '공개했습니다.')} className={secondaryBtn}>
                  {product.published ? '비공개로 바꾸기' : '공개하기'}
                </button>
              </div>
            )}
            {product.kind === 'digital' && (<div className="md:col-span-2">
              <label className="block">내려받기 파일 — 한 줄에 하나, &quot;이름|저장소 키&quot; (키는 shop/로 시작)
                <textarea value={filesText} onChange={(e) => setFilesText(e.target.value)} rows={3} placeholder="앨범 (WAV)|shop/album-name/album.zip" className={`${inputClass} mt-1 font-mono`} />
              </label>
              <label className="mt-3 block">미리듣기 파일 — 상품 화면에서 누구나 먼저 들어 보는 30초~1분 발췌본. 한 줄에 하나, 형식은 같고 <strong>내려받기 파일과 다른 키</strong>여야 합니다
                <textarea value={previewText} onChange={(e) => setPreviewText(e.target.value)} rows={3} placeholder="미리듣기 (1분)|shop/album-name/preview.mp3" className={`${inputClass} mt-1 font-mono`} />
              </label>
              <button type="button" disabled={busy} onClick={() => run({ action: 'set_digital_files', files: [...parseFiles(filesText, false), ...parseFiles(previewText, true)] }, '파일을 저장했습니다.')} className={`${secondaryBtn} mt-2`}>파일 저장</button>
              {(!product.digitalFiles.some((f) => !f.preview) || !product.digitalFiles.some((f) => f.preview)) && (
                <span className="ml-3 text-xs text-amber-800">디지털 상품은 내려받기 파일과 미리듣기 파일이 모두 있어야 승인됩니다.</span>
              )}
            </div>)}
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
