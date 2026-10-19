import { parseTenancySheet } from './importCsv';

// 실제 시트가 아니라 같은 모양의 가짜 데이터다(개인정보를 저장소에 두지 않는다).
const CSV = [
  '입금계좌 : 은행 000,,,,, 입주시작일,월액,,,',
  '방,가격,창,피아노,이름, 계약액,연체여부,대여시작일,종료일확인,계약종료일,최종입금일,최종입금액,입금예정일,전화번호,성별,비상연락, 보증금,특약',
  ',,,,스튜디오 놀 (불광),,,,,,,,,,,,,',
  'R01,,창,거울,가나다,"₩380,000",,2025-02-02,종료,2025-03-01,2026-10-06,"₩380,000",2026-11-02,010-0000-0001‬,남,,,',
  'R08,40,X,책상,라마바,"₩360,000",,2025-11-01,16일전,2026-10-31,2026-10-05,"₩360,000",2026-11-05,,,,,1년 계약',
  ',,,,월 수입,"  5,005,000 ",,,불광,,,,,,,,,',
  '비대면,,,,주식회사 가,"₩33,000",7일전,2025-12-22,종료,2026-06-21,2026-09-22,"₩33,000",2026-10-22,010-0000-0002,,a@b.kr,,111-11-11111',
].join('\n');

describe('parseTenancySheet', () => {
  const { rows, skipped } = parseTenancySheet(CSV);
  it('방·비상주 행만 가져오고 합계 행은 건너뛴다', () => {
    expect(rows.map((r) => [r.input.kind, r.input.roomNumber, r.input.tenantName])).toEqual([
      ['room', 'R01', '가나다'], ['room', 'R08', '라마바'], ['virtual', null, '주식회사 가'],
    ]);
    expect(skipped).toEqual([]);
  });
  it('방 행: 금액·창·가구·납부일·마지막 입금, 보이지 않는 문자 제거', () => {
    expect(rows[0].input).toMatchObject({ monthlyAmount: 380000, hasWindow: true, furnishings: '거울', billingDay: 2, endDate: '2025-03-01', roomListPrice: null });
    expect(rows[0].input.private).toEqual({ phone: '010-0000-0001', gender: '남' });
    expect(rows[0].lastPaid).toEqual({ paidOn: '2026-10-06', amount: 380000 });
    expect(rows[1]).toMatchObject({ needsPhoneLookup: true });
    expect(rows[1].input).toMatchObject({ hasWindow: false, roomListPrice: 400000, note: '1년 계약' });
  });
  it('비상주 행: 이메일·사업자번호는 비상연락·특약 칸에서', () => {
    expect(rows[2].input.private).toEqual({ phone: '010-0000-0002', email: 'a@b.kr', businessNumber: '111-11-11111' });
    expect(rows[2].input).toMatchObject({ monthlyAmount: 33000, hasWindow: null, note: null });
  });
  it('머리글이 없으면 비어 있고 이유를 알린다', () => {
    expect(parseTenancySheet('a,b\n1,2').skipped[0].reason).toContain('머리글');
  });
});

describe('금액·길이 엄격 파싱 (4차 감사)', () => {
  const head = '방,가격,창,피아노,이름, 계약액,연체여부,대여시작일,종료일확인,계약종료일,최종입금일,최종입금액,입금예정일,전화번호,성별,비상연락, 보증금,특약';
  const row = (amount: string, name = '홍길동') => `${head}\nR05,,X,,${name},"${amount}",,2026-10-14,,,2026-10-14,"₩360,000",2026-11-14,,여,,,`;
  it('소수·음수·지수 표기·글자 섞인 금액은 읽지 않고 그 행을 건너뛴다', () => {
    for (const bad of ['360,000.50', '-360000', '1e9', '40만', '99999999999999999999999']) {
      const r = parseTenancySheet(row(bad));
      expect(r.rows).toHaveLength(0);
      expect(r.skipped).toHaveLength(1);
    }
    expect(parseTenancySheet(row('₩360,000')).rows[0].input.monthlyAmount).toBe(360000);
  });
  it('이름은 100자로 자르고 서로게이트 쌍을 쪼개지 않는다', () => {
    const name = '😀'.repeat(150);
    expect(Array.from(parseTenancySheet(row('360000', name)).rows[0].input.tenantName)).toHaveLength(100);
  });
});
