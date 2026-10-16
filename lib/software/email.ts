import { eq } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { orders } from '../../db/schema';
import { formatPriceAmount } from '../../data/pricing';
import { SOFTWARE_SELF_CANCEL_DAYS } from '../../data/software/policy';
import { SITE_URL, adminUrl, buildEmailLayout, escapeHtml, type EmailLayoutRow } from '../email/layout';
import { sendEmail } from '../email/resend';
import { CUSTOMER_REPLY_TO, OPERATOR_EMAIL } from '../operatorContact';
import { findSoftwareOrder, type SoftwareOrderWithDetails } from './order';

/**
 * 소프트웨어 메일 — 결제 확정(고객: 라이선스 키·구매 내역 링크 / 운영자), 환불(고객·운영자), 구매 내역 링크 다시 받기(고객).
 *
 * 실패는 던지지 않는다 — 돈은 이미 움직였다. 마지막 실패 사유를 `orders.notification_error`에 남긴다(성공하면 비운다).
 * 키는 메일에 싣는다 — 구매 내역 화면에서도 다시 볼 수 있고, 새어도 기기 수 한도가 피해를 묶는다(lib/software/CLAUDE.md).
 */

const won = (n: number): string => `${formatPriceAmount(n)}원`;

export const softwareManageUrl = (orderNo: string, manageToken: string): string =>
  `${SITE_URL}/ko/software/manage/${orderNo}?token=${encodeURIComponent(manageToken)}`;

const recordNotification = async (orderId: string, failure: string | null): Promise<void> => {
  try {
    await getDb().update(orders).set({ notificationError: failure }).where(eq(orders.id, orderId));
  } catch (error) {
    console.error('[software-email] notification_error 기록 실패', { orderId, error });
  }
};

const send = async (to: string, subject: string, html: string, text: string, customer: boolean): Promise<string | null> => {
  try {
    const result = await sendEmail({ to, subject, html, text, ...(customer ? { replyTo: CUSTOMER_REPLY_TO } : {}) });
    return result.ok ? null : `${customer ? '고객' : '운영자'} 메일 실패: ${result.errorCode ?? 'unknown'}`;
  } catch (error) {
    console.error('[software-email] 발송 예외', { subject, error });
    return `${customer ? '고객' : '운영자'} 메일 예외`;
  }
};

const productRow = (order: SoftwareOrderWithDetails): EmailLayoutRow => ({ label: '상품', value: order.item?.productTitle ?? '-' });

/** 구매자에게 키·구매 내역 링크 메일 한 통. 실패 사유를 돌려준다(성공·주소 없음이면 null). 확정 메일과 관리자 "키 메일 다시 보내기"가 같이 쓴다. */
type KeyMailOrder = Pick<SoftwareOrderWithDetails, 'orderNo' | 'manageToken' | 'customerName' | 'totalAmount'> & {
  item: { productTitle: string } | null;
  licenses: { licenseKey: string; status: string }[];
};

/** 구매자 키 메일 본문 — 발송과 미리보기(scripts/preview-emails.ts)가 같이 쓴다. */
export const buildCustomerKeyEmail = (order: KeyMailOrder): { html: string; text: string } => {
  const manage = softwareManageUrl(order.orderNo, order.manageToken);
  const keys = order.licenses.filter((l) => l.status === 'active').map((l) => l.licenseKey);
  const html = buildEmailLayout({
    preheader: `라이선스 키 ${keys[0] ?? ''}`,
    heading: '구매해 주셔서 고마워요',
    paragraphs: [
      `${escapeHtml(order.customerName)}님, ${escapeHtml(order.item?.productTitle ?? '소프트웨어')} 라이선스 키를 보내 드려요.`,
      '설치한 뒤 플러그인(또는 앱)을 열고 아래 키를 넣으면 정식판으로 바뀌어요. 처음 한 번만 인터넷이 필요하고, 그 뒤로는 오프라인에서도 써요.',
      `라이선스를 활성화하기 전이라면 결제 후 ${SOFTWARE_SELF_CANCEL_DAYS}일 안에 구매 내역 화면에서 바로 환불할 수 있어요.`,
    ],
    rows: [
      { label: '주문번호', value: order.orderNo },
      { label: '상품', value: order.item?.productTitle ?? '-' },
      ...keys.map((k) => ({ label: '라이선스 키', value: k, emphasis: true })),
      { label: '결제 금액', value: `${won(order.totalAmount)} (부가세 포함)` },
    ],
    cta: { label: '구매 내역·설치 파일', url: manage },
    notices: [
      '라이선스를 활성화한 뒤에는 단순 변심으로 환불할 수 없어요(전자상거래법 제17조 제2항 제5호). 설치·동작에 문제가 있으면 알려 주세요.',
      '이 메일의 버튼 주소가 구매 내역 열쇠예요. 다른 사람에게 전달하지 마세요.',
    ],
  });
  const text = [
    '구매해 주셔서 고마워요.',
    `주문번호: ${order.orderNo}`,
    `상품: ${order.item?.productTitle ?? '-'}`,
    ...keys.map((k) => `라이선스 키: ${k}`),
    `구매 내역·설치 파일: ${manage}`,
  ].join('\n');
  return { html, text };
};

const sendCustomerKeyEmail = async (order: SoftwareOrderWithDetails): Promise<string | null> => {
  if (!order.customerEmail) return null;
  const { html, text } = buildCustomerKeyEmail(order);
  return send(order.customerEmail, `[스튜디오 놀] 라이선스 키를 보내 드려요 (${order.orderNo})`, html, text, true);
};

/** 관리자 "키 메일 다시 보내기"(결제 주문) — 고객에게만. 결과를 돌려준다. */
export const resendSoftwareKeyEmail = async (orderNo: string): Promise<{ ok: boolean; message?: string }> => {
  const order = await findSoftwareOrder(orderNo).catch(() => null);
  if (!order) return { ok: false, message: '주문을 찾을 수 없어요.' };
  if (!order.customerEmail) return { ok: false, message: '주문에 이메일이 없어요.' };
  const f = await sendCustomerKeyEmail(order);
  await recordNotification(order.id, f);
  return f ? { ok: false, message: f } : { ok: true };
};

/** 결제 없이 발급한(시험·증정) 라이선스의 키 메일 — 구매 내역 화면이 없어 키와 사용법만 싣는다. */
type ManualMailLicense = { licenseKey: string; email: string; customerName: string | null; productTitle: string; maxActivations: number };

/** 결제 없는 발급의 키 메일 본문 — 발송과 미리보기가 같이 쓴다. */
export const buildManualLicenseEmail = (license: ManualMailLicense): { html: string; text: string } => {
  const html = buildEmailLayout({
    preheader: `라이선스 키 ${license.licenseKey}`,
    heading: `${license.productTitle} 라이선스 키`,
    paragraphs: [
      `${license.customerName ? `${escapeHtml(license.customerName)}님, ` : ''}스튜디오 놀에서 ${escapeHtml(license.productTitle)} 라이선스 키를 보내 드려요.`,
      `설치한 뒤 플러그인(또는 앱)을 열고 아래 키를 넣으면 정식판으로 바뀌어요. 처음 한 번만 인터넷이 필요하고, 기기는 ${license.maxActivations}대까지 쓸 수 있어요. 컴퓨터를 바꾸면 소프트웨어 안에서 옛 기기를 해제해 주세요.`,
    ],
    rows: [{ label: '라이선스 키', value: license.licenseKey, emphasis: true }],
    notices: ['이 키는 받으신 분만 쓸 수 있어요. 다른 사람에게 전달하지 마세요. 문의는 카카오톡이나 010-4255-7893으로 해 주세요.'],
  });
  const text = `${license.productTitle} 라이선스 키: ${license.licenseKey}\n설치한 뒤 소프트웨어에 키를 넣으면 정식판으로 바뀌어요. 기기는 ${license.maxActivations}대까지.`;
  return { html, text };
};

export const sendManualLicenseEmail = async (license: ManualMailLicense): Promise<{ ok: boolean; message?: string }> => {
  const { html, text } = buildManualLicenseEmail(license);
  const f = await send(license.email, `[스튜디오 놀] ${license.productTitle} 라이선스 키`, html, text, true);
  return f ? { ok: false, message: f } : { ok: true };
};

/** 결제 확정 직후 한 번 — 확정 batch를 이긴 실행만 부른다(lib/software/confirm.ts). */
export const sendSoftwareOrderConfirmedEmails = async (orderNo: string): Promise<void> => {
  const order = await findSoftwareOrder(orderNo).catch(() => null);
  if (!order) return;
  const keys = order.licenses.map((l) => l.licenseKey);
  const failures: string[] = [];

  const customerFailure = await sendCustomerKeyEmail(order);
  if (customerFailure) failures.push(customerFailure);

  const operatorHtml = buildEmailLayout({
    audience: 'operator',
    preheader: `${order.customerName} · ${won(order.totalAmount)}`,
    heading: '소프트웨어가 팔렸어요',
    rows: [
      { label: '주문번호', value: order.orderNo },
      { label: '구매자', value: `${order.customerName} / ${order.customerPhone}` },
      { label: '이메일', value: order.customerEmail ?? '-' },
      productRow(order),
      { label: '결제 금액', value: `${won(order.totalAmount)} (부가세 포함)`, emphasis: true },
    ],
    ...(keys.length === 0 ? { notices: ['라이선스가 발급되지 않았어요 — 관리자 화면에서 수동 발급하고 고객에게 알려 주세요.'], noticeTone: 'alert' as const } : {}),
    cta: { label: '관리자에서 보기', url: adminUrl(`/admin/software?q=${order.orderNo}`) },
  });
  const f = await send(OPERATOR_EMAIL, `[소프트웨어 판매] ${won(order.totalAmount)} — ${order.customerName}`, operatorHtml, `소프트웨어 주문 ${order.orderNo} / ${won(order.totalAmount)}`, false);
  if (f) failures.push(f);
  await recordNotification(order.id, failures.length ? failures.join(' / ') : null);
};

/** 환불 직후 — 고객과 운영자. */
export const sendSoftwareCancelledEmails = async (orderNo: string, refundAmount: number, requestedBy: 'customer' | 'admin'): Promise<void> => {
  const order = await findSoftwareOrder(orderNo).catch(() => null);
  if (!order) return;
  const failures: string[] = [];
  if (order.customerEmail) {
    const html = buildEmailLayout({
      preheader: `${won(refundAmount)} 환불`,
      heading: '환불했어요',
      paragraphs: [
        `${escapeHtml(order.customerName)}님, ${won(refundAmount)}을 결제하신 수단으로 돌려드렸어요. 이 주문의 라이선스 키는 더 이상 쓸 수 없어요.`,
        '카드는 카드사 사정에 따라 승인 취소가 보이기까지 며칠 걸릴 수 있어요.',
      ],
      rows: [{ label: '주문번호', value: order.orderNo }, productRow(order), { label: '환불 금액', value: won(refundAmount), emphasis: true }],
    });
    const f = await send(order.customerEmail, `[스튜디오 놀] 환불했어요 (${order.orderNo})`, html, `주문 ${order.orderNo}을 환불해 ${won(refundAmount)}을 돌려드렸어요.`, true);
    if (f) failures.push(f);
  }
  const operatorHtml = buildEmailLayout({
    audience: 'operator',
    heading: requestedBy === 'customer' ? '고객이 소프트웨어 주문을 환불했어요' : '소프트웨어 주문을 환불했어요',
    rows: [
      { label: '주문번호', value: order.orderNo },
      { label: '구매자', value: `${order.customerName} / ${order.customerPhone}` },
      productRow(order),
      { label: '환불 금액', value: won(refundAmount), emphasis: true },
    ],
    cta: { label: '관리자에서 보기', url: adminUrl(`/admin/software?q=${order.orderNo}`) },
  });
  const f = await send(OPERATOR_EMAIL, `[소프트웨어 환불] ${won(refundAmount)} — ${order.customerName}`, operatorHtml, `소프트웨어 주문 ${order.orderNo} 환불 ${won(refundAmount)}`, false);
  if (f) failures.push(f);
  await recordNotification(order.id, failures.length ? failures.join(' / ') : null);
};

/** 구매 내역 링크 다시 받기 — 그 이메일로 산 주문들의 구매 내역 주소를 한 통에. 주문이 없으면 보내지 않는다(호출부가 결과를 숨긴다). */
export const sendSoftwareLinksEmail = async (
  to: string,
  items: { orderNo: string; manageToken: string; productTitle: string; paidAt: Date }[],
): Promise<boolean> => {
  if (items.length === 0) return false;
  const html = buildEmailLayout({
    heading: '구매 내역 링크를 보내 드려요',
    paragraphs: ['요청하신 이메일로 산 소프트웨어의 구매 내역 주소예요. 라이선스 키·설치 파일·기기 관리를 여기서 할 수 있어요.', '직접 요청하지 않았다면 이 메일은 무시해도 돼요.'],
    rows: items.map((i) => ({ label: `${i.productTitle} (${i.paidAt.toISOString().slice(0, 10)})`, value: i.orderNo, href: softwareManageUrl(i.orderNo, i.manageToken) })),
    notices: ['이 메일의 주소가 구매 내역 열쇠예요. 다른 사람에게 전달하지 마세요.'],
  });
  const text = ['구매 내역 링크', ...items.map((i) => `${i.productTitle} ${i.orderNo}: ${softwareManageUrl(i.orderNo, i.manageToken)}`)].join('\n');
  return (await send(to, '[스튜디오 놀] 소프트웨어 구매 내역 링크', html, text, true)) === null;
};
