import {
  FUNDING_SOURCE_CHOICES,
  READINESS_CHOICES,
  SCALE_QUESTIONS,
  SERVICE_CHOICES,
  type QuoteAnswers,
} from '../../quote/estimate';

/**
 * 견적 요청서 요약(카톡으로 받은 글) → 제작 계약 작성 폼의 출발점.
 *
 * 견적 요청서는 DB에 남지 않는다 — 의뢰인이 카톡에 붙여 넣는 요약(lib/quote/estimate.ts buildQuoteSummary)이
 * 유일한 기록이다. 그 글을 운영자가 붙여 넣으면 답을 되읽어, 견적 번호를 계약 제목에 남기고(문의 ↔ 계약을 잇는
 * 고리, 분석 이벤트의 quote_code와 같은 값) 계약과 어긋나는 답을 경고로 알린다. 금액은 바꾸지 않는다 — 견적은
 * "~부터"이고 계약 금액은 상담으로 정한 값이다.
 *
 * 요약 형식이 바뀌면 이 함수도 같이 고친다(quote-prefill.test.ts가 buildQuoteSummary 출력으로 확인한다).
 */
export interface QuotePrefill {
  code: string | null;
  answers: QuoteAnswers;
  /** 운영자가 계약 전에 확인할 것. */
  warnings: string[];
}

const findByLabel = <T extends { id: string; label: string }>(choices: readonly T[], label: string | undefined) =>
  label ? choices.find((choice) => choice.label === label.trim())?.id : undefined;

export const parseQuoteSummary = (text: string): QuotePrefill | null => {
  const code = /견적 요청 (NOL-[A-Z0-9]+)/.exec(text)?.[1] ?? null;
  const line = (label: string) => new RegExp(`^${label}: (.+)$`, 'm').exec(text)?.[1];

  const serviceLine = line('서비스');
  if (!serviceLine && !code) return null;

  const [serviceLabel, scaleLabel] = (serviceLine ?? '').split(' — ');
  const service = SERVICE_CHOICES.find((choice) => choice.label === serviceLabel?.trim())?.id;
  const scale = service ? findByLabel(SCALE_QUESTIONS[service]?.choices ?? [], scaleLabel) : undefined;
  const readiness = findByLabel(READINESS_CHOICES, line('준비 상태'));
  const fundingSource = findByLabel(FUNDING_SOURCE_CHOICES, line('제작비'));
  const answers: QuoteAnswers = { service, scale, readiness, fundingSource };

  const warnings: string[] = [];
  if (service !== 'release') {
    warnings.push(`음반 발매 견적이 아니에요(${serviceLabel ?? '알 수 없음'}). 제작 계약이 맞는지 확인해 주세요.`);
  } else if (scale && scale !== 'single') {
    warnings.push('EP·정규 견적이에요 — 이 계약서는 싱글(1곡)용이에요. 곡 수에 맞는 계약서를 써 주세요.');
  }
  if (readiness === 'idea') {
    warnings.push('아이디어 단계예요. 이 계약은 멜로디·코드·곡 구조가 확정된 1차 완성본이 전제라(제1·2조), 작곡은 별도 견적이에요.');
  }
  if (fundingSource === 'funding') {
    warnings.push('크라우드펀딩으로 제작비를 마련하는 견적이에요 — 설계비·제작비를 모금액에서 정산하는 구조라 지급 조건(제3조)을 따로 정해야 해요.');
  }
  return { code, answers, warnings };
};

/** 견적 번호를 붙인 계약 제목. 번호가 이미 있으면 다시 붙이지 않는다. */
export const titleWithQuoteCode = (title: string, clientName: string, code: string | null): string => {
  const base = title.trim() || (clientName.trim() ? `${clientName.trim()}님 음원 제작 용역 계약` : '음원 제작 용역 계약');
  if (!code || base.includes(code)) return base;
  return `${base} (${code})`;
};
