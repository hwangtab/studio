import { formatPriceAmount } from '../../data/pricing';
import { sendEmail } from '../email/resend';
import { CUSTOMER_REPLY_TO, OPERATOR_EMAIL } from '../operatorContact';
import { isPurgedValue } from '../privacy/orderRetention';

import { isManualPlaceholderRecipient } from './service';

import type { CreatorProjectDetail } from './creatorProjectWrite';
import type { FundingProject } from './projects';
import type { FundingOrder } from './service';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://studionol.co.kr').replace(/\/+$/, '');
const manageUrl = (order: FundingOrder): string => `${SITE_URL}/ko/funding/manage/${order.orderNo}?token=${order.manageToken}`;
export const PHONE_NUMBER = '010-4255-7893';
export const PHONE = `문의: ${PHONE_NUMBER}`;

/**
 * 제목 꼬리표. 프로젝트를 못 찾으면(슬러그 오타·비공개 전환) `project?.title ?? ''`가
 * 빈 문자열이 되어 "후원이 확정되었습니다 — "처럼 em dash로 끝나는 제목이 나갔다.
 */
const titleSuffix = (project: FundingProject | null): string => (project?.title ? ` — ${project.title}` : '');

/** 운영자 메일용 결제수단 라벨 — 원문 enum(toss·bank_transfer)을 그대로 보이지 않는다. */
const PAYMENT_METHOD_LABEL: Record<string, string> = { toss: '토스', bank_transfer: '무통장' };
const paymentMethodLabel = (method: string | null | undefined): string =>
  (method && PAYMENT_METHOD_LABEL[method]) || method || '미지정';

const summaryLines = (order: FundingOrder, project: FundingProject | null): string[] => {
  const p = order.fundingPledge;
  if (!p) return [];
  const reward = project?.rewards.find((r) => r.id === p.rewardId);
  return [
    `프로젝트: ${project?.title ?? p.projectSlug}`,
    `리워드: ${p.rewardTitle} × ${p.quantity}${p.additionalAmount > 0 ? ` + 추가 펀딩 ${formatPriceAmount(p.additionalAmount)}원` : ''}`,
    `펀딩 금액: ${formatPriceAmount(order.totalAmount)}원 (VAT 포함)`,
    ...(reward ? [`예상 전달 시기: ${reward.estimatedDelivery}`] : []),
    `주문번호: ${order.orderNo}`,
  ];
};

/**
 * 전자상거래법 제13조 2항의 계약내용 서면 교부 — 계약이 성립한 뒤 후원자에게 도달하는 문서에는
 * 청약철회의 기한·행사 방법과 약관을 함께 담아야 한다. 전에는 확정·무통장 메일 어디에도 약관
 * 링크가 없어, 계약 성립 뒤 후원자가 받는 모든 문서에서 철회 조건이 사라졌다.
 * 문구는 펀딩 약관 제8조(청약철회 기간)·제10조(환불)를 그대로 요약한 것이다 — 조항을 고치면
 * 여기도 함께 고쳐야 한다(lib/funding/email.test.ts가 기한·링크를 단언한다).
 */
const withdrawalLines = (order: FundingOrder): string[] => [
  '',
  '[청약철회 안내]',
  '· 기한: 프로젝트 마감 전이고 리워드 발송 준비가 시작되기 전이면 언제든 취소하고 전액 환불받을 수 있습니다. 리워드를 받은 뒤에는 받은 날부터 7일 이내에 청약철회할 수 있습니다(표시·광고와 다르거나 계약 내용과 다르게 이행된 경우에는 받은 날부터 3개월 이내, 그 사실을 안 날부터 30일 이내).',
  `· 방법: 펀딩 확인 페이지(${manageUrl(order)})에서 직접 취소하거나, 이 메일에 회신 또는 ${CUSTOMER_REPLY_TO} · ${PHONE_NUMBER}으로 알려 주세요. 환불은 접수일부터 3영업일 이내에 처리합니다.`,
  `· 약관 전문(청약철회·환불 규정 포함): ${SITE_URL}/ko/funding/terms`,
];

const send = async (pairs: Array<{ key: string; params: Parameters<typeof sendEmail>[0] }>): Promise<string | null> => {
  const failures: string[] = [];
  for (const { key, params } of pairs) {
    const r = await sendEmail(params);
    if (!r.ok) failures.push(`${key}:${r.errorCode}`);
  }
  return failures.length ? failures.join(', ') : null;
};

/**
 * 수신 불가 주소로 가는 **고객 항목만** 떨어뜨린다. 운영자 사본은 그대로 나간다.
 *
 * 수기 등록에서 연락처를 비우면 customer_email에 플레이스홀더(manual@studionol.co.kr)가
 * 들어간다. 우리 도메인이라 resend.ts의 배달불가 판정(RFC 2606 예약 도메인)에 안 걸려
 * 실제로 발송되고, 그 메일은 우리 수신함으로 되돌아오거나 반송돼 발신 도메인 평판을 깎는다.
 *
 * **운영자 사본까지 함께 끊으면 안 된다** — 수기 건의 환불은 손으로 계좌에 송금하는
 * 작업이라, 무엇을 얼마나 돌려줘야 하는지 알려 주는 그 메일이 실무의 시작점이다.
 * 예전엔 호출부(cancel.ts)에서 통째로 건너뛰어 그 사본까지 사라졌다.
 *
 * 여기(발송 계층)에 두면 취소·환불요청 해제·확정 등 모든 경로가 같은 규칙을 따른다.
 * `errorCode`를 만들지 않고 **조용히 빼는** 것도 의도다 — 실패로 세면 그 문자열이
 * orders.notificationError에 남아 헬스체크가 영구히 울린다.
 *
 * **보관 기간이 지나 파기된 주문도 같은 자리에서 뺀다.** 그 주문은 이메일 칸이
 * `PURGED_MARK`로 덮여 있고(`lib/privacy/orderRetention.ts`), 보낼 곳이 아예 없다.
 * resend.ts가 발송은 막지만 그것만으로는 부족하다 — `UNDELIVERABLE_ADDRESS`가 실패로
 * 세어지면 위 문단이 말한 영구 경보가 문자열만 바꿔 그대로 남는다. 나이 게이트가 없는
 * 관리자 재발송(`pages/api/admin/funding/pledges/[id].ts`)이 실제로 그 경로다.
 *
 * **RFC 2606 시험용 주소는 여기서 가르지 않는다** — 그쪽 실패는 세는 편이 맞다.
 * 보낼 곳이 사라진 것과 잘못된 주소가 들어온 것은 다른 사건이다.
 */
const withoutUndeliverableCustomer = (
  order: FundingOrder,
  pairs: Array<{ key: string; params: Parameters<typeof sendEmail>[0] }>,
): Array<{ key: string; params: Parameters<typeof sendEmail>[0] }> =>
  isManualPlaceholderRecipient(order) || isPurgedValue(order.customerEmail)
    ? pairs.filter((p) => p.key !== 'customer')
    : pairs;

/**
 * 디지털 리워드 내려받기 안내 — 후원한 리워드에 내려받을 파일이 있을 때만 붙는다.
 *
 * **메일에는 내려받기 주소를 싣지 않는다.** 예전에는 파일마다 게이트 주소를 실어 보냈는데,
 * 그 주소는 여는 것만으로 `downloaded_at`을 남겼다. 여는 주체가 사람이라는 보장이 없다 —
 * 회사 메일의 링크 검사기나 메신저 미리보기 봇이 배달 시점에 한 번 긁는다. 그러면 후원자는
 * 파일을 받은 적이 없는데 셀프 취소만 잃고, "내려받은 뒤에는 청약철회가 제한됩니다"라는
 * 사실과 다른 문구를 보게 된다.
 *
 * 그래서 후원 확인 페이지로 보낸다. 거기 버튼을 눌러야 내려받기가 시작되고, 그때 기록된다.
 *
 * 받을 파일의 이름은 여기 적는다. 상위 티어는 하위 티어가 주는 것을 포함하므로, 무엇을
 * 받게 되는지는 메일에서 바로 보여야 한다.
 */
const downloadLines = (order: FundingOrder, project: FundingProject | null): string[] => {
  const rewardId = order.fundingPledge?.rewardId;
  const reward = project?.rewards.find((r) => r.id === rewardId);
  // `downloads`가 없는 리워드가 들어와도 여기서 터지면 안 된다 — 이 함수는 결제 확정
  // 메일 경로 안이라, 던지면 결제는 됐는데 안내 메일이 통째로 실패한다.
  if (!reward?.downloads?.length) return [];
  return [
    '',
    '[음원 내려받기]',
    ...reward.downloads.map((d) => `· ${d.label}`),
    `아래 펀딩 확인 페이지에서 받으실 수 있습니다: ${manageUrl(order)}`,
    '· 내려받기를 시작하면 청약철회가 제한됩니다(약관 제8조 2항).',
  ];
};

/**
 * 운영자 메일에 싣는 명단 표시 한 줄. 운영자가 욕설·사칭 닉네임을 내리려면(관리자 후원 상세의
 * "서포터 명단에서 내리기") 먼저 **무엇이 올라갔는지** 알아야 하는데, 알림 메일에 메시지만
 * 있고 표시 이름은 없었다.
 */
const listingLine = (order: FundingOrder): string => {
  const p = order.fundingPledge;
  if (!p?.displayNamePublic) return '명단: 비공개';
  return `명단: 공개 · ${p.publicName ?? `${order.customerName} (실명)`}`;
};
const adminPledgeUrl = (order: FundingOrder): string => `${SITE_URL}/admin/funding/${order.id}`;

export const sendFundingConfirmedEmails = (order: FundingOrder, project: FundingProject | null): Promise<string | null> =>
  send(withoutUndeliverableCustomer(order, [
    { key: 'customer', params: {
      to: order.customerEmail, replyTo: CUSTOMER_REPLY_TO,
      subject: `[스튜디오 놀] 펀딩이 확정되었습니다${titleSuffix(project)}`,
      text: [`${order.customerName}님, 함께해 주셔서 고맙습니다.`, ...summaryLines(order, project), ...downloadLines(order, project), ...withdrawalLines(order), '', `펀딩 확인·취소: ${manageUrl(order)}`, PHONE].join('\n'),
    } },
    { key: 'operator', params: {
      to: OPERATOR_EMAIL,
      subject: `[펀딩] 펀딩 확정 ${formatPriceAmount(order.totalAmount)}원 — ${order.customerName}`,
      text: [...summaryLines(order, project), `고객: ${order.customerName} / ${order.customerPhone} / ${order.customerEmail}`,
        `결제수단: ${paymentMethodLabel(order.fundingPledge?.paymentMethod)}`, listingLine(order), `메시지: ${order.fundingPledge?.supporterMessage ?? '없음'}`, `관리자: ${adminPledgeUrl(order)}`].join('\n'),
    } },
  ]));


const CANCEL_SUBJECT = { refunded: '환불이 완료되었습니다', refund_requested: '취소 요청을 접수했습니다', recorded: '환불 처리 안내' } as const;
/**
 * 본문 금액은 totalAmount가 아니라 **실제 환불액**이다 — 부분환불 이력이 있는 건에서 두 값은
 * 다르고, 총액을 적으면 이미 돌려준 몫까지 다시 돌려주는 것처럼 읽힌다.
 */
const CANCEL_BODY = {
  refunded: (amount: number) => `${formatPriceAmount(amount)}원이 결제 수단으로 환불됩니다(카드사에 따라 3~7일).`,
  refund_requested: () => '무통장 펀딩은 운영자가 확인 후 계좌로 환불합니다. 환불받을 계좌(은행·계좌번호·예금주)를 이 메일에 회신해 주세요.',
  recorded: (amount: number) => `${formatPriceAmount(amount)}원 환불 처리가 완료되었습니다.`,
} as const;

export const sendFundingCancelledEmails = (order: FundingOrder, project: FundingProject | null, mode: 'refunded' | 'refund_requested' | 'recorded', refundAmount: number): Promise<string | null> =>
  send(withoutUndeliverableCustomer(order, [
    { key: 'customer', params: {
      to: order.customerEmail, replyTo: CUSTOMER_REPLY_TO,
      subject: `[스튜디오 놀] ${CANCEL_SUBJECT[mode]}${titleSuffix(project)}`,
      text: [`${order.customerName}님,`, CANCEL_BODY[mode](refundAmount), ...summaryLines(order, project), PHONE].join('\n'),
    } },
    { key: 'operator', params: {
      to: OPERATOR_EMAIL,
      subject: `[펀딩] ${CANCEL_SUBJECT[mode]} — ${order.customerName} (${mode})`,
      text: [...summaryLines(order, project), `환불 금액: ${formatPriceAmount(refundAmount)}원`, `고객: ${order.customerName} / ${order.customerPhone} / ${order.customerEmail}`, `관리자: ${SITE_URL}/admin/funding`].join('\n'),
    } },
  ]));

/**
 * 관리자가 취소 요청을 철회 처리했을 때. 후원자에게 **반드시** 나가야 한다 — 이 액션은
 * 고객이 남긴 청약철회 의사를 지우는 것이라, 알리지 않으면 고객은 취소가 접수된 줄 알고
 * 기다리다가 리워드를 받게 된다. 다시 요청하는 방법(관리 링크)을 함께 적는다.
 */
export const sendFundingRefundRequestClearedEmails = (
  order: FundingOrder,
  project: FundingProject | null,
  reason: string,
): Promise<string | null> =>
  send(withoutUndeliverableCustomer(order, [
    { key: 'customer', params: {
      to: order.customerEmail, replyTo: CUSTOMER_REPLY_TO,
      subject: `[스튜디오 놀] 취소 요청이 철회 처리되었습니다${titleSuffix(project)}`,
      text: [
        `${order.customerName}님,`,
        '접수해 두었던 펀딩 취소 요청을 철회 처리했습니다. 이 펀딩은 다시 정상 진행됩니다.',
        `사유: ${reason}`,
        '',
        '취소를 원하지 않으셨다면 아래 링크에서 다시 취소를 요청하시거나 이 메일에 회신해 주세요.',
        ...summaryLines(order, project),
        '',
        `펀딩 확인·취소: ${manageUrl(order)}`,
        PHONE,
      ].join('\n'),
    } },
    { key: 'operator', params: {
      to: OPERATOR_EMAIL,
      subject: `[펀딩] 취소 요청 철회 처리 — ${order.customerName}`,
      text: [
        ...summaryLines(order, project),
        `사유: ${reason}`,
        `고객: ${order.customerName} / ${order.customerPhone} / ${order.customerEmail}`,
        `관리자: ${SITE_URL}/admin/funding`,
      ].join('\n'),
    } },
  ]));

/**
 * 개설자 심사 신청 알림 — 운영자에게만 보낸다(개설자는 화면 응답으로 이미 안다).
 *
 * 링크는 프로젝트별 심사 화면(`/admin/funding/projects/{id}`)이다 — `/admin/funding`
 * 목록은 후원 건(주문/pledge)을 다루는 다른 화면(`pages/admin/funding/[id].tsx`,
 * `findFundingOrderById`)이라 프로젝트 심사와는 별개다.
 */
export const sendFundingCreatorSubmissionEmail = (project: CreatorProjectDetail): Promise<string | null> => {
  const contact = [project.creator.contactName, project.creator.phone].filter(Boolean).join(' / ') || '연락처 미기재';
  return send([
    { key: 'operator', params: {
      to: OPERATOR_EMAIL,
      subject: `[펀딩] 심사 요청 — ${project.title}`,
      text: [
        `개설자: ${project.creator.name} (${contact})`,
        `프로젝트: ${project.title}`,
        `심사 화면: ${SITE_URL}/admin/funding/projects/${project.id}`,
      ].join('\n'),
    } },
  ]);
};

/**
 * 개설자 심사 철회 알림 — 운영자에게만 보낸다(개설자는 화면 응답으로 이미 안다).
 *
 * 심사를 이미 시작했을 수 있다 — 운영자가 화면을 열어 보던 중이었다면 그 작업이 헛수고가
 * 된 것을 알아야 한다. 링크는 submit 알림과 같은 프로젝트별 심사 화면이다.
 */
export const sendFundingCreatorWithdrawalEmail = (project: CreatorProjectDetail): Promise<string | null> => {
  const contact = [project.creator.contactName, project.creator.phone].filter(Boolean).join(' / ') || '연락처 미기재';
  return send([
    { key: 'operator', params: {
      to: OPERATOR_EMAIL,
      subject: `[펀딩] 심사 철회 — ${project.title}`,
      text: [
        `개설자가 심사 신청을 철회했습니다. 프로젝트는 작성 중(draft) 상태로 돌아갔습니다.`,
        `개설자: ${project.creator.name} (${contact})`,
        `프로젝트: ${project.title}`,
        `심사 화면: ${SITE_URL}/admin/funding/projects/${project.id}`,
      ].join('\n'),
    } },
  ]);
};

/**
 * 개설자 로그인 메일 전역 일일 캡에 걸렸을 때의 운영자 알림.
 *
 * 캡에 걸린 정상 사용자는 메일을 못 받는데 화면은 성공이라고 답한다(주소 존재 여부를
 * 숨기려면 그래야 한다). 운영자가 모르면 아무도 모른다 — "로그인이 안 된다"는 문의가
 * 들어와야 비로소 알게 되는 상태를 막는다.
 *
 * 링크는 `/admin/funding/projects` 목록이다 — 이 화면이 프로젝트마다 `creatorEmail`을
 * 나란히 보여주므로(`pages/admin/funding/projects/index.tsx`), 캡을 두드린 주소가 실제
 * 등록된 개설자인지 운영자가 바로 대조할 수 있다. `/admin/funding`(주문·pledge 목록)에는
 * 개설자 이메일이 없어 이 판단에 쓸 수 없다.
 */
export const sendCreatorLoginCapAlert = async (cap: number): Promise<string | null> => {
  const result = await sendEmail({
    to: OPERATOR_EMAIL,
    subject: '[펀딩] 개설자 로그인 메일 일일 한도에 걸렸습니다',
    text: [
      `오늘 개설자 로그인 메일이 일일 한도(${cap}통)에 도달했습니다.`,
      '지금부터 24시간 창이 지날 때까지 로그인 링크가 발송되지 않습니다.',
      '',
      '정상 사용자도 함께 막히므로, 남용이 아니라면 한도를 올려야 합니다',
      '(pages/api/funding/creator/login.ts의 GLOBAL_DAILY_CAP).',
      '',
      `개설자 목록(이메일 대조용): ${SITE_URL}/admin/funding/projects`,
    ].join('\n'),
  });
  return result.ok ? null : `operator:${result.errorCode}`;
};

/**
 * 개설자 로그인 링크 메일 자체의 발송 실패를 운영자에게 알린다.
 *
 * `sendCreatorLoginEmail`이 실패해도 화면은 그대로 "로그인 링크를 보냈습니다"라고 답한다
 * (열거 방지). 그래서 이 실패는 개설자에게는 "링크가 안 온다"는 문의로만 드러나고, 문의가
 * 오기 전까지 운영자는 알 길이 없다. 어느 주소로 보내려다 실패했는지 본문에 그대로 적어야
 * 운영자가 그 사람에게 직접 연락할 수 있다.
 *
 * 창당 한 번만 보낸다 — 발송 실패는 보통 메일 발송사 쪽 장애라 짧은 시간에 여러 개설자에게
 * 동시에 나므로, 개설자마다 알림을 보내면 그 자체가 쏟아진다. 전역 일일 캡 알림
 * (`creator_login:global_alert`)과는 겹치는 상황이 다르므로(캡은 "너무 많이 보냈다", 이건
 * "보내려 했는데 실패했다") 레이트리밋 키를 다르게 둔다 — 같으면 한쪽이 다른 쪽의 하루
 * 예산을 먹는다.
 */
export const sendCreatorLoginMailFailureAlert = async (email: string, reason: string): Promise<string | null> => {
  const result = await sendEmail({
    to: OPERATOR_EMAIL,
    subject: '[펀딩] 개설자 로그인 메일 발송이 실패했습니다',
    text: [
      '개설자 로그인 링크 메일을 보내려 했으나 발송에 실패했습니다.',
      `수신 시도 주소: ${email}`,
      `실패 사유: ${reason}`,
      '',
      '이 개설자는 로그인 링크를 받지 못했을 수 있습니다. 위 주소로 직접 연락해 안내해 주세요.',
      '',
      `개설자 목록(이메일 대조용): ${SITE_URL}/admin/funding/projects`,
    ].join('\n'),
  });
  return result.ok ? null : `operator:${result.errorCode}`;
};

/**
 * 매직링크 토큰은 소진됐는데 세션 생성이 던졌을 때의 운영자 알림.
 *
 * `pages/api/funding/creator/session.ts`는 토큰을 먼저 소진하고 나서 세션을 만든다(순서를
 * 바꾸면 세션 생성 실패 시 "유효한 세션 + 안 쓴 토큰"이 남는 더 나쁜 상태가 된다). 그래서
 * 이 실패는 개설자에게는 새 링크를 받아도 반복되는 장애로 보이는데 화면에는 원인이 없다 —
 * 운영자가 모르면 "로그인이 안 된다"는 문의가 들어와야 비로소 알게 된다.
 *
 * 무엇이 잘못됐는지는 여기서 지어내지 않는다 — 서버 로그(console.error)에 실제 에러가
 * 남으므로, 메일은 "이 경로가 실패하고 있다"는 신호만 전달한다.
 */
export const sendCreatorSessionFailureAlert = async (): Promise<string | null> => {
  const result = await sendEmail({
    to: OPERATOR_EMAIL,
    subject: '[펀딩] 개설자 로그인 세션 생성이 실패했습니다',
    text: [
      '매직링크 토큰은 정상 소진됐는데, 그 뒤 세션을 만드는 단계에서 오류가 났습니다.',
      '개설자는 새 링크를 다시 받아도 같은 자리에서 반복해 막힙니다.',
      '',
      '원인은 서버 로그에서 확인해야 합니다(이 메일은 "실패하고 있다"는 신호만 전달합니다).',
      '',
      `개설자 목록: ${SITE_URL}/admin/funding/projects`,
    ].join('\n'),
  });
  return result.ok ? null : `operator:${result.errorCode}`;
};

/**
 * 후원자가 **결제 뒤에** 닉네임으로 명단에 올렸거나 닉네임을 바꿨다는 운영자 알림.
 *
 * 확정 메일(위)은 결제 순간의 표시 이름만 싣는다. 그 뒤 펀딩 확인 페이지나 결제 완료 화면에서
 * 바꾼 닉네임은 운영자가 알 길이 없어, 관리자 화면의 "서포터 명단에서 내리기"가 있어도 누를
 * 계기가 없었다. 실명·가린 이름은 후원자가 정한 문자열이 아니라 검토할 거리가 없으므로 알리지
 * 않는다(호출부가 판단).
 */
export const sendFundingListingNicknameAlert = (order: FundingOrder, nickname: string, message: string | null): Promise<string | null> =>
  send([{ key: 'operator', params: {
    to: OPERATOR_EMAIL,
    subject: `[펀딩] 서포터 명단 닉네임 — ${nickname}`,
    text: [
      `후원자가 서포터 명단 표시 이름을 닉네임으로 정했습니다. 부적절하면 관리자 화면에서 "서포터 명단에서 내리기"를 눌러 주세요.`,
      '',
      `닉네임: ${nickname}`,
      `응원 메시지: ${message ?? '없음'}`,
      `주문번호: ${order.orderNo} / 결제자: ${order.customerName}`,
      `관리자: ${adminPledgeUrl(order)}`,
    ].join('\n'),
  } }]);
