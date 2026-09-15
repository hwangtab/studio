import fs from 'fs';
import path from 'path';

import { withI18nServerProps } from './getStatic';

/**
 * getServerSideProps 페이지가 i18nResources를 빠뜨리면 _app이 페이지 대신 스피너 셸을
 * SSR한다(2026-09-15 /ko/booking/* 사고 — 서버 HTML에 <title>·noindex가 없었다).
 * 새 SSR 페이지가 같은 함정에 빠지지 않도록 전수로 잡는다.
 */
const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(path.join(dir, d.name)) : d.name.endsWith('.tsx') ? [path.join(dir, d.name)] : []
  );

describe('getServerSideProps 페이지는 i18nResources를 넘긴다', () => {
  const pages = walk(path.join(process.cwd(), 'pages', '[locale]')).filter((f) =>
    fs.readFileSync(f, 'utf8').includes('getServerSideProps')
  );

  it('SSR 페이지가 하나 이상 있다(스캔 자체가 살아 있는지)', () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  it.each(pages.map((f) => [path.relative(process.cwd(), f)]))('%s', (rel) => {
    const src = fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
    const ok = /withI18nServerProps(<[^>]*>)?\(/.test(src) || src.includes('getI18nStaticProps(');
    expect(ok).toBe(true);
  });
});

describe('withI18nServerProps', () => {
  const ctx = { params: { locale: 'ko' } } as never;

  it('props 결과에 locale·i18nResources를 합친다', async () => {
    const gssp = withI18nServerProps(async () => ({ props: { a: 1 } }));
    const r = (await gssp(ctx)) as { props: Record<string, unknown> };
    expect(r.props.a).toBe(1);
    expect(r.props.locale).toBe('ko');
    expect(r.props.i18nResources).toBeTruthy();
    expect(Object.keys(r.props.i18nResources as object)).toContain('ko');
  });

  it('redirect·notFound는 손대지 않는다', async () => {
    const red = withI18nServerProps(async () => ({ redirect: { destination: '/ko', permanent: false } }));
    expect(await red(ctx)).toEqual({ redirect: { destination: '/ko', permanent: false } });
    const nf = withI18nServerProps(async () => ({ notFound: true }));
    expect(await nf(ctx)).toEqual({ notFound: true });
  });
});
