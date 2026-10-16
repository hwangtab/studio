import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { getAnySoftware } from '../../../../lib/software/catalog';
import { resendSoftwareKeyEmail, sendManualLicenseEmail } from '../../../../lib/software/email';
import { findSoftwareOrder, normalizeSoftwareOrderNo } from '../../../../lib/software/order';
import { issueLicense } from '../../../../lib/software/service';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 관리자 — 라이선스 수동 발급.
 * - 주문번호 없이: 결제 없는 시험·리뷰어·증정 키(`source: 'manual'`). 비공개 상품에도 된다 — 출시 전 플러그인 시험 키가 이 경로다.
 *   `sendEmail`이면 받는 분에게 키 메일을 보낸다.
 * - 주문번호와 함께: **결제됐는데 라이선스가 없는 주문**(승인 batch 밖의 장애)을 메운다. 그 주문의 상품·구매자 이메일로 발급하고
 *   (`source: 'toss'`, 구매 내역 화면에 나타난다) 고객에게 키 메일을 보낸다. 이미 라이선스가 있으면 거절한다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const b = ((typeof req.body === 'object' && req.body) || {}) as Record<string, unknown>;
  const note = typeof b.note === 'string' && b.note.trim() ? `${b.note.slice(0, 200)} · ${auth.actor}` : `발급 ${auth.actor}`;

  if (typeof b.orderNo === 'string' && b.orderNo.trim()) {
    const orderNo = normalizeSoftwareOrderNo(b.orderNo);
    const order = orderNo ? await findSoftwareOrder(orderNo) : null;
    if (!order || !order.item) return res.status(400).json({ ok: false, message: '소프트웨어 주문을 찾을 수 없어요. 주문번호(SWR-…)를 확인해 주세요.' });
    if (order.status !== 'paid' && order.status !== 'partially_refunded') return res.status(409).json({ ok: false, message: '결제가 끝난 주문에만 발급할 수 있어요.' });
    if (order.licenses.length > 0) return res.status(409).json({ ok: false, message: '이 주문에는 이미 라이선스가 있어요. 목록에서 확인해 주세요.' });
    const license = await issueLicense({
      productSlug: order.item.productSlug, email: order.customerEmail ?? '', customerName: order.customerName,
      source: 'toss', orderNo: order.orderNo, note: `주문 보충 발급 · ${note}`,
    });
    const mail = await resendSoftwareKeyEmail(order.orderNo);
    return res.status(201).json({ ok: true, id: license.id, licenseKey: license.licenseKey, emailed: mail.ok, mailError: mail.message ?? null });
  }

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
    note,
    maxActivations: max,
  });
  let emailed = false;
  let mailError: string | null = null;
  if (b.sendEmail === true) {
    const mail = await sendManualLicenseEmail({
      licenseKey: license.licenseKey, email: license.email, customerName: license.customerName, productTitle: product.title, maxActivations: license.maxActivations,
    });
    emailed = mail.ok;
    mailError = mail.message ?? null;
  }
  return res.status(201).json({ ok: true, id: license.id, licenseKey: license.licenseKey, emailed, mailError });
}
