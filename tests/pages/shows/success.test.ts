/** @jest-environment node */
jest.mock('../../../lib/shows/confirm', () => ({ confirmShowOrder: jest.fn() }));
jest.mock('../../../lib/shows/email', () => ({ sendShowTicketEmail: jest.fn() }));
jest.mock('../../../db/client', () => ({ getDb: jest.fn() }));

import { confirmShowOrder } from '../../../lib/shows/confirm';
import { getServerSideProps } from '../../../pages/[locale]/shows/success';

/**
 * 결제수단 목록 화면(`?pay=v2`)으로 연 결제는 success 주소에 `tosskey=api`가 붙는다. SSR이 그 값을
 * 승인 함수의 channel로 넘겨야 같은 쌍의 시크릿(TOSS_API_SECRET_KEY)부터 쓴다(lib/booking/toss.ts).
 */
const run = (query: Record<string, string>) =>
  getServerSideProps({ query, params: { locale: 'ko' }, res: { setHeader: jest.fn() } } as never);
const base = { paymentKey: 'pk', orderId: 'TKT-20261024-ABCDEF12', amount: '25000' };

beforeEach(() => {
  jest.clearAllMocks();
  (confirmShowOrder as jest.Mock).mockResolvedValue({ status: 'error', code: 'not_found' });
});

describe('공연 success — 승인 채널 배선', () => {
  it('tosskey=api면 channel: api로 승인한다', async () => {
    await run({ ...base, tosskey: 'api' });
    expect((confirmShowOrder as jest.Mock).mock.calls[0][0]).toEqual({ orderNo: base.orderId, paymentKey: 'pk', amount: 25000, channel: 'api' });
  });

  it('표식이 없으면 channel 없이(위젯 키부터) 승인한다', async () => {
    await run(base);
    expect((confirmShowOrder as jest.Mock).mock.calls[0][0].channel).toBeUndefined();
  });
});
