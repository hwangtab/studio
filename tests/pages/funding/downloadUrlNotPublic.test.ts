/** @jest-environment node */
import { getStaticProps as detailProps } from '../../../pages/[locale]/funding/[slug]/index';
import { getFundingProject, getListableFundingProjects, stripRewardDownloads } from '../../../lib/funding/projects';

/**
 * 리워드 `downloads`는 후원자에게만 가야 한다.
 *
 * 상세·후원 화면은 프로젝트를 통째로 props로 직렬화해 내려보낸다. 벗기지 않으면 그 값이
 * **페이지 소스에 그대로 실려** 후원하지 않고도 원본을 받을 수 있다 — 리워드가 리워드가
 * 아니게 된다. 실제로 그렇게 배포됐다가 잡았다(2026-09-14).
 */
describe('내려받기 주소는 공개 화면 props에 실리지 않는다', () => {
  const live = getListableFundingProjects();

  it('벗기는 함수가 모든 리워드의 주소를 지운다', () => {
    const withUrl = {
      ...live[0],
      rewards: [{ ...live[0].rewards[0], downloads: [{ label: 'MP3', url: 'https://cdn.example/a.zip' }] }],
    };
    expect(stripRewardDownloads(withUrl).rewards.every((r) => r.downloads.length === 0)).toBe(true);
  });

  it('상세 페이지 props 어디에도 주소가 없다', async () => {
    // 내려받기 주소를 실제로 가진 프로젝트로만 본다 — 없으면 이 테스트가 아무것도 안 지킨다.
    const target = live.find((p) => p.rewards.some((r) => r.downloads.length > 0));
    expect(target).toBeDefined();

    const result = (await detailProps({ params: { locale: 'ko', slug: target!.slug } } as never)) as {
      props: unknown;
    };
    const serialized = JSON.stringify(result.props);
    for (const r of getFundingProject(target!.slug)!.rewards) {
      for (const d of r.downloads) expect(serialized).not.toContain(d.url);
    }
    expect(serialized).not.toContain('r2.dev');
  });

  it('서버는 원본 값을 그대로 본다 — 메일·후원 확인 페이지가 그 값을 쓴다', () => {
    const target = live.find((p) => p.rewards.some((r) => r.downloads.length > 0));
    expect(getFundingProject(target!.slug)!.rewards.some((r) => r.downloads.length > 0)).toBe(true);
  });
});
