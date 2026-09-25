import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/router', () => ({
  useRouter: () => ({
    replace: jest.fn(),
    asPath: '/admin/funding/projects/proj-1',
    pathname: '/admin/funding/projects/[id]',
  }),
}));
jest.mock('../../../../components/admin/fundingProjectActions', () => ({ patchFundingProject: jest.fn() }));
// admin-auth는 iron-session(ESM)을 끌고 들어온다 — getServerSideProps는 이 테스트 대상이 아니다.
jest.mock('../../../../lib/contracts/admin-auth', () => ({ authenticateAdminRequest: jest.fn() }));

import AdminFundingProjectDetailPage from '../../../../pages/admin/funding/projects/[id]';
import { patchFundingProject } from '../../../../components/admin/fundingProjectActions';

// jsdom은 scrollIntoView를 구현하지 않는다 — 배너로 스크롤·포커스를 옮기는 코드가 실행되면
// "not a function"으로 죽으므로 여기서 폴리필한다.
beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

const NO_SERVICE = { available: true as const, service: null };

const PROJECT = {
  id: 'proj-1',
  slug: 'demo-project',
  title: '데모 프로젝트',
  reviewStatus: 'submitted' as const,
  status: 'draft',
  hidden: false,
  submittedAt: '2026-09-10T00:00:00.000Z',
  approvedAt: null,
  creatorName: '홍길동',
  creatorEmail: 'creator@example.com',
  goalAmount: 1_000_000,
  startAt: '2026-09-20T00:00:00.000Z',
  endAt: '2026-10-20T00:00:00.000Z',
  summary: '요약',
  content: '본문',
  coverUrl: '/images/cover.jpg',
  reviewNote: null,
  internalNote: null,
  creatorEditedAt: null,
  creator: { contactName: '담당자', phone: '010-0000-0000' },
  rewards: [
    {
      rewardId: 'r1',
      title: '리워드 1',
      description: '설명',
      amount: 30_000,
      totalQuantity: 100,
      requiresShipping: true,
      estimatedDelivery: '2026-11-01',
      locked: false,
    },
  ],
};

beforeEach(() => {
  (patchFundingProject as jest.Mock).mockReset();
});

/**
 * 이 화면의 존재 이유는 "판정 뒤 후속 처리(재검증·메일) 실패를 조용히 넘기지 않는 것"이다
 * — API가 warnings를 돌려주면 판정 네 경로(승인·보완요청·반려·메모저장) 전부에서 배너로
 * 떠야 한다. 조용히 사라지면 운영자가 개설자에게 통보됐다고 착각한다.
 */
describe('경고 배너 — 판정 네 경로 전부', () => {
  it('승인 성공 + warnings → 경고 배너가 뜬다', async () => {
    (patchFundingProject as jest.Mock).mockResolvedValue({ ok: true, warnings: ['개설자 메일 발송에 실패했습니다.'] });
    window.confirm = jest.fn().mockReturnValue(true);
    render(<AdminFundingProjectDetailPage project={PROJECT} payout={null} service={NO_SERVICE} />);
    fireEvent.click(screen.getByRole('button', { name: '승인' }));
    expect(await screen.findByText('개설자 메일 발송에 실패했습니다.')).toBeInTheDocument();
    expect(screen.getByText(/판정은 처리됐지만 후속 처리에 문제가 있었습니다/)).toBeInTheDocument();
  });

  it('보완 요청 성공 + warnings → 경고 배너가 뜬다', async () => {
    (patchFundingProject as jest.Mock).mockResolvedValue({ ok: true, warnings: ['재검증에 실패했습니다.'] });
    window.prompt = jest.fn().mockReturnValue('사진을 다시 올려 주세요.');
    render(<AdminFundingProjectDetailPage project={PROJECT} payout={null} service={NO_SERVICE} />);
    fireEvent.click(screen.getByRole('button', { name: '보완 요청' }));
    expect(await screen.findByText('재검증에 실패했습니다.')).toBeInTheDocument();
  });

  it('반려 성공 + warnings → 경고 배너가 뜬다', async () => {
    (patchFundingProject as jest.Mock).mockResolvedValue({ ok: true, warnings: ['운영자 폴백 알림도 실패했습니다.'] });
    window.prompt = jest.fn().mockReturnValue('요건 미충족');
    window.confirm = jest.fn().mockReturnValue(true);
    render(<AdminFundingProjectDetailPage project={PROJECT} payout={null} service={NO_SERVICE} />);
    fireEvent.click(screen.getByRole('button', { name: '반려' }));
    expect(await screen.findByText('운영자 폴백 알림도 실패했습니다.')).toBeInTheDocument();
  });

  it('메모 저장 성공 + warnings → 경고 배너가 뜬다', async () => {
    (patchFundingProject as jest.Mock).mockResolvedValue({ ok: true, warnings: ['알 수 없는 오류'] });
    render(<AdminFundingProjectDetailPage project={PROJECT} payout={null} service={NO_SERVICE} />);
    fireEvent.click(screen.getByRole('button', { name: '메모 저장' }));
    expect(await screen.findByText('알 수 없는 오류')).toBeInTheDocument();
  });

  it('경고가 뜨면 배너로 스크롤·포커스를 옮긴다', async () => {
    (patchFundingProject as jest.Mock).mockResolvedValue({ ok: true, warnings: ['메일 발송 실패'] });
    render(<AdminFundingProjectDetailPage project={PROJECT} payout={null} service={NO_SERVICE} />);
    fireEvent.click(screen.getByRole('button', { name: '메모 저장' }));
    await screen.findByText('메일 발송 실패');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('warnings가 없는 성공은 짧은 성공 안내만 뜨고 경고 배너는 없다', async () => {
    (patchFundingProject as jest.Mock).mockResolvedValue({ ok: true });
    render(<AdminFundingProjectDetailPage project={PROJECT} payout={null} service={NO_SERVICE} />);
    fireEvent.click(screen.getByRole('button', { name: '메모 저장' }));
    expect(await screen.findByText('메모를 저장했습니다.')).toBeInTheDocument();
    expect(screen.queryByText(/판정은 처리됐지만 후속 처리에 문제가 있었습니다/)).not.toBeInTheDocument();
  });
});

describe('승인 확인창', () => {
  it('공개 사실과 확정될 주소(입력칸이 비어 있으면 개설자가 고른 slug)를 함께 말한다', () => {
    window.confirm = jest.fn().mockReturnValue(false);
    render(<AdminFundingProjectDetailPage project={PROJECT} payout={null} service={NO_SERVICE} />);
    fireEvent.click(screen.getByRole('button', { name: '승인' }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('/funding/demo-project'));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('공개'));
    expect(patchFundingProject).not.toHaveBeenCalled();
  });

  it('slug 입력칸을 바꾸면 확인창·요청 모두 새 값을 쓴다', async () => {
    (patchFundingProject as jest.Mock).mockResolvedValue({ ok: true });
    window.confirm = jest.fn().mockReturnValue(true);
    render(<AdminFundingProjectDetailPage project={PROJECT} payout={null} service={NO_SERVICE} />);
    fireEvent.change(screen.getByDisplayValue('demo-project'), { target: { value: 'new-slug' } });
    fireEvent.click(screen.getByRole('button', { name: '승인' }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('/funding/new-slug'));
    expect(patchFundingProject).toHaveBeenCalledWith('proj-1', { action: 'approve', slug: 'new-slug' });
    // 판정 뒤 setSuccess 등 상태 갱신이 act 밖에서 일어나지 않도록 완료까지 기다린다.
    expect(await screen.findByText(/승인했습니다/)).toBeInTheDocument();
  });

  it('대문자를 넣어도 API가 확정할 소문자 주소를 보여 준다', () => {
    window.confirm = jest.fn().mockReturnValue(false);
    render(<AdminFundingProjectDetailPage project={PROJECT} payout={null} service={NO_SERVICE} />);
    fireEvent.change(screen.getByDisplayValue('demo-project'), { target: { value: 'New-Slug' } });
    expect(screen.getByText('확정될 주소: /funding/new-slug')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '승인' }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('/funding/new-slug'));
  });
});

describe('사유 필수(보완 요청·반려)', () => {
  it('보완 요청은 사유가 없으면 API를 부르지 않는다', () => {
    window.prompt = jest.fn().mockReturnValue('   ');
    render(<AdminFundingProjectDetailPage project={PROJECT} payout={null} service={NO_SERVICE} />);
    fireEvent.click(screen.getByRole('button', { name: '보완 요청' }));
    expect(patchFundingProject).not.toHaveBeenCalled();
  });

  it('반려는 사유가 없으면 confirm까지 가지 않는다', () => {
    window.prompt = jest.fn().mockReturnValue('');
    window.confirm = jest.fn();
    render(<AdminFundingProjectDetailPage project={PROJECT} payout={null} service={NO_SERVICE} />);
    fireEvent.click(screen.getByRole('button', { name: '반려' }));
    expect(window.confirm).not.toHaveBeenCalled();
    expect(patchFundingProject).not.toHaveBeenCalled();
  });
});

it('공개 상태 줄에 hidden이면 숨김 배지를 보여준다', () => {
  render(<AdminFundingProjectDetailPage payout={null} service={NO_SERVICE} project={{ ...PROJECT, hidden: true, status: 'auto' }} />);
  expect(screen.getByText('숨김')).toBeInTheDocument();
  expect(screen.getByText('공개중')).toBeInTheDocument();
});

it('잠긴 리워드는 배지 옆에 텍스트로 이유를 보여준다(툴팁이 아니라)', () => {
  render(
    <AdminFundingProjectDetailPage
      payout={null} service={NO_SERVICE}
      project={{ ...PROJECT, rewards: [{ ...PROJECT.rewards[0], locked: true }] }}
    />,
  );
  expect(screen.getByText('잠김')).toBeInTheDocument();
  expect(screen.getByText(/승인된 리워드라 주소·금액·수량 제한·배송 여부를 바꿀 수 없습니다/)).toBeInTheDocument();
});

it('두 메모 칸은 개설자에게 보이는지를 서로 다르게 말한다', () => {
  render(<AdminFundingProjectDetailPage project={PROJECT} payout={null} service={NO_SERVICE} />);
  expect(screen.getByText('개설자에게 보이는 메모')).toBeInTheDocument();
  expect(screen.getByText('개설자에게 보이지 않습니다.')).toBeInTheDocument();
});

it('승인 뒤 수정된 프로젝트는 심사 화면이 그 사실을 말한다', () => {
  render(<AdminFundingProjectDetailPage payout={null} service={NO_SERVICE} project={{ ...PROJECT, creatorEditedAt: '2026-09-21T05:00:00.000Z' }} />);
  expect(screen.getByText(/승인 뒤 개설자가 수정했습니다/)).toBeInTheDocument();
});

it('수정된 적 없으면 그 표시가 없다', () => {
  render(<AdminFundingProjectDetailPage payout={null} service={NO_SERVICE} project={{ ...PROJECT, creatorEditedAt: null }} />);
  expect(screen.queryByText(/승인 뒤 개설자가 수정했습니다/)).not.toBeInTheDocument();
});

it('내부 기록 저장은 set_internal_note로 나간다', async () => {
  (patchFundingProject as jest.Mock).mockResolvedValue({ ok: true });
  render(<AdminFundingProjectDetailPage project={PROJECT} payout={null} service={NO_SERVICE} />);
  fireEvent.change(screen.getByLabelText('내부 기록'), { target: { value: '메모' } });
  fireEvent.click(screen.getByRole('button', { name: '내부 기록 저장' }));
  expect(patchFundingProject).toHaveBeenCalledWith('proj-1', { action: 'set_internal_note', note: '메모' });
  expect(await screen.findByText(/저장했습니다/)).toBeInTheDocument();
});

describe('스튜디오 서비스', () => {
  it('직접 개설 상태에서 설계 대행을 고르면 set_studio_service로 나간다', async () => {
    (patchFundingProject as jest.Mock).mockResolvedValue({ ok: true });
    render(<AdminFundingProjectDetailPage project={PROJECT} payout={null} service={NO_SERVICE} />);
    expect(screen.getByRole('button', { name: '직접 개설' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '펀딩 설계 대행' }));
    expect(patchFundingProject).toHaveBeenCalledWith('proj-1', { action: 'set_studio_service', kind: 'design' });
  });

  it('지정된 서비스는 약정 설계비와 미입금을 보여 주고 입금 확인을 보낸다', () => {
    (patchFundingProject as jest.Mock).mockResolvedValue({ ok: true });
    render(
      <AdminFundingProjectDetailPage
        project={PROJECT}
        payout={null}
        service={{ available: true, service: { kind: 'release', designFee: 500000, designFeePaidAt: null } }}
      />,
    );
    expect(screen.getByRole('button', { name: '발매 프로젝트 연계' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('미입금')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '입금 확인' }));
    expect(patchFundingProject).toHaveBeenCalledWith('proj-1', { action: 'set_design_fee_paid', paid: true });
  });

  it('직접 개설로 되돌릴 때 확인창을 거절하면 보내지 않는다', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(
      <AdminFundingProjectDetailPage
        project={PROJECT}
        payout={null}
        service={{ available: true, service: { kind: 'design', designFee: 500000, designFeePaidAt: null } }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '직접 개설' }));
    expect(patchFundingProject).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  /**
   * `none`은 행을 지우지 않고 보존한다(lib/funding/projectServices.ts). 그래서 화면은 옛
   * 약정을 설계비 칸으로 되살리지 않되, 다시 지정하면 무엇으로 돌아가는지는 알려야 한다 —
   * 모르면 이중 청구·누락이 난다.
   */
  it('되돌린 프로젝트는 설계비 칸 대신 보존된 옛 약정을 알린다', () => {
    render(
      <AdminFundingProjectDetailPage
        project={PROJECT}
        payout={null}
        service={{ available: true, service: { kind: 'none', designFee: 400000, designFeePaidAt: '2026-10-03T00:00:00.000Z' } }}
      />,
    );
    expect(screen.getByRole('button', { name: '직접 개설' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/직접 개설한 프로젝트입니다/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '입금 확인' })).not.toBeInTheDocument();
    expect(screen.getByText(/이전 약정 보존/)).toHaveTextContent('400,000원');
    expect(screen.getByText(/이전 약정 보존/)).toHaveTextContent('입금 확인');
  });

  it('되돌리기 확인창은 기록이 보존된다고 말한다 — 지워진다고 말하지 않는다', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(
      <AdminFundingProjectDetailPage
        project={PROJECT}
        payout={null}
        service={{ available: true, service: { kind: 'design', designFee: 500000, designFeePaidAt: null } }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '직접 개설' }));
    expect(confirmSpy.mock.calls[0][0]).toContain('보존');
    expect(confirmSpy.mock.calls[0][0]).not.toContain('지워집니다');
    confirmSpy.mockRestore();
  });

  it('0037이 운영 DB에 없으면 버튼 대신 마이그레이션 안내를 띄운다', () => {
    render(<AdminFundingProjectDetailPage project={PROJECT} payout={null} service={{ available: false, reason: 'missing_table' }} />);
    expect(screen.getByText(/마이그레이션 0037/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '펀딩 설계 대행' })).not.toBeInTheDocument();
  });

  // 새로고침으로 낫지 않는 상태에 새로고침을 시키지 않는다.
  it('부분 스키마는 마이그레이션 적용을 안내하고 새로고침을 권하지 않는다', () => {
    render(<AdminFundingProjectDetailPage project={PROJECT} payout={null} service={{ available: false, reason: 'schema_mismatch' }} />);
    expect(screen.getByText(/컬럼 누락/)).toBeInTheDocument();
    expect(screen.getByText(/새로고침으로는 해결되지 않습니다/)).toBeInTheDocument();
  });

  it('그 밖의 장애는 마이그레이션을 권하지 않는다 — 엉뚱한 조치를 막는다', () => {
    render(<AdminFundingProjectDetailPage project={PROJECT} payout={null} service={{ available: false, reason: 'error' }} />);
    expect(screen.getByText(/불러오지 못했습니다/)).toBeInTheDocument();
    expect(screen.queryByText(/마이그레이션 0037/)).not.toBeInTheDocument();
  });
});
