import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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
      subscriptionClosed={false}
      occupyingSubscriptionCount={occupyingSubscriptionCount}
    />,
  );
};

afterEach(() => jest.restoreAllMocks());

beforeEach(() => {
  (mutateContract as jest.Mock).mockReset().mockResolvedValue({ ok: true });
});

describe('이용 종료 확인창', () => {
  // 사유는 입력창 겸 확인창(useAdminDialog)이 받는다 — 예전 window.prompt.
  const clickTerminate = () => fireEvent.click(screen.getByRole('button', { name: '이용 종료 처리' }));

  it('연결된 구독이 있으면 해지와 고객 메일을 미리 알린다', () => {
    renderPage({}, 2);
    clickTerminate();
    expect(screen.getByRole('dialog')).toHaveTextContent('연결된 구독 2건이 함께 해지되고 고객에게 해지 안내 메일이 나갑니다');
  });

  it('구독이 없으면 그 문구를 넣지 않는다', () => {
    renderPage({}, 0);
    clickTerminate();
    expect(screen.getByRole('dialog')).not.toHaveTextContent('구독');
  });

  it('건수를 못 읽었으면 숨기지 않고 있을 수 있다고 알린다', () => {
    renderPage({}, null);
    clickTerminate();
    expect(screen.getByRole('dialog')).toHaveTextContent('건수를 확인하지 못했습니다');
  });

  it('사유가 비면 창 안에서 막고, 사유를 적으면 종료 요청을 보낸다', async () => {
    renderPage({}, 1);
    clickTerminate();
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '이용 종료' }));
    expect(await within(dialog).findByText('종료 사유를 입력해 주세요.')).toBeInTheDocument();
    expect(mutateContract).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText(/이용 종료 사유/), { target: { value: '기간 만료' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '이용 종료' }));
    await waitFor(() => expect(mutateContract).toHaveBeenCalledWith('c1', 'terminate', { reason: '기간 만료' }));
  });
});

describe('개인정보가 파기된 계약', () => {
  it('재발송·복제 입구를 띄우지 않고 이유를 알린다', () => {
    renderPage({ status: 'expired', purgedAt: D('2026-09-01T00:00:00Z'), customerName: '(개인정보 파기됨)' }, 0);
    expect(screen.queryByRole('button', { name: '재발송' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '복제해서 새 계약' })).not.toBeInTheDocument();
    expect(screen.getByText(/개인정보가 파기되어 재발송·복제할 수 없습니다/)).toBeInTheDocument();
  });

  it('파기되지 않은 만료 계약에는 재발송·복제가 있다', () => {
    renderPage({ status: 'expired' }, 0);
    expect(screen.getByRole('button', { name: '재발송' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '복제해서 새 계약' })).toBeInTheDocument();
  });
});

describe('관리자 작업 이력', () => {
  const renderWithEvents = (adminEvents: Array<{ id: string; action: string; actor: string; fromStatus: string | null; toStatus: string | null; at: string }>) => {
    const c = baseContract({});
    render(
      <AdminContractDetailPage
        contract={serializeContractForAdmin(c, NOW)}
        signatures={[]}
        clauses={[]}
        attachments={[]}
        rulesContent=""
        auditTrail={serializeAuditTrail(buildAuditTrail(c as never))}
        subscriptionId={null}
        subscriptionClosed={false}
        occupyingSubscriptionCount={0}
        adminEvents={adminEvents}
      />,
    );
  };

  it('누가 무슨 행위를 했는지, 상태가 바뀐 행위는 전후 상태와 함께 보인다', () => {
    renderWithEvents([
      { id: 'e2', action: 'terminate', actor: 'minji', fromStatus: 'signed', toStatus: 'terminated', at: '2026-10-14T05:00:00.000Z' },
      { id: 'e1', action: 'resend-signed', actor: 'kyungha', fromStatus: 'signed', toStatus: 'signed', at: '2026-10-13T05:00:00.000Z' },
    ]);
    const section = screen.getByRole('region', { name: '관리자 작업 이력' });
    expect(section).toHaveTextContent('이용 종료 처리');
    expect(section).toHaveTextContent('minji');
    expect(section).toHaveTextContent('서명완료 → 이용종료');
    expect(section).toHaveTextContent('완료 메일 재발송');
    // 상태가 안 바뀐 행위는 화살표를 그리지 않는다.
    expect(section.textContent?.match(/→/g)).toHaveLength(1);
  });

  it('이력이 없으면 이력이 2026-10-15 이후 작업부터 남는다고 알린다', () => {
    renderWithEvents([]);
    expect(screen.getByRole('region', { name: '관리자 작업 이력' })).toHaveTextContent('기록된 변경이 없습니다');
  });
});
