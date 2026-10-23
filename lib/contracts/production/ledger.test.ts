import type { ProductionContractEvent, ProductionEventType } from '../../../db/schema';
import { computeProductionLedger, findStage, kstDay, type EventData } from './ledger';
import { buildDefaultProductionTerms, type ProductionTerms } from './terms';
import type { TerminationCause } from './termination';

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
    song: null,
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

  it('14일 이상 지체면 해지 통지 가능으로 올린다(제10조 5항) — 14일째 날이 다 지난 다음 날부터(초일불산입)', () => {
    // 기한 11/5 → 지체 11/6부터. 14일째인 11/19는 아직, 11/20부터 성립.
    expect(ledgerAt('2026-11-19T23:00:00', []).todos.find((t) => t.message.includes('계약금'))).toMatchObject({ severity: 'warn' });
    expect(ledgerAt('2026-11-20T00:30:00', []).todos.find((t) => t.message.includes('계약금'))).toMatchObject({ severity: 'alert' });
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
    expect(findStage(ledger, 'mastering')!).toMatchObject({ revisions: 2, freeRemaining: 0, extraRevisions: 1, extraFee: 30_000 });
    expect(ledger.payments.totalDue).toBe(1_150_000 + 30_000 + 120_000);
  });
});

describe('수정·승인(제5조)', () => {
  it('전달 뒤 답이 없으면 대기이고, 기한은 전달일 다음 날부터 7일째 날이다', () => {
    const ledger = ledgerAt('2026-11-12T09:00:00', [ev('stage_delivered', '2026-11-10T23:30:00', { stage: 'arrangement' })]);
    const pending = findStage(ledger, 'arrangement')!.pending!;
    // 밤 11시 30분 전달이어도 그날(11/10)이 전달일이다 — 경과 시간으로 자르지 않는다.
    expect(kstDay(pending.lastDayToRespond)).toBe(kstDay(kst('2026-11-17T00:00:00')));
    expect(pending.deemedFromDay).toBe(kstDay(kst('2026-11-18T00:00:00')));
  });

  it('수정 요청이 들어오면 대기가 아니라 수정 반영 중이다', () => {
    const ledger = ledgerAt('2026-11-12T09:00:00', [
      ev('stage_delivered', '2026-11-10T09:00:00', { stage: 'mixing' }),
      ev('revision_requested', '2026-11-11T09:00:00', { stage: 'mixing', actor: 'client' }),
    ]);
    expect(findStage(ledger, 'mixing')!).toMatchObject({ pending: null, revising: true, freeRemaining: 1 });
  });

  it('전달 통지가 나가지 않았으면 대기는 남되 근거 없음으로 표시하고 경고한다', () => {
    const ledger = ledgerAt('2026-11-12T09:00:00', [
      ev('stage_delivered', '2026-11-10T09:00:00', { stage: 'arrangement', noticeStatus: 'failed' }),
    ]);
    expect(findStage(ledger, 'arrangement')!.pending?.noticeSent).toBe(false);
    expect(ledger.todos).toContainEqual(expect.objectContaining({ severity: 'alert', message: expect.stringContaining('통지') }));
  });

  it('승인되면 대기가 끝나고, 마스터링 승인일부터 잔금 기한을 센다', () => {
    const ledger = ledgerAt('2026-12-01T09:00:00', [
      ev('stage_delivered', '2026-11-20T09:00:00', { stage: 'mastering' }),
      ev('stage_approved', '2026-11-21T09:00:00', { stage: 'mastering', data: { mode: 'explicit' } }),
    ]);
    expect(findStage(ledger, 'mastering')!.approved).toMatchObject({ mode: 'explicit' });
    expect(kstDay(ledger.payments.balanceLastDay!)).toBe(kstDay(kst('2026-11-28T00:00:00')));
    expect(ledger.payments.balanceOverdueDays).toBe(3);
  });

  it('무효 처리한 기록은 없는 것으로 계산한다', () => {
    const delivered = ev('stage_delivered', '2026-11-10T09:00:00', { stage: 'arrangement' });
    const ledger = ledgerAt('2026-11-12T09:00:00', [
      delivered,
      ev('void', '2026-11-11T09:00:00', { voidsEventId: delivered.id, data: { reason: '잘못 기록' } }),
    ]);
    expect(findStage(ledger, 'arrangement')!).toMatchObject({ deliveries: 0, pending: null });
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

  it('예정일을 4주 넘기면 의뢰인 해지 가능으로 올린다(제12조 2항) — 28일째 날이 다 지난 다음 날부터', () => {
    expect(ledgerAt('2027-01-28T09:00:00', started).work.delayExceeded).toBe(false);
    const ledger = ledgerAt('2027-01-29T09:00:00', started);
    expect(ledger.work.delayDays).toBe(29);
    expect(ledger.work.delayExceeded).toBe(true);
    expect(ledger.todos).toContainEqual(expect.objectContaining({ severity: 'alert', message: expect.stringContaining('제12조 2항') }));
  });
});

describe('해지 정산(제10조 3항 — 운영자 결정 경계)', () => {
  it('착수 전이면 받은 금액 전액을 돌려준다 — 동의한 추가 비용이 있어도(제10조 2항)', () => {
    const ledger = ledgerAt('2026-11-10T09:00:00', [
      ev('payment_received', '2026-11-03T09:00:00', { amount: 575_000 }),
      ev('extra_cost_agreed', '2026-11-04T09:00:00', { amount: 200_000, data: { note: '세션' } }),
    ]);
    expect(ledger.refund).toMatchObject({ extras: 0, deduction: 0, refundable: 575_000 });
  });

  it('착수 기록이 없어도 결과물을 전달했으면 착수한 것으로 본다(제10조 1항)', () => {
    const ledger = ledgerAt('2026-11-10T09:00:00', [
      ev('payment_received', '2026-11-03T09:00:00', { amount: 575_000 }),
      ev('stage_delivered', '2026-11-05T09:00:00', { stage: 'arrangement' }),
    ]);
    expect(ledger.work.kickedOff).toBe(true);
    expect(ledger.refund.deduction).toBeGreaterThan(0);
  });

  it('초과 수정 요금은 다시 전달까지 마친 수정만 공제한다', () => {
    const base = [
      ev('payment_received', '2026-11-03T09:00:00', { amount: 575_000 }),
      ev('kickoff', '2026-11-04T09:00:00'),
      ev('stage_delivered', '2026-11-05T09:00:00', { stage: 'mastering' }),
      ev('revision_requested', '2026-11-06T09:00:00', { stage: 'mastering' }),
      ev('stage_delivered', '2026-11-07T09:00:00', { stage: 'mastering' }),
      ev('revision_requested', '2026-11-08T09:00:00', { stage: 'mastering' }),
    ];
    // 무료 1회 + 초과 1회 요청 — 초과분을 아직 다시 전달하지 않았다.
    expect(ledgerAt('2026-11-09T09:00:00', base).refund.extras).toBe(0);
    const redelivered = ledgerAt('2026-11-10T09:00:00', [...base, ev('stage_delivered', '2026-11-09T09:00:00', { stage: 'mastering' })]);
    expect(redelivered.refund.extras).toBe(terms.extraRevisionFees.mastering);
  });

  it('스튜디오 사정 해지(제10조 4항)는 추가 비용·초과 수정 요금을 공제하지 않는다', () => {
    const events = [
      ev('payment_received', '2026-11-03T09:00:00', { amount: 875_000 }),
      ev('kickoff', '2026-11-04T09:00:00'),
      ev('extra_cost_agreed', '2026-11-05T09:00:00', { amount: 300_000, data: { note: '세션' } }),
    ];
    const client = computeProductionLedger({ terms, signedAt: SIGNED, events, now: kst('2026-11-10T09:00:00'), terminationCause: 'client' });
    const studio = computeProductionLedger({ terms, signedAt: SIGNED, events, now: kst('2026-11-10T09:00:00'), terminationCause: 'studio' });
    expect(client.refund.extras).toBe(300_000);
    expect(studio.refund.extras).toBe(0);
    expect(studio.refund.refundable).toBe(client.refund.refundableIfStudio);
  });

  it('계약금이 0원이면 체결로 계약금 조건이 채워진다', () => {
    const free = { ...terms, amount: { ...terms.amount, deposit: 0, balance: terms.amount.total } };
    const ledger = computeProductionLedger({
      terms: free,
      signedAt: SIGNED,
      events: [ev('source_received', '2026-11-04T09:00:00')],
      now: kst('2026-11-20T09:00:00'),
    });
    expect(ledger.payments.depositOverdueDays).toBe(0);
    expect(ledger.work.startedOn).not.toBeNull();
  });

  it('연락 뒤 의뢰인이 입금하면 무응답으로 세지 않는다', () => {
    const ledger = ledgerAt('2026-12-30T09:00:00', [
      ev('client_contacted', '2026-11-10T09:00:00'),
      ev('payment_received', '2026-11-11T09:00:00', { amount: 100_000 }),
    ]);
    expect(ledger.unresponsive.since).toBeNull();
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

  it('동의한 추가 비용과 무료 횟수를 넘은 수정 요금은 해지해도 돌려주지 않는다', () => {
    const base = [
      ev('payment_received', '2026-11-03T09:00:00', { amount: terms.amount.deposit }),
      ev('kickoff', '2026-11-05T09:00:00'),
      ev('stage_delivered', '2026-11-10T09:00:00', { stage: 'arrangement' }),
    ];
    const without = ledgerAt('2026-11-20T09:00:00', base);
    const withExtra = ledgerAt('2026-11-20T09:00:00', [
      ...base,
      ev('extra_cost_agreed', '2026-11-12T09:00:00', { amount: 300_000, data: { note: '세션 실비' } }),
      ev('payment_received', '2026-11-13T09:00:00', { amount: 300_000 }),
    ]);
    expect(withExtra.refund.extras).toBe(300_000);
    expect(withExtra.refund.refundable).toBe(without.refund.refundable);
  });

  it('최종 파일을 인도하면 완료 처리를 할 일로 올린다(개인정보 보관 기산점)', () => {
    const ledger = ledgerAt('2026-12-20T09:00:00', [ev('final_delivered', '2026-12-18T09:00:00')]);
    expect(ledger.todos.map((t) => t.message)).toContainEqual(expect.stringContaining('완료 처리'));
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

describe('여러 곡(EP)', () => {
  const ep = buildDefaultProductionTerms('ep', 4);
  const epLedger = (now: string, events: ProductionContractEvent[]) =>
    computeProductionLedger({ terms: ep, signedAt: SIGNED, events, now: kst(now) });

  it('편곡·믹싱은 곡마다 따로 세고, 마스터링은 음반 하나다', () => {
    const ledger = epLedger('2026-11-12T09:00:00', [
      ev('stage_delivered', '2026-11-10T09:00:00', { stage: 'arrangement', song: 1 }),
      ev('revision_requested', '2026-11-11T09:00:00', { stage: 'arrangement', song: 1 }),
      ev('stage_delivered', '2026-11-11T10:00:00', { stage: 'arrangement', song: 2 }),
    ]);
    expect(ledger.stages).toHaveLength(4 * 2 + 1);
    expect(findStage(ledger, 'arrangement', 1)).toMatchObject({ revising: true, revisions: 1 });
    expect(findStage(ledger, 'arrangement', 2)?.pending).not.toBeNull();
    expect(findStage(ledger, 'arrangement', 0)).toMatchObject({ deliveries: 0, pending: null });
    expect(findStage(ledger, 'mastering')).toMatchObject({ song: null });
  });

  it('작업 기간은 모든 곡의 1차 완성본을 받아야 시작한다', () => {
    const base = [
      ev('payment_received', '2026-11-03T09:00:00', { amount: ep.amount.deposit }),
      ev('source_received', '2026-11-04T09:00:00', { song: 0 }),
      ev('source_received', '2026-11-04T09:00:00', { song: 1 }),
      ev('source_received', '2026-11-05T09:00:00', { song: 2 }),
    ];
    expect(epLedger('2026-11-10T09:00:00', base).work.startedOn).toBeNull();
    const ledger = epLedger('2026-11-10T09:00:00', [...base, ev('source_received', '2026-11-08T09:00:00', { song: 3 })]);
    expect(ledger.work.startedOn).toEqual(kst('2026-11-08T00:00:00'));
  });

  it('해지 정산은 경계에 닿은 곡의 비율만큼 — 4곡 중 2곡 편곡 시안이면 편곡 금액의 절반', () => {
    const ledger = epLedger('2026-11-20T09:00:00', [
      ev('payment_received', '2026-11-03T09:00:00', { amount: ep.amount.deposit }),
      ev('kickoff', '2026-11-05T09:00:00'),
      ev('stage_delivered', '2026-11-10T09:00:00', { stage: 'arrangement', song: 0 }),
      ev('stage_delivered', '2026-11-11T09:00:00', { stage: 'arrangement', song: 3 }),
    ]);
    const arrangement = ledger.refund.lines.find((line) => line.key === 'arrangement')!;
    expect(arrangement.ratio).toBe(0.5);
    expect(arrangement.deducted).toBe(Math.round(arrangement.amount / 2));
  });

  it('항목에 경계가 여럿이면 곡마다 가장 큰 경계를 고른 뒤 곡 수로 나눈다 — 계약서 "곡마다 … 그 곡 몫의 N%"', () => {
    const custom = {
      ...ep,
      refundSchedule: ep.refundSchedule.map((item) =>
        item.key === 'arrangement'
          ? { ...item, milestones: [{ event: 'arrangement_delivered' as const, ratio: 0.5 }, { event: 'mixing_delivered' as const, ratio: 1 }] }
          : item,
      ),
    };
    const events = [
      ev('payment_received', '2026-11-03T09:00:00', { amount: ep.amount.deposit }),
      ev('kickoff', '2026-11-05T09:00:00'),
      ...[0, 1, 2, 3].map((song) => ev('stage_delivered', '2026-11-10T09:00:00', { stage: 'arrangement', song })),
      ev('stage_delivered', '2026-11-12T09:00:00', { stage: 'mixing', song: 0 }),
    ];
    const ledger = computeProductionLedger({ terms: custom, signedAt: SIGNED, events, now: kst('2026-11-20T09:00:00') });
    // 1번 곡 100% + 나머지 셋 50% → (1 + 0.5 × 3) / 4
    expect(ledger.refund.lines.find((line) => line.key === 'arrangement')!.ratio).toBe(0.625);
  });

  it('곡별 경계와 음반 전체 경계가 섞이면 음반 전체 경계는 모든 곡에 닿는다', () => {
    const custom = {
      ...ep,
      refundSchedule: ep.refundSchedule.map((item) =>
        item.key === 'mixmaster'
          ? { ...item, milestones: [{ event: 'mixing_delivered' as const, ratio: 0.7 }, { event: 'mastering_delivered' as const, ratio: 1 }] }
          : item,
      ),
    };
    const base = [ev('payment_received', '2026-11-03T09:00:00', { amount: ep.amount.deposit }), ev('kickoff', '2026-11-05T09:00:00')];
    const mixedOne = computeProductionLedger({
      terms: custom,
      signedAt: SIGNED,
      events: [...base, ev('stage_delivered', '2026-11-12T09:00:00', { stage: 'mixing', song: 0 })],
      now: kst('2026-11-20T09:00:00'),
    });
    expect(mixedOne.refund.lines.find((line) => line.key === 'mixmaster')!.ratio).toBeCloseTo(0.175);
    const mastered = computeProductionLedger({
      terms: custom,
      signedAt: SIGNED,
      events: [...base, ev('stage_delivered', '2026-11-15T09:00:00', { stage: 'mastering' })],
      now: kst('2026-11-20T09:00:00'),
    });
    expect(mastered.refund.lines.find((line) => line.key === 'mixmaster')!.ratio).toBe(1);
  });

  it('결과물을 보내고 의뢰인 답을 기다린 날은 작업 기간에서 빼 예정일을 미룬다(제4조 2항)', () => {
    const base = [
      ev('payment_received', '2026-11-03T09:00:00', { amount: terms.amount.deposit }),
      ev('source_received', '2026-11-03T10:00:00'),
    ];
    const plain = ledgerAt('2026-12-01T09:00:00', base);
    const waited = ledgerAt('2026-12-01T09:00:00', [
      ...base,
      ev('stage_delivered', '2026-11-10T09:00:00', { stage: 'arrangement' }),
      ev('revision_requested', '2026-11-15T09:00:00', { stage: 'arrangement' }),
    ]);
    expect(kstDay(waited.work.dueOn!) - kstDay(plain.work.dueOn!)).toBe(5);
  });

  it('할 일에 곡 이름을 붙인다', () => {
    const titled = { ...ep, songs: ep.songs.map((song, i) => (i === 1 ? { title: '파도' } : song)) };
    const ledger = computeProductionLedger({
      terms: titled,
      signedAt: SIGNED,
      now: kst('2026-11-12T09:00:00'),
      events: [ev('stage_delivered', '2026-11-10T09:00:00', { stage: 'mixing', song: 1, noticeStatus: 'failed' })],
    });
    expect(ledger.todos.map((t) => t.message).join('\n')).toContain('2번 곡 「파도」 믹싱 결과물 전달 통지');
  });
});

describe('3회 분할 — 2차 납부·연체(제3조)', () => {
  const reworkTerms: ProductionTerms = {
    ...buildDefaultProductionTerms('single'),
    amount: {
      total: 1_000_000,
      deposit: 500_000,
      second: 300_000,
      balance: 200_000,
      depositDueDays: 3,
      secondDueDays: 7,
      balanceDueDays: 7,
    },
    refundPolicy: {
      mode: 'paid_ratio',
      stages: [
        { event: 'kickoff', ratio: 0.7 },
        { event: 'recording_completed', ratio: 0.4 },
        { event: 'mixing_delivered', ratio: 0.2 },
        { event: 'mastering_delivered', ratio: 0 },
      ],
    },
    refundSchedule: [
      {
        key: 'planning',
        label: 'AI 리워크 제작 일체',
        amount: 1_000_000,
        milestones: [{ event: 'mastering_delivered', ratio: 1 }],
      },
    ],
  };

  const reworkLedger = (now: string, events: ProductionContractEvent[], terminationCause?: TerminationCause) =>
    computeProductionLedger({ terms: reworkTerms, signedAt: SIGNED, events, now: kst(now), terminationCause });

  const arrangementApproved = [
    ev('stage_delivered', '2026-11-10T09:00:00', { stage: 'arrangement' }),
    ev('stage_approved', '2026-11-11T09:00:00', { stage: 'arrangement', data: { mode: 'explicit' } }),
  ];

  it('편곡 승인일부터 2차 기한을 세고, 미납이면 연체일을 계산한다', () => {
    const ledger = reworkLedger('2026-11-25T09:00:00', [
      ev('payment_received', '2026-11-03T09:00:00', { amount: 500_000 }),
      ...arrangementApproved,
    ]);
    expect(ledger.payments.secondMetAt).toBeNull();
    expect(kstDay(ledger.payments.secondLastDay!)).toBe(kstDay(kst('2026-11-18T00:00:00')));
    expect(ledger.payments.secondOverdueDays).toBe(7);
    expect(ledger.todos.map((t) => t.message)).toContainEqual(expect.stringContaining('중간금 기한이 7일 지났어요'));
  });

  it('편곡 승인 전에는 2차 기한이 없다', () => {
    const ledger = reworkLedger('2026-11-25T09:00:00', [
      ev('payment_received', '2026-11-03T09:00:00', { amount: 500_000 }),
      ev('stage_delivered', '2026-11-10T09:00:00', { stage: 'arrangement' }),
    ]);
    expect(ledger.payments.secondLastDay).toBeNull();
    expect(ledger.payments.secondOverdueDays).toBe(0);
  });

  it('편곡이 승인됐어도 계약금이 안 들어왔으면 2차 기한이 생기지 않는다 — 받을 돈은 아직 계약금이다', () => {
    const ledger = reworkLedger('2026-11-25T09:00:00', arrangementApproved);
    expect(ledger.payments.depositMetAt).toBeNull();
    expect(ledger.payments.secondLastDay).toBeNull();
    expect(ledger.payments.secondOverdueDays).toBe(0);
    expect(ledger.todos.map((t) => t.message)).not.toContainEqual(expect.stringContaining('중간금 기한'));
  });

  it('2차까지 입금하면 입금일을 기록하고, 잔금이 남으면 완납이 아니다', () => {
    const ledger = reworkLedger('2026-11-25T09:00:00', [
      ev('payment_received', '2026-11-03T09:00:00', { amount: 500_000 }),
      ev('payment_received', '2026-11-04T09:00:00', { amount: 250_000 }),
      ev('payment_received', '2026-11-05T09:00:00', { amount: 50_000 }),
      ...arrangementApproved,
    ]);
    expect(ledger.payments.received).toBe(800_000);
    expect(ledger.payments.secondMetAt).toEqual(kst('2026-11-05T09:00:00'));
    expect(ledger.payments.secondOverdueDays).toBe(0);
    expect(ledger.payments.paidInFull).toBe(false);
  });

  it('2차가 없는 계약은 2차 필드가 비어 있고 기존 항목표 정산을 그대로 쓴다', () => {
    const ledger = ledgerAt('2026-12-01T09:00:00', [
      ev('payment_received', '2026-11-03T09:00:00', { amount: terms.amount.deposit }),
      ...arrangementApproved,
    ]);
    expect(ledger.payments).toMatchObject({ secondMetAt: null, secondLastDay: null, secondOverdueDays: 0 });
    expect(ledger.refund).toMatchObject({ basis: 'work', ratio: 0 });
    expect(ledger.refund.lines.length).toBeGreaterThan(0);
  });
});

describe('지급 비율 환불(paid_ratio, 제10조)', () => {
  const reworkTerms: ProductionTerms = {
    ...buildDefaultProductionTerms('single'),
    amount: {
      total: 1_000_000,
      deposit: 500_000,
      second: 300_000,
      balance: 200_000,
      depositDueDays: 3,
      secondDueDays: 7,
      balanceDueDays: 7,
    },
    refundPolicy: {
      mode: 'paid_ratio',
      stages: [
        { event: 'kickoff', ratio: 0.7 },
        { event: 'recording_completed', ratio: 0.4 },
        { event: 'mixing_delivered', ratio: 0.2 },
        { event: 'mastering_delivered', ratio: 0 },
      ],
    },
    refundSchedule: [
      {
        key: 'planning',
        label: 'AI 리워크 제작 일체',
        amount: 1_000_000,
        milestones: [{ event: 'mastering_delivered', ratio: 1 }],
      },
    ],
  };

  const reworkLedger = (events: ProductionContractEvent[], terminationCause?: TerminationCause) =>
    computeProductionLedger({ terms: reworkTerms, signedAt: SIGNED, events, now: kst('2026-11-30T09:00:00'), terminationCause });

  it('단계가 진행될수록 받은 금액에서 돌려줄 비율이 줄어든다', () => {
    const paid = ev('payment_received', '2026-11-03T09:00:00', { amount: 500_000 });
    const kickoff = ev('kickoff', '2026-11-04T09:00:00');
    const recorded = ev('recording_completed', '2026-11-05T09:00:00');
    const mixed = ev('stage_delivered', '2026-11-06T09:00:00', { stage: 'mixing' });
    const mastered = ev('stage_delivered', '2026-11-07T09:00:00', { stage: 'mastering' });

    expect(reworkLedger([paid]).refund).toMatchObject({
      basis: 'paid_ratio',
      ratio: 1,
      refundable: 500_000,
      deduction: 0,
      lines: [],
    });
    expect(reworkLedger([paid, kickoff]).refund).toMatchObject({ ratio: 0.7, refundable: 350_000, deduction: 150_000 });
    expect(reworkLedger([paid, kickoff, recorded]).refund).toMatchObject({ ratio: 0.4, refundable: 200_000, deduction: 300_000 });
    expect(reworkLedger([paid, kickoff, recorded, mixed]).refund).toMatchObject({ ratio: 0.2, refundable: 100_000, deduction: 400_000 });
    expect(reworkLedger([paid, kickoff, recorded, mixed, mastered]).refund).toMatchObject({ ratio: 0, refundable: 0, deduction: 500_000 });
  });

  it('받은 돈이 0원이면 어떤 단계에서도 환불액이 0이고 음수가 되지 않는다', () => {
    const kickoff = ev('kickoff', '2026-11-04T09:00:00');
    const extra = ev('extra_cost_agreed', '2026-11-05T09:00:00', { amount: 100_000, data: { note: '세션' } });
    const recorded = ev('recording_completed', '2026-11-05T09:00:00');
    const mixed = ev('stage_delivered', '2026-11-06T09:00:00', { stage: 'mixing' });
    const mastered = ev('stage_delivered', '2026-11-07T09:00:00', { stage: 'mastering' });

    for (const events of [[], [kickoff], [kickoff, extra], [kickoff, recorded], [kickoff, recorded, mixed], [kickoff, recorded, mixed, mastered]]) {
      const refund = reworkLedger(events).refund;
      expect(refund.refundable).toBe(0);
      expect(refund.deduction).toBe(0);
    }
  });

  it('추가 비용은 의뢰인 귀책에서만 공제하고, 스튜디오 귀책이면 받은 금액 전액을 돌려준다', () => {
    const events = [
      ev('payment_received', '2026-11-03T09:00:00', { amount: 500_000 }),
      ev('kickoff', '2026-11-04T09:00:00'),
      ev('extra_cost_agreed', '2026-11-05T09:00:00', { amount: 100_000, data: { note: '세션' } }),
    ];

    expect(reworkLedger(events, 'client').refund).toMatchObject({
      basis: 'paid_ratio',
      ratio: 0.7,
      extras: 100_000,
      refundable: 250_000,
      deduction: 250_000,
      refundableIfStudio: 500_000,
      lines: [],
    });
    expect(reworkLedger(events, 'studio').refund).toMatchObject({
      basis: 'paid_ratio',
      ratio: 1,
      extras: 0,
      refundable: 500_000,
      deduction: 0,
      refundableIfStudio: 500_000,
    });
  });
});
