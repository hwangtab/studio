import type { ProductionContractEvent, ProductionEventType } from '../../../db/schema';
import { adminEventTypesFor, eventLabelFor, eventStagesFor, isMixMasterTerms } from './event-spec';
import { computeProductionLedger, findStage } from './ledger';
import { buildProductionContent, findUnfilledPlaceholders, readProductionTemplate } from './template';
import { applyMixMasterTracks, buildDefaultProductionTerms, contractNameFor, releaseTitle, validateProductionTerms } from './terms';

/** 믹싱·마스터링 계약(1곡) — 제작 계약 엔진에 종류 하나를 더한 것. 범위·착수·발매 조항이 다르고 조 번호는 같다. */

const terms = buildDefaultProductionTerms('mixmaster');
const template = readProductionTemplate('mixmaster');
const content = buildProductionContent(
  {
    kind: 'mixmaster',
    clientName: '홍길동',
    clientStageName: null,
    clientPhone: '010-1234-5678',
    terms: { ...terms, songs: [{ title: '물결' }] },
    contractDate: '2026-10-20T03:00:00.000Z',
  },
  template,
);

describe('기본 조건', () => {
  it('사이트 정가 그대로 — 믹싱(10트랙 이하) 200,000 + 싱글 마스터링 100,000, 50만원 이하라 한 번에', () => {
    expect(terms.amount).toMatchObject({ total: 300_000, deposit: 300_000, balance: 0 });
    expect(terms.firstDeliveryBusinessDays).toBe(7);
    expect(terms.songs).toHaveLength(1);
    expect(terms.scope).toEqual({ arrangementTracks: 0, recordingHours: 0, mixingTracks: 10 });
    expect(terms.revisions).toEqual({ arrangement: 0, mixing: 2, mastering: 1 });
  });

  it('환불 항목은 하나 — 믹싱 1차 전달 때 믹싱 몫, 마스터링 전달 때 전액', () => {
    expect(terms.refundSchedule).toEqual([
      {
        key: 'mixmaster',
        label: '믹싱·마스터링 (제2조)',
        amount: 300_000,
        milestones: [
          { event: 'mixing_delivered', ratio: 0.67 },
          { event: 'mastering_delivered', ratio: 1 },
        ],
      },
    ]);
  });

  it('트랙 수가 가격 구간을 정한다 — 10 이하 / 11~30 / 31 이상, 항목표·경계가 함께 맞는다', () => {
    const at = (tracks: number) => applyMixMasterTracks(terms, tracks);
    expect(at(10).amount).toMatchObject({ total: 300_000, deposit: 300_000, balance: 0 });
    expect(at(30).amount).toMatchObject({ total: 450_000, deposit: 450_000, balance: 0 });
    // 50만원을 넘으면 계약금·잔금 절반씩.
    expect(at(31).amount).toMatchObject({ total: 600_000, deposit: 300_000, balance: 300_000 });
    expect(at(30).scope.mixingTracks).toBe(30);
    expect(at(30).refundSchedule[0]).toMatchObject({ amount: 450_000, milestones: [{ event: 'mixing_delivered', ratio: 0.78 }, { event: 'mastering_delivered', ratio: 1 }] });
    expect(at(31).amount.total).toBe(600_000);
    expect(validateProductionTerms(at(45), 'mixmaster').ok).toBe(true);
  });

  it('검증을 통과하고, 제작 계약의 다섯 항목표는 받지 않는다', () => {
    expect(validateProductionTerms(terms, 'mixmaster').ok).toBe(true);
    expect(validateProductionTerms(buildDefaultProductionTerms('single'), 'mixmaster').ok).toBe(false);
    // 반대로 싱글 계약에 한 항목표를 보내도 막는다.
    expect(validateProductionTerms(terms, 'single').ok).toBe(false);
  });

  it('음반 제목을 받지 않고, 화면 이름은 곡 제목이다', () => {
    const result = validateProductionTerms({ ...terms, albumTitle: '앨범', songs: [{ title: '물결' }] }, 'mixmaster');
    expect(result.ok && result.data.albumTitle).toBeNull();
    expect(releaseTitle('mixmaster', { albumTitle: null, songs: [{ title: '물결' }] })).toBe('물결');
    expect(contractNameFor('mixmaster')).toBe('믹싱·마스터링 용역 계약서');
  });
});

describe('계약서 본문', () => {
  it('자리표시자를 남기지 않는다', () => {
    expect(findUnfilledPlaceholders(content)).toEqual([]);
  });

  it('제목·범위가 믹싱·마스터링이고, 편곡·녹음·유통 대행을 약속하지 않는다', () => {
    expect(content).toContain('# 믹싱·마스터링 용역 계약서');
    expect(content).toContain('1. 믹싱 (10트랙 이하)');
    expect(content).toContain('| 본 곡 | 물결 |');
    expect(content).not.toContain('편곡 (');
    expect(content).not.toContain('유통 등록 대행');
    expect(content).not.toContain('1차 완성본');
    expect(content).toContain('**믹싱 2회, 마스터링 1회**');
  });

  it('50만원 이하는 계약금·잔금 없이 한 번에 — 요약표·제3조·제5조 6항이 그렇게 말한다', () => {
    expect(content).toContain('| 대금 지급 | 300,000원 일시불 — 계약 체결일로부터 3일 이내 |');
    expect(content).toContain('2. 의뢰인은 계약금액 전액을 계약 체결일로부터 3일 이내에 한 번에 지급한다.');
    expect(content).toContain('6. 스튜디오는 최종 마스터가 승인되고 대금 지급이 확인되면 최종 마스터 파일을 인도한다.');
    expect(content).not.toContain('잔금');
    expect(content).not.toContain('계약금:');
  });

  it('납품 기한이 있다 — 믹싱 1차 7영업일, 최종 마스터 2주 이내', () => {
    expect(content).toContain('| 납품 기한 | 대금 입금과 작업 파일 수령일부터 믹싱 1차 결과물 7영업일 이내, 최종 마스터 2주 이내 |');
    expect(content).toContain('믹싱 1차 결과물을 **7영업일 이내**에 전달하고, 최종 마스터를 **2주 이내**에 인도한다(납품 기한).');
  });

  it('50만원을 넘으면 계약금·잔금으로 나눈다', () => {
    const big = applyMixMasterTracks(terms, 31);
    const text = buildProductionContent(
      { kind: 'mixmaster', clientName: '홍길동', clientStageName: null, clientPhone: '010-1234-5678', terms: big, contractDate: '2026-10-20T03:00:00.000Z' },
      template,
    );
    expect(text).toContain('| 계약금 | 300,000원 — 계약 체결일로부터 3일 이내 |');
    expect(text).toContain('   - 잔금: **300,000원**, 최종 마스터 승인일부터 7일 이내(최종 마스터 파일 인도 전)');
    expect(text).toContain('6. 잔금은 최종 마스터 승인일부터 7일 이내에 지급한다. 스튜디오는 잔금 지급을 확인한 후 최종 마스터 파일을 인도한다.');
    expect(text).toContain('계약금 입금과 작업 파일 수령일부터');
  });

  it('1차 결과물 기한은 믹싱·마스터링에만 — 필수이고 최종 기한보다 길 수 없다', () => {
    const { firstDeliveryBusinessDays: _drop, ...without } = terms;
    expect(validateProductionTerms(without, 'mixmaster').ok).toBe(false);
    expect(validateProductionTerms({ ...terms, firstDeliveryBusinessDays: 11 }, 'mixmaster').ok).toBe(false);
    const single = validateProductionTerms({ ...buildDefaultProductionTerms('single'), firstDeliveryBusinessDays: 7 }, 'single');
    expect(single.ok && single.data.firstDeliveryBusinessDays).toBeUndefined();
  });

  it('제10조 3항 문장이 항목표 경계에서 나온다', () => {
    expect(content).toContain(
      '믹싱·마스터링(제2조)은 스튜디오가 믹싱 1차 결과물을 전달한 때 그 금액의 67%를, 스튜디오가 마스터링 결과물을 전달한 때 전액을 작업분으로 본다.',
    );
    expect(content).toContain('| 믹싱·마스터링 (제2조) | 300,000원 |');
  });

  it('조 번호는 제작 계약과 같다 — 진행 기록·메일이 "제5조 5항", "제10조 1항"을 가리킨다', () => {
    for (let n = 1; n <= 14; n += 1) expect(content.match(new RegExp(`## 제${n}조 `, 'g'))).toHaveLength(1);
  });

  it('대금·책임 제한·기타 조항은 싱글 제작 계약서와 글자 하나 다르지 않다', () => {
    const single = readProductionTemplate('single');
    const section = (text: string, heading: string) => {
      const start = text.indexOf(`## ${heading}`);
      return text.slice(start, text.indexOf('\n## ', start + 1));
    };
    for (const heading of ['제3조', '제12조', '제14조']) {
      expect(section(template, heading)).toBe(section(single, heading));
    }
  });
});

describe('진행 기록', () => {
  const kst = (local: string) => new Date(`${local}+09:00`);
  let seq = 0;
  const ev = (type: ProductionEventType, at: string, extra: Partial<ProductionContractEvent> = {}): ProductionContractEvent => {
    seq += 1;
    return {
      id: `e${seq}`, contractId: 'c1', seq, type, stage: null, song: null, amount: null, dataJson: null,
      occurredAt: kst(at), recordedAt: kst(at), actor: 'admin:kyungha', actorIp: null, voidsEventId: null,
      noticeStatus: 'sent', noticeSentAt: kst(at), noticeError: null, createdAt: kst(at), ...extra,
    };
  };
  const ledgerAt = (now: string, events: ProductionContractEvent[]) =>
    computeProductionLedger({ terms, signedAt: kst('2026-10-20T10:00:00'), events, now: kst(now) });

  it('입금 기한 이틀 전·하루 전에 운영자 할 일 — 고객 안내(전날)보다 먼저, 기록하면 사라진다', () => {
    // 체결 10/20, 대금 기한 3일 → 10/23. 10/21이면 이틀 남았다.
    const todo = (now: string, events: ProductionContractEvent[] = []) =>
      ledgerAt(now, events).todos.map((t) => t.message).find((m) => m.includes('입금 기한이'));
    expect(todo('2026-10-21T10:00:00')).toContain('대금 입금 기한이 2일 남았어요');
    expect(todo('2026-10-22T10:00:00')).toContain('1일 남았어요');
    expect(todo('2026-10-20T11:00:00')).toBeUndefined(); // 3일 전에는 아직
    expect(todo('2026-10-21T10:00:00', [ev('payment_received', '2026-10-21T09:00:00', { amount: 300_000 })])).toBeUndefined();
  });

  it('편곡 단계를 만들지 않는다 — 믹싱(곡)과 마스터링만', () => {
    expect(ledgerAt('2026-10-21T10:00:00', []).stages.map((s) => s.stage)).toEqual(['mixing', 'mastering']);
  });

  it('믹싱 1차를 전달한 뒤 해지하면 믹싱 몫(67%)을, 마스터링까지 전달하면 전액을 공제한다', () => {
    const paid = [
      ev('payment_received', '2026-10-20T12:00:00', { amount: 150_000 }),
      ev('source_received', '2026-10-20T13:00:00', { song: 0 }),
      ev('kickoff', '2026-10-21T10:00:00'),
      ev('stage_delivered', '2026-10-23T10:00:00', { stage: 'mixing', song: 0 }),
    ];
    expect(ledgerAt('2026-10-24T10:00:00', paid).refund.deduction).toBe(201_000);
    const mastered = [...paid, ev('stage_approved', '2026-10-24T10:00:00', { stage: 'mixing', song: 0 }), ev('stage_delivered', '2026-10-25T10:00:00', { stage: 'mastering' })];
    const ledger = ledgerAt('2026-10-26T10:00:00', mastered);
    expect(findStage(ledger, 'mastering')?.pending).toBeTruthy();
    expect(ledger.refund.deduction).toBe(300_000);
  });

  it('기록 폼은 녹음·유통·발매와 편곡·보정 단계를 숨기고, 이름을 "작업 파일"·"믹싱 시작"으로 바꾼다', () => {
    expect(isMixMasterTerms(terms)).toBe(true);
    expect(isMixMasterTerms(buildDefaultProductionTerms('single'))).toBe(false);
    const types = adminEventTypesFor(true);
    expect(types).not.toContain('recording_completed');
    expect(types).not.toContain('distribution_submitted');
    expect(types).not.toContain('released');
    expect(eventStagesFor('stage_delivered', true)).toEqual(['mixing', 'mastering']);
    expect(eventLabelFor('source_received', true)).toBe('작업 파일 수령');
    expect(eventLabelFor('kickoff', true)).toBe('착수 (믹싱 시작)');
    expect(eventLabelFor('kickoff', false)).toBe('착수 (기획 상담·편곡 시작)');
  });
});

describe('동의 항목 지문', () => {
  it('요약 문장이 지문에 들어가고, 요약이 없는 옛 항목의 지문 문자열은 그대로다', async () => {
    const { buildProductionClauses, LEGACY_PRODUCTION_CLAUSES } = await import('./clauses');
    const { computeProductionFingerprint } = await import('./integrity');
    const base = {
      contract: {
        id: 'c', kind: 'mixmaster' as const, title: 't', clientName: 'a', clientStageName: null, clientEmail: 'a@b.c', clientPhone: '010-1111-2222',
        clientBirthdate: null, clientAddress: null, termsJson: '{}', content: 'x', templateHash: 'h',
      },
      signers: [],
      signedAt: new Date('2026-10-20T00:00:00Z'),
    };
    const fp = (clauses: Parameters<typeof computeProductionFingerprint>[0]['clauses']) =>
      computeProductionFingerprint({ ...base, clauses } as unknown as Parameters<typeof computeProductionFingerprint>[0]);
    const now = buildProductionClauses({ deemedApprovalDays: 7 });
    expect(fp(now)).not.toBe(fp([{ ...now[0], points: [...now[0].points!.slice(0, 2), '바뀐 문장'] }]));
    expect(fp(LEGACY_PRODUCTION_CLAUSES)).toBe(fp(LEGACY_PRODUCTION_CLAUSES.map((c) => ({ ...c, points: undefined }))));
  });
});
