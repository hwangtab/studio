import { buildProductionContent, findUnfilledPlaceholders, readProductionTemplate } from './template';
import { buildDefaultProductionTerms } from './terms';

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
