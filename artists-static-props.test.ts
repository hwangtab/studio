/** @jest-environment node */

import { getStaticPaths as getHubPaths, getStaticProps as getHubStaticProps } from './pages/[locale]/artists/index';
import { getStaticPaths as getDetailPaths, getStaticProps as getDetailStaticProps } from './pages/[locale]/artists/[slug]';
import { SUPPORTED_ARTISTS } from './data/artists';

describe('artists hub static props', () => {
  it('ko 경로만 생성한다', async () => {
    const result = await getHubPaths({});
    expect(result.paths).toEqual([{ params: { locale: 'ko' } }]);
    expect(result.fallback).toBe(false);
  });

  it('artists 섹션 번역과 아티스트 목록을 포함한다', async () => {
    const result = await getHubStaticProps({ params: { locale: 'ko' } });
    expect('props' in result).toBe(true);
    if (!('props' in result)) return;
    const props = result.props as { artists: unknown[]; i18nResources: Record<string, { common?: Record<string, unknown> }> };
    expect(Array.isArray(props.artists)).toBe(true);
    expect(props.i18nResources.ko?.common?.artists).toBeDefined();
  });
});

describe('artist detail static props', () => {
  it('등재된 아티스트마다 ko 경로 하나를 만든다', async () => {
    const result = await getDetailPaths({});
    expect(result.paths).toEqual(SUPPORTED_ARTISTS.map((a) => ({ params: { locale: 'ko', slug: a.slug } })));
    expect(result.fallback).toBe(false);
  });

  it('없는 slug는 notFound', async () => {
    const result = await getDetailStaticProps({ params: { locale: 'ko', slug: 'no-such-artist' } });
    expect(result).toEqual({ notFound: true });
  });
});
