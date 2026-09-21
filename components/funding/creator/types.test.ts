/**
 * @jest-environment node
 *
 * `canEditSectionInBrowser`(types.ts)는 `lib/funding/reviewTransition.ts`의
 * `canCreatorEditSection`을 클라이언트 번들에 DB 스키마 코드를 끌어들이지 않으려고
 * 리터럴로 다시 적은 것이다 — 두 정의가 갈리면(예: 서버가 새 구획을 열었는데 여기를 안
 * 고치면) 서버는 저장을 받아 주는데 화면은 계속 읽기 전용으로 잠가 버리는 조용한 회귀가
 * 난다. 이 테스트가 실제 진리표(다섯 상태 × 세 구획 전수)에 대해 두 함수가 항상 같은
 * 답을 내는지 대조한다.
 */
import { canCreatorEditSection, type CreatorSectionName } from '../../../lib/funding/reviewTransition';
import { canEditSectionInBrowser } from './types';

const STATUSES = ['draft', 'submitted', 'changes_requested', 'approved', 'rejected'] as const;
const SECTIONS: CreatorSectionName[] = ['basic', 'story', 'rewards'];

describe('canEditSectionInBrowser ↔ canCreatorEditSection 진리표 대조', () => {
  it.each(STATUSES.flatMap((s) => SECTIONS.map((sec) => [s, sec] as const)))(
    '%s × %s',
    (status, section) => {
      expect(canEditSectionInBrowser(status, section)).toBe(canCreatorEditSection(status, section));
    },
  );
});
