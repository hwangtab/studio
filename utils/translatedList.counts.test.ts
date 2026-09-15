import fs from 'fs';
import path from 'path';

/**
 * createTranslatedQaItems·createTranslatedHowToSteps는 배열 길이를 인자로 받고
 * `${prefix}.${index}.q` 형태로 키를 만든다. 그래서 코드의 숫자와 JSON 배열 길이가
 * 어긋나도 아무 데서도 터지지 않는다 — 숫자가 작으면 뒤쪽 항목이 조용히 사라지고,
 * 크면 빈 문자열이나 키 이름이 그대로 화면에 찍힌다. 두 경우 다 타입 검사·렌더 검사에
 * 걸리지 않는다.
 *
 * 2026-09-15 전수 대조에서 실제로 네 건이 어긋나 있었다:
 *   - recording.quickAnswers.items        코드 3 / ko 4
 *   - mixingMastering.quickAnswers.items  코드 3 / ko 4
 *   - musicPromotion.faq.items            코드 6 / ko 7
 *   - musicPromotion.process.steps        코드 6 / ko 7
 * 앞의 두 건은 "녹음·믹싱만 맡겨도 되고 발매까지 이어갈 수 있다"는 업셀 안내였는데,
 * 화면에도 FAQPage 스키마에도 나가지 않고 있었다. 카피를 늘린 사람과 숫자를 세는
 * 사람이 같은 커밋 안에 있지 않으면 언제든 다시 난다.
 */

const PAGES_DIR = path.join(__dirname, '..', 'pages', '[locale]');
const KO_COMMON = path.join(__dirname, '..', 'public', 'locales', 'ko', 'common.json');

const CALL_RE = /createTranslated(QaItems|HowToSteps)\(\s*t,\s*'([\w.]+)',\s*(\d+)\s*\)/g;

interface CallSite {
  file: string;
  helper: string;
  keyPath: string;
  declared: number;
}

const collectCallSites = (): CallSite[] => {
  const sites: CallSite[] = [];
  for (const file of fs.readdirSync(PAGES_DIR).filter((f) => f.endsWith('.tsx'))) {
    const source = fs.readFileSync(path.join(PAGES_DIR, file), 'utf-8');
    for (const [, helper, keyPath, count] of source.matchAll(CALL_RE)) {
      sites.push({ file, helper, keyPath, declared: Number(count) });
    }
  }
  return sites;
};

const resolveKey = (root: unknown, keyPath: string): unknown =>
  keyPath.split('.').reduce<unknown>((cur, seg) => {
    if (cur && typeof cur === 'object' && seg in (cur as Record<string, unknown>)) {
      return (cur as Record<string, unknown>)[seg];
    }
    return undefined;
  }, root);

describe('createTranslated* 호출의 개수 인자', () => {
  const ko = JSON.parse(fs.readFileSync(KO_COMMON, 'utf-8'));
  const sites = collectCallSites();

  it('호출부를 실제로 찾는다 (정규식이 썩으면 검사가 통째로 무력화된다)', () => {
    expect(sites.length).toBeGreaterThanOrEqual(15);
  });

  it.each(sites.map((s) => [s.file, s.keyPath, s.declared] as const))(
    '%s — %s 의 개수 인자가 ko 배열 길이와 같다',
    (_file, keyPath, declared) => {
      const value = resolveKey(ko, keyPath);
      expect(Array.isArray(value)).toBe(true);
      expect(declared).toBe((value as unknown[]).length);
    }
  );
});
