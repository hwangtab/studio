jest.mock('../email/resend', () => ({ sendEmail: jest.fn().mockResolvedValue({ ok: true }) }));
import { sendEmail } from '../email/resend';
import { OPERATOR_EMAIL } from '../operatorContact';
import { sendFundingBankDepositEmails, sendFundingCancelledEmails, sendFundingConfirmedEmails } from './email';

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
it('무통장 안내는 계좌·기한·입금자명, 고객 메일은 replyTo 운영자', async () => {
  await sendFundingBankDepositEmails(order, project);
  const customer = (sendEmail as jest.Mock).mock.calls[0][0];
  expect(customer.replyTo).toBe(OPERATOR_EMAIL);
  const text = customer.text as string;
  expect(text).toContain('3333-12-5480849');
  expect(text).toContain('입금자명');
  expect(text).toContain('2026.10.16');
});
it('무통장 안내는 fundingPledge가 없으면 메일을 보내지 않고 missing_pledge를 반환', async () => {
  const orderWithoutPledge = { ...(order as Record<string, unknown>), fundingPledge: null } as never;
  expect(await sendFundingBankDepositEmails(orderWithoutPledge, project)).toBe('missing_pledge');
  expect(sendEmail).not.toHaveBeenCalled();
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
