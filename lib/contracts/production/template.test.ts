import { buildProductionContent, findUnfilledPlaceholders, readProductionTemplate } from './template';
import { buildDefaultProductionTerms } from './terms';

const template = readProductionTemplate();
const base = {
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

  it('제10조 3항에 편곡 완료 기준(1차 시안 전달)을 적는다 — 해지 정산의 계약상 근거', () => {
    expect(buildProductionContent(base, template)).toContain('편곡(제2조 2호)은 스튜디오가 1차 시안을 전달한 때 완료된 것으로 본다');
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

  it('서명 전 초안은 생년월일·주소 칸을 비운다', () => {
    const content = buildProductionContent({ ...base, clientBirthdate: null, clientAddress: null }, template);
    expect(content).toContain('| 생년월일 |  |');
    expect(content).toContain('| 주소 |  |');
  });
});
