import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';
import { loadShopProductForAdmin } from '../../../../../lib/shop/adminProducts';
import {
  applyShopAdminAction, decideShopProduct,
  type ShopAdminAction, type ShopAdminCode, type ShopDecisionAction, type ShopDecisionCode,
} from '../../../../../lib/shop/reviewDecision';
import { sendShopReviewDecisionEmail, sendShopReviewOperatorFallback, type ShopMailProduct } from '../../../../../lib/shop/reviewEmail';
import { revalidateShopArtistPages } from '../../../../../lib/shop/revalidate';

/**
 * 관리자 — 상품 심사 판정(approve·request_changes·reject)과 관리자 액션(lock_new_skus·set_ships_on·set_published·
 * set_internal_note·set_digital_files). 판정 DB 쓰기가 끝난 뒤의 후속 작업(재검증·메일)은 실패해도 200 + `warnings`다 —
 * 실패시키면 운영자가 같은 버튼을 다시 눌러 409를 받는다(펀딩 심사 라우트와 같은 원칙).
 */

const DECISION_STATUS: Record<ShopDecisionCode, number> = {
  not_found: 404, conflict: 409, invalid_slug: 400, duplicate_slug: 400, incomplete: 400, no_artist: 400, no_files: 400, digital_edition: 400,
};
const ADMIN_STATUS: Record<ShopAdminCode, number> = {
  not_found: 404, invalid: 400, conflict: 409, incomplete: 400, storage_unavailable: 503,
};

const DECISIONS: readonly ShopDecisionAction[] = ['approve', 'request_changes', 'reject'];
const isDecision = (v: unknown): v is ShopDecisionAction => typeof v === 'string' && (DECISIONS as readonly string[]).includes(v);

const parseAdminAction = (b: Record<string, unknown>): ShopAdminAction | null => {
  switch (b.action) {
    case 'lock_new_skus': return { type: 'lock_new_skus' };
    case 'set_ships_on':
      if (b.shipsOn === null || b.shipsOn === '') return { type: 'set_ships_on', shipsOn: null };
      return typeof b.shipsOn === 'string' ? { type: 'set_ships_on', shipsOn: b.shipsOn } : null;
    case 'set_published': return typeof b.published === 'boolean' ? { type: 'set_published', published: b.published } : null;
    case 'set_internal_note': return typeof b.note === 'string' ? { type: 'set_internal_note', note: b.note } : null;
    case 'set_digital_files': {
      if (!Array.isArray(b.files)) return null;
      const files: Array<{ label: string; key: string }> = [];
      for (const f of b.files) {
        if (typeof f !== 'object' || f === null || typeof (f as Record<string, unknown>).label !== 'string' || typeof (f as Record<string, unknown>).key !== 'string') return null;
        files.push({ label: (f as { label: string }).label, key: (f as { key: string }).key });
      }
      return { type: 'set_digital_files', files };
    }
    default: return null;
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }
  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!id) return res.status(400).json({ ok: false, message: '잘못된 요청이에요.' });
  const b = ((typeof req.body === 'object' && req.body) || {}) as Record<string, unknown>;
  const warnings: string[] = [];

  try {
    if (isDecision(b.action)) {
      const action = b.action;
      const note = typeof b.note === 'string' ? b.note : undefined;
      // 운영자가 본 판본(submitted_at 초). 없으면 거부한다 — 화면은 항상 싣는다.
      if (typeof b.expectedSubmittedAt !== 'number' && b.expectedSubmittedAt !== null) {
        return res.status(400).json({ ok: false, message: '화면을 새로고침한 뒤 다시 시도해 주세요.' });
      }
      const result = await decideShopProduct(id, action, {
        note, slug: typeof b.slug === 'string' ? b.slug : undefined, expectedSubmittedAt: b.expectedSubmittedAt,
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
          const mailError = await sendShopReviewDecisionEmail(mail, action, note?.trim() || null, result.slug);
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
