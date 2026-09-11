/**
 * navLabels.ts ↔ common.json 동기화 가드.
 *
 * `lib/navLabels.ts`는 SSR/SSG에서 i18n 런타임 없이 SiteNavigationElement JSON-LD를
 * 만들려고 nav 라벨을 손으로 복제해 둔 정적 매핑이다. 파일 주석이 "동기화 유지"를
 * 요구하지만 강제하는 것이 없었다.
 *
 * 실제로 어긋났다: 2026-09-11 헤더 재정렬에서 `nav.releaseProject`를
 * "음원 발매 개요"(en "Overview")에서 "발매 프로젝트"로 바꿨는데 이 파일만
 * 안 따라와, 화면과 breadcrumb은 새 이름을 말하는데 구조화 데이터는 "Overview"를
 * 검색엔진에 내보내고 있었다. 타입체크도 테스트도 잡지 못했다 — 두 값이
 * 각각 유효한 문자열이라 코드로는 차이가 보이지 않는다.
 */
import fs from 'fs';
import path from 'path';
import { navLabels, type NavKey } from './navLabels';
import { locales } from './i18n-config';

/**
 * 로케일 목록은 i18n-config에서 가져온다.
 *
 * 여기 배열을 손으로 적어 두면 8번째 로케일이 생겼을 때 navLabels에는 타입이
 * 추가를 강제하는데 이 검사만 조용히 건너뛴다 — 이 파일이 막으려는 실패가
 * 이 파일 안에서 재현되는 셈이다.
 */
const LOCALES = locales;

const navSection = (locale: string): Record<string, unknown> => {
  const file = path.join(__dirname, '..', 'public', 'locales', locale, 'common.json');
  return JSON.parse(fs.readFileSync(file, 'utf8')).nav;
};

describe('navLabels ↔ common.json', () => {
  it('모든 로케일의 모든 NavKey가 common.json의 nav 라벨과 같다', () => {
    const mismatches: string[] = [];
    for (const locale of LOCALES) {
      const nav = navSection(locale);
      for (const [key, label] of Object.entries(navLabels[locale]) as [NavKey, string][]) {
        const source = nav[key];
        if (source !== label) {
          mismatches.push(`${locale}.${key}: navLabels=${JSON.stringify(label)} vs common.json=${JSON.stringify(source)}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('로케일마다 같은 키 집합을 갖는다 (한 곳만 추가되면 JSON-LD가 로케일별로 달라진다)', () => {
    const reference = Object.keys(navLabels.ko).sort();
    for (const locale of LOCALES) {
      expect(Object.keys(navLabels[locale]).sort()).toEqual(reference);
    }
  });

  /**
   * pricing.releaseLink ↔ nav.releaseProject.
   *
   * 두 키가 같은 것(발매 프로젝트 페이지)을 가리킨다. 원래 pricing이 별도 키를 둔
   * 이유는 nav 쪽이 'Overview' 같은 하위메뉴 맥락 라벨이어서였는데, 2026-09-11
   * 리네임으로 그 이유가 사라졌다.
   *
   * 아직 합치지 않은 것은 th·uz의 번역이 갈려 있어서다 — 어느 쪽을 남길지는 번역
   * 판단이라 코드가 정할 일이 아니다. 대신 **그 목록을 여기 상수로 둔다.**
   * 주석에 손으로 적었다가 vi를 빠뜨린 적이 있다(대소문자만 다른 경우였다).
   * 목록이 달라지면 이 테스트가 실패하므로 갱신이 강제된다.
   */
  const PRICING_LINK_DIVERGED: string[] = ['th', 'uz'];

  const pricingSection = (locale: string): Record<string, unknown> => {
    const file = path.join(__dirname, '..', 'public', 'locales', locale, 'common.json');
    return JSON.parse(fs.readFileSync(file, 'utf8')).pricing;
  };

  it('pricing.releaseLink가 갈린 로케일이 통합 대기 목록과 같다', () => {
    const diverged = LOCALES.filter(
      (locale) => pricingSection(locale)?.releaseLink !== navSection(locale).releaseProject
    );
    expect(diverged).toEqual(PRICING_LINK_DIVERGED);
  });

  /**
   * 대소문자만 다른 것은 번역 판단이 아니라 그냥 불일치다 — 통합 대기가 아니라
   * 지금 고칠 것이므로 실패시킨다. vi가 실제로 이 상태였다
   * ('Dự án Phát hành' vs 'Dự án phát hành').
   */
  it('대소문자만 다른 불일치는 남기지 않는다', () => {
    const caseOnly = LOCALES.filter((locale) => {
      const a = String(pricingSection(locale)?.releaseLink ?? '');
      const b = String(navSection(locale).releaseProject ?? '');
      return a !== b && a.toLowerCase() === b.toLowerCase();
    });
    expect(caseOnly).toEqual([]);
  });
});
