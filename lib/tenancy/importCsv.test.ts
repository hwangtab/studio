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
