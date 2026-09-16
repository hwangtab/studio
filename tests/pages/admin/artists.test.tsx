/**
 * 관리자 아티스트 화면 — 닫힘/열림 안내, 정산 표의 버튼이 상태에 맞게 나오는지.
 */
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/router', () => ({ useRouter: () => ({ replace: jest.fn(), push: jest.fn(), asPath: '/admin/artists', pathname: '/admin/artists' }) }));
jest.mock('../../../components/admin/contractActions', () => ({ logoutAdmin: jest.fn() }));
jest.mock('../../../lib/contracts/admin-auth', () => ({ authenticateAdminRequest: jest.fn() }));
jest.mock('../../../lib/artistSupport/payout', () => ({
  ...jest.requireActual('../../../lib/artistSupport/payout'),
  buildAllArtistPayoutPreviews: jest.fn(),
  listArtistPayouts: jest.fn(),
}));
jest.mock('../../../lib/artistSupport/supporters', () => ({ countSupportersByArtist: jest.fn() }));

import AdminArtistsPage from '../../../pages/admin/artists/index';

const base = {
  period: '2026-09',
  artists: [{ slug: 'jai', name: '자이', supportActive: true, taxType: 'withholding', supporterCount: 3 }],
  history: [],
};

const preview = {
  artistSlug: 'jai', artistName: '자이', taxType: 'withholding' as const, period: '2026-09', subscriberCount: 3,
  grossAmount: 30000, refundAmount: 0, supplyAmount: 27273, shareAmount: 24546, withholdingAmount: 810, netAmount: 23736,
};

it('닫혀 있으면 여는 방법을 안내한다', () => {
  render(<AdminArtistsPage {...base} supportOpen={false} previews={[]} />);
  expect(screen.getByText(/구독 신청이 닫혀 있습니다/)).toBeInTheDocument();
  expect(screen.getByText('NEXT_PUBLIC_ARTIST_SUPPORT_OPEN=1')).toBeInTheDocument();
});

it('미기록 정산에는 "정산 기록", 이체 대기에는 "지급 완료", 완료에는 버튼이 없다', () => {
  const { rerender } = render(<AdminArtistsPage {...base} supportOpen previews={[{ ...preview, recorded: null }]} />);
  expect(screen.getByRole('button', { name: '정산 기록' })).toBeInTheDocument();
  expect(screen.getByText('23,736원')).toBeInTheDocument();

  rerender(<AdminArtistsPage {...base} supportOpen previews={[{ ...preview, recorded: { id: 'p1', status: 'pending', netAmount: 23736, paidAt: null, memo: null } }]} />);
  expect(screen.getByRole('button', { name: '지급 완료' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '정산 기록' })).not.toBeInTheDocument();

  rerender(<AdminArtistsPage {...base} supportOpen previews={[{ ...preview, recorded: { id: 'p1', status: 'paid', netAmount: 23736, paidAt: '2026-10-05T00:00:00.000Z', memo: null } }]} />);
  expect(screen.queryByRole('button', { name: /정산 기록|지급 완료/ })).not.toBeInTheDocument();
  expect(screen.getAllByText('지급 완료').length).toBeGreaterThan(0);
});

it('기록 뒤 환불이 들어와 숫자가 달라지면 경고한다', () => {
  render(<AdminArtistsPage {...base} supportOpen previews={[{ ...preview, netAmount: 15824, recorded: { id: 'p1', status: 'pending', netAmount: 23736, paidAt: null, memo: null } }]} />);
  expect(screen.getByText(/기록 23,736원과 다름/)).toBeInTheDocument();
});

it('후원자 CSV 링크가 아티스트마다 있다', () => {
  render(<AdminArtistsPage {...base} supportOpen previews={[]} />);
  expect(screen.getByRole('link', { name: 'CSV' })).toHaveAttribute('href', '/api/admin/artists/jai/supporters-export');
});
