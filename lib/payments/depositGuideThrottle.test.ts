jest.mock('../booking/rate-limit', () => ({ consumeRateLimit: jest.fn() }));
jest.mock('../email/resend', () => ({ sendEmail: jest.fn() }));
jest.mock('../../db/client', () => ({ getDb: jest.fn() }));

import { consumeRateLimit } from '../booking/rate-limit';
import { sendEmail } from '../email/resend';
import { sendDepositGuideEmails } from './bankDepositOrders';
import { allowCustomerDepositGuideMail, DEPOSIT_GUIDE_MAILS_PER_ADDRESS_PER_HOUR, normalizeMailbox } from './depositGuideThrottle';

const mockRate = consumeRateLimit as jest.Mock;
const mockSend = sendEmail as jest.Mock;

beforeEach(() => {
  mockRate.mockReset();
  mockSend.mockReset().mockResolvedValue({ ok: true });
});

describe('normalizeMailbox — 같은 받은편지함으로 가는 별칭은 같은 키', () => {
  it.each([
    ['Victim@Example.com', 'victim@example.com'],
    ['victim+1@example.com', 'victim@example.com'],
    ['v.ic.tim+x@gmail.com', 'victim@gmail.com'],
    ['victim@googlemail.com', 'victim@gmail.com'],
    ['first.last@naver.com', 'first.last@naver.com'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeMailbox(input)).toBe(expected);
  });
});

it('별칭이 달라도 같은 상한 키를 쓰고, 상한은 시간당 정해진 수다', async () => {
  mockRate.mockResolvedValue(true);
  await allowCustomerDepositGuideMail('Victim+a@gmail.com');
  await allowCustomerDepositGuideMail('v.ictim@gmail.com');
  const [k1, limit, window] = mockRate.mock.calls[0];
  expect(mockRate.mock.calls[1][0]).toBe(k1);
  expect(k1).not.toContain('victim'); // 주소는 해시로만
  expect(limit).toBe(DEPOSIT_GUIDE_MAILS_PER_ADDRESS_PER_HOUR);
  expect(window).toBe(3600);
});

it('skipCustomer면 고객 메일은 건너뛰고 운영자 알림만 보낸다(실패로 세지 않는다)', async () => {
  const failure = await sendDepositGuideEmails({
    orderNo: 'SNB-1', customerName: '김입금', customerEmail: 'victim@example.com', customerPhone: '010-0000-0000',
    totalAmount: 10000, deadline: new Date('2026-10-07T06:00:00Z'), kindLabel: '스튜디오 예약',
    applicantLabel: '예약하신 분', summaryLines: [], manageUrl: 'https://x', adminUrl: 'https://y', skipCustomer: true,
  } as Parameters<typeof sendDepositGuideEmails>[0]);
  expect(failure).toBeNull();
  expect(mockSend).toHaveBeenCalledTimes(1);
  expect(mockSend.mock.calls[0][0].to).not.toBe('victim@example.com');
});
