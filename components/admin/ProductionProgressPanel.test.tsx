import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/router', () => ({ useRouter: () => ({ replace: jest.fn(), asPath: '/admin/contracts/production/c1' }) }));

import type { ProductionContractEvent, ProductionEventType } from '../../db/schema';
import { computeProductionLedger } from '../../lib/contracts/production/ledger';
import { buildAdminProgressView } from '../../lib/contracts/production/progress-view';
import { buildDefaultProductionTerms, buildDefaultReworkTerms, type ProductionTerms } from '../../lib/contracts/production/terms';
import ProductionProgressPanel from './ProductionProgressPanel';

const kst = (local: string) => new Date(`${local}+09:00`);
const SIGNED = kst('2026-11-02T10:00:00');
let seq = 0;
const ev = (type: ProductionEventType, at: string, extra: Partial<ProductionContractEvent> = {}): ProductionContractEvent => {
  seq += 1;
  return {
    id: `e${seq}`,
    contractId: 'c1',
    seq,
    type,
    stage: null,
    song: null,
    amount: null,
    dataJson: null,
    occurredAt: kst(at),
    recordedAt: kst(at),
    actor: 'admin:kyungha',
    actorIp: null,
    voidsEventId: null,
    noticeStatus: 'sent',
    noticeSentAt: kst(at),
    noticeError: null,
    createdAt: kst(at),
    ...extra,
  };
};

const renderPanel = (terms: ProductionTerms, events: ProductionContractEvent[]) => {
  const ledger = computeProductionLedger({ terms, signedAt: SIGNED, events, now: kst('2026-11-25T09:00:00') });
  return render(<ProductionProgressPanel contractId="c1" view={buildAdminProgressView(terms, ledger, events)} editable={false} />);
};

describe('AI 리워크 진행 패널', () => {
  const rework = buildDefaultReworkTerms('small');

  it('3회 분할이면 중간금 줄이 보이고, 편곡 승인 전에는 기한이 없다', () => {
    renderPanel(rework, [ev('payment_received', '2026-11-03T09:00:00', { amount: 500_000 })]);
    expect(screen.getByText('중간금 300,000원')).toBeInTheDocument();
    expect(screen.getByText('편곡 승인 후')).toBeInTheDocument();
  });

  it('지급 비율 해지 미리보기 — 받은 금액 × 단계 비율, 항목표 행 없음', () => {
    renderPanel(rework, [
      ev('payment_received', '2026-11-03T09:00:00', { amount: 500_000 }),
      ev('source_received', '2026-11-03T10:00:00'),
      ev('kickoff', '2026-11-04T10:00:00'),
    ]);
    const summary = screen.getByText(/받은 금액 500,000원 × 70%/);
    expect(summary).toHaveTextContent('환불 350,000원');
    expect(screen.queryByText('AI 리워크 제작 일체 (제2조)')).not.toBeInTheDocument();
    expect(screen.getByText(/스튜디오 사정으로 해지하면\(제10조 4항\) 받은 금액 전액 500,000원/)).toBeInTheDocument();
  });
});

describe('회귀 — 항목표 정산 계약', () => {
  it('싱글은 항목표 행과 공제 문구 그대로, 중간금 줄 없음', () => {
    const terms = buildDefaultProductionTerms();
    renderPanel(terms, [ev('payment_received', '2026-11-03T09:00:00', { amount: terms.amount.deposit }), ev('kickoff', '2026-11-04T10:00:00')]);
    expect(screen.getByText('편곡 (제2조 2호)')).toBeInTheDocument();
    expect(screen.getByText(/− 공제/)).toBeInTheDocument();
    expect(screen.queryByText(/^중간금/)).not.toBeInTheDocument();
  });
});

describe('AI 리워크 자료 이름', () => {
  it('기록 줄과 작업 기간 칸이 "AI 데모 파일"로 읽힌다', () => {
    const rework = buildDefaultReworkTerms('none');
    renderPanel(rework, [ev('payment_received', '2026-11-03T09:00:00', { amount: 500_000 }), ev('source_received', '2026-11-03T10:00:00')]);
    expect(screen.getByText('AI 데모 파일 수령')).toBeInTheDocument();
    expect(screen.queryByText('1차 완성본 수령')).not.toBeInTheDocument();
  });

  it('작업 시작 전 칸 — 리워크는 AI 데모 파일, 싱글은 1차 완성본', () => {
    const { unmount } = renderPanel(buildDefaultReworkTerms('small'), []);
    expect(screen.getByText('계약금·AI 데모 파일 대기')).toBeInTheDocument();
    unmount();
    renderPanel(buildDefaultProductionTerms(), []);
    expect(screen.getByText('계약금·1차 완성본 대기')).toBeInTheDocument();
  });
});
