jest.mock('../email/resend', () => ({ sendEmail: jest.fn().mockResolvedValue({ ok: true }) }));
import { sendEmail } from '../email/resend';
import { OPERATOR_EMAIL } from '../operatorContact';
import { sendFundingCancelledEmails, sendFundingConfirmedEmails, sendFundingRefundRequestClearedEmails } from './email';

const order = {
  id: 'o', orderNo: 'FND-20261015-ABCDEF12', type: 'funding', status: 'paid', manageToken: 'tok',
  customerName: '김후원', customerPhone: '010', customerEmail: 'a@b.com', itemAmount: 4545, vatAmount: 455, totalAmount: 5000,
  notificationError: null, createdAt: new Date(), updatedAt: new Date(), payments: [],
  fundingPledge: {
    id: 'p', orderId: 'o', projectSlug: 'demo', rewardId: 'mail', rewardTitle: '감사 메일', unitAmount: 5000, quantity: 1, additionalAmount: 0,
    paymentMethod: 'bank_transfer', holdExpiresAt: new Date('2026-10-15T15:00:00Z'), paidAt: null, supporterMessage: null, displayNamePublic: true,
    shippingName: null, shippingPhone: null, shippingPostcode: null, shippingAddress1: null, shippingAddress2: null, shippingMemo: null,
    fulfillmentStatus: 'none', trackingCompany: null, trackingNumber: null, entrySource: 'online', refundRequestedAt: null, adminMemo: null,
    createdAt: new Date(), updatedAt: new Date(),
  },
} as never;
const project = { title: '데모 앨범', rewards: [{ id: 'mail', estimatedDelivery: '2026-11' }] } as never;

beforeEach(() => (sendEmail as jest.Mock).mockClear());

it('확정 메일은 고객·운영자 두 통, manage 링크·리워드 포함, 고객 메일은 replyTo 운영자', async () => {
  expect(await sendFundingConfirmedEmails(order, project)).toBeNull();
  expect(sendEmail).toHaveBeenCalledTimes(2);
  const customer = (sendEmail as jest.Mock).mock.calls[0][0];
  expect(customer.to).toBe('a@b.com');
  expect(customer.replyTo).toBe(OPERATOR_EMAIL);
  expect(customer.text).toContain('/ko/funding/manage/FND-20261015-ABCDEF12?token=tok');
  expect(customer.text).toContain('감사 메일');
});
it('한 통이라도 실패하면 요약을 돌려준다', async () => {
  (sendEmail as jest.Mock).mockResolvedValueOnce({ ok: false, errorCode: 'API_ERROR' });
  expect(await sendFundingCancelledEmails(order, project, 'refunded', 5000)).toBe('customer:API_ERROR');
});

// 부분환불 이력이 있으면 총액과 실제 환불액이 다르다 — 총액을 적으면 이미 돌려준 몫까지
// 다시 돌려주는 것처럼 읽힌다.
it('취소 메일 본문은 총액이 아니라 실제 환불액을 말한다', async () => {
  await sendFundingCancelledEmails(order, project, 'refunded', 3000);
  const customer = (sendEmail as jest.Mock).mock.calls[0][0];
  expect(customer.text).toContain('3,000원이 결제 수단으로 환불됩니다');
  expect(customer.text).not.toContain('5,000원이 결제 수단으로');
  const operator = (sendEmail as jest.Mock).mock.calls[1][0];
  expect(operator.text).toContain('환불 금액: 3,000원');
});

it('무통장 환불 기록 메일도 환불액을 말한다', async () => {
  await sendFundingCancelledEmails(order, project, 'recorded', 1500);
  expect((sendEmail as jest.Mock).mock.calls[0][0].text).toContain('1,500원 환불 처리가 완료되었습니다');
});

describe('제목 꼬리표 · 결제수단 라벨', () => {
  it('프로젝트를 못 찾으면 제목이 em dash로 끝나지 않는다', async () => {
    await sendFundingConfirmedEmails(order, null);
    expect((sendEmail as jest.Mock).mock.calls[0][0].subject).toBe('[스튜디오 놀] 후원이 확정되었습니다');

    (sendEmail as jest.Mock).mockClear();
    await sendFundingCancelledEmails(order, null, 'refunded', 5000);
    expect((sendEmail as jest.Mock).mock.calls[0][0].subject).toBe('[스튜디오 놀] 환불이 완료되었습니다');
  });

  it('프로젝트가 있으면 제목에 붙는다', async () => {
    await sendFundingConfirmedEmails(order, project);
    expect((sendEmail as jest.Mock).mock.calls[0][0].subject).toBe('[스튜디오 놀] 후원이 확정되었습니다 — 데모 앨범');
  });

  it('운영자 메일의 결제수단은 한글 라벨로 나간다 — enum 원문을 보이지 않는다', async () => {
    await sendFundingConfirmedEmails(order, project);
    const operator = (sendEmail as jest.Mock).mock.calls[1][0];
    expect(operator.text).toContain('결제수단: 무통장');
    expect(operator.text).not.toContain('bank_transfer');

    (sendEmail as jest.Mock).mockClear();
    const tossOrder = { ...(order as object), fundingPledge: { ...(order as { fundingPledge: object }).fundingPledge, paymentMethod: 'toss' } } as never;
    await sendFundingConfirmedEmails(tossOrder, project);
    expect((sendEmail as jest.Mock).mock.calls[1][0].text).toContain('결제수단: 토스');
  });
});

// 전자상거래법 제13조 2항 — 계약 성립 뒤 후원자에게 도달하는 문서에 청약철회의 기한·방법과
// 계약 내용(약관)이 없으면 서면 교부 요건을 못 채운다. 예전엔 확정·무통장 메일 어디에도
// 약관 링크가 없었다. 문구는 약관 제8조(기간)·제10조(환불)와 같아야 한다.
describe('청약철회 고지 (전자상거래법 제13조 2항)', () => {
  it('확정 메일 고객 본문에 청약철회 기한·방법과 약관 링크가 있다', async () => {
    await sendFundingConfirmedEmails(order, project);
    const text = (sendEmail as jest.Mock).mock.calls[0][0].text as string;
    expect(text).toContain('청약철회');
    expect(text).toContain('받은 날부터 7일 이내');
    expect(text).toContain('3개월 이내');
    expect(text).toContain('30일 이내');
    expect(text).toContain('3영업일 이내');
    expect(text).toContain('https://studionol.co.kr/ko/funding/terms');
    // 행사 방법 — 후원 확인 페이지에서 직접 취소할 수 있다는 경로를 함께 준다.
    expect(text).toContain('/ko/funding/manage/FND-20261015-ABCDEF12?token=tok');
  });

  it('운영자 메일에는 청약철회 고지를 넣지 않는다 — 수신자가 후원자가 아니다', async () => {
    await sendFundingConfirmedEmails(order, project);
    expect((sendEmail as jest.Mock).mock.calls[1][0].text as string).not.toContain('[청약철회 안내]');
  });
});

/**
 * 관리자가 취소 요청을 철회 처리하면 고객이 남긴 청약철회 의사가 사라진다. 알리지 않으면
 * 고객은 취소가 접수된 줄 알고 기다리다가 리워드를 받는다.
 */
it('취소 요청 철회 메일은 고객·운영자 두 통, 사유와 다시 요청하는 방법이 들어간다', async () => {
  expect(await sendFundingRefundRequestClearedEmails(order, project, '후원자 전화 철회')).toBeNull();
  expect(sendEmail).toHaveBeenCalledTimes(2);
  const customer = (sendEmail as jest.Mock).mock.calls[0][0];
  expect(customer.to).toBe('a@b.com');
  expect(customer.replyTo).toBe(OPERATOR_EMAIL);
  expect(customer.subject).toBe('[스튜디오 놀] 취소 요청이 철회 처리되었습니다 — 데모 앨범');
  expect(customer.text).toContain('사유: 후원자 전화 철회');
  expect(customer.text).toContain('다시 취소를 요청');
  expect(customer.text).toContain('/ko/funding/manage/FND-20261015-ABCDEF12?token=tok');
  expect((sendEmail as jest.Mock).mock.calls[1][0].to).toBe(OPERATOR_EMAIL);
});
