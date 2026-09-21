import { canCreatorEdit, canCreatorEditSection, nextReviewStatus, type CreatorSectionName, type ReviewAction } from './reviewTransition';
import { fundingReviewStatusEnum } from '../../db/schema';

const ALL = fundingReviewStatusEnum;
const ACTIONS: ReviewAction[] = ['submit', 'request_changes', 'approve', 'reject', 'withdraw', 'archive'];
const STATUSES = ['draft', 'submitted', 'changes_requested', 'approved', 'rejected'] as const;
const SECTIONS: CreatorSectionName[] = ['basic', 'story', 'rewards'];

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

  it('보관은 미심사 상태(draft·submitted·changes_requested)에서만 되고 rejected로 간다', () => {
    expect(nextReviewStatus('draft', 'archive')).toBe('rejected');
    expect(nextReviewStatus('submitted', 'archive')).toBe('rejected');
    expect(nextReviewStatus('changes_requested', 'archive')).toBe('rejected');
    // approved는 공개된 프로젝트라 status: closed로 닫아야지 심사 상태를 되감지 않는다.
    expect(nextReviewStatus('approved', 'archive')).toBeNull();
    // rejected는 이미 종결 상태라 다시 보관할 수 없다.
    expect(nextReviewStatus('rejected', 'archive')).toBeNull();
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

describe('canCreatorEditSection 전수 조합', () => {
  const EXPECTED: Record<string, CreatorSectionName[]> = {
    draft: ['basic', 'story', 'rewards'],
    changes_requested: ['basic', 'story', 'rewards'],
    // 승인 뒤에는 본문과 기본정보만. 기본정보 안에서 무엇이 잠기는지는 필드 가드가 본다
    // (slug·목표금액·모금 기간은 잠기고 제목·요약·표지는 열린다).
    approved: ['basic', 'story'],
    submitted: [],
    rejected: [],
  };

  it.each(STATUSES)('%s의 열린 구획이 표와 같다', (status) => {
    const open = SECTIONS.filter((s) => canCreatorEditSection(status, s));
    expect(open).toEqual(EXPECTED[status]);
  });
});

describe('canCreatorEdit', () => {
  it('구획이 하나라도 열려 있으면 true다', () => {
    expect(canCreatorEdit('approved')).toBe(true);
    expect(canCreatorEdit('submitted')).toBe(false);
    expect(canCreatorEdit('rejected')).toBe(false);
  });
});
