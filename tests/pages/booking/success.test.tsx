/** @jest-environment node */

jest.mock('../../../lib/booking/confirm', () => ({ confirmBookingPayment: jest.fn() }));

import { confirmBookingPayment } from '../../../lib/booking/confirm';
import { getServerSideProps } from '../../../pages/[locale]/booking/success';

/**
 * 예약 완료 화면이 고객에게 관리 링크를 반드시 준다.
 *
 * 예약 확인·취소에 필요한 manageToken이 **확인 메일에만** 실려 있었다. 메일 발송이
 * 실패하면 고객은 예약을 스스로 취소할 방법이 없는데, 화면은 발송 결과와 무관하게
 * "예약 확인 메일을 보내드렸습니다"라고 단언했다. 지금은 링크를 화면에 직접 띄우고,
 * 메일이 실패했으면 그 사실을 말한다.
 */

type Ctx = Parameters<typeof getServerSideProps>[0];
type Ok = { props: { outcome: string; manageUrl?: string; emailSent?: boolean } };

const run = async (): Promise<Ok> =>
  (await getServerSideProps({
    query: { paymentKey: 'pk', orderId: 'SNB-1', amount: '275000' },
    params: { locale: 'ko' },
    res: { setHeader: jest.fn() },
  } as unknown as Ctx)) as Ok;

const mockConfirm = confirmBookingPayment as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('예약 완료 화면', () => {
  it('확정되면 관리 링크를 화면에 넘긴다 (메일에만 의존하지 않는다)', async () => {
    mockConfirm.mockResolvedValue({ ok: true, orderNo: 'SNB-1', manageToken: 'tok', emailSent: true });
    const r = await run();
    expect(r.props.manageUrl).toBe('/ko/booking/manage/SNB-1?token=tok');
    expect(r.props.emailSent).toBe(true);
  });

  it('메일이 실패해도 관리 링크는 나오고, 실패 사실을 숨기지 않는다', async () => {
    mockConfirm.mockResolvedValue({ ok: true, orderNo: 'SNB-1', manageToken: 'tok', emailSent: false });
    const r = await run();
    expect(r.props.manageUrl).toBe('/ko/booking/manage/SNB-1?token=tok');
    expect(r.props.emailSent).toBe(false);
  });

  it('새로고침 등 멱등 경로에서도 링크를 준다 (이번 호출이 메일을 보낸 게 아니면 단정하지 않는다)', async () => {
    mockConfirm.mockResolvedValue({ ok: true, orderNo: 'SNB-1', manageToken: 'tok' });
    const r = await run();
    expect(r.props.manageUrl).toBe('/ko/booking/manage/SNB-1?token=tok');
    expect(r.props).not.toHaveProperty('emailSent');
  });

  it('확정 실패면 링크를 만들지 않는다', async () => {
    mockConfirm.mockResolvedValue({ ok: false, code: 'toss_rejected', message: '실패' });
    const r = await run();
    expect(r.props.outcome).toBe('error');
    expect(r.props.manageUrl).toBeUndefined();
  });
});
