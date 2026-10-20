/**
 * 서명 때 하나씩 체크받는 조항. 계약을 만들 때 이 목록을 `production_contracts.clauses_json`으로 떠 두고,
 * 서명 화면·서명 API·PDF는 그 사본을 쓴다 — 목록을 고쳐도 이미 보낸 계약의 동의 항목은 바뀌지 않는다
 * (연습실 contract_clauses를 계약마다 복제하는 것과 같은 이유).
 *
 * 고른 기준: 의뢰인이 나중에 "몰랐다"고 할 때 돈·권리가 걸리는 조항이다. 간주 승인(제5조)은 의뢰인이
 * 그 사실을 알 수 있었는지가 효력의 쟁점이라 특히 따로 받는다.
 *
 * 2026-10-20부터 새 계약은 **체크 하나**다(운영자 결정 — 체크박스 다섯은 과했다). 서명이 곧 모든 조항에 대한 동의라
 * 조항마다 받을 의무는 없고, 남길 가치가 있는 것은 의뢰인에게 불리할 수 있는 내용을 따로 짚었다는 기록뿐이다(약관규제법
 * 제3조 중요 내용 설명). 그래서 간주 승인·해지 공제·포트폴리오를 요약(points)으로 보여 주고 한 번에 확인받는다.
 * 저작권(제7조)·개인정보(제13조)는 서명으로 충분하다 — 본문에 그대로 있다. 옛 다섯 항목 계약은 저장된 사본 그대로다.
 */
export interface ProductionClause {
  /** 서명 API가 체크 여부를 대조하는 키. 한 번 쓴 키는 바꾸지 않는다(저장된 동의 기록이 이 키를 가리킨다). */
  key: string;
  clauseNumber: string;
  title: string;
  /**
   * 한 번에 확인받는 요약 문장(2026-10-20~). 있으면 서명 화면·서명본 PDF가 목록으로 보이고, 지문에도 들어간다 —
   * 없던 옛 계약의 지문은 그대로다(integrity.ts).
   */
  points?: string[];
}

/** 옛 다섯 항목(2026-10-20 전 계약). 키는 저장된 동의 기록이 가리키므로 지우지 않고 둔다 — 테스트·참조용. */
export const LEGACY_PRODUCTION_CLAUSES: readonly ProductionClause[] = [
  { key: 'revisions', clauseNumber: '제5조', title: '수정 횟수와 기간 경과 시 승인 간주' },
  { key: 'rights', clauseNumber: '제7조', title: '저작권·음원 소유권과 크레딧 표기' },
  { key: 'refund', clauseNumber: '제10조', title: '계약의 해지와 환불 산정' },
  { key: 'portfolio', clauseNumber: '제11조', title: '발매 후 포트폴리오 게재' },
  { key: 'privacy', clauseNumber: '제13조', title: '개인정보의 처리' },
];

/**
 * 새 계약의 동의 항목 — 중요 조항 요약 하나. 승인 간주 기한은 그 계약의 terms에서 온다(계약서 제5조 5항과 같은 수).
 * 포트폴리오 문장은 발매를 전제로 한다(믹싱·마스터링도 의뢰인이 발매한 뒤 — 제11조 2항).
 */
export const buildProductionClauses = (terms: { deemedApprovalDays: number }): ProductionClause[] => [
  {
    key: 'key-terms',
    clauseNumber: '제5·10·11조',
    title: '중요 조항 확인',
    points: [
      `결과물을 받은 날부터 ${terms.deemedApprovalDays}일 안에 수정 요청이 없으면 그 단계는 승인된 것으로 봐요(제5조 5항).`,
      '작업을 시작한 뒤 의뢰인 사정으로 해지하면, 진행한 작업분을 빼고 남은 금액을 돌려드려요(제10조 3항).',
      '곡이 발매되면 곡명·크레딧·아트워크를 스튜디오 웹사이트와 SNS에 포트폴리오로 올릴 수 있어요(제11조 2항).',
    ],
  },
];

const isClause = (value: unknown): value is ProductionClause =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as ProductionClause).key === 'string' &&
  typeof (value as ProductionClause).clauseNumber === 'string' &&
  typeof (value as ProductionClause).title === 'string' &&
  ((value as ProductionClause).points === undefined ||
    (Array.isArray((value as ProductionClause).points) && (value as ProductionClause).points!.every((p) => typeof p === 'string')));

/** 저장된 사본을 읽는다. 읽지 못하면 던진다 — 동의 항목을 모른 채 서명을 받으면 안 된다. */
export const parseStoredClauses = (raw: string): ProductionClause[] => {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(isClause)) {
    throw new Error('제작 계약의 동의 항목을 읽을 수 없습니다.');
  }
  return parsed;
};
