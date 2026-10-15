/** @jest-environment node */
import { sendDepositLinkPaidEmail } from './email';
import { MANUAL_PLACEHOLDER_EMAIL } from '../privacy/manualPlaceholder';

const sendEmail = jest.fn().mockResolvedValue({ ok: true });
jest.mock('../email/resend', () => ({ ...jest.requireActual('../email/resend'), sendEmail: (...a: unknown[]) => sendEmail(...a) }));

const order = (customerEmail: string) =>
  ({ id: 'o', orderNo: 'NO-1', type: 'deposit', customerName: '김', customerPhone: '-', customerEmail, totalAmount: 11000, manageToken: 't' }) as never;

beforeEach(() => sendEmail.mockClear());

it('수기 예약의 플레이스홀더 주소로는 고객 메일을 보내지 않는다(반송 방지)', async () => {
  expect(await sendDepositLinkPaidEmail(order(MANUAL_PLACEHOLDER_EMAIL))).toBeNull();
  expect(sendEmail).not.toHaveBeenCalled();
});

it('진짜 주소로는 그대로 보낸다', async () => {
  expect(await sendDepositLinkPaidEmail(order('real@example.com'))).toBeNull();
  expect(sendEmail).toHaveBeenCalledTimes(1);
});
