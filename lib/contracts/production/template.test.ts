import { buildProductionContent, describeRefundMilestones, findUnfilledPlaceholders, readProductionTemplate } from './template';
import { buildDefaultProductionTerms, buildDefaultReworkTerms } from './terms';

const template = readProductionTemplate();
const base = {
  kind: 'single' as const,
  clientName: '홍길동',
  clientStageName: '길동밴드',
  clientPhone: '010-1234-5678',
  clientBirthdate: '1990-05-15',
  clientAddress: '서울시 은평구 대조동 1-1',
  terms: buildDefaultProductionTerms(),
  contractDate: '2026-10-18T15:30:00.000Z', // KST 10/19 00:30
};

describe('제작 계약서 본문', () => {
  it('자리표시자를 하나도 남기지 않는다', () => {
    expect(findUnfilledPlaceholders(buildProductionContent(base, template))).toEqual([]);
  });

  it('계약일은 KST 달력 날짜로 찍힌다 — 서버(UTC)에서도 하루 어긋나지 않는다', () => {
    expect(buildProductionContent(base, template)).toContain('2026년 10월 19일');
  });

  it('금액·수정 횟수·기한이 terms에서 온다', () => {
    const terms = buildDefaultProductionTerms();
    terms.amount = { ...terms.amount, total: 2_000_000, deposit: 1_000_000, balance: 1_000_000 };
    terms.revisions.mixing = 3;
    terms.deemedApprovalDays = 10;
    const content = buildProductionContent({ ...base, terms }, template);
    expect(content).toContain('금 **2,000,000원**');
    expect(content).toContain('믹싱 3회');
    expect(content).toContain('10일 이내에 의뢰인의 수정 요청이 없으면');
  });

  it('제10조 3항에 항목별 작업분 경계를 적는다 — 해지 정산의 계약상 근거(운영자 결정 2026-10-18)', () => {
    const content = buildProductionContent(base, template);
    expect(content).toContain('편곡(제2조 2호)은 스튜디오가 편곡 1차 시안을 전달한 때 완료된 것으로 본다.');
    expect(content).toContain('믹싱·마스터링(제2조 5호)은 스튜디오가 믹싱 1차 결과물을 전달한 때 완료된 것으로 본다.');
    expect(content).toContain('보컬 녹음(제2조 3호)은 보컬 녹음 세션을 마친 때 완료된 것으로 본다.');
    expect(content).toContain('보컬 음정·박자 보정(제2조 4호)은 스튜디오가 보정 결과물을 전달한 때 완료된 것으로 본다.');
    expect(content).toContain(
      '기획 상담·유통 등록·발매 홍보(제2조 1·6·7호)는 착수한 때 그 금액의 30%를, 유통 등록을 마친 때 전액을 작업분으로 본다.',
    );
  });

  it('제10조에 추가 비용·초과 수정 요금의 정산 규칙을 적는다 — 의뢰인 사정은 공제, 스튜디오 사정은 공제하지 않음', () => {
    const content = buildProductionContent(base, template);
    expect(content).toContain('의뢰인이 동의한 추가 비용(제6조) 및 이미 이행한 초과 수정의 요금(제5조 제3항)을 공제하고');
    expect(content).toContain('이 경우 추가 비용과 초과 수정의 요금은 공제하지 않는다.');
  });

  it('환불 항목표에 다섯 항목과 합계를 싣는다', () => {
    const content = buildProductionContent(base, template);
    expect(content).toContain('| 편곡 (제2조 2호) | 500,000원 |');
    expect(content).toContain('| **합계** | **1,150,000원** |');
  });

  it('곡 제목이 없으면 "제목 미정"으로 적는다', () => {
    expect(buildProductionContent(base, template)).toContain('1곡 (제목 미정)');
  });

  it('표 셀 주입을 막는다 — 파이프·꺾쇠·replace 패턴', () => {
    const content = buildProductionContent(
      { ...base, clientName: "홍길동 | 잔금 면제 <b>x</b> $' $&", clientAddress: '주소 | 칸' },
      template,
    );
    expect(content).toContain("홍길동 \\| 잔금 면제 \\<b\\>x\\</b\\> $' $&");
    expect(content).toContain('주소 \\| 칸');
    // `$'`가 템플릿 뒷부분을 끌어오지 않았다 — 계약서가 한 번만 끝난다.
    expect(content.match(/## 제14조/g)).toHaveLength(1);
  });

  it('서명자가 적은 값 안의 자리표시자는 다시 채우지 않는다 — 주소로 환불표 행을 끼워 넣을 수 없다', () => {
    const content = buildProductionContent({ ...base, clientAddress: '서울 {{refundRows}} {{contractDate}}' }, template);
    expect(content).toContain('서울 {{refundRows}} {{contractDate}}');
    expect(content.match(/\| \*\*합계\*\* \|/g)).toHaveLength(1);
  });

  it('서명 전 초안은 생년월일·주소 칸을 비운다', () => {
    const content = buildProductionContent({ ...base, clientBirthdate: null, clientAddress: null }, template);
    expect(content).toContain('| 생년월일 |  |');
    expect(content).toContain('| 주소 |  |');
  });
});

describe('EP·정규 계약서(release-template.md)', () => {
  const release = readProductionTemplate('ep');
  const terms = buildDefaultProductionTerms('ep', 4);
  terms.albumTitle = '바다';
  terms.songs[1] = { title: '파도' };
  const content = buildProductionContent({ ...base, kind: 'ep', terms }, release);

  it('자리표시자를 하나도 남기지 않는다', () => {
    expect(findUnfilledPlaceholders(content)).toEqual([]);
  });

  it('음반·곡 수·수록곡 표·곡당/합계 녹음 시간을 적는다', () => {
    expect(content).toContain('의뢰인의 EP 음반(4곡)의 제작·발매');
    expect(content).toContain('| 음반 | 바다 (EP · 4곡) |');
    expect(content).toContain('| 2 | 파도 |');
    expect(content).toContain('| 3 | 제목 미정 |');
    expect(content).toContain('곡마다 3시간, 합계 12시간');
  });

  it('곡마다 일어나는 정산 경계는 "그 곡의 몫"으로 적는다 — 음반 전체 경계는 그대로', () => {
    expect(content).toContain('편곡(제2조 2호)은 곡마다 스튜디오가 편곡 1차 시안을 전달한 때 그 곡의 몫(항목 금액을 곡 수로 나눈 금액)이 완료된 것으로 본다.');
    expect(content).toContain('기획 상담·유통 등록·발매 홍보(제2조 1·6·7호)는 착수한 때 그 금액의 30%를');
  });

  it('곡별 경계와 음반 전체 경계가 섞인 항목도 "곡마다 … 그 곡 몫"으로 적는다 — 정산 계산과 같은 말', () => {
    const custom = {
      ...terms,
      refundSchedule: terms.refundSchedule.map((item) =>
        item.key === 'mixmaster'
          ? { ...item, milestones: [{ event: 'mixing_delivered' as const, ratio: 0.7 }, { event: 'mastering_delivered' as const, ratio: 1 }] }
          : item,
      ),
    };
    expect(describeRefundMilestones(custom)).toContain('곡마다 스튜디오가 믹싱 1차 결과물을 전달한 때 그 곡 몫의 70%를');
  });

  it('곡 수와 무관한 조항은 싱글 계약서와 글자 하나 다르지 않다', () => {
    const single = readProductionTemplate('single');
    const section = (text: string, heading: string) => {
      const start = text.indexOf(`## ${heading}`);
      return text.slice(start, text.indexOf('\n## ', start + 1));
    };
    for (const heading of ['제3조', '제8조', '제9조', '제10조', '제12조', '제13조', '제14조']) {
      expect(section(release, heading)).toBe(section(single, heading));
    }
  });
});

describe('AI 리워크 계약서(rework-template.md)', () => {
  const rework = readProductionTemplate('rework');
  const reworkBase = { ...base, kind: 'rework' as const, terms: buildDefaultReworkTerms('small') };
  const content = buildProductionContent(reworkBase, rework);

  it('자리표시자를 하나도 남기지 않는다 — 편곡 없음·소편성·풀밴드 모두', () => {
    for (const scope of ['none', 'small', 'band'] as const) {
      const terms = buildDefaultReworkTerms(scope);
      expect(findUnfilledPlaceholders(buildProductionContent({ ...reworkBase, terms }, rework))).toEqual([]);
    }
  });

  it('3회 분할 — 요약표·제3조에 계약금·중간금·잔금과 각 기한', () => {
    expect(content).toContain('| 계약금 | 500,000원 — 계약 체결일로부터 3일 이내 |');
    expect(content).toContain('| 중간금 | 300,000원 — 편곡 승인일부터 7일 이내 |');
    expect(content).toContain('| 잔금 | 200,000원 — 최종 마스터 승인일부터 7일 이내 |');
    expect(content).toContain('   - 중간금: **300,000원**, 편곡 승인일부터 7일 이내');
  });

  it('제10조는 항목표가 아니라 받은 금액의 비율표다', () => {
    expect(content).toContain('| 착수 전 | 받은 금액 전액 |');
    expect(content).toContain('| 착수한 때부터 | 받은 금액의 70% |');
    expect(content).toContain('| 보컬 녹음 세션을 마친 때부터 | 받은 금액의 40% |');
    expect(content).toContain('| 스튜디오가 믹싱 1차 결과물을 전달한 때부터 | 받은 금액의 20% |');
    expect(content).toContain('| 스튜디오가 마스터링 결과물을 전달한 때부터 | 환불하지 않음 |');
    expect(content).not.toContain('편곡 (제2조 2호)');
    expect(content).not.toContain('AI 리워크 제작 일체');
    expect(content).toContain('스튜디오의 사정으로 해지하는 경우, 이미 받은 금액 전액을 환불한다.');
  });

  it('AI 권리 보증·AI 표기·유통 미보장을 적는다', () => {
    expect(content).toContain('## 제8조 (의뢰인의 보증과 AI 사용 표기)');
    expect(content).toContain('AI 생성물로 분류되지 않는다는 것');
    expect(content).toContain('게재·승인 여부와 시점은 각 사의 심사에 따르며 스튜디오가 보증하지 않는다');
  });

  it('편곡 없음은 편곡을 하지 않는다고 적고 편곡 수정 횟수를 말하지 않는다', () => {
    const none = buildProductionContent({ ...reworkBase, terms: buildDefaultReworkTerms('none') }, rework);
    expect(none).toContain('2. 편곡: 하지 않는다. AI 데모의 반주를 그대로 쓰고 보컬을 다시 녹음한다');
    expect(none).toContain('무료 수정 횟수는 **믹싱 2회, 마스터링 1회**로 한다.');
    expect(none).toContain('| 대금 지급 | 500,000원 일시불');
    expect(none).not.toContain('중간금:');
  });

  it('조 번호는 제작 계약과 같고, 제3·11·12·13·14조는 싱글과 글자 하나 다르지 않다', () => {
    const single = readProductionTemplate('single');
    const section = (text: string, heading: string) => {
      const start = text.indexOf(`## ${heading} `);
      const next = text.indexOf('\n## ', start + 1);
      return text.slice(start, next === -1 ? undefined : next);
    };
    for (let n = 1; n <= 14; n += 1) expect(rework).toContain(`## 제${n}조 `);
    for (const heading of ['제3조', '제11조', '제12조', '제13조', '제14조']) {
      expect(section(rework, heading)).toBe(section(single, heading));
    }
  });

  it('회귀 — 2회차 없는 싱글 계약서에는 중간금이 나오지 않는다', () => {
    expect(buildProductionContent(base, template)).not.toContain('중간금');
  });
});
