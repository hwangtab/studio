/**
 * 아티스트 페이지 구독 자리 — 닫힘/열림 두 상태와 제출 흐름.
 * 열렸을 때 금액은 등급 id로만 보내고, 성공하면 카드 등록 화면으로 문서 이동한다.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../../utils/analytics', () => ({ trackMicroEvent: jest.fn(), trackLeadEvent: jest.fn() }));
jest.mock('../common/HeroKakaoCta', () => ({
  __esModule: true,
  default: ({ label }: { label: string }) => <a href="https://open.kakao.com/x">{label}</a>,
}));

import ArtistSupportCallout from './ArtistSupportCallout';

const labels = {
  title: '이 아티스트 구독하기',
  pending: '구독 오픈을 준비하고 있습니다',
  pendingBody: '정기 구독이 열리면 알려드릴게요.',
  pendingLabel: '카카오톡으로 소식 받기',
  tierTitle: '매월 얼마를 구독할까요',
  shareNote: '구독료 공급가의 {{percent}}%가 아티스트에게 매월 지급됩니다.',
  perMonth: '월 {{amount}}원',
  nameLabel: '이름',
  emailLabel: '이메일',
  phoneLabel: '휴대폰 (선택)',
  displayNameLabel: '구독자 명단에 표시할 이름',
  displayNameHint: '비우면 이름을 씁니다.',
  consentLabel: '명단에 제 이름을 올려도 됩니다',
  submit: '구독 시작하기',
  submitting: '잠시만요...',
  agreeNote: '다음 화면에서 카드를 등록하면 첫 달치가 결제됩니다.',
  supportersTitle: '함께 구독하는 사람들',
  supportersCount: '{{count}}명',
  supportersEmpty: '첫 구독자가 되어 주세요.',
  errorGeneric: '신청을 처리하지 못했습니다.',
};
const artist = { slug: 'jai', name: '자이' };

const originalFetch = global.fetch;
const originalAssign = window.location.assign;
beforeEach(() => {
  global.fetch = jest.fn();
  Object.defineProperty(window, 'location', { value: { ...window.location, assign: jest.fn() }, writable: true });
});
afterEach(() => {
  global.fetch = originalFetch;
  Object.defineProperty(window, 'location', { value: { ...window.location, assign: originalAssign }, writable: true });
});

it('닫혀 있으면 등급 카드 없이 준비 중 안내와 카카오 링크만 보인다', () => {
  render(<ArtistSupportCallout artist={artist} locale="ko" kakaoUrl="https://open.kakao.com/x" supportOpen={false} labels={labels} />);
  expect(screen.getByText('구독 오픈을 준비하고 있습니다')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '카카오톡으로 소식 받기' })).toBeInTheDocument();
  expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});

it('열려 있으면 등급 세 개와 지급률 문구가 보이고, 명단을 불러온다', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ ok: true, count: 2, supporters: [{ displayName: '별명A', since: '2026-09-01' }] }) });
  render(<ArtistSupportCallout artist={artist} locale="ko" kakaoUrl="x" supportOpen labels={labels} />);

  expect(screen.getAllByRole('radio')).toHaveLength(3);
  expect(screen.getByText('월 5,000원')).toBeInTheDocument();
  expect(screen.getByText('월 10,000원')).toBeInTheDocument();
  expect(screen.getByText('월 30,000원')).toBeInTheDocument();
  expect(screen.getByText(/공급가의 90%가 아티스트에게/)).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText('별명A')).toBeInTheDocument());
  expect(screen.getByText('2명')).toBeInTheDocument();
});

it('제출하면 등급 id만 보내고 카드 등록 URL로 문서 이동한다 — 금액은 보내지 않는다', async () => {
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, count: 0, supporters: [] }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, setupUrl: 'https://studionol.co.kr/ko/subscribe/s1?token=t' }) });
  render(<ArtistSupportCallout artist={artist} locale="ko" kakaoUrl="x" supportOpen labels={labels} />);

  fireEvent.click(screen.getByLabelText(/든든하게/));
  fireEvent.change(screen.getByLabelText(/^이름/), { target: { value: '김후원' } });
  fireEvent.change(screen.getByLabelText(/^이메일/), { target: { value: 'fan@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: '구독 시작하기' }));

  await waitFor(() => expect(window.location.assign).toHaveBeenCalledWith('https://studionol.co.kr/ko/subscribe/s1?token=t'));
  const [url, init] = (global.fetch as jest.Mock).mock.calls[1];
  expect(url).toBe('/api/artists/support');
  const body = JSON.parse(init.body);
  expect(body).toMatchObject({ artistSlug: 'jai', tierId: 'patron', customerName: '김후원', customerEmail: 'fan@example.com', displayConsent: true });
  expect(body).not.toHaveProperty('totalAmount');
});

it('서버가 거절하면 문구를 보여주고 이동하지 않는다', async () => {
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, count: 0, supporters: [] }) })
    .mockResolvedValueOnce({ ok: false, json: async () => ({ ok: false, message: '아직 열리지 않았습니다.' }) });
  render(<ArtistSupportCallout artist={artist} locale="ko" kakaoUrl="x" supportOpen labels={labels} />);
  fireEvent.change(screen.getByLabelText(/^이름/), { target: { value: '김' } });
  fireEvent.change(screen.getByLabelText(/^이메일/), { target: { value: 'a@b.co' } });
  fireEvent.click(screen.getByRole('button', { name: '구독 시작하기' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('아직 열리지 않았습니다.');
  expect(window.location.assign).not.toHaveBeenCalled();
});
