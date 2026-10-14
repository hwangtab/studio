import type { Contract } from '../../db/schema';
import { serializeContractForAdmin, serializeContractForAdminList } from './serialize';

const NOW = new Date('2026-10-14T03:00:00Z');

const contract = {
  id: 'c1',
  title: '계약',
  status: 'sent',
  signToken: 'secret-token',
  customerName: '박연주',
  customerEmail: 'p@x.y',
  customerPhone: '010-0000-0000',
  customerBirthdate: '1990-01-01',
  customerAddress: '서울시 은평구 어딘가 1-2',
  roomNumber: 'A-1',
  content: '계약 본문 전체',
  startDate: new Date('2026-10-01T00:00:00Z'),
  endDate: new Date('2026-12-31T00:00:00Z'),
  expiresAt: new Date('2026-10-20T00:00:00Z'),
  sentAt: null,
  signedAt: null,
  rulesAgreedAt: null,
  pdfGeneratedAt: null,
  notifiedAt: null,
  terminatedAt: null,
  purgedAt: null,
  identityVerifiedAt: null,
  signTokenUsedAt: null,
  firstViewedAt: null,
  lastViewedAt: null,
  createdAt: new Date('2026-10-01T00:00:00Z'),
  updatedAt: new Date('2026-10-01T00:00:00Z'),
} as unknown as Contract;

describe('serializeContractForAdminList', () => {
  it('목록에는 생년월일·주소·본문을 싣지 않는다 — 목록은 contract_view 접속기록을 남기지 않는다', () => {
    const row = serializeContractForAdminList(contract, NOW);

    expect(row).not.toHaveProperty('customerBirthdate');
    expect(row).not.toHaveProperty('customerAddress');
    expect(row).not.toHaveProperty('content');
    expect(JSON.stringify(row)).not.toContain('1990-01-01');
    expect(JSON.stringify(row)).not.toContain('은평구');
    expect(JSON.stringify(row)).not.toContain('계약 본문 전체');
  });

  it('목록이 쓰는 칸(이름·연락처·호실·상태·서명 링크)은 그대로다', () => {
    const row = serializeContractForAdminList(contract, NOW);

    expect(row).toMatchObject({ id: 'c1', customerName: '박연주', customerPhone: '010-0000-0000', roomNumber: 'A-1', status: 'sent' });
    expect(row.signUrl).toContain('secret-token');
    expect(row).not.toHaveProperty('signToken');
  });

  it('상세용 직렬화는 전체 칸을 유지한다(상세 열람은 접속기록이 남는다)', () => {
    const row = serializeContractForAdmin(contract, NOW);

    expect(row).toMatchObject({ customerBirthdate: '1990-01-01', content: '계약 본문 전체' });
  });
});
