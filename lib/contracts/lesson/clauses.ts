/**
 * 서명 때 한 번에 확인받는 중요 조항 — 수강생에게 불리할 수 있는 내용(결석 시 보강·환불 없음, 중도 해지 환불)을 따로 짚었다는 기록이다
 * (약관규제법 제3조 중요 내용 설명). 계약을 만들 때 이 목록을 `lesson_contracts.clauses_json`으로 떠 두고, 서명 화면·서명 API·지문은 그 사본을 쓴다.
 * 한 번 쓴 키는 바꾸지 않는다(저장된 동의 기록이 키를 가리킨다).
 */
export interface LessonClause {
  key: string;
  clauseNumber: string;
  title: string;
  points: string[];
}

export const buildLessonClauses = (): LessonClause[] => [
  {
    key: 'key-terms',
    clauseNumber: '제4·5·9조',
    title: '중요 조항 확인',
    points: [
      '수업에 오지 않으면 그 회차는 진행된 것으로 보고, 보강도 환불도 하지 않아요(제4조).',
      '스튜디오 사정으로 쉬는 수업은 과정 끝에 보충 회차를 붙여 드려요(제5조).',
      '중도에 해지하면 이미 진행한 회차(결석 포함)를 뺀 나머지를 돌려받아요(제9조).',
    ],
  },
];

const isClause = (value: unknown): value is LessonClause =>
  typeof value === 'object' && value !== null
  && typeof (value as LessonClause).key === 'string' && typeof (value as LessonClause).clauseNumber === 'string' && typeof (value as LessonClause).title === 'string'
  && Array.isArray((value as LessonClause).points) && (value as LessonClause).points.every((p) => typeof p === 'string');

/** 저장된 사본을 읽는다. 읽지 못하면 던진다 — 동의 항목을 모른 채 서명을 받으면 안 된다. */
export const parseLessonClauses = (raw: string): LessonClause[] => {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(isClause)) throw new Error('수강 계약의 동의 항목을 읽을 수 없습니다.');
  return parsed;
};
