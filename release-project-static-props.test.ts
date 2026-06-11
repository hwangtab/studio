/** @jest-environment node */

import { getStaticProps as getReleaseProjectStaticProps } from './pages/[locale]/release-project';
import { getStaticProps as getSingleStaticProps } from './pages/[locale]/release-project/single';
import { getStaticProps as getEpStaticProps } from './pages/[locale]/release-project/ep';
import { getStaticProps as getAlbumStaticProps } from './pages/[locale]/release-project/album';

const pages = [
  ['release project hub', getReleaseProjectStaticProps],
  ['single release', getSingleStaticProps],
  ['EP release', getEpStaticProps],
  ['album release', getAlbumStaticProps],
] as const;

const getCommonResource = (props: Record<string, unknown>) => {
  const resources = props.i18nResources as Record<string, { common?: Record<string, unknown> }> | undefined;
  return resources?.ko?.common;
};

describe('release project static props', () => {
  it.each(pages)('includes portfolio modal translations on %s page', async (_name, getStaticProps) => {
    const result = await getStaticProps({ params: { locale: 'ko' } });

    expect('props' in result).toBe(true);
    if (!('props' in result)) return;

    const common = getCommonResource(result.props as unknown as Record<string, unknown>);
    expect(common?.releaseProject).toBeDefined();
    expect(common?.portfolio).toMatchObject({
      detail: {
        share: '공유하기',
        artistLabel: '아티스트',
        servicesProvided: '제공 서비스',
        listenNow: '음원 들으러 가기',
      },
    });
  });
});
