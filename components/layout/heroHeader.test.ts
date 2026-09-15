import fs from 'fs';
import path from 'path';

/**
 * 히어로가 있는 페이지는 헤더를 투명하게 띄워 사진 위에 얹는다.
 *
 * 배선은 static property다 — 페이지가 `Page.hasHero = true`를 선언하면
 * `_app.tsx`가 `Component.hasHero`를 읽어 `Layout`에 넘기고, Layout이
 * 헤더 배경과 본문 상단 여백(`pt-0` vs `pt-20`)을 함께 결정한다.
 *
 * 문제는 `types/index.ts`의 선언이 `hasHero?: boolean`이라는 것이다.
 * 옵셔널이라 빠뜨려도 타입 검사가 통과하고, 렌더도 깨지지 않는다. 그냥
 * 그 페이지만 헤더가 불투명하게 남고 히어로가 헤더 아래로 밀린다.
 *
 * 2026-09-15에 실제로 그렇게 어긋나 있었다 — ImageHero를 쓰는 15개 페이지
 * 중 music-promotion 하나만 선언이 없어 혼자 다른 레이아웃으로 나갔다.
 * 사람이 눈으로 비교하지 않으면 드러나지 않는 종류의 불일치라 여기서 막는다.
 *
 * 양방향으로 검사한다. 반대 방향(선언은 있는데 히어로가 없는 경우)도 사고다 —
 * 헤더가 투명해지는데 뒤에 사진이 없으면 흰 배경에 흰 글씨가 된다.
 */

const PAGES_DIR = path.join(__dirname, '..', '..', 'pages', '[locale]');

/** 히어로 컴포넌트. 새 히어로 컴포넌트를 만들면 여기에 더한다. */
const HERO_COMPONENTS = ['<ImageHero'] as const;

interface PageFacts {
  file: string;
  usesHero: boolean;
  declaresHasHero: boolean;
}

const readIfExists = (base: string): string | null => {
  for (const ext of ['.tsx', '.ts', '/index.tsx', '/index.ts']) {
    const candidate = base + ext;
    if (fs.existsSync(candidate)) return fs.readFileSync(candidate, 'utf-8');
  }
  return null;
};

/**
 * 히어로를 페이지가 직접 렌더하지 않고 공유 컴포넌트에 맡기는 경우가 있다
 * (release-project/* → components/release/TierPage, guides/[slug] →
 * components/guides/BuyerIntentHubPage). 페이지 파일만 보면 이들이 히어로 없이
 * hasHero를 선언한 것처럼 보이므로, 상대경로 import를 한 단계 따라간다.
 * 그 컴포넌트들이 직접 ImageHero를 렌더하므로 한 단계면 충분하다.
 */
const rendersHero = (file: string, source: string): boolean => {
  if (HERO_COMPONENTS.some((tag) => source.includes(tag))) return true;
  const dir = path.dirname(file);
  for (const [, spec] of source.matchAll(/from\s+'(\.[^']+)'/g)) {
    const child = readIfExists(path.resolve(dir, spec));
    if (child && HERO_COMPONENTS.some((tag) => child.includes(tag))) return true;
  }
  return false;
};

const collect = (): PageFacts[] => {
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return entry.name.endsWith('.tsx') ? [full] : [];
    });

  return walk(PAGES_DIR).map((full) => {
    const source = fs.readFileSync(full, 'utf-8');
    return {
      file: path.relative(PAGES_DIR, full),
      usesHero: rendersHero(full, source),
      // `Foo.hasHero = true` — 컴포넌트 이름은 페이지마다 다르므로 우변으로 찾는다.
      declaresHasHero: /^\w+\.hasHero\s*=\s*true;/m.test(source),
    };
  });
};

describe('히어로 페이지와 투명 헤더 선언', () => {
  const pages = collect();

  it('검사 대상을 실제로 찾는다 (경로가 바뀌면 검사가 통째로 무력해진다)', () => {
    expect(pages.length).toBeGreaterThanOrEqual(15);
    expect(pages.filter((p) => p.usesHero).length).toBeGreaterThanOrEqual(10);
  });

  it.each(pages.filter((p) => p.usesHero).map((p) => [p.file] as const))(
    '%s — 히어로를 쓰므로 hasHero를 선언한다',
    (file) => {
      const page = pages.find((p) => p.file === file)!;
      expect(page.declaresHasHero).toBe(true);
    }
  );

  it.each(pages.filter((p) => p.declaresHasHero).map((p) => [p.file] as const))(
    '%s — hasHero를 선언했으므로 히어로가 있다',
    (file) => {
      const page = pages.find((p) => p.file === file)!;
      expect(page.usesHero).toBe(true);
    }
  );
});
