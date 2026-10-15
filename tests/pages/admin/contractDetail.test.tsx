import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/router', () => ({
  useRouter: () => ({ replace: jest.fn(), asPath: '/admin/contracts/c1', pathname: '/admin/contracts/[id]' }),
}));
jest.mock('../../../lib/contracts/admin-auth', () => ({ authenticateAdminRequest: jest.fn() }));
jest.mock('../../../components/admin/contractActions', () => ({
  mutateContract: jest.fn(),
  logoutAdmin: jest.fn(),
  copyToClipboard: jest.fn(),
  downloadContractPdf: jest.fn(),
}));
jest.mock('../../../components/admin/subscriptionActions', () => ({ createSubscription: jest.fn() }));

import AdminContractDetailPage from '../../../pages/admin/contracts/[id]/index';
import { mutateContract } from '../../../components/admin/contractActions';
import { serializeContractForAdmin } from '../../../lib/contracts/serialize';
import { buildAuditTrail, serializeAuditTrail } from '../../../lib/contracts/audit-trail';
import type { Contract } from '../../../db/schema';

const NOW = new Date('2026-10-14T03:00:00Z');
const D = (iso: string) => new Date(iso);

const baseContract = (over: Partial<Contract>) =>
  ({
    id: 'c1', title: '계약', status: 'signed', signToken: 'tok', customerName: '박연주', customerEmail: 'p@x.y',
    customerPhone: '010-0000-0000', customerBirthdate: '1990-01-01', customerAddress: '서울', roomNumber: 'A-1',
    content: '본문', monthlyRent: 300000, depositAmount: 0, paymentDay: 5,
    startDate: D('2026-01-01T00:00:00Z'), endDate: D('2026-06-30T00:00:00Z'), expiresAt: D('2026-02-01T00:00:00Z'),
    sentAt: D('2026-01-01T00:00:00Z'), signedAt: D('2026-01-02T00:00:00Z'), rulesAgreedAt: null, pdfGeneratedAt: null,
    pdfUrl: 'x', notifiedAt: D('2026-01-02T00:00:00Z'), terminatedAt: null, purgedAt: null, identityVerifiedAt: null,
    signTokenUsedAt: null, firstViewedAt: null, lastViewedAt: null,
    createdAt: D('2026-01-01T00:00:00Z'), updatedAt: D('2026-01-01T00:00:00Z'),
    signatures: [], contractClauses: [], contractAttachments: [],
    ...over,
  }) as unknown as Contract & { signatures: never[]; contractClauses: never[]; contractAttachments: never[] };

const renderPage = (over: Partial<Contract>, occupyingSubscriptionCount: number | null) => {
  const c = baseContract(over);
  render(
    <AdminContractDetailPage
      contract={serializeContractForAdmin(c, NOW)}
      signatures={[]}
      clauses={[]}
      attachments={[]}
      rulesContent=""
      auditTrail={serializeAuditTrail(buildAuditTrail(c as never))}
      subscriptionId={null}
      occupyingSubscriptionCount={occupyingSubscriptionCount}
    />,
  );
};

afterEach(() => jest.restoreAllMocks());

beforeEach(() => {
  (mutateContract as jest.Mock).mockReset().mockResolvedValue({ ok: true });
});

describe('이용 종료 확인창', () => {
  const clickTerminate = () => fireEvent.click(screen.getByRole('button', { name: '이용 종료 처리' }));

  it('연결된 구독이 있으면 해지와 고객 메일을 미리 알린다', () => {
    const prompt = jest.spyOn(window, 'prompt').mockReturnValue(null);
    renderPage({}, 2);
    clickTerminate();
    expect(prompt).toHaveBeenCalledWith(expect.stringContaining('연결된 구독 2건이 함께 해지되고 고객에게 해지 안내 메일이 나갑니다'));
  });

  it('구독이 없으면 그 문구를 넣지 않는다', () => {
    const prompt = jest.spyOn(window, 'prompt').mockReturnValue(null);
    renderPage({}, 0);
    clickTerminate();
    expect(prompt.mock.calls[0][0]).not.toContain('구독');
  });

  it('건수를 못 읽었으면 숨기지 않고 있을 수 있다고 알린다', () => {
    const prompt = jest.spyOn(window, 'prompt').mockReturnValue(null);
    renderPage({}, null);
    clickTerminate();
    expect(prompt).toHaveBeenCalledWith(expect.stringContaining('건수를 확인하지 못했습니다'));
  });

  it('사유를 적으면 종료 요청을 보낸다', async () => {
    jest.spyOn(window, 'prompt').mockReturnValue('기간 만료');
    renderPage({}, 1);
    clickTerminate();
    await waitFor(() => expect(mutateContract).toHaveBeenCalledWith('c1', 'terminate', { reason: '기간 만료' }));
  });
});

describe('개인정보가 파기된 계약', () => {
  it('재발송·복제 입구를 띄우지 않고 이유를 알린다', () => {
    renderPage({ status: 'expired', purgedAt: D('2026-09-01T00:00:00Z'), customerName: '(개인정보 파기됨)' }, 0);
    expect(screen.queryByRole('button', { name: '재발송' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '복제해서 새 계약' })).not.toBeInTheDocument();
    expect(screen.getByText(/개인정보가 파기되어 재발송·복제할 수 없습니다/)).toBeInTheDocument();
  });

  it('파기되지 않은 만료 계약에는 재발송·복제가 있다', () => {
    renderPage({ status: 'expired' }, 0);
    expect(screen.getByRole('button', { name: '재발송' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '복제해서 새 계약' })).toBeInTheDocument();
  });
});
