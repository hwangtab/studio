import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';
import { approveShopProductNow, saveProductAsAdmin } from '../../../../../lib/shop/adminProductWrite';
import { loadShopProductForAdmin } from '../../../../../lib/shop/adminProducts';
import { respondProductFailure } from '../../../../../lib/shop/creatorWriteHttp';
import {
  applyShopAdminAction, decideShopProduct,
  type ShopAdminAction, type ShopAdminCode, type ShopDecisionAction, type ShopDecisionCode,
} from '../../../../../lib/shop/reviewDecision';
import { sendShopReviewDecisionEmail, sendShopReviewOperatorFallback, type ShopMailProduct } from '../../../../../lib/shop/reviewEmail';
import { revalidateShopArtistPages } from '../../../../../lib/shop/revalidate';
import { isStudioShopArtistSlug } from '../../../../../lib/shop/studioArtist';

/**
 * 관리자 — 상품 저장(PUT `{ value }` — 아티스트와 같은 검증·잠금 규칙, 소유자 대신 관리자 인증), 저장한 그대로 바로 승인(`approve_now`),
 * 상품 심사 판정(approve·request_changes·reject)과 관리자 액션(lock_new_skus·set_ships_on·set_published·
 * set_internal_note·set_digital_files). 판정 DB 쓰기가 끝난 뒤의 후속 작업(재검증·메일)은 실패해도 200 + `warnings`다 —
 * 실패시키면 운영자가 같은 버튼을 다시 눌러 409를 받는다(펀딩 심사 라우트와 같은 원칙).
 */

const DECISION_STATUS: Record<ShopDecisionCode, number> = {
  not_found: 404, conflict: 409, invalid_slug: 400, duplicate_slug: 400, incomplete: 400, no_artist: 400, no_files: 400, digital_edition: 400, digital_shipper: 400, terms_not_agreed: 400,
};
const ADMIN_STATUS: Record<ShopAdminCode, number> = {
  not_found: 404, invalid: 400, conflict: 409, incomplete: 400, storage_unavailable: 503,
};

const DECISIONS: readonly ShopDecisionAction[] = ['approve', 'request_changes', 'reject'];
const isDecision = (v: unknown): v is ShopDecisionAction => typeof v === 'string' && (DECISIONS as readonly string[]).includes(v);

const parseAdminAction = (b: Record<string, unknown>): ShopAdminAction | null => {
  switch (b.action) {
    case 'lock_new_skus': {
      // 화면이 본 미잠금 옵션 목록 — 없으면 거부한다(보지 않은 옵션까지 잠그지 않게).
      if (!Array.isArray(b.skus) || b.skus.length === 0) return null;
      const skus: Array<{ id: string; price: number; optionLabel: string | null }> = [];
      for (const raw of b.skus) {
        const s = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
        if (typeof s.id !== 'string' || typeof s.price !== 'number' || (s.optionLabel !== null && typeof s.optionLabel !== 'string')) return null;
        skus.push({ id: s.id, price: s.price, optionLabel: s.optionLabel as string | null });
      }
      return { type: 'lock_new_skus', skus };
    }
    case 'set_ships_on':
      if (b.shipsOn === null || b.shipsOn === '') return { type: 'set_ships_on', shipsOn: null };
      return typeof b.shipsOn === 'string' ? { type: 'set_ships_on', shipsOn: b.shipsOn } : null;
    case 'set_published': return typeof b.published === 'boolean' ? { type: 'set_published', published: b.published } : null;
    case 'set_internal_note': return typeof b.note === 'string' ? { type: 'set_internal_note', note: b.note } : null;
    case 'set_digital_files': {
      if (!Array.isArray(b.files)) return null;
      const files: Array<{ label: string; key: string; preview?: true }> = [];
      for (const f of b.files) {
        if (typeof f !== 'object' || f === null || typeof (f as Record<string, unknown>).label !== 'string' || typeof (f as Record<string, unknown>).key !== 'string') return null;
        files.push({ label: (f as { label: string }).label, key: (f as { key: string }).key, ...((f as { preview?: unknown }).preview === true ? { preview: true as const } : {}) });
      }
      return { type: 'set_digital_files', files };
    }
    case 'set_fulfillment_mode': return b.mode === 'studio' || b.mode === 'artist' ? { type: 'set_fulfillment_mode', mode: b.mode } : null;
    default: return null;
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  if (req.method !== 'POST' && req.method !== 'PUT') {
    res.setHeader('Allow', 'POST, PUT');
    return res.status(405).json({ ok: false });
  }
  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!id) return res.status(400).json({ ok: false, message: '잘못된 요청이에요.' });

  if (req.method === 'PUT') {
    // 화면을 연 판본(updated_at 초) — 없으면 거부한다(그 사이 아티스트가 고친 판본을 덮어쓰지 않게, 화면은 항상 싣는다).
    const expectedUpdatedAt = req.body?.expectedUpdatedAt;
    if (typeof expectedUpdatedAt !== 'number') return res.status(400).json({ ok: false, message: '화면을 새로고침한 뒤 다시 시도해 주세요.' });
    try {
      const saved = await saveProductAsAdmin(id, req.body?.value, new Date(), { expectedUpdatedAt });
      if (!saved.ok) return respondProductFailure(res, saved);
      return res.status(200).json({ ok: true, product: saved.product });
    } catch (error: unknown) {
      console.error(`[shop/admin] 상품 저장 실패 (id=${id}):`, error);
      return res.status(500).json({ ok: false, message: '저장하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
    }
  }
  const b = ((typeof req.body === 'object' && req.body) || {}) as Record<string, unknown>;
  const warnings: string[] = [];

  try {
    if (isDecision(b.action) || b.action === 'approve_now') {
      const immediate = b.action === 'approve_now';
      const action: ShopDecisionAction = immediate ? 'approve' : (b.action as ShopDecisionAction);
      const note = typeof b.note === 'string' ? b.note : undefined;
      // 운영자가 본 판본(submitted_at 초). 없으면 거부한다 — 화면은 항상 싣는다. (바로 승인은 판본이 없다 — 저장한 현재 내용이 그 판본이다.)
      if (!immediate && typeof b.expectedSubmittedAt !== 'number' && b.expectedSubmittedAt !== null) {
        return res.status(400).json({ ok: false, message: '화면을 새로고침한 뒤 다시 시도해 주세요.' });
      }
      // 바로 승인은 화면을 연 판본(updated_at)을 싣는다 — 그 사이 아티스트가 고쳤으면 못 본 판본을 승인하지 않는다.
      if (immediate && typeof b.expectedUpdatedAt !== 'number') {
        return res.status(400).json({ ok: false, message: '화면을 새로고침한 뒤 다시 시도해 주세요.' });
      }
      const slugIn = typeof b.slug === 'string' ? b.slug : undefined;
      const result = immediate
        ? await approveShopProductNow(id, { slug: slugIn, expectedUpdatedAt: b.expectedUpdatedAt as number })
        : await decideShopProduct(id, action, {
          note, slug: slugIn, expectedSubmittedAt: b.expectedSubmittedAt as number | null,
        });
      if (!result.ok) return res.status(DECISION_STATUS[result.code]).json({ ok: false, message: result.message });

      try {
        const product = await loadShopProductForAdmin(id);
        if (action === 'approve' && product) {
          const w = await revalidateShopArtistPages(res, product.creatorId);
          if (w) warnings.push(w);
        }
        if (product) {
          const mail: ShopMailProduct = {
            id: product.id, title: product.title, slug: result.slug, creatorName: product.creatorName, creatorEmail: product.creatorEmail,
          };
          // 스튜디오 자체 상품은 알릴 아티스트가 없다(그 계정 주소는 운영자 받은편지함의 별칭이다).
          const mailError = isStudioShopArtistSlug(product.artistSlug)
            ? null
            : await sendShopReviewDecisionEmail(mail, action, note?.trim() || null, result.slug);
          if (mailError) {
            warnings.push(mailError);
            const fallbackError = await sendShopReviewOperatorFallback(mail, action, mailError);
            if (fallbackError) warnings.push(`운영자 폴백 알림도 실패했습니다: ${fallbackError}`);
          }
        } else {
          warnings.push('아티스트 정보를 다시 읽지 못해 알림 메일을 보내지 못했습니다.');
        }
      } catch (error: unknown) {
        console.error(`[shop/admin] 판정 후속 처리 실패 (id=${id}, action=${action}):`, error);
        warnings.push('판정 뒤 재검증·메일 처리 중 오류가 났습니다. 상태를 직접 확인해 주세요.');
      }
      const allWarnings = [...(result.warnings ?? []), ...warnings];
      return res.status(200).json({ ok: true, ...(allWarnings.length > 0 ? { warnings: allWarnings } : {}) });
    }

    const adminAction = parseAdminAction(b);
    if (!adminAction) return res.status(400).json({ ok: false, message: '잘못된 요청이에요.' });
    const result = await applyShopAdminAction(id, adminAction);
    if (!result.ok) return res.status(ADMIN_STATUS[result.code]).json({ ok: false, message: result.message });

    if (adminAction.type === 'set_published' || adminAction.type === 'lock_new_skus') {
      try {
        const product = await loadShopProductForAdmin(id);
        if (product) {
          const w = await revalidateShopArtistPages(res, product.creatorId);
          if (w) warnings.push(w);
        }
      } catch (error: unknown) {
        console.error(`[shop/admin] 재검증 실패 (id=${id}):`, error);
        warnings.push('재검증 중 오류가 났습니다. 아티스트 페이지는 최대 하루 뒤 갱신됩니다.');
      }
    }
    return res.status(200).json({ ok: true, ...(result.locked !== undefined ? { locked: result.locked } : {}), ...(warnings.length > 0 ? { warnings } : {}) });
  } catch (error: unknown) {
    console.error(`[shop/admin] 상품 처리 실패 (id=${id}):`, error);
    return res.status(500).json({ ok: false, message: '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
  }
}
