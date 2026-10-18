/**
 * 서명 때 하나씩 체크받는 조항. 계약을 만들 때 이 목록을 `production_contracts.clauses_json`으로 떠 두고,
 * 서명 화면·서명 API·PDF는 그 사본을 쓴다 — 목록을 고쳐도 이미 보낸 계약의 동의 항목은 바뀌지 않는다
 * (연습실 contract_clauses를 계약마다 복제하는 것과 같은 이유).
 *
 * 고른 기준: 의뢰인이 나중에 "몰랐다"고 할 때 돈·권리가 걸리는 조항이다. 간주 승인(제5조)은 의뢰인이
 * 그 사실을 알 수 있었는지가 효력의 쟁점이라 특히 따로 받는다.
 */
export interface ProductionClause {
  /** 서명 API가 체크 여부를 대조하는 키. 한 번 쓴 키는 바꾸지 않는다(저장된 동의 기록이 이 키를 가리킨다). */
  key: string;
  clauseNumber: string;
  title: string;
}

export const PRODUCTION_REQUIRED_CLAUSES: readonly ProductionClause[] = [
  { key: 'revisions', clauseNumber: '제5조', title: '수정 횟수와 기간 경과 시 승인 간주' },
  { key: 'rights', clauseNumber: '제7조', title: '저작권·음원 소유권과 크레딧 표기' },
  { key: 'refund', clauseNumber: '제10조', title: '계약의 해지와 환불 산정' },
  { key: 'portfolio', clauseNumber: '제11조', title: '발매 후 포트폴리오 게재' },
  { key: 'privacy', clauseNumber: '제13조', title: '개인정보의 처리' },
];

const isClause = (value: unknown): value is ProductionClause =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as ProductionClause).key === 'string' &&
  typeof (value as ProductionClause).clauseNumber === 'string' &&
  typeof (value as ProductionClause).title === 'string';

/** 저장된 사본을 읽는다. 읽지 못하면 던진다 — 동의 항목을 모른 채 서명을 받으면 안 된다. */
export const parseStoredClauses = (raw: string): ProductionClause[] => {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(isClause)) {
    throw new Error('제작 계약의 동의 항목을 읽을 수 없습니다.');
  }
  return parsed;
};
