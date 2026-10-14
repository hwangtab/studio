import { adminUrl, buildEmailLayout, escapeHtml, strong, SITE_URL, type EmailLayoutInput } from '../email/layout';
import { sendEmail } from '../email/resend';
import { CUSTOMER_REPLY_TO, OPERATOR_EMAIL } from '../operatorContact';
import type { ShopDecisionAction } from './reviewDecision';

/**
 * 상점 상품 심사 메일 — 제출 알림(운영자)·판정 결과(아티스트)·승인 뒤 수정 알림(운영자).
 * `buildEmailLayout` 한 벌로 입힌다(루트 CLAUDE.md "메일은 공용 레이아웃으로"). 운영자 알림은 딥링크 버튼을 둔다.
 * **메일 실패는 판정·저장을 실패시키지 않는다** — 실패 사유 문자열만 돌려주고 호출부가 `warnings`로 올린다.
 * 사용자 입력(제목·이름·사유)은 `paragraphs`·`notices`에 넣을 때 호출부가 escape한다.
 */

export interface ShopMailProduct {
  id: string;
  title: string;
  slug: string;
  creatorName: string;
  creatorEmail: string;
}

const consoleUrl = (productId: string): string => `${SITE_URL}/ko/funding/creator/shop/${productId}`;
const publicUrl = (slug: string): string => `${SITE_URL}/ko/shop/${slug}`;
const adminProductUrl = (productId: string): string => adminUrl(`/admin/shop/products/${productId}`);

const SUBJECT: Record<ShopDecisionAction, string> = {
  approve: '상품이 승인됐어요',
  request_changes: '상품 보완 요청',
  reject: '상품 심사 결과',
};

const noteParagraph = (note: string | null): string =>
  `${strong('운영자 메모')}<br />${escapeHtml(note ?? '').replace(/\n/g, '<br />')}`;

export const buildShopSubmissionLayout = (product: ShopMailProduct): EmailLayoutInput => ({
  audience: 'operator',
  preheader: `${product.creatorName} · ${product.title}`,
  heading: '상품 심사 요청이 들어왔어요',
  rows: [
    { label: '상품', value: product.title },
    { label: '아티스트', value: product.creatorName },
    { label: '이메일', value: product.creatorEmail, href: `mailto:${product.creatorEmail}` },
  ],
  cta: { label: '심사 화면 열기', url: adminProductUrl(product.id) },
});

/** 새 상품이 심사에 제출됐다 — 운영자. */
export const sendShopSubmissionNotice = async (product: ShopMailProduct): Promise<string | null> => {
  const result = await sendEmail({
    to: OPERATOR_EMAIL,
    subject: `[상점] 상품 심사 요청 — ${product.title}`,
    text: [
      '아티스트가 상품을 심사에 제출했어요.',
      '',
      `상품: ${product.title}`,
      `아티스트: ${product.creatorName} <${product.creatorEmail}>`,
      '',
      `심사 화면: ${adminProductUrl(product.id)}`,
    ].join('\n'),
    html: buildEmailLayout(buildShopSubmissionLayout(product)),
  });
  return result.ok ? null : `operator:${result.errorCode}`;
};

/** 판정 메일 본문(HTML 입력). 사유는 아티스트에게 그대로 보인다. */
export const buildShopDecisionLayout = (
  product: ShopMailProduct,
  action: ShopDecisionAction,
  note: string | null,
  slug: string,
): EmailLayoutInput => {
  const greeting = `${escapeHtml(product.creatorName)}님,`;
  const contact = `문의: ${escapeHtml(CUSTOMER_REPLY_TO)}`;
  const html: Record<ShopDecisionAction, EmailLayoutInput> = {
    approve: {
      preheader: SUBJECT.approve,
      heading: SUBJECT.approve,
      paragraphs: [greeting, '상품이 승인되어 공개됐어요.'],
      rows: [
        { label: '상품', value: product.title },
        { label: '공개 주소', value: publicUrl(slug), href: publicUrl(slug) },
      ],
      cta: { label: '관리 화면 열기', url: consoleUrl(product.id) },
      notices: ['승인된 뒤에는 제목·주소·분류·종류와 판매 중인 옵션의 가격은 바꿀 수 없어요. 가격을 바꾸려면 새 옵션을 추가해 주세요.'],
    },
    request_changes: {
      preheader: SUBJECT.request_changes,
      heading: SUBJECT.request_changes,
      paragraphs: [greeting, '제출하신 상품에 보완이 필요해요.', noteParagraph(note), '내용을 고친 뒤 다시 제출해 주세요.'],
      rows: [{ label: '상품', value: product.title }],
      cta: { label: '상품 고치기', url: consoleUrl(product.id) },
    },
    reject: {
      preheader: SUBJECT.reject,
      heading: SUBJECT.reject,
      paragraphs: [greeting, '제출하신 상품은 이번 심사에서 등록이 어려워요.', noteParagraph(note), contact],
      rows: [{ label: '상품', value: product.title }],
    },
  };
  return html[action];
};

/** 판정 결과 — 아티스트. 사유(`note`)는 아티스트에게 그대로 보인다. */
export const sendShopReviewDecisionEmail = async (
  product: ShopMailProduct,
  action: ShopDecisionAction,
  note: string | null,
  slug: string,
): Promise<string | null> => {
  const text: Record<ShopDecisionAction, string[]> = {
    approve: [
      '상품이 승인되어 공개됐어요.',
      '',
      `공개 주소: ${publicUrl(slug)}`,
      '',
      '승인된 뒤에는 제목·주소·분류·종류와 판매 중인 옵션의 가격은 바꿀 수 없어요. 가격을 바꾸려면 새 옵션을 추가해 주세요.',
      '',
      `관리 화면: ${consoleUrl(product.id)}`,
    ],
    request_changes: [
      '제출하신 상품에 보완이 필요해요.',
      '',
      '[운영자 메모]',
      note ?? '',
      '',
      `내용을 고친 뒤 다시 제출해 주세요: ${consoleUrl(product.id)}`,
    ],
    reject: [
      '제출하신 상품은 이번 심사에서 등록이 어려워요.',
      '',
      '[운영자 메모]',
      note ?? '',
      '',
      `문의: ${CUSTOMER_REPLY_TO}`,
    ],
  };
  const result = await sendEmail({
    to: product.creatorEmail,
    replyTo: CUSTOMER_REPLY_TO,
    subject: `[스튜디오 놀] ${SUBJECT[action]} — ${product.title}`,
    text: [`${product.creatorName}님,`, '', ...text[action]].join('\n'),
    html: buildEmailLayout(buildShopDecisionLayout(product, action, note, slug)),
  });
  return result.ok ? null : `creator:${result.errorCode}`;
};

/** 아티스트 메일이 실패했을 때 운영자에게 알린다 — 실패 사실이 HTTP 응답에만 남지 않게. */
export const sendShopReviewOperatorFallback = async (
  product: ShopMailProduct,
  action: ShopDecisionAction,
  failureReason: string,
): Promise<string | null> => {
  const result = await sendEmail({
    to: OPERATOR_EMAIL,
    subject: `[상점] 심사 알림 메일 실패 — ${product.title}`,
    text: [
      '아티스트에게 심사 결과 메일을 보내지 못했어요. 아래 정보로 직접 연락해 주세요.',
      '',
      `상품: ${product.title}`,
      `판정: ${SUBJECT[action]}`,
      `아티스트: ${product.creatorName} <${product.creatorEmail}>`,
      `실패 사유: ${failureReason}`,
      '',
      `심사 화면: ${adminProductUrl(product.id)}`,
    ].join('\n'),
    html: buildEmailLayout({
      audience: 'operator',
      noticeTone: 'alert',
      preheader: `${product.creatorEmail} · ${SUBJECT[action]} 알림 메일 실패`,
      heading: '심사 알림 메일 실패',
      rows: [
        { label: '상품', value: product.title },
        { label: '판정', value: SUBJECT[action] },
        { label: '아티스트', value: product.creatorName },
        { label: '이메일', value: product.creatorEmail, href: `mailto:${product.creatorEmail}` },
        { label: '실패 사유', value: failureReason },
      ],
      cta: { label: '심사 화면 열기', url: adminProductUrl(product.id) },
      notices: ['아티스트에게 심사 결과 메일을 보내지 못했어요. 위 정보로 직접 연락해 주세요.'],
    }),
  });
  return result.ok ? null : `operator:${result.errorCode}`;
};

export const buildShopEditedLayout = (product: ShopMailProduct): EmailLayoutInput => ({
    audience: 'operator',
    preheader: `${product.creatorName} · ${product.title}`,
    heading: '공개된 상품이 수정됐어요',
    paragraphs: ['아티스트가 승인된 상품의 내용을 고쳤어요. 심사를 거치지 않는 경로예요.'],
    rows: [
      { label: '상품', value: product.title },
      { label: '아티스트', value: product.creatorName },
      { label: '공개 주소', value: publicUrl(product.slug), href: publicUrl(product.slug) },
    ],
    cta: { label: '심사 화면 열기', url: adminProductUrl(product.id) },
    notices: ['새 옵션을 추가했다면 심사 화면의 "새 옵션 승인"을 눌러야 판매가 시작돼요.'],
});

/** 승인된 상품을 아티스트가 고쳤다 — 심사를 거치지 않는 경로라 운영자가 알 유일한 길이다. */
export const sendShopCreatorEditedNotice = async (product: ShopMailProduct): Promise<string | null> => {
  const result = await sendEmail({
    to: OPERATOR_EMAIL,
    subject: `[상점] 공개된 상품이 수정됐어요 — ${product.title}`,
    text: [
      '아티스트가 승인된 상품의 내용을 고쳤어요. 심사를 거치지 않는 경로예요.',
      '',
      `상품: ${product.title} (id: ${product.id})`,
      `아티스트: ${product.creatorName} <${product.creatorEmail}>`,
      `공개 주소: ${publicUrl(product.slug)}`,
      '',
      `심사 화면: ${adminProductUrl(product.id)}`,
      '',
      '새 옵션을 추가했다면 심사 화면의 "새 옵션 승인"을 눌러야 판매가 시작돼요.',
    ].join('\n'),
    html: buildEmailLayout(buildShopEditedLayout(product)),
  });
  return result.ok ? null : `operator:${result.errorCode}`;
};
