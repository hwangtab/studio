import { canCreatorEdit, nextReviewStatus, type ReviewAction } from './reviewTransition';
import { fundingReviewStatusEnum } from '../../db/schema';

const ALL = fundingReviewStatusEnum;
const ACTIONS: ReviewAction[] = ['submit', 'request_changes', 'approve', 'reject', 'withdraw'];

describe('nextReviewStatus', () => {
  it('개설자는 draft와 changes_requested에서만 제출할 수 있다', () => {
    expect(nextReviewStatus('draft', 'submit')).toBe('submitted');
    expect(nextReviewStatus('changes_requested', 'submit')).toBe('submitted');
    expect(nextReviewStatus('submitted', 'submit')).toBeNull();
    expect(nextReviewStatus('approved', 'submit')).toBeNull();
    expect(nextReviewStatus('rejected', 'submit')).toBeNull();
  });

  it('운영자 판정은 submitted에서만 나온다', () => {
    expect(nextReviewStatus('submitted', 'approve')).toBe('approved');
    expect(nextReviewStatus('submitted', 'request_changes')).toBe('changes_requested');
    expect(nextReviewStatus('submitted', 'reject')).toBe('rejected');
    expect(nextReviewStatus('draft', 'approve')).toBeNull();
    expect(nextReviewStatus('approved', 'reject')).toBeNull();
  });

  it('제출 철회는 submitted에서만', () => {
    expect(nextReviewStatus('submitted', 'withdraw')).toBe('draft');
    expect(nextReviewStatus('draft', 'withdraw')).toBeNull();
  });

  it('승인된 프로젝트는 어떤 행동으로도 상태가 되돌아가지 않는다', () => {
    for (const action of ACTIONS) expect(nextReviewStatus('approved', action)).toBeNull();
  });

  it('전이표가 모든 조합을 명시한다', () => {
    for (const from of ALL) {
      for (const action of ACTIONS) {
        const result = nextReviewStatus(from, action);
        expect(result === null || ALL.includes(result)).toBe(true);
      }
    }
  });
});

describe('canCreatorEdit', () => {
  it('심사 중과 반려·승인 뒤에는 개설자가 고칠 수 없다', () => {
    expect(canCreatorEdit('draft')).toBe(true);
    expect(canCreatorEdit('changes_requested')).toBe(true);
    expect(canCreatorEdit('submitted')).toBe(false);
    expect(canCreatorEdit('rejected')).toBe(false);
    // 승인 뒤 스토리 편집은 3차에서 따로 연다(스펙 §6.4). 지금은 전부 잠근다.
    expect(canCreatorEdit('approved')).toBe(false);
  });
});
