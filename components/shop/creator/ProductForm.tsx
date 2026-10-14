import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { ChoiceCard, ChoiceGroup } from '../../ui/Choice';
import { Field, TextArea, TextInput } from '../../ui/Field';
import { Notice } from '../../ui/Notice';
import { Panel } from '../../ui/Panel';
import { ImageUploadField } from '../../funding/creator/ImageUploadField';
import ShopProductDetail from '../ShopProductDetail';
import type { ShopProduct } from '../../../data/shop/catalog';
import { splitShopDescription } from '../../../lib/shop/creatorValidation';
import type { CreatorProductDetail } from '../../../lib/shop/creatorProductWrite';
import {
  canAdminEditShopField, canAdminEditShopProduct, canCreatorEditShopField, canCreatorEditShopProduct, isDraftPlaceholderSlug, SHOP_CREATOR_LIMITS as L, SHOP_STATUS_LABELS,
  type ShopProductEditableField,
} from '../../../lib/shop/productRules';
import { saveShopProduct, saveShopProductAsAdmin, shopProductAction } from './api';

interface SkuRow {
  /** 화면 안에서만 쓰는 키(새 행은 id가 없다). */
  key: string;
  id?: string;
  optionLabel: string;
  price: string;
  retired: boolean;
  locked: boolean;
}

interface FormState {
  title: string;
  subtitle: string;
  slug: string;
  description: string;
  category: 'album' | 'goods';
  kind: 'physical' | 'digital';
  shipsOn: string;
  editionSize: string;
  images: string[];
  skus: SkuRow[];
}

const toForm = (p: CreatorProductDetail): FormState => ({
  title: p.title,
  subtitle: p.subtitle ?? '',
  slug: isDraftPlaceholderSlug(p.slug) ? '' : p.slug,
  description: p.description,
  category: p.category,
  kind: p.kind,
  shipsOn: p.shipsOn ?? '',
  editionSize: p.editionSize === null ? '' : String(p.editionSize),
  images: p.images,
  skus: p.skus.map((s) => ({ key: s.id, id: s.id, optionLabel: s.optionLabel ?? '', price: String(s.price), retired: s.retired, locked: s.locked })),
});

const toValue = (f: FormState) => ({
  title: f.title,
  subtitle: f.subtitle,
  slug: f.slug.trim().toLowerCase(),
  description: f.description,
  images: f.images,
  category: f.category,
  kind: f.kind,
  shipsOn: f.shipsOn || null,
  editionSize: f.editionSize === '' ? null : Number(f.editionSize),
  skus: f.skus.map((s) => ({ ...(s.id ? { id: s.id } : {}), optionLabel: s.optionLabel, price: Number(s.price), retired: s.retired })),
});

const previewProduct = (f: FormState): ShopProduct => ({
  slug: f.slug || 'preview',
  category: f.category,
  title: f.title || '제목',
  ...(f.subtitle ? { subtitle: f.subtitle } : {}),
  description: splitShopDescription(f.description),
  images: f.images,
  skus: f.skus.map((s) => ({ id: s.id ?? s.key, ...(s.optionLabel ? { optionLabel: s.optionLabel } : {}), price: Number(s.price) || 0, ...(s.retired ? { retired: true } : {}) })),
  published: true,
  kind: f.kind,
});

let rowCounter = 0;
const newRow = (): SkuRow => {
  rowCounter += 1;
  return { key: `new-${rowCounter}`, optionLabel: '', price: '', retired: false, locked: false };
};

type Message = { tone: 'success' | 'error'; text: string } | null;

/**
 * 아티스트 콘솔과 관리자 화면이 함께 쓰는 상품 폼. `admin`이면 열린 칸이 관리자 표(`canAdminEditShopField`)이고, 저장·사진 업로드는
 * 관리자 라우트로 가며, 심사 신청·철회·공개 버튼은 없다(관리자 화면이 판정·공개를 따로 다룬다). 저장하면 `onSaved`로 알린다.
 */
export function ProductForm({ initial, admin = false, onSaved }: { initial: CreatorProductDetail; admin?: boolean; onSaved?: (p: CreatorProductDetail) => void }) {
  const [product, setProduct] = useState(initial);
  const [form, setForm] = useState<FormState>(() => toForm(initial));
  const [busy, setBusy] = useState<'save' | 'action' | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const [showPreview, setShowPreview] = useState(false);

  const status = product.reviewStatus;
  const can = (field: ShopProductEditableField) => (admin ? canAdminEditShopField(status, field) : canCreatorEditShopField(status, field));
  const formOpen = admin ? canAdminEditShopProduct(status) : canCreatorEditShopProduct(status);
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(toForm(product)), [form, product]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const patch = (next: Partial<FormState>) => { setForm((f) => ({ ...f, ...next })); setMessage(null); };
  const patchSku = (key: string, next: Partial<SkuRow>) => patch({ skus: form.skus.map((s) => (s.key === key ? { ...s, ...next } : s)) });

  const applyServerProduct = (p: CreatorProductDetail) => { setProduct(p); setForm(toForm(p)); };

  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy('save');
    const result = admin
      ? await saveShopProductAsAdmin(product.id, toValue(form), product.updatedAt)
      : await saveShopProduct(product.id, toValue(form));
    setBusy(null);
    if (result.ok) {
      applyServerProduct(result.product);
      setMessage({ tone: 'success', text: '저장했어요.' });
      onSaved?.(result.product);
    } else {
      setMessage({ tone: 'error', text: result.message });
    }
  };

  const act = async (action: 'submit' | 'withdraw' | 'publish' | 'unpublish', done: string) => {
    setBusy('action');
    const result = await shopProductAction(product.id, action);
    setBusy(null);
    if (result.ok) {
      applyServerProduct(result.product);
      setMessage({ tone: 'success', text: done });
    } else {
      setMessage({ tone: 'error', text: result.message });
    }
  };

  const moveImage = (index: number, delta: -1 | 1) => {
    const next = [...form.images];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    patch({ images: next });
  };

  const hasLockedSku = form.skus.some((s) => s.locked);
  const skusOpen = can('skus');
  const disabled = busy !== null;

  return (
    <div className="flex flex-col gap-6">
      {!admin && status === 'submitted' && (
        <Notice tone="info">심사 중이에요. 고치려면 심사 신청을 철회해 주세요.</Notice>
      )}
      {!admin && product.fulfillmentMode === 'artist' && (
        <Notice tone="neutral" title="직접 보내는 상품이에요">
          주문이 들어오면 콘솔의 발송할 주문에서 받는 분 정보를 확인하고 직접 보내요. 재고도 판매 현황 표에서 직접 정해요. 판매·결제·환불·문의는 스튜디오 놀이 맡아요.
        </Notice>
      )}
      {status === 'approved' && (
        <Notice tone="success" title="승인된 상품이에요">
          {admin
            ? '제목·주소·분류·종류와 판매 중인 옵션의 가격은 관리자도 바꿀 수 없어요. 새 옵션은 아래 "새 옵션 승인"을 눌러야 판매가 시작돼요.'
            : '제목·주소·분류·종류와 판매 중인 옵션의 가격은 바꿀 수 없어요. 새로 추가한 옵션은 운영자가 승인하면 판매가 시작돼요.'}
        </Notice>
      )}
      {!admin && (status === 'changes_requested' || status === 'rejected') && product.reviewNote && (
        <Notice tone={status === 'rejected' ? 'error' : 'warning'} title="운영자 메모">
          <span className="whitespace-pre-line">{product.reviewNote}</span>
        </Notice>
      )}
      {!admin && status === 'rejected' && <Notice tone="neutral">반려된 상품은 고칠 수 없어요. 새 상품으로 다시 만들어 주세요.</Notice>}

      <form onSubmit={save} className="flex flex-col gap-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <ChoiceGroup label="분류" columns={2} className="sm:col-span-1">
            {(['album', 'goods'] as const).map((c) => (
              <ChoiceCard
                key={c}
                name="shop-category"
                value={c}
                title={c === 'album' ? '음반' : '굿즈'}
                checked={form.category === c}
                disabled={!can('category') || disabled}
                onChange={() => patch({ category: c })}
              />
            ))}
          </ChoiceGroup>
          <ChoiceGroup label="종류" columns={2} className="sm:col-span-1">
            <ChoiceCard
              name="shop-kind"
              value="physical"
              title="실물"
              description="택배로 보내요"
              checked={form.kind === 'physical'}
              disabled={!can('kind') || disabled}
              onChange={() => patch({ kind: 'physical' })}
            />
            <ChoiceCard
              name="shop-kind"
              value="digital"
              title="디지털"
              description="파일은 운영자가 등록해요"
              checked={form.kind === 'digital'}
              disabled={!can('kind') || disabled}
              onChange={() => patch({ kind: 'digital' })}
            />
          </ChoiceGroup>
        </div>

        <Field id="shop-title" label="제목" required hint={`${L.titleMax}자 이내`}>
          <TextInput value={form.title} maxLength={L.titleMax} disabled={!can('title') || disabled} required onChange={(e) => patch({ title: e.target.value })} />
        </Field>
        <Field id="shop-subtitle" label="부제" hint={`${L.subtitleMax}자 이내`}>
          <TextInput value={form.subtitle} maxLength={L.subtitleMax} disabled={!can('subtitle') || disabled} onChange={(e) => patch({ subtitle: e.target.value })} />
        </Field>
        <Field id="shop-slug" label="주소" hint="studionol.co.kr/ko/shop/<주소> — 영문 소문자·숫자·하이픈. 운영자가 승인할 때 조정할 수 있어요.">
          <TextInput value={form.slug} maxLength={L.slugMax} disabled={!can('slug') || disabled} onChange={(e) => patch({ slug: e.target.value })} />
        </Field>
        <Field id="shop-description" label="소개" required hint="문단은 빈 줄로 나눠요. 첫 문단이 검색 결과와 공유 카드에 쓰여요.">
          <TextArea
            value={form.description}
            maxLength={L.descriptionMax}
            rows={10}
            disabled={!can('description') || disabled}
            onChange={(e) => patch({ description: e.target.value })}
          />
        </Field>

        <fieldset className="min-w-0">
          <legend className="mb-2 typo-card-meta font-medium text-gray-700 dark:text-gray-300">사진 (첫 장이 대표 사진, 최대 {L.imagesMax}장)</legend>
          {form.images.length > 0 && (
            <ul className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {form.images.map((url, i) => (
                <li key={url} className="flex flex-col gap-2">
                  {/* 업로드 주소를 그 자리에서 미리보기하는 자리라 next/image를 탈 이유가 없다(ImageUploadField와 같다). */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`사진 ${i + 1}`} className="aspect-square w-full rounded-lg border border-gray-200 object-cover dark:border-gray-700" />
                  {can('images') && (
                    <div className="flex gap-1">
                      <Button type="button" size="sm" variant="ghost" disabled={disabled || i === 0} onClick={() => moveImage(i, -1)} aria-label={`사진 ${i + 1} 앞으로`}>←</Button>
                      <Button type="button" size="sm" variant="ghost" disabled={disabled || i === form.images.length - 1} onClick={() => moveImage(i, 1)} aria-label={`사진 ${i + 1} 뒤로`}>→</Button>
                      <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => patch({ images: form.images.filter((u) => u !== url) })}>삭제</Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {can('images') && form.images.length < L.imagesMax && (
            <ImageUploadField
              {...(admin
                ? { uploadUrl: `/api/admin/shop/upload?productId=${encodeURIComponent(product.id)}` }
                : { uploadQuery: `productId=${encodeURIComponent(product.id)}&kind=body` })}
              value=""
              onChange={(url) => patch({ images: [...form.images, url] })}
              disabled={disabled}
              label="사진 추가"
            />
          )}
        </fieldset>

        <fieldset className="min-w-0">
          <legend className="mb-2 typo-card-meta font-medium text-gray-700 dark:text-gray-300">옵션과 가격 (최대 {L.skusMax}개)</legend>
          {hasLockedSku && (
            <Notice tone="neutral" className="mb-3">
              판매 중인 옵션은 가격을 바꿀 수 없어요. 새 옵션을 추가하세요. 판매를 멈추려면 &quot;판매 종료&quot;를 켜요.
            </Notice>
          )}
          <ul className="flex flex-col gap-3">
            {form.skus.map((s, i) => (
              <li key={s.key} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
                  <Field id={`sku-label-${s.key}`} label={`옵션 이름 ${i + 1}`} hint={form.skus.length > 1 ? undefined : '옵션이 하나뿐이면 비워도 돼요.'}>
                    <TextInput value={s.optionLabel} maxLength={L.optionLabelMax} disabled={!skusOpen || s.locked || disabled} onChange={(e) => patchSku(s.key, { optionLabel: e.target.value })} />
                  </Field>
                  <Field id={`sku-price-${s.key}`} label="가격(원)">
                    <TextInput
                      type="number"
                      inputMode="numeric"
                      min={L.priceMin}
                      max={L.priceMax}
                      step={L.priceStep}
                      value={s.price}
                      disabled={!skusOpen || s.locked || disabled}
                      onChange={(e) => patchSku(s.key, { price: e.target.value })}
                    />
                  </Field>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-3">
                    <Checkbox label="판매 종료" checked={s.retired} disabled={!skusOpen || disabled} onChange={(e) => patchSku(s.key, { retired: e.target.checked })} />
                    {s.locked ? <Badge tone="success">판매 중인 옵션</Badge> : status === 'approved' && <Badge tone="warning">승인 대기</Badge>}
                  </span>
                  {skusOpen && !s.locked && (
                    <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => patch({ skus: form.skus.filter((x) => x.key !== s.key) })}>옵션 지우기</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {skusOpen && form.skus.length < L.skusMax && (
            <Button type="button" size="sm" variant="secondary" className="mt-3" disabled={disabled} onClick={() => patch({ skus: [...form.skus, newRow()] })}>옵션 추가</Button>
          )}
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="shop-ships-on" label="예약 발송일" hint="비우면 바로 발송해요. 승인된 뒤에는 운영자가 바꿔요.">
            <TextInput type="date" value={form.shipsOn} disabled={!can('shipsOn') || disabled} onChange={(e) => patch({ shipsOn: e.target.value })} />
          </Field>
          <Field id="shop-edition" label="한정 수량" hint="한정판이면 장수를 적어요. 비우면 한정이 아니에요.">
            <TextInput
              type="number"
              inputMode="numeric"
              min={1}
              max={L.editionSizeMax}
              value={form.editionSize}
              disabled={!can('editionSize') || disabled}
              onChange={(e) => patch({ editionSize: e.target.value })}
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {formOpen && <Button type="submit" disabled={disabled || !dirty}>{busy === 'save' ? '저장 중…' : '저장'}</Button>}
          {!admin && (status === 'draft' || status === 'changes_requested') && (
            <Button type="button" variant="secondary" disabled={disabled || dirty} onClick={() => act('submit', '심사를 신청했어요.')}>
              {busy === 'action' ? '처리 중…' : '심사 신청'}
            </Button>
          )}
          {!admin && status === 'submitted' && (
            <Button type="button" variant="secondary" disabled={disabled} onClick={() => act('withdraw', '심사 신청을 철회했어요.')}>심사 신청 철회</Button>
          )}
          {!admin && status === 'approved' && (
            <Button type="button" variant="secondary" disabled={disabled || dirty} onClick={() => act(product.published ? 'unpublish' : 'publish', product.published ? '비공개로 바꿨어요.' : '공개했어요.')}>
              {product.published ? '비공개로 바꾸기' : '공개하기'}
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={() => setShowPreview((v) => !v)}>{showPreview ? '미리보기 닫기' : '미리보기'}</Button>
          <Badge tone={status === 'approved' ? 'success' : status === 'rejected' ? 'error' : status === 'changes_requested' ? 'warning' : status === 'submitted' ? 'info' : 'neutral'}>
            {SHOP_STATUS_LABELS[status]}
          </Badge>
          {dirty && formOpen && <span className="typo-caption">저장하지 않은 변경이 있어요.</span>}
        </div>
        {message && (
          <p role={message.tone === 'error' ? 'alert' : 'status'} className={message.tone === 'error' ? 'typo-caption text-red-600 dark:text-red-400' : 'typo-caption text-green-600 dark:text-green-400'}>
            {message.text}
          </p>
        )}
      </form>

      {showPreview && (
        <Panel variant="outline" padding="default" title="미리보기">
          <ShopProductDetail product={previewProduct(form)} layout="stack" headingAs="h2" titleFallbackFont />
        </Panel>
      )}
    </div>
  );
}
