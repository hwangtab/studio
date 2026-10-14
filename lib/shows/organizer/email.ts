/**
 * 주최자 공연 알림 메일 — Task 8이 본문을 채운다. 지금은 호출 자리만 있다.
 * 실패는 던져도 된다: 호출부(submissions.ts)가 잡아서 warnings로 돌려준다.
 */
export async function notifyOperatorShowSubmitted(_submissionId: string): Promise<void> {}

export async function notifyOperatorShowEdited(_submissionId: string): Promise<void> {}

export async function sendShowReviewResultEmail(
  _submissionId: string,
  _result: 'approved' | 'changes_requested' | 'rejected',
): Promise<void> {}
