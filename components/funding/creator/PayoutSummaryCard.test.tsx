import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import type { BusinessProfileView } from '../../../lib/funding/businessProfile';
import { PayoutSummaryCard } from './PayoutSummaryCard';
import type { EditorPayoutSummary } from './types';

const BUSINESS: BusinessProfileView = {
  businessNumber: '7537400653',
  businessName: '스튜디오 놀',
  representativeName: '황경하',
  ntsStatus: 'active',
  ntsTaxTypeCode: '01',
  ntsTaxTypeLabel: '부가가치세 일반과세자',
  ntsCheckedAt: '2026-10-14T03:00:00.000Z',
  ntsCheckError: null,
  hasCertificate: true,
  certificateUploadedAt: '2026-10-14T03:00:00.000Z',
};

const INVOICE: EditorPayoutSummary = {
  registered: true, accountLast4: '9012', taxType: 'invoice', residentNumberRegistered: false, withheldPayoutRecorded: false, keepsResidentNumber: false, keepsBusinessProfile: false,
  business: BUSINESS,
};

const WITHHOLDING: EditorPayoutSummary = {
  registered: true, accountLast4: '1234', taxType: 'withholding', residentNumberRegistered: true, withheldPayoutRecorded: false, keepsResidentNumber: false, keepsBusinessProfile: false,
  business: null,
};

describe('PayoutSummaryCard', () => {
  it('사업자 요약 — 번호를 하이픈 모양으로, 상호·국세청 상태·사업자등록증 등록 여부를 보인다', () => {
    render(<PayoutSummaryCard summary={INVOICE} />);
    expect(screen.getByText('753-74-00653')).toBeInTheDocument();
    expect(screen.getByText('스튜디오 놀')).toBeInTheDocument();
    expect(screen.getByText('정상')).toBeInTheDocument();
    expect(screen.getByText('사업자 — 세금계산서')).toBeInTheDocument();
    expect(screen.getByText('뒤 4자리 9012', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('사업자등록증')).toBeInTheDocument();
  });

  it('원천징수 요약 — 주민등록번호는 등록 여부만', () => {
    render(<PayoutSummaryCard summary={WITHHOLDING} />);
    expect(screen.getByText('개인 — 원천징수')).toBeInTheDocument();
    expect(screen.getByText('주민등록번호')).toBeInTheDocument();
    expect(screen.queryByText('사업자등록번호')).toBeNull();
  });

  it('미등록이면 아직 없다고 말한다', () => {
    render(<PayoutSummaryCard summary={{ ...WITHHOLDING, registered: false, accountLast4: null, taxType: null, residentNumberRegistered: false }} />);
    expect(screen.getAllByText('아직 없어요').length).toBeGreaterThan(0);
  });

  it('고치는 곳은 계정 화면 하나다 — 링크 주소가 맞고, 입력 칸이 하나도 없다', () => {
    const { container } = render(<PayoutSummaryCard summary={INVOICE} />);
    expect(screen.getByRole('link', { name: '정산 정보 고치기' })).toHaveAttribute('href', '/ko/funding/creator/payout');
    expect(screen.getByText('정산 정보는 계정에 한 벌이라 펀딩·공연·상점 정산에 함께 쓰여요.', { exact: false })).toBeInTheDocument();
    expect(container.querySelectorAll('input, select, textarea')).toHaveLength(0);
  });
});
