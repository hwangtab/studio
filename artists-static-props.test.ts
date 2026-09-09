/** @jest-environment node */

import { getStaticPaths as getHubPaths, getStaticProps as getHubStaticProps } from './pages/[locale]/artists/index';

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
