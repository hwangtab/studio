import { sql } from 'drizzle-orm';
import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../db/client';
import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { getClientIp } from '../../../lib/contracts/client-ip';
import { sendSoftwareLinksEmail } from '../../../lib/software/email';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 구매 내역 링크 다시 받기 — 이메일을 넣으면 그 주소로 산 소프트웨어 주문들의 구매 내역 주소를 보낸다.
 * **응답은 언제나 같다**(그 주소로 산 적이 있는지 드러내지 않는다). 레이트리밋은 IP와 이메일 두 겹 — 남의 주소로
 * 메일 폭탄을 보내는 데 쓰이지 않게.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`software_resend:ip:${ip}`, 5, 3600)))
    return res.status(429).json({ ok: false, message: '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.' });

  const b = ((typeof req.body === 'object' && req.body) || {}) as Record<string, unknown>;
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  if (!EMAIL.test(email) || email.length > 200) return res.status(400).json({ ok: false, message: '이메일을 확인해 주세요.' });

  const done = () => res.status(200).json({ ok: true });
  if (!(await consumeRateLimit(`software_resend:email:${email}`, 3, 86400))) return done();

  try {
    const rows = await getDb().all<{ order_no: string; manage_token: string; product_title: string; created_at: number }>(sql`
      SELECT o.order_no, o.manage_token, s.product_title, o.created_at
      FROM orders o JOIN software_orders s ON s.order_no = o.order_no
      WHERE o.type = 'software' AND o.status IN ('paid', 'partially_refunded') AND lower(o.customer_email) = ${email} -- 주문 칸은 입력 그대로라 대소문자를 무시한다
      ORDER BY o.created_at DESC LIMIT 20
    `);
    await sendSoftwareLinksEmail(email, rows.map((r) => ({
      orderNo: r.order_no, manageToken: r.manage_token, productTitle: r.product_title, paidAt: new Date(Number(r.created_at) * 1000),
    })));
  } catch (error) {
    console.error('[api/software/resend] 처리 실패', error);
  }
  return done();
}
