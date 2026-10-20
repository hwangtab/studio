import type { ProductionContractEvent, ProductionEventType } from '../../../db/schema';
import { adminEventTypesFor, eventLabelFor, eventStagesFor, isMixMasterTerms } from './event-spec';
import { computeProductionLedger, findStage } from './ledger';
import { buildProductionContent, findUnfilledPlaceholders, readProductionTemplate } from './template';
import { buildDefaultProductionTerms, contractNameFor, releaseTitle, validateProductionTerms } from './terms';

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
  it('사이트 정가 그대로 — 믹싱(10트랙 이하) 200,000 + 싱글 마스터링 100,000, 계약금 절반', () => {
    expect(terms.amount).toMatchObject({ total: 300_000, deposit: 150_000, balance: 150_000 });
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
