/** @jest-environment node */

import type { ProductionContract, ProductionContractEvent } from '../../../db/schema';
import { parseAdminEventInput, parseVoidInput } from './events';
import { computeProductionLedger } from './ledger';
import { buildProgressNoticeContent } from './progress-email';
import { buildDefaultProductionTerms } from './terms';

const terms = buildDefaultProductionTerms();
const kst = (local: string) => new Date(`${local}+09:00`);
const contract = { id: 'c1', clientName: '홍길동 <b>', clientEmail: 'g@example.com' } as ProductionContract;

const delivery = {
  id: 'e1',
  contractId: 'c1',
  seq: 1,
  type: 'stage_delivered',
  stage: 'mixing',
  amount: null,
  dataJson: JSON.stringify({ link: 'https://drive.example.com/mix1' }),
  occurredAt: kst('2026-11-10T23:30:00'),
  recordedAt: kst('2026-11-10T23:30:00'),
  actor: 'admin:kyungha',
  actorIp: null,
  voidsEventId: null,
  noticeStatus: 'pending',
  noticeSentAt: null,
  noticeError: null,
  createdAt: kst('2026-11-10T23:30:00'),
} as ProductionContractEvent;

describe('결과물 전달 통지', () => {
  const ledger = computeProductionLedger({ terms, signedAt: kst('2026-11-02T10:00:00'), events: [delivery], now: kst('2026-11-10T23:31:00') });
  const content = buildProgressNoticeContent(contract, terms, delivery, ledger)!;
  const all = [content.subject, ...content.paragraphs, ...(content.notices ?? []), ...(content.rows ?? []).map((r) => `${r.label}: ${r.value}`)].join('\n');

  it('제5조 5항의 간주 승인 문장과 그 기한(KST 날짜)을 반드시 싣는다', () => {
    expect(all).toContain('수정 요청이 없으면 이 단계는 승인된 것으로 봐요');
    expect(all).toContain('제5조 5항');
    // 밤 11시 30분 전달 → 기한은 11/17(전달일 다음 날부터 7일째).
    expect(all).toContain('2026년 11월 17일까지');
  });

  it('남은 무료 수정과 초과 요금을 알린다', () => {
    expect(all).toContain('남은 무료 수정');
    expect(all).toContain('50,000원');
  });

  it('이름을 escape한다', () => {
    expect(content.paragraphs.join('')).toContain('홍길동 &lt;b&gt;');
  });
});

describe('관리자 기록 입력', () => {
  const now = kst('2026-11-20T12:00:00');

  it('일어난 때는 KST로 읽고, 미래는 받지 않는다', () => {
    const ok = parseAdminEventInput({ type: 'kickoff', occurredAt: '2026-11-19T09:30' }, now);
    expect(ok.ok && ok.input.occurredAt).toEqual(kst('2026-11-19T09:30:00'));
    expect(parseAdminEventInput({ type: 'kickoff', occurredAt: '2026-11-21T09:30' }, now).ok).toBe(false);
  });

  it('종류별 필수 칸을 요구한다 — 금액·단계·사유·내용', () => {
    expect(parseAdminEventInput({ type: 'payment_received' }, now).ok).toBe(false);
    expect(parseAdminEventInput({ type: 'stage_delivered' }, now).ok).toBe(false);
    expect(parseAdminEventInput({ type: 'stage_delivered', stage: 'recording' }, now).ok).toBe(false);
    expect(parseAdminEventInput({ type: 'pause_started', note: '수리' }, now).ok).toBe(false);
    expect(parseAdminEventInput({ type: 'termination_notice' }, now).ok).toBe(false);
  });

  it('링크는 https만 받는다', () => {
    expect(parseAdminEventInput({ type: 'stage_delivered', stage: 'mixing', link: 'javascript:alert(1)' }, now).ok).toBe(false);
    expect(parseAdminEventInput({ type: 'stage_delivered', stage: 'mixing', link: 'https://drive.google.com/x' }, now).ok).toBe(true);
  });

  it('시스템·무효 기록은 일반 기록 경로로 받지 않는다', () => {
    expect(parseAdminEventInput({ type: 'reminder_sent' }, now).ok).toBe(false);
    expect(parseAdminEventInput({ type: 'void' }, now).ok).toBe(false);
    expect(parseVoidInput({ eventId: 'e1' }, now).ok).toBe(false);
    expect(parseVoidInput({ eventId: 'e1', reason: '잘못 기록' }, now).ok).toBe(true);
  });
});
