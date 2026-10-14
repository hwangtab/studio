import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { isTokenMatch } from '../../../lib/booking/token';
import { getClientIp } from '../../../lib/contracts/client-ip';
import { fundingDownloadObjectExists, presignFundingDownload } from '../../../lib/funding/r2';
import { isSafeObjectKey } from '../../../lib/funding/objectKey';
import { alertMissingShopFile, loadOrderDownloadFiles, recordFirstDownload } from '../../../lib/shop/downloads';
import { findShopOrderByOrderNo } from '../../../lib/shop/service';
import { normalizeShopOrderNo } from '../../../lib/shop/shape';
import { DIGITAL_KEY_PREFIX } from '../../../lib/shop/reviewDecision';

/**
 * 디지털 상품 내려받기 — **첫 접근을 기록하는** 경로(펀딩 `pages/api/funding/download.ts`와 같은 장치).
 *
 * POST만 받는다. GET이면 메일·메신저의 링크 미리보기 봇이 주소를 여는 것만으로 기록이 남아, 받은 적 없는 고객이 청약철회를
 * 잃는다. 그래서 메일에는 이 주소를 싣지 않고 주문 확인 페이지로 보낸다 — 내려받기는 그 페이지의 버튼(form POST)에서만 시작된다.
 * 파일은 요청 시점에 서명한 만료 주소로 302한다(R2 키·공개 주소는 밖으로 나가지 않는다).
 *
 * 순서: 서명 → 객체 존재 확인 → 기록 → 302. 파일을 못 받는데 기록만 남아 청약철회를 잃는 일이 없게 기록이 마지막이다.
 */

const NOT_FOUND = { ok: false, message: '주문을 찾을 수 없어요.' } as const;
const UNAVAILABLE = { ok: false, message: '지금은 내려받을 수 없어요. 잠시 후 다시 시도해 주세요.' } as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: '내려받기는 주문 확인 페이지의 버튼으로 시작해 주세요.' });

  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`shop_download:ip:${ip}`, 60, 3600)))
    return res.status(429).json({ ok: false, message: '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.' });

  // 폼 전송이라 본문으로 온다. 쿼리는 보지 않는다 — 받으면 GET과 같은 구멍이 우회로로 남는다.
  const b = (typeof req.body === 'object' && req.body) || {};
  const { orderNo: rawOrderNo, token, file, label } = b as Record<string, unknown>;
  const orderNo = normalizeShopOrderNo(rawOrderNo);
  if (!orderNo || typeof token !== 'string' || !token || (typeof file !== 'string' && typeof file !== 'number'))
    return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않아요.' });

  try {
    const order = await findShopOrderByOrderNo(orderNo);
    // 주문 부재와 토큰 불일치를 같은 404로 — 다르게 답하면 주문의 존재를 떠볼 수 있다.
    if (!order || !order.shopOrder || !isTokenMatch(order.manageToken, token)) return res.status(404).json(NOT_FOUND);
    if ((order.status !== 'paid' && order.status !== 'partially_refunded') || order.shopOrder.fulfillmentStatus === 'cancelled')
      return res.status(409).json({ ok: false, message: '결제가 살아 있는 주문만 내려받을 수 있어요.' });

    // `file`은 **이 주문 줄의 디지털 상품이 가진 파일 순번**이어야 한다 — 목록에 없는 값으로 버킷의 다른 객체에 서명을 받아 내지 못한다.
    const files = await loadOrderDownloadFiles(order.orderNo, order.shopOrder.items);
    const target = files.find((f) => String(f.index) === String(file));
    if (!target || (typeof label === 'string' && label !== target.label)) return res.status(404).json({ ok: false, message: '파일을 찾을 수 없어요. 주문 확인 페이지를 새로고침해 주세요.' });
    if (!isSafeObjectKey(target.key) || !target.key.startsWith(DIGITAL_KEY_PREFIX)) {
      console.error('[shop-download] 허용되지 않는 키', { orderNo: order.orderNo, key: target.key });
      return res.status(503).json(UNAVAILABLE);
    }

    let signedUrl: string;
    try {
      signedUrl = await presignFundingDownload(target.key);
    } catch (error) {
      console.error('[shop-download] 서명 주소 발급 실패', { orderNo: order.orderNo, key: target.key, error });
      return res.status(503).json(UNAVAILABLE);
    }
    let exists: boolean;
    try {
      exists = await fundingDownloadObjectExists(target.key);
    } catch (error) {
      // "없다"가 아니라 "모르겠다" — 헛경보 없이 재시도를 안내한다.
      console.error('[shop-download] 객체 확인 실패', { orderNo: order.orderNo, key: target.key, error });
      return res.status(503).json(UNAVAILABLE);
    }
    if (!exists) {
      await alertMissingShopFile({ key: target.key, orderNo: order.orderNo });
      return res.status(503).json({ ok: false, message: '파일을 준비하지 못했어요. 010-4255-7893으로 문의해 주세요.' });
    }

    if (!(await recordFirstDownload(order.orderNo))) {
      return res.status(409).json({ ok: false, message: '취소된 주문이거나 취소 처리 중이에요. 내려받을 수 없어요.' });
    }
    return res.redirect(302, signedUrl);
  } catch (error) {
    console.error('[api/shop/download] 실패', error);
    return res.status(503).json(UNAVAILABLE);
  }
}
