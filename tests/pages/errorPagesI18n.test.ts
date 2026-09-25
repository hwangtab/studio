/**
 * @jest-environment node
 */
/**
 * 404·500의 서버 렌더가 번역을 받는가 — 빌드 순서에 기대지 않고.
 *
 * 예전 두 페이지의 getStaticProps는 전 로케일 번들을 props로 반환만 했고, 서버 i18n
 * 싱글턴에는 넣지 않았다. 그래서 서버 렌더 결과가 "그 빌드 워커가 앞서 렌더한 페이지가
 * 남긴 번들"에 달려 있었고, 빌드마다 <title>이 "notFound.seoTitle"로 나가기도 했다.
 * 여기서는 싱글턴을 비운 상태에서 getStaticProps만 불러도 번역이 준비되는지를 본다.
 */
import i18n, { locales } from '../../lib/i18n';
import { getStaticProps as notFoundStaticProps } from '../../pages/404';
import { getStaticProps as serverErrorStaticProps } from '../../pages/500';

const clearBundles = () => {
  for (const lng of locales) {
    if (i18n.hasResourceBundle(lng, 'common')) i18n.removeResourceBundle(lng, 'common');
  }
};

describe.each([
  ['404', notFoundStaticProps, 'notFound.seoTitle'],
  ['500', serverErrorStaticProps, 'serverError.seoTitle'],
] as const)('%s 페이지', (_name, getStaticProps, key) => {
  beforeEach(clearBundles);

  it('싱글턴이 비어 있으면 키가 그대로 나온다(이 테스트의 전제 확인)', () => {
    expect(i18n.getFixedT('ko', 'common')(key)).toBe(key);
  });

  it.each([...locales])('getStaticProps 뒤에는 %s 번역이 서버 i18n에 있다', async (lng) => {
    await getStaticProps({} as Parameters<typeof getStaticProps>[0]);
    const translated = i18n.getFixedT(lng, 'common')(key);
    expect(translated).not.toBe(key);
    expect(translated.length).toBeGreaterThan(0);
  });
});
