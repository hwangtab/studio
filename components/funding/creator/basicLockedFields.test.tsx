import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

import { BASIC_LOCKED_FIELD_NAMES } from '../../../lib/funding/creatorProjectWrite';
import { BasicSectionForm, type BasicSectionValue } from './BasicSectionForm';

/**
 * `pages/[locale]/funding/creator/[id].tsx`는 서버의 `basicLockedViolation`이 잠그는 필드
 * 집합과 화면(`BasicSectionForm`)이 `lockedFields`로 비활성화하는 필드 집합을 각자 따로
 * 적어 둔다 — 지금은 우연히 같지만(둘 다 slug·goalAmount·startAt·endAt), 그 사실을
 * 묶어 두는 테스트가 없으면 한쪽만 고쳐도 컴파일도 CI도 그대로 통과한다.
 *
 * 서버 쪽 진실은 `lib/funding/creatorProjectWrite.ts`가 내보내는
 * `BASIC_LOCKED_FIELD_NAMES`다. 이 테스트는 `lockedFields` 활성 상태에서 실제로 DOM에
 * 비활성화되는 기본정보 입력이 정확히 그 집합과 같은지, 그리고 `lockedFields`가 꺼지면
 * 전부 활성인지를 본다 — 두 자리가 갈리면 여기서 CI가 선다.
 */

// BasicSectionValue의 필드 → 화면 입력 id. coverUrl은 별도 컴포넌트(ImageUploadField)라
// lockedFields의 영향을 받지 않으므로 이 표에서 뺀다(서버도 잠그지 않는다).
const FIELD_TO_INPUT_ID: Record<Exclude<keyof BasicSectionValue, 'coverUrl'>, string> = {
  title: 'basic-title',
  summary: 'basic-summary',
  slug: 'basic-slug',
  goalAmount: 'basic-goal',
  startAt: 'basic-start',
  endAt: 'basic-end',
};

const INITIAL: BasicSectionValue = {
  title: '제목',
  summary: '요약',
  slug: 'my-project',
  coverUrl: '/api/funding/media/cover.webp',
  goalAmount: 1_000_000,
  startAt: '2026-10-01',
  endAt: '2026-11-01',
};

const disabledFieldNames = (): string[] =>
  (Object.keys(FIELD_TO_INPUT_ID) as (keyof typeof FIELD_TO_INPUT_ID)[])
    .filter((name) => (document.getElementById(FIELD_TO_INPUT_ID[name]) as HTMLInputElement).disabled);

describe('BasicSectionForm의 lockedFields ↔ 서버 BASIC_LOCKED_FIELD_NAMES 대조', () => {
  it('lockedFields=true면 서버가 잠그는 필드와 정확히 같은 입력만 비활성화된다', () => {
    render(
      <BasicSectionForm
        projectId="proj-1"
        initial={INITIAL}
        earliestStartDate="2026-09-25"
        readOnly={false}
        lockedFields
        onSaved={() => {}}
      />,
    );
    expect(disabledFieldNames().sort()).toEqual([...BASIC_LOCKED_FIELD_NAMES].sort());
  });

  it('lockedFields=false면 아무 필드도 비활성화되지 않는다', () => {
    render(
      <BasicSectionForm
        projectId="proj-1"
        initial={INITIAL}
        earliestStartDate="2026-09-25"
        readOnly={false}
        lockedFields={false}
        onSaved={() => {}}
      />,
    );
    expect(disabledFieldNames()).toEqual([]);
  });
});
