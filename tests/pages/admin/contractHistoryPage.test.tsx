import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/router', () => ({ useRouter: () => ({ replace: jest.fn(), asPath: '/admin/contracts/history', pathname: '/admin/contracts/history' }) }));
jest.mock('../../../lib/contracts/admin-auth', () => ({ authenticateAdminRequest: jest.fn() }));

import AdminContractHistoryPage from '../../../pages/admin/contracts/history';

const FILTER = { actor: '', action: '', contract: '', from: '', to: '' };
const NAMES = { kyungha: '황경하' };
const EVENTS = [
  { id: 'e2', contractId: 'c1', action: 'terminate', actor: 'minji', fromStatus: 'signed', toStatus: 'terminated', at: '2026-10-14T01:00:00.000Z', roomNumber: 'A-1' },
  { id: 'e1', contractId: 'gone', action: 'delete', actor: 'kyungha', fromStatus: 'draft', toStatus: null, at: '2026-10-12T01:00:00.000Z', roomNumber: null },
];

it('행위·수행자·상태 변화를 그리고, 삭제된 계약은 링크 대신 삭제됨으로 보인다', () => {
  render(<AdminContractHistoryPage events={EVENTS} actors={['kyungha', 'minji']} actorNames={NAMES} filter={FILTER} truncated={false} />);
  const rows = screen.getAllByRole('row');
  expect(rows[1]).toHaveTextContent('이용 종료 처리');
  expect(rows[1]).toHaveTextContent('서명완료 → 이용종료');
  expect(screen.getByRole('link', { name: '상세' })).toHaveAttribute('href', '/admin/contracts/c1');
  expect(rows[2]).toHaveTextContent('삭제됨');
  expect(rows[2]).toHaveTextContent('작성중 → 삭제');
});

it('수행자는 id가 아니라 이름으로 보이고(표에 없으면 id 그대로), 필터 값은 id다', () => {
  render(<AdminContractHistoryPage events={EVENTS} actors={['kyungha', 'minji']} actorNames={NAMES} filter={FILTER} truncated={false} />);
  const rows = screen.getAllByRole('row');
  expect(rows[2]).toHaveTextContent('황경하');
  expect(rows[2]).not.toHaveTextContent('kyungha');
  expect(rows[1]).toHaveTextContent('minji');
  expect(screen.getByRole('option', { name: '황경하' })).toHaveValue('kyungha');
});

it('CSV 링크가 지금 적용된 필터를 그대로 싣는다', () => {
  render(<AdminContractHistoryPage events={EVENTS} actors={['minji']} actorNames={NAMES} filter={{ ...FILTER, actor: 'minji', from: '2026-10-01' }} truncated={false} />);
  expect(screen.getByRole('link', { name: 'CSV 내려받기' })).toHaveAttribute('href', '/api/admin/contracts/history-export?actor=minji&from=2026-10-01');
});

it('표가 없을 때의 오류와 잘림 안내를 보여 준다', () => {
  const { rerender } = render(<AdminContractHistoryPage events={[]} actors={[]} actorNames={NAMES} filter={FILTER} truncated={false} error="마이그레이션 0075이 적용됐는지 확인해 주세요." />);
  expect(screen.getByRole('alert')).toHaveTextContent('0075');
  rerender(<AdminContractHistoryPage events={EVENTS} actors={[]} actorNames={NAMES} filter={FILTER} truncated />);
  expect(screen.getByText(/최근 200건만 표시합니다/)).toBeInTheDocument();
});
