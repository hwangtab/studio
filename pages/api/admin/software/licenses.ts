import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { getAnySoftware } from '../../../../lib/software/catalog';
import { issueLicense } from '../../../../lib/software/service';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 관리자 — 라이선스 수동 발급(리뷰어·시험·증정, 결제 없이). 결제로 생긴 라이선스는 결제 확정 경로가 발급한다(2단계).
 * 비공개 상품에도 발급할 수 있다 — 출시 전 플러그인 시험용 키가 이 경로다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const b = ((typeof req.body === 'object' && req.body) || {}) as Record<string, unknown>;
  const product = getAnySoftware(b.productSlug);
  if (!product) return res.status(400).json({ ok: false, message: '상품을 골라 주세요.' });
  if (typeof b.email !== 'string' || !EMAIL.test(b.email.trim()) || b.email.length > 200)
    return res.status(400).json({ ok: false, message: '이메일을 확인해 주세요.' });
  const max = b.maxActivations === undefined || b.maxActivations === '' ? undefined : Number(b.maxActivations);
  if (max !== undefined && (!Number.isInteger(max) || max < 1 || max > 50))
    return res.status(400).json({ ok: false, message: '기기 수는 1~50 사이 정수로 넣어 주세요.' });

  const license = await issueLicense({
    productSlug: product.slug,
    email: b.email,
    customerName: typeof b.customerName === 'string' ? b.customerName.slice(0, 80) : null,
    source: 'manual',
    note: typeof b.note === 'string' ? `${b.note.slice(0, 200)} · ${auth.actor}` : `발급 ${auth.actor}`,
    maxActivations: max,
  });
  return res.status(201).json({ ok: true, id: license.id, licenseKey: license.licenseKey });
}
