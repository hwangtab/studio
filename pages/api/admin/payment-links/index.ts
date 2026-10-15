import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { closePaymentLink, createPaymentLink, validatePaymentLinkInput } from '../../../../lib/payments/paymentLinks';

/**
 * 관리자 결제 링크 — `create`(새 링크, 즉시 열린다) · `close`(닫기, 되돌릴 수 없다). 규칙은 lib/payments/paymentLinks.ts.
 * 금액은 VAT 포함 총액이다. 발급한 링크의 금액을 고치는 액션은 없다(틀렸으면 닫고 새로 만든다).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const b = ((typeof req.body === 'object' && req.body) || {}) as Record<string, unknown>;
  if (b.action === 'create') {
    const input = validatePaymentLinkInput(b);
    if (!input.ok) return res.status(400).json({ ok: false, message: input.message });
    try {
      const { slug, blockId } = await createPaymentLink(input.value);
      return res.status(201).json({ ok: true, slug, path: `/ko/pay/${slug}`, blocked: blockId !== null });
    } catch (error) {
      console.error('[api/admin/payment-links] 생성 실패(마이그레이션 0060 적용 여부 확인)', error instanceof Error ? error.name : 'unknown');
      return res.status(500).json({ ok: false, message: '링크를 만들지 못했어요. 결제 링크 표(마이그레이션 0060)가 적용됐는지 확인해 주세요.' });
    }
  }
  if (b.action === 'close') {
    const slug = typeof b.slug === 'string' ? b.slug : '';
    const { closed, blockReleased } = await closePaymentLink(slug);
    return closed ? res.status(200).json({ ok: true, blockReleased }) : res.status(409).json({ ok: false, message: '이미 닫혔거나 없는 링크예요.' });
  }
  return res.status(400).json({ ok: false, message: '알 수 없는 작업이에요.' });
}
