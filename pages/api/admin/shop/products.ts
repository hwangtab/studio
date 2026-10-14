import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { createDraftProductAsAdmin, type AdminDraftTarget } from '../../../../lib/shop/adminProductWrite';
import { respondProductFailure } from '../../../../lib/shop/creatorWriteHttp';

/**
 * 관리자 — 상품 초안 만들기(POST `{ studio: true }` 또는 `{ creatorId }`). 임시 주소의 빈 초안을 만들고 편집 화면(`/admin/shop/products/<id>`)이
 * 채운다. 스튜디오 상품이면 스튜디오 계정을 처음에 만든다. 아티스트 대신 만든 상품은 그 아티스트 콘솔에도 보인다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }
  const b = ((typeof req.body === 'object' && req.body) || {}) as Record<string, unknown>;
  const target: AdminDraftTarget | null = b.studio === true
    ? { studio: true }
    : typeof b.creatorId === 'string' && b.creatorId ? { creatorId: b.creatorId } : null;
  if (!target) return res.status(400).json({ ok: false, message: '아티스트를 골라 주세요.' });
  try {
    const result = await createDraftProductAsAdmin(target);
    if (!result.ok) return respondProductFailure(res, result);
    return res.status(200).json({ ok: true, id: result.id });
  } catch (error: unknown) {
    console.error('[admin/shop/products] 초안 생성 실패:', error);
    return res.status(500).json({ ok: false, message: '만들지 못했습니다. 잠시 후 다시 시도해 주세요.' });
  }
}
