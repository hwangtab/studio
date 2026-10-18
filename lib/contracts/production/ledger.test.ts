import type { ProductionContractEvent, ProductionEventType } from '../../../db/schema';
import { computeProductionLedger, kstDay, type EventData } from './ledger';
import { buildDefaultProductionTerms } from './terms';

const terms = buildDefaultProductionTerms();
/** KST 시각 문자열 → Date. */
const kst = (local: string) => new Date(`${local}+09:00`);
const SIGNED = kst('2026-11-02T10:00:00');

let seq = 0;
const ev = (
  type: ProductionEventType,
  at: string,
  extra: Partial<Omit<ProductionContractEvent, 'dataJson'>> & { data?: EventData } = {},
): ProductionContractEvent => {
  seq += 1;
  const { data, ...rest } = extra;
  return {
    id: `e${seq}`,
    contractId: 'c1',
    seq,
    type,
    stage: null,
    amount: null,
    dataJson: data ? JSON.stringify(data) : null,
    occurredAt: kst(at),
    recordedAt: kst(at),
    actor: 'admin:kyungha',
    actorIp: null,
    voidsEventId: null,
    noticeStatus: 'sent',
    noticeSentAt: kst(at),
    noticeError: null,
    createdAt: kst(at),
    ...rest,
  };
};

const ledgerAt = (now: string, events: ProductionContractEvent[]) =>
  computeProductionLedger({ terms, signedAt: SIGNED, events, now: kst(now) });

beforeEach(() => {
  seq = 0;
});

describe('대금(제3조)', () => {
  it('계약금 기한은 체결일 다음 날부터 3일째 날이고, 그 뒤로 지체일을 센다', () => {
    const ledger = ledgerAt('2026-11-07T09:00:00', []);
    expect(kstDay(ledger.payments.depositLastDay!)).toBe(kstDay(kst('2026-11-05T00:00:00')));
    expect(ledger.payments.depositOverdueDays).toBe(2);
    expect(ledger.todos.map((t) => t.message)).toContainEqual(expect.stringContaining('계약금 기한이 2일 지났어요'));
  });

  it('14일 이상 지체면 해지 통지 가능으로 올린다(제10조 5항)', () => {
    const ledger = ledgerAt('2026-11-19T09:00:00', []);
    expect(ledger.todos.find((t) => t.message.includes('계약금'))).toMatchObject({ severity: 'alert' });
  });

  it('나눠 들어온 입금이 계약금에 닿은 날을 계약금 입금일로 본다', () => {
    const ledger = ledgerAt('2026-11-10T09:00:00', [
      ev('payment_received', '2026-11-03T09:00:00', { amount: 300_000 }),
      ev('payment_received', '2026-11-04T09:00:00', { amount: 275_000 }),
    ]);
    expect(ledger.payments.depositMetAt).toEqual(kst('2026-11-04T09:00:00'));
    expect(ledger.payments.depositOverdueDays).toBe(0);
  });

  it('무료 횟수를 넘은 수정과 동의한 추가 비용은 받을 금액에 더한다', () => {
    const ledger = ledgerAt('2026-11-20T09:00:00', [
      ev('stage_delivered', '2026-11-10T09:00:00', { stage: 'mastering' }),
      ev('revision_requested', '2026-11-11T09:00:00', { stage: 'mastering' }),
      ev('stage_delivered', '2026-11-12T09:00:00', { stage: 'mastering' }),
      ev('revision_requested', '2026-11-13T09:00:00', { stage: 'mastering' }), // 마스터링 무료 1회 → 이건 초과
      ev('extra_cost_agreed', '2026-11-14T09:00:00', { amount: 120_000, data: { note: '세션 기타' } }),
    ]);
    expect(ledger.stages.mastering).toMatchObject({ revisions: 2, freeRemaining: 0, extraRevisions: 1, extraFee: 30_000 });
    expect(ledger.payments.totalDue).toBe(1_150_000 + 30_000 + 120_000);
  });
});

describe('수정·승인(제5조)', () => {
  it('전달 뒤 답이 없으면 대기이고, 기한은 전달일 다음 날부터 7일째 날이다', () => {
    const ledger = ledgerAt('2026-11-12T09:00:00', [ev('stage_delivered', '2026-11-10T23:30:00', { stage: 'arrangement' })]);
    const pending = ledger.stages.arrangement.pending!;
    // 밤 11시 30분 전달이어도 그날(11/10)이 전달일이다 — 경과 시간으로 자르지 않는다.
    expect(kstDay(pending.lastDayToRespond)).toBe(kstDay(kst('2026-11-17T00:00:00')));
    expect(pending.deemedFromDay).toBe(kstDay(kst('2026-11-18T00:00:00')));
  });

  it('수정 요청이 들어오면 대기가 아니라 수정 반영 중이다', () => {
    const ledger = ledgerAt('2026-11-12T09:00:00', [
      ev('stage_delivered', '2026-11-10T09:00:00', { stage: 'mixing' }),
      ev('revision_requested', '2026-11-11T09:00:00', { stage: 'mixing', actor: 'client' }),
    ]);
    expect(ledger.stages.mixing).toMatchObject({ pending: null, revising: true, freeRemaining: 1 });
  });

  it('전달 통지가 나가지 않았으면 대기는 남되 근거 없음으로 표시하고 경고한다', () => {
    const ledger = ledgerAt('2026-11-12T09:00:00', [
      ev('stage_delivered', '2026-11-10T09:00:00', { stage: 'arrangement', noticeStatus: 'failed' }),
    ]);
    expect(ledger.stages.arrangement.pending?.noticeSent).toBe(false);
    expect(ledger.todos).toContainEqual(expect.objectContaining({ severity: 'alert', message: expect.stringContaining('통지') }));
  });

  it('승인되면 대기가 끝나고, 마스터링 승인일부터 잔금 기한을 센다', () => {
    const ledger = ledgerAt('2026-12-01T09:00:00', [
      ev('stage_delivered', '2026-11-20T09:00:00', { stage: 'mastering' }),
      ev('stage_approved', '2026-11-21T09:00:00', { stage: 'mastering', data: { mode: 'explicit' } }),
    ]);
    expect(ledger.stages.mastering.approved).toMatchObject({ mode: 'explicit' });
    expect(kstDay(ledger.payments.balanceLastDay!)).toBe(kstDay(kst('2026-11-28T00:00:00')));
    expect(ledger.payments.balanceOverdueDays).toBe(3);
  });

  it('무효 처리한 기록은 없는 것으로 계산한다', () => {
    const delivered = ev('stage_delivered', '2026-11-10T09:00:00', { stage: 'arrangement' });
    const ledger = ledgerAt('2026-11-12T09:00:00', [
      delivered,
      ev('void', '2026-11-11T09:00:00', { voidsEventId: delivered.id, data: { reason: '잘못 기록' } }),
    ]);
    expect(ledger.stages.arrangement).toMatchObject({ deliveries: 0, pending: null });
  });
});

describe('작업 기간(제4조)', () => {
  const started = [
    ev('payment_received', '2026-11-03T09:00:00', { amount: 575_000 }),
    ev('source_received', '2026-11-05T09:00:00'),
  ];

  it('계약금 입금과 1차 완성본 수령 중 늦은 날부터 8주', () => {
    const ledger = ledgerAt('2026-11-10T09:00:00', started);
    expect(ledger.work.startedOn).toEqual(kst('2026-11-05T00:00:00'));
    expect(ledger.work.dueOn).toEqual(kst('2026-12-31T00:00:00'));
  });

  it('의뢰인 사유 정지는 예정일을 미루고, 스튜디오 사유 정지는 미루지 않는다', () => {
    const client = ledgerAt('2026-12-20T09:00:00', [
      ...started,
      ev('pause_started', '2026-11-10T09:00:00', { data: { cause: 'client', note: '가사 수정' } }),
      ev('pause_ended', '2026-11-20T09:00:00'),
    ]);
    expect(client.work.clientPauseDays).toBe(10);
    expect(client.work.dueOn).toEqual(kst('2027-01-10T00:00:00'));

    const studio = ledgerAt('2026-12-20T09:00:00', [
      ...started,
      ev('pause_started', '2026-11-10T09:00:00', { data: { cause: 'studio', note: '장비 수리' } }),
      ev('pause_ended', '2026-11-20T09:00:00'),
    ]);
    expect(studio.work.dueOn).toEqual(kst('2026-12-31T00:00:00'));
  });

  it('예정일을 4주 넘기면 의뢰인 해지 가능으로 올린다(제12조 2항)', () => {
    const ledger = ledgerAt('2027-01-28T09:00:00', started);
    expect(ledger.work.delayDays).toBe(28);
    expect(ledger.work.delayExceeded).toBe(true);
    expect(ledger.todos).toContainEqual(expect.objectContaining({ severity: 'alert', message: expect.stringContaining('제12조 2항') }));
  });
});

describe('해지 정산(제10조 3항 — 운영자 결정 경계)', () => {
  it('착수 전이면 받은 금액 전액을 돌려준다', () => {
    const ledger = ledgerAt('2026-11-10T09:00:00', [
      ev('payment_received', '2026-11-03T09:00:00', { amount: 575_000 }),
      ev('stage_delivered', '2026-11-05T09:00:00', { stage: 'arrangement' }),
    ]);
    expect(ledger.refund).toMatchObject({ deduction: 0, refundable: 575_000 });
  });

  it('착수 후 편곡 1차 시안 전달이면 편곡 전액 + 기획 30%를 공제한다', () => {
    const ledger = ledgerAt('2026-11-20T09:00:00', [
      ev('payment_received', '2026-11-03T09:00:00', { amount: 575_000 }),
      ev('kickoff', '2026-11-05T09:00:00'),
      ev('stage_delivered', '2026-11-15T09:00:00', { stage: 'arrangement' }),
    ]);
    expect(ledger.refund.deduction).toBe(500_000 + 30_000);
    expect(ledger.refund.refundable).toBe(45_000);
  });

  it('믹싱 1차 전달이면 믹싱·마스터링 전액, 녹음 세션을 마쳤으면 녹음 전액', () => {
    const ledger = ledgerAt('2026-12-20T09:00:00', [
      ev('payment_received', '2026-11-03T09:00:00', { amount: 1_150_000 }),
      ev('kickoff', '2026-11-05T09:00:00'),
      ev('stage_delivered', '2026-11-15T09:00:00', { stage: 'arrangement' }),
      ev('recording_completed', '2026-11-25T09:00:00'),
      ev('stage_delivered', '2026-12-05T09:00:00', { stage: 'mixing' }),
    ]);
    const deducted = Object.fromEntries(ledger.refund.lines.map((line) => [line.key, line.deducted]));
    expect(deducted).toEqual({ arrangement: 500_000, recording: 200_000, tuning: 0, mixmaster: 200_000, planning: 30_000 });
  });

  it('공제액이 받은 금액보다 커도 추가로 청구하지 않는다 — 환불 0원', () => {
    const ledger = ledgerAt('2026-12-20T09:00:00', [
      ev('payment_received', '2026-11-03T09:00:00', { amount: 575_000 }),
      ev('kickoff', '2026-11-05T09:00:00'),
      ev('stage_delivered', '2026-11-15T09:00:00', { stage: 'arrangement' }),
      ev('recording_completed', '2026-11-25T09:00:00'),
    ]);
    expect(ledger.refund.deduction).toBe(730_000);
    expect(ledger.refund.refundable).toBe(0);
  });
});

describe('의뢰인 무응답(제10조 5항)', () => {
  it('스튜디오가 연락한 뒤 의뢰인 활동이 없으면 날수를 센다', () => {
    const ledger = ledgerAt('2026-12-15T09:00:00', [ev('client_contacted', '2026-11-10T09:00:00', { data: { note: '가사 요청' } })]);
    expect(ledger.unresponsive).toMatchObject({ days: 35, exceeded: true });
  });

  it('의뢰인이 수정 요청·응답을 남기면 무응답이 아니다', () => {
    const ledger = ledgerAt('2026-12-15T09:00:00', [
      ev('client_contacted', '2026-11-10T09:00:00'),
      ev('client_responded', '2026-11-12T09:00:00'),
    ]);
    expect(ledger.unresponsive.since).toBeNull();
  });
});
