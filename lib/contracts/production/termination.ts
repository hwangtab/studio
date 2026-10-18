/**
 * 해지 사유 — 누구의 사정으로 끝났는지가 정산 조항을 가른다(계약서 제10조).
 *
 * - client: 의뢰인 사정(3항). 진행한 작업분과, 동의한 추가 비용·이행한 초과 수정 요금을 공제한다.
 * - client_default: 의뢰인 무응답·대금 지체로 스튜디오가 통지 후 해지(5항). 정산은 3항과 같다.
 * - studio: 스튜디오 사정(4항, 제12조 2항 지연 해지 포함). 진행한 작업분만 공제한다.
 *
 * 마이그레이션 없이 담으려고 해지 사유(termination_reason) 앞에 `[라벨]`로 적는다. 사람이 읽는 사유이기도 해서
 * 관리자 화면에 그대로 보여도 뜻이 통한다. 라벨이 없는 사유(이 규칙 전 해지)는 사유를 모르는 것으로 본다.
 */
export const TERMINATION_CAUSES = ['client', 'client_default', 'studio'] as const;
export type TerminationCause = (typeof TERMINATION_CAUSES)[number];

export const TERMINATION_CAUSE_LABEL: Record<TerminationCause, string> = {
  client: '의뢰인 사정',
  client_default: '의뢰인 무응답·대금 지체',
  studio: '스튜디오 사정',
};

export const TERMINATION_CLAUSE: Record<TerminationCause, string> = {
  client: '제10조 3항',
  client_default: '제10조 5항',
  studio: '제10조 4항',
};

export const isTerminationCause = (value: unknown): value is TerminationCause =>
  typeof value === 'string' && (TERMINATION_CAUSES as readonly string[]).includes(value);

export const formatTerminationReason = (cause: TerminationCause, reason: string): string =>
  `[${TERMINATION_CAUSE_LABEL[cause]}] ${reason}`;

export const parseTerminationCause = (reason: string | null | undefined): TerminationCause | null => {
  if (!reason) return null;
  return TERMINATION_CAUSES.find((cause) => reason.startsWith(`[${TERMINATION_CAUSE_LABEL[cause]}]`)) ?? null;
};
