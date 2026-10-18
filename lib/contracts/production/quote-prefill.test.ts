import { buildQuoteSummary, estimate, type QuoteAnswers } from '../../quote/estimate';
import { parseQuoteSummary, titleWithQuoteCode } from './quote-prefill';

/** 견적 요청서가 실제로 만드는 요약 글 — 형식이 바뀌면 여기서 드러난다. */
const summaryOf = (answers: QuoteAnswers) => buildQuoteSummary(answers, estimate(answers)!, 'NOL-AB12CD');

describe('견적 요약 되읽기', () => {
  it('싱글 발매 견적의 번호와 답을 읽는다 — 경고 없음', () => {
    const parsed = parseQuoteSummary(summaryOf({ service: 'release', scale: 'single', readiness: 'demo', fundingSource: 'self', timing: '1m' }));
    expect(parsed).toEqual({
      code: 'NOL-AB12CD',
      kind: 'single',
      answers: { service: 'release', scale: 'single', readiness: 'demo', fundingSource: 'self' },
      warnings: [],
    });
  });

  it('EP 견적은 EP 계약으로 옮기고, 아이디어 단계·펀딩이면 경고한다', () => {
    const parsed = parseQuoteSummary(summaryOf({ service: 'release', scale: 'ep', readiness: 'idea', fundingSource: 'funding', timing: '3m' }))!;
    expect(parsed.kind).toBe('ep');
    expect(parsed.warnings).toHaveLength(2);
    expect(parsed.warnings.join(' ')).toMatch(/1차 완성본.*크라우드펀딩/s);
  });

  it('발매가 아닌 견적이면 경고한다', () => {
    const parsed = parseQuoteSummary(summaryOf({ service: 'mixing', scale: 'l1', readiness: 'ready', timing: '2w' }))!;
    expect(parsed.warnings[0]).toContain('음반 발매 견적이 아니에요');
  });

  it('견적 요약이 아닌 글은 null', () => {
    expect(parseQuoteSummary('안녕하세요 문의드려요')).toBeNull();
  });
});

describe('견적 번호를 붙인 제목', () => {
  it('비어 있으면 기본 제목에 번호를 붙이고, 이미 있으면 다시 붙이지 않는다', () => {
    expect(titleWithQuoteCode('', '홍길동', 'NOL-AB12CD')).toBe('홍길동님 음원 제작 용역 계약 (NOL-AB12CD)');
    expect(titleWithQuoteCode('홍길동 (NOL-AB12CD)', '홍길동', 'NOL-AB12CD')).toBe('홍길동 (NOL-AB12CD)');
  });
});
