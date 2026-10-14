import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit } from '../../../../../../lib/booking/rate-limit';
import { isAllowedContactRequestOrigin } from '../../../../../../lib/contact/origin';
import { authenticateCreatorApi } from '../../../../../../lib/funding/creatorAuth';
import { validateShopProductInput } from '../../../../../../lib/shop/creatorValidation';
import {
  loadProductForCreator, saveProduct, setPublishedByCreator, submitProduct, withdrawProduct,
  type CreatorProductDetail, type ProductWriteResult,
} from '../../../../../../lib/shop/creatorProductWrite';
import { respondProductFailure } from '../../../../../../lib/shop/creatorWriteHttp';
import { sendShopCreatorEditedNotice, sendShopSubmissionNotice, type ShopMailProduct } from '../../../../../../lib/shop/reviewEmail';
import { revalidateShopArtistPages } from '../../../../../../lib/shop/revalidate';

/**
 * 아티스트 상품 저장(PUT `{ value }`)과 상태 전환(POST `{ action: 'submit' | 'withdraw' | 'publish' | 'unpublish' }`).
 * 응답의 `product`는 `loadProductForCreator`가 만든 객체 그대로다 — 내부 메모·내려받기 키는 애초에 읽지 않는다.
 * 메일 실패는 저장·제출을 실패시키지 않는다(이미 커밋됐다) — 로그만 남긴다.
 */

const ACTIONS = ['submit', 'withdraw', 'publish', 'unpublish'] as const;
type Action = (typeof ACTIONS)[number];
const isAction = (v: unknown): v is Action => typeof v === 'string' && (ACTIONS as readonly string[]).includes(v);

const mailShape = (p: CreatorProductDetail): ShopMailProduct => ({
  id: p.id, title: p.title, slug: p.slug, creatorName: p.creator.name, creatorEmail: p.creator.email,
});

const notify = async (label: string, send: () => Promise<string | null>) => {
  try {
    const error = await send();
    if (error) console.error(`[funding/creator/shop] ${label} 메일 실패:`, error);
  } catch (error: unknown) {
    console.error(`[funding/creator/shop] ${label} 메일 처리 중 오류:`, error);
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'PUT' && req.method !== 'POST') {
    res.setHeader('Allow', 'PUT, POST');
    return res.status(405).json({ ok: false });
  }
  if (!isAllowedContactRequestOrigin(req)) return res.status(403).json({ ok: false, message: 'Forbidden' });

  const auth = await authenticateCreatorApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: '로그인이 필요해요.' });

  const productId = typeof req.query.id === 'string' ? req.query.id : '';
  if (!productId) return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않아요.' });

  if (!(await consumeRateLimit(`creator_save:${auth.creatorId}`, 30, 60))) {
    return res.status(429).json({ ok: false, message: '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.' });
  }

  try {
    const current = await loadProductForCreator(auth.creatorId, productId);
    if (!current) return res.status(404).json({ ok: false, message: '상품을 찾을 수 없어요.' });

    let result: ProductWriteResult;
    let afterSave: (() => Promise<void>) | null = null;
    // 공개 상품 그리드가 바뀌는 쓰기(공개 토글·승인 상태 저장) 뒤에는 /ko/artists/<slug>(ISR)를 다시 만든다 — 관리자 경로와 같은 함수.
    let revalidate = false;

    if (req.method === 'PUT') {
      const validated = validateShopProductInput(req.body?.value, { creatorId: auth.creatorId, existing: current.images });
      if (!validated.ok) return res.status(400).json({ ok: false, message: validated.message });
      const saved = await saveProduct(auth.creatorId, productId, validated.value);
      result = saved;
      if (saved.ok && saved.approvedEdit) {
        afterSave = () => notify('승인 뒤 수정 알림', () => sendShopCreatorEditedNotice(mailShape(current)));
        revalidate = true;
      }
    } else {
      const action = req.body?.action;
      if (!isAction(action)) return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않아요.' });
      if (action === 'submit') {
        const submitted = await submitProduct(auth.creatorId, productId);
        result = submitted;
        if (submitted.ok) afterSave = () => notify('심사 요청 알림', () => sendShopSubmissionNotice(mailShape(submitted.product)));
      } else if (action === 'withdraw') {
        result = await withdrawProduct(auth.creatorId, productId);
      } else {
        result = await setPublishedByCreator(auth.creatorId, productId, action === 'publish');
        revalidate = true;
      }
    }

    if (!result.ok) return respondProductFailure(res, result);
    if (afterSave) await afterSave();
    if (revalidate) {
      // 실패는 로그만 — 이미 저장됐다. 아티스트 페이지는 최대 하루(ISR) 뒤 갱신된다.
      try {
        const warning = await revalidateShopArtistPages(res, auth.creatorId);
        if (warning) console.error(`[funding/creator/shop] 재검증 경고 (id=${productId}): ${warning}`);
      } catch (error: unknown) {
        console.error(`[funding/creator/shop] 재검증 실패 (id=${productId}):`, error);
      }
    }
    const product = await loadProductForCreator(auth.creatorId, productId);
    return res.status(200).json({ ok: true, product });
  } catch (error: unknown) {
    console.error('[funding/creator/shop/products/[id]] 실패:', error);
    return res.status(500).json({ ok: false, message: '저장하지 못했어요. 잠시 후 다시 시도해 주세요.' });
  }
}
