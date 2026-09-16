import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../../../lib/funding/confirm', () => ({ confirmFundingPledge: jest.fn() }));
jest.mock('../../../lib/funding/service', () => ({ findFundingOrderByOrderNo: jest.fn() }));
jest.mock('../../../utils/analytics', () => ({ trackMicroEvent: jest.fn() }));

// eslint-disable-next-line import/first
import FundingSuccessPage from '../../../pages/[locale]/funding/success';
// eslint-disable-next-line import/first
import { trackMicroEvent } from '../../../utils/analytics';

const confirmed = {
  outcome: 'confirmed' as const,
  orderNo: 'FND-20261015-ABCD1234',
  manageUrl: '/ko/funding/manage/FND-20261015-ABCD1234?token=tok',
  projectSlug: 'demo',
  emailSent: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();
});

/**
 * 이 페이지는 확정 뒤 `?o=`로 리다이렉트된 자리라 **측정 대상**이다
 * (lib/analytics/privatePaths.ts의 예외). 전환 이벤트가 여기서 실제로 발화해야
 * 퍼널이 진입 100%·결제 0%로 보이던 문제가 풀린다.
 */
it('확정 화면에서 전환 이벤트가 발화한다', () => {
  render(<FundingSuccessPage {...confirmed} />);
  expect(trackMicroEvent).toHaveBeenCalledWith('funding_pledge_paid', { component: 'funding_success', landing_slug: 'demo' });
  expect(screen.getByRole('link', { name: /펀딩 확인·취소 페이지 열기/ })).toHaveAttribute('href', confirmed.manageUrl);
});

/**
 * 결제가 확정된 뒤에는 PledgeWizard가 남긴 이름·연락처·주소 임시 저장(lib/formDraft.ts)이
 * 세션에 남아 있을 이유가 없다. `projectSlug`를 아는 정상 경로에서는 그 프로젝트 것만 지운다
 * — 다른 프로젝트를 동시에 후원 중이었다면 그 초안까지 지우면 안 된다.
 */
it('확정되면 그 프로젝트의 펀딩 폼 임시 저장을 지운다', () => {
  window.sessionStorage.setItem('studionol:funding-draft:demo', JSON.stringify({ customerName: '홍길동' }));
  window.sessionStorage.setItem('studionol:funding-draft:other', JSON.stringify({ customerName: '다른펀딩' }));
  render(<FundingSuccessPage {...confirmed} />);
  expect(window.sessionStorage.getItem('studionol:funding-draft:demo')).toBeNull();
  expect(window.sessionStorage.getItem('studionol:funding-draft:other')).toBe(JSON.stringify({ customerName: '다른펀딩' }));
});

// 주문에 fundingPledge 연결이 비어 projectSlug를 모르는 예외적인 경우 — 특정할 수 없으니
// 흐름 전체를 지운다. 결제가 끝난 세션에 어느 프로젝트의 것이든 배송지를 남겨 둘 이유는 없다.
it('projectSlug를 모르면 펀딩 임시 저장 전체를 지운다', () => {
  window.sessionStorage.setItem('studionol:funding-draft:demo', JSON.stringify({ customerName: '홍길동' }));
  render(<FundingSuccessPage {...confirmed} projectSlug="" />);
  expect(window.sessionStorage.getItem('studionol:funding-draft:demo')).toBeNull();
});

// 쿠키가 살아 있는 30분 동안 몇 번이고 열릴 수 있다 — 새로고침마다 세면 결제 수가 부풀려진다.
it('같은 주문을 다시 열면 이벤트를 또 보내지 않는다', () => {
  const { unmount } = render(<FundingSuccessPage {...confirmed} />);
  unmount();
  render(<FundingSuccessPage {...confirmed} />);
  expect(trackMicroEvent).toHaveBeenCalledTimes(1);
});

/**
 * 쿠키가 막히거나 30분이 지나면 관리 링크를 만들 근거가 없다. 그래도 결제한 사람이 빈손으로
 * 나가면 안 된다 — 주문번호와 문의처, 그리고 "관리 링크는 메일에 있다"까지는 남겨야 한다.
 */
it('확정을 되살릴 수 없는 화면(unknown)에는 주문번호·문의처가 남고 이벤트는 안 보낸다', () => {
  render(<FundingSuccessPage outcome="unknown" orderNo="FND-20261015-ABCD1234" />);
  expect(trackMicroEvent).not.toHaveBeenCalled();
  expect(screen.getByText(/FND-20261015-ABCD1234/)).toBeInTheDocument();
  expect(screen.getByText(/펀딩 확인 메일에/)).toBeInTheDocument();
  expect(screen.getByText(/010-4255-7893/)).toBeInTheDocument();
  expect(screen.getByText(/hello@studionol.co.kr/)).toBeInTheDocument();
});

it('오류 화면에서도 이벤트를 보내지 않는다', () => {
  render(<FundingSuccessPage outcome="error" message="이미 처리되었거나 만료된 펀딩입니다." />);
  expect(trackMicroEvent).not.toHaveBeenCalled();
  expect(screen.getByText('이미 처리되었거나 만료된 펀딩입니다.')).toBeInTheDocument();
});

it('확인 메일이 실패했으면 링크를 저장하라고 안내한다', () => {
  render(<FundingSuccessPage {...confirmed} emailSent={false} />);
  expect(screen.getByText(/확인 메일을 보내지 못했습니다/)).toBeInTheDocument();
});

/**
 * 결제를 막 마친 사람에게 필요한 것은 "확정되었습니다"가 아니라 파일이다. 예전엔 이 화면에서
 * 후원 확인 페이지로 한 번 더 들어가야 음원을 받을 수 있었다 — 쓸데없는 한 단계였다.
 */
describe('확정 화면의 내려받기', () => {
  it('내려받기 링크가 있으면 화면에 바로 띄운다', () => {
    render(
      <FundingSuccessPage
        {...confirmed}
        downloads={[
          { label: 'MP3 320kbps', key: 'demo/a.zip' },
          { label: 'WAV 24bit 96kHz', key: 'demo/b.zip' },
        ]}
      />
    );
    expect(screen.getByRole('button', { name: /MP3 320kbps 내려받기/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /WAV 24bit 96kHz 내려받기/ })).toBeInTheDocument();
  });

  /**
   * 링크가 아니라 **폼**이어야 한다. 주소를 여는 것만으로 기록이 남으면, 메일 링크를 긁는
   * 검사기·미리보기 봇이 후원자의 청약철회권을 대신 소멸시킨다.
   */
  it('링크가 아니라 POST 폼이다 — 사람이 누른 것만 기록된다', () => {
    const { container } = render(
      <FundingSuccessPage {...confirmed} manageToken="tok" downloads={[{ label: 'MP3', key: 'demo/a.zip' }]} />
    );
    expect(screen.queryByRole('link', { name: /MP3 내려받기/ })).toBeNull();
    const form = container.querySelector('form[action="/api/funding/download"]') as HTMLFormElement;
    expect(form).not.toBeNull();
    expect(form.method).toBe('post');
    // 저장소 주소는 화면 어디에도 없다 — 나가는 값은 키뿐이다.
    expect(container.innerHTML).not.toContain('r2.dev');
    expect(container.innerHTML).not.toContain('r2.cloudflarestorage.com');
    const value = (name: string) => (form.querySelector(`input[name="${name}"]`) as HTMLInputElement)?.value;
    expect(value('file')).toBe('demo/a.zip');
    expect(value('token')).toBe('tok');
  });

  it('내려받기와 함께 청약철회 제한을 고지한다', () => {
    render(<FundingSuccessPage {...confirmed} downloads={[{ label: 'MP3', key: 'demo/a.zip' }]} />);
    expect(screen.getByText(/청약철회가 제한됩니다/)).toBeInTheDocument();
  });

  it('내려받을 것이 없으면 아무것도 띄우지 않는다 — 배송 리워드 서포터에게 빈 영역을 보이지 않는다', () => {
    render(<FundingSuccessPage {...confirmed} downloads={[]} />);
    expect(screen.queryByText(/내려받기/)).toBeNull();
  });

  it('확정되지 않은 화면에는 내려받기가 나가지 않는다', () => {
    render(<FundingSuccessPage outcome="unknown" orderNo="FND-1" />);
    expect(screen.queryByText(/내려받기/)).toBeNull();
  });
});
