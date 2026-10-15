import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// showEditor.test.tsx와 같은 처방 — 페이지 모듈이 GSSP용 서버 모듈을 최상위에서 물고 있다.
jest.mock('../../../../lib/funding/creatorAuth', () => ({ authenticateCreatorRequest: jest.fn() }));
jest.mock('../../../../lib/shows/organizer/submissions', () => ({ listSubmissionsForCreator: jest.fn() }));
jest.mock('next/router', () => ({
  useRouter: () => ({ asPath: '/ko/funding/creator/shows', pathname: '/[locale]/funding/creator/shows', push: jest.fn() }),
}));

// eslint-disable-next-line import/first
import CreatorShowsHome, { type CreatorShowSummary } from '../../../../pages/[locale]/funding/creator/shows';

const row = (over: Partial<CreatorShowSummary>): CreatorShowSummary => ({
  id: 's1', title: '공연', reviewStatus: 'approved', showSlug: 'live', showStatus: 'published', firstShowtimeLabel: null, ...over,
});

it('공개(published)·취소(cancelled)된 공연만 "공개된 페이지 보기"를 띄운다', () => {
  render(
    <CreatorShowsHome
      loadFailed={false}
      shows={[
        row({ id: 'a', title: '공개', showSlug: 'open-show', showStatus: 'published' }),
        row({ id: 'b', title: '공개 전', showSlug: 'draft-show', showStatus: 'draft' }),
        row({ id: 'c', title: '취소', showSlug: 'gone-show', showStatus: 'cancelled' }),
      ]}
    />,
  );
  const hrefs = screen.getAllByRole('link', { name: '공개된 페이지 보기' }).map((a) => a.getAttribute('href'));
  expect(hrefs).toEqual(['/ko/shows/open-show', '/ko/shows/gone-show']);
});
