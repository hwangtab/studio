import { buildLessonContent, DRAFT_MARKER, findUnfilledPlaceholders, hasDraftMarker, readLessonTemplate } from './template';
import { buildLessonTerms } from './terms';

const terms = (over: Partial<Parameters<typeof buildLessonTerms>[0]> = {}) =>
  buildLessonTerms({ courseWeeks: 12, startDate: '2026-10-28', startTime: '14:00', durationMin: 60, monthlyAmount: 350000, payMethod: 'bank', ...over });

describe('수강 계약 본문', () => {
  const template = readLessonTemplate();

  it('모든 자리표시자가 채워지고 일정·금액이 계약서에 찍힌다', () => {
    const content = buildLessonContent({ studentName: '김수강', studentPhone: '010-1234-5678', terms: terms(), contractDate: null }, template);
    expect(findUnfilledPlaceholders(content)).toEqual([]);
    expect(content).toContain('매주 수요일 14:00~15:00');
    expect(content).toContain('12주 과정 (총 12회');
    expect(content).toContain('350,000원');
    expect(content).toContain('1,050,000원'); // 3개월
    expect(content).toContain('(서명하는 날로 기재)');
  });

  it('결제 방식마다 납부 문장이 다르다(카드는 부가세 포함 385,000원, 계좌는 입금 계좌, 현금은 계좌 언급 없음)', () => {
    const body = (payMethod: 'card' | 'bank' | 'cash') => buildLessonContent({ studentName: '김수강', studentPhone: '010-1234-5678', terms: terms({ payMethod }), contractDate: null }, template);
    expect(body('card')).toContain('385,000원(부가세 10% 포함)');
    expect(body('bank')).toContain('카카오뱅크');
    expect(body('cash')).not.toContain('카카오뱅크');
    expect(body('cash')).toContain('현금으로 지급');
  });

  it('24주는 6개월 합계, 계약일은 서명일로 찍힌다', () => {
    const content = buildLessonContent({ studentName: '김수강', studentPhone: '010-1234-5678', terms: terms({ courseWeeks: 24 }), contractDate: new Date('2026-10-30T03:00:00Z') }, template);
    expect(content).toContain('2,100,000원');
    expect(content).toContain('2026');
  });

  it('수강생이 적은 값 안의 {{…}}는 다시 풀리지 않는다', () => {
    const content = buildLessonContent({ studentName: '{{paymentTerms}}', studentPhone: '010-1234-5678', studentAddress: '{{studentName}}', terms: terms(), contractDate: null }, template);
    expect(content).toContain('{{paymentTerms}}');
    expect(content).toContain('{{studentName}}');
  });

  it('제9조는 시행령 별표 4 기준을 담고 확정 전 표시는 없다', () => {
    expect(template).not.toContain(DRAFT_MARKER);
    const content = buildLessonContent({ studentName: '김수강', studentPhone: '010-1234-5678', terms: terms(), contractDate: null }, template);
    expect(hasDraftMarker(content)).toBe(false);
    expect(content).toContain('별표 4');
    expect(content).toContain('낸 수강료 전액');
    expect(content).toContain('수강료의 2분의 1');
    expect(content).toContain('5일 안에');
    expect(content).toContain('3분의 2');
  });

  it('발송 막이는 표시가 붙은 문안을 알아본다', () => {
    expect(hasDraftMarker(`${DRAFT_MARKER} — 법률 확인 전】`)).toBe(true);
  });
});
