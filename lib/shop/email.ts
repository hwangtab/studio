import { eq } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingCreators, orders } from '../../db/schema';
import { formatPriceAmount } from '../../data/pricing';
import { SITE_URL, adminUrl, buildEmailLayout, type EmailLayoutRow } from '../email/layout';
import { sendEmail } from '../email/resend';
import { CUSTOMER_REPLY_TO, OPERATOR_EMAIL } from '../operatorContact';
import { resolveOrderShipper } from './artistShipping';
import { shopLineName } from './catalog';
import { loadOrderExtras, type OrderExtras } from './orderExtras';
import { formatShipsOn } from './preorder';
import { SHOP_DIGITAL_WITHDRAWAL_NOTICE } from './policyCopy';
import { shopOrderShips } from './shape';
import { findShopOrderByOrderNo, type ShopOrderWithDetails } from './service';

/**
 * 상점 메일 — 주문 확인(고객·운영자), 발송 안내(고객), 취소·환불(고객·운영자).
 *
 * 실패는 던지지 않는다 — 돈은 이미 움직였고 메일 실패로 결과를 뒤집지 않는다. 마지막 실패 사유를
 * `orders.notification_error`에 남겨 관리자 화면에 드러낸다(성공하면 비운다).
 */

const won = (n: number): string => `${formatPriceAmount(n)}원`;

export const shopManageUrl = (orderNo: string, manageToken: string): string =>
  `${SITE_URL}/ko/shop/manage/${orderNo}?token=${encodeURIComponent(manageToken)}`;

const itemRows = (order: ShopOrderWithDetails): EmailLayoutRow[] =>
  (order.shopOrder?.items ?? []).map((i) => ({
    label: shopLineName(i.productTitle, i.optionLabel),
    value: `${i.quantity}개 · ${won(i.unitPrice * i.quantity)}`,
  }));

/** 예약 발송일·한정판 번호 줄 — 해당하는 줄에만. */
const extraRows = (order: ShopOrderWithDetails, extras: OrderExtras): EmailLayoutRow[] =>
  (order.shopOrder?.items ?? []).flatMap((i) => {
    const name = shopLineName(i.productTitle, i.optionLabel);
    const rows: EmailLayoutRow[] = [];
    const shipsOn = extras.shipsOnByItem.get(i.id);
    if (shipsOn) rows.push({ label: `${name} 발송 예정`, value: formatShipsOn(shipsOn) });
    const serials = extras.serialsByItem.get(i.id);
    if (serials) rows.push({ label: `${name} 한정판 번호`, value: serials });
    return rows;
  });

const amountRows = (order: ShopOrderWithDetails): EmailLayoutRow[] => [
  // 디지털 상품만 담은 주문은 배송비 줄이 없다.
  ...(order.shopOrder && !shopOrderShips(order.shopOrder) ? [] : [{ label: '배송비', value: order.shopOrder && order.shopOrder.shippingFee > 0 ? won(order.shopOrder.shippingFee) : '무료' }]),
  { label: '결제 금액', value: `${won(order.totalAmount)} (부가세 포함)`, emphasis: true },
];

const addressLine = (order: ShopOrderWithDetails): string => {
  const so = order.shopOrder;
  if (!so) return '-';
  return `(${so.postcode}) ${so.address1}${so.address2 ? ` ${so.address2}` : ''}`;
};

const recordNotification = async (orderId: string, failure: string | null): Promise<void> => {
  try {
    await getDb().update(orders).set({ notificationError: failure }).where(eq(orders.id, orderId));
  } catch (error) {
    console.error('[shop-email] notification_error 기록 실패', { orderId, error });
  }
};

const send = async (to: string, subject: string, html: string, text: string, customer: boolean, who?: string): Promise<string | null> => {
  const label = who ?? (customer ? '고객' : '운영자');
  try {
    const result = await sendEmail({ to, subject, html, text, ...(customer ? { replyTo: CUSTOMER_REPLY_TO } : {}) });
    return result.ok ? null : `${label} 메일 실패: ${result.errorCode ?? 'unknown'}`;
  } catch (error) {
    console.error('[shop-email] 발송 예외', { subject, error });
    return `${label} 메일 예외`;
  }
};

/** 아티스트 콘솔의 발송할 주문 화면. 메일에는 주소·연락처를 싣지 않고 이 링크만 건다. */
export const ARTIST_SHIPPING_CONSOLE_URL = `${SITE_URL}/ko/funding/creator/shop/shipping`;

/**
 * 아티스트가 직접 보내는 주문이 접수되면 그 아티스트에게 "발송할 주문" 메일 — 받는 분 이름·연락처·주소는 싣지 않는다(콘솔에서만 본다).
 * 스튜디오 발송 주문이면 아무것도 하지 않는다(null). 실패 사유 문자열을 돌려주면 호출부가 `notification_error`에 남긴다.
 */
const sendArtistShipRequest = async (order: ShopOrderWithDetails, extras: OrderExtras): Promise<string | null> => {
  const shipper = await resolveOrderShipper(order.orderNo);
  if (shipper.kind !== 'artist') return null;
  const [creator] = await getDb().select({ email: fundingCreators.email, name: fundingCreators.name })
    .from(fundingCreators).where(eq(fundingCreators.id, shipper.creatorId)).limit(1);
  if (!creator?.email) return '아티스트 메일 실패: 받을 주소 없음';
  const html = buildEmailLayout({
    preheader: `주문번호 ${order.orderNo}`,
    heading: '발송할 주문이 들어왔어요',
    paragraphs: [
      `${creator.name}님, 직접 보내시는 상품의 주문이 들어왔어요. 받는 분 정보는 콘솔의 발송할 주문에서 확인하고, 보낸 뒤 택배사와 운송장 번호를 입력해 주세요.`,
      ...(extras.latestShipsOn ? [`예약 판매 상품이 있어서 ${formatShipsOn(extras.latestShipsOn)} 이후에 보내 주세요.`] : []),
    ],
    rows: [{ label: '주문번호', value: order.orderNo }],
    cta: { label: '발송할 주문 보기', url: ARTIST_SHIPPING_CONSOLE_URL },
  });
  const text = `발송할 주문이 들어왔어요.\n주문번호: ${order.orderNo}\n발송할 주문: ${ARTIST_SHIPPING_CONSOLE_URL}`;
  return send(creator.email, `[스튜디오 놀] 발송할 주문이 들어왔어요 (${order.orderNo})`, html, text, false, '아티스트');
};

/** 결제 확정 직후 한 번 — 확정 batch를 이긴 실행만 부른다(lib/shop/confirm.ts). */
export const sendShopOrderConfirmedEmails = async (orderNo: string): Promise<void> => {
  const order = await findShopOrderByOrderNo(orderNo).catch(() => undefined);
  if (!order || !order.shopOrder) return;
  const so = order.shopOrder;
  const manage = shopManageUrl(order.orderNo, order.manageToken);
  const failures: string[] = [];
  const extras = await loadOrderExtras(order.orderNo, so.items, new Date()).catch((error) => {
    console.error('[shop-email] 발송일·번호 조회 실패', { orderNo, error });
    return { shipsOnByItem: new Map(), latestShipsOn: null, serialsByItem: new Map(), hasDigital: false } as OrderExtras;
  });
  const extra = extraRows(order, extras);
  const ships = shopOrderShips(so);

  // 내려받기 주소는 싣지 않는다 — 메일의 링크를 여는 봇이 "내려받음"을 남기지 않게. 내려받기는 주문 확인 페이지의 버튼에서만 시작된다.
  const customerHtml = buildEmailLayout({
    preheader: `주문번호 ${order.orderNo} · ${won(order.totalAmount)}`,
    heading: '주문이 접수됐어요',
    paragraphs: [
      !ships
        ? `${order.customerName}님, 주문해 주셔서 고마워요. 주문 확인 페이지에서 파일을 내려받을 수 있어요.`
        : extras.latestShipsOn
        ? `${order.customerName}님, 주문해 주셔서 고마워요. 예약 판매 상품이 있어서 ${formatShipsOn(extras.latestShipsOn)} 이후에 함께 보내요. 보내면 운송장 번호를 메일로 알려 드릴게요.`
        : `${order.customerName}님, 주문해 주셔서 고마워요. 준비되는 대로 발송하고 운송장 번호를 메일로 알려 드릴게요.`,
      ...(ships && extras.hasDigital ? ['디지털 상품은 주문 확인 페이지에서 내려받을 수 있어요.'] : []),
      !ships
        ? '내려받기 전에는 주문 확인 페이지에서 바로 취소할 수 있어요. 결제하신 수단으로 전액 돌려드려요.'
        : '발송 전에는 주문 확인 페이지에서 바로 취소할 수 있어요. 결제하신 수단으로 전액 돌려드려요.',
    ],
    rows: [
      { label: '주문번호', value: order.orderNo },
      ...itemRows(order),
      ...extra,
      ...amountRows(order),
      ...(ships ? [{ label: '받는 분', value: `${so.recipientName} · ${so.recipientPhone}` }, { label: '배송지', value: addressLine(order) }] : []),
    ],
    cta: { label: !ships ? '주문 확인·내려받기' : '주문 확인·취소', url: manage },
    notices: [
      ...(extras.hasDigital ? [SHOP_DIGITAL_WITHDRAWAL_NOTICE] : []),
      '이 메일의 버튼 주소가 주문 확인 열쇠예요. 다른 사람에게 전달하지 마세요.',
    ],
  });
  const customerText = [
    '주문이 접수됐어요.',
    `주문번호: ${order.orderNo}`,
    ...[...itemRows(order), ...extra].map((r) => `${r.label}: ${r.value}`),
    `결제 금액: ${won(order.totalAmount)} (부가세 포함)`,
    `주문 확인·취소: ${manage}`,
  ].join('\n');
  if (order.customerEmail) {
    const f = await send(order.customerEmail, `[스튜디오 놀] 주문이 접수됐어요 (${order.orderNo})`, customerHtml, customerText, true);
    if (f) failures.push(f);
  }

  const operatorHtml = buildEmailLayout({
    audience: 'operator',
    preheader: `${order.customerName} · ${won(order.totalAmount)}`,
    heading: '상점 주문이 들어왔어요',
    rows: [
      { label: '주문번호', value: order.orderNo },
      { label: '주문자', value: `${order.customerName} / ${order.customerPhone}` },
      ...itemRows(order),
      ...extra,
      ...amountRows(order),
      ...(ships
        ? [
            { label: '받는 분', value: `${so.recipientName} / ${so.recipientPhone}` },
            { label: '배송지', value: addressLine(order) },
            ...(so.shippingMemo ? [{ label: '배송 메모', value: so.shippingMemo }] : []),
          ]
        : [{ label: '배송', value: '없음(디지털 상품)' }]),
    ],
    cta: { label: '관리자에서 보기', url: adminUrl(`/admin/shop/${order.orderNo}`) },
  });
  const f = await send(OPERATOR_EMAIL, `[상점 주문] ${won(order.totalAmount)} — ${order.customerName}`, operatorHtml, `상점 주문 ${order.orderNo} / ${won(order.totalAmount)}`, false);
  if (f) failures.push(f);

  // 아티스트 직접 발송 주문이면 그 아티스트에게도 — 던지지 않는다(실패는 notification_error로 관리자 화면에 드러난다).
  try {
    const artistFailure = await sendArtistShipRequest(order, extras);
    if (artistFailure) failures.push(artistFailure);
  } catch (error) {
    console.error('[shop-email] 아티스트 발송 요청 메일 예외', { orderNo, error });
    failures.push('아티스트 메일 예외');
  }

  await recordNotification(order.id, failures.length ? failures.join(' / ') : null);
};

/** 발송 처리 직후 — 택배사·운송장. */
export const sendShopShippedEmail = async (orderNo: string): Promise<void> => {
  const order = await findShopOrderByOrderNo(orderNo).catch(() => undefined);
  if (!order || !order.shopOrder || !order.customerEmail) return;
  const so = order.shopOrder;
  const html = buildEmailLayout({
    preheader: `${so.courier ?? ''} ${so.trackingNumber ?? ''}`.trim(),
    heading: '주문하신 상품을 보냈어요',
    paragraphs: [`${order.customerName}님, 주문하신 상품을 발송했어요. 운송장 번호로 배송 상황을 확인할 수 있어요.`],
    rows: [
      { label: '주문번호', value: order.orderNo },
      ...itemRows(order),
      { label: '택배사', value: so.courier ?? '-' },
      { label: '운송장 번호', value: so.trackingNumber ?? '-', emphasis: true },
      { label: '배송지', value: addressLine(order) },
    ],
    cta: { label: '주문 확인', url: shopManageUrl(order.orderNo, order.manageToken) },
  });
  const text = `주문하신 상품을 보냈어요.\n주문번호: ${order.orderNo}\n택배사: ${so.courier ?? '-'}\n운송장 번호: ${so.trackingNumber ?? '-'}`;
  const f = await send(order.customerEmail, `[스튜디오 놀] 상품을 보냈어요 (${order.orderNo})`, html, text, true);
  await recordNotification(order.id, f);
};

/** 취소·환불 직후 — 고객과 운영자. */
export const sendShopCancelledEmails = async (orderNo: string, refundAmount: number, requestedBy: 'customer' | 'admin'): Promise<void> => {
  const order = await findShopOrderByOrderNo(orderNo).catch(() => undefined);
  if (!order) return;
  const failures: string[] = [];
  if (order.customerEmail) {
    const html = buildEmailLayout({
      preheader: `${won(refundAmount)} 환불`,
      heading: '주문이 취소됐어요',
      paragraphs: [
        `${order.customerName}님, 주문이 취소되어 ${won(refundAmount)}을 결제하신 수단으로 돌려드렸어요.`,
        '카드는 카드사 사정에 따라 승인 취소가 보이기까지 며칠 걸릴 수 있어요.',
      ],
      rows: [
        { label: '주문번호', value: order.orderNo },
        ...itemRows(order),
        { label: '환불 금액', value: won(refundAmount), emphasis: true },
      ],
    });
    const f = await send(order.customerEmail, `[스튜디오 놀] 주문이 취소됐어요 (${order.orderNo})`, html, `주문 ${order.orderNo}이 취소되어 ${won(refundAmount)}을 돌려드렸어요.`, true);
    if (f) failures.push(f);
  }
  const operatorHtml = buildEmailLayout({
    audience: 'operator',
    heading: requestedBy === 'customer' ? '고객이 상점 주문을 취소했어요' : '상점 주문을 환불했어요',
    rows: [
      { label: '주문번호', value: order.orderNo },
      { label: '주문자', value: `${order.customerName} / ${order.customerPhone}` },
      ...itemRows(order),
      { label: '환불 금액', value: won(refundAmount), emphasis: true },
    ],
    cta: { label: '관리자에서 보기', url: adminUrl(`/admin/shop/${order.orderNo}`) },
  });
  const f = await send(OPERATOR_EMAIL, `[상점 취소] ${won(refundAmount)} — ${order.customerName}`, operatorHtml, `상점 주문 ${order.orderNo} 취소 ${won(refundAmount)}`, false);
  if (f) failures.push(f);
  await recordNotification(order.id, failures.length ? failures.join(' / ') : null);
};
