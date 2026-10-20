/**
 * pressCoverage의 kind 필드 회귀 방지.
 *
 * 2026-10-20 추가 — "제3자 보도인가, 수상 증빙인가"를 매번 재검토하다 추가→삭제가
 * 세 번 반복된 문제의 처방으로 kind: 'coverage' | 'record'를 넣었다. 이 필드가
 * 지키려는 약속(coverage만 /author "언론 보도" 목록·subjectOf에, record는 독립
 * WebPage·mentions로)이 오타·누락으로 조용히 깨지지 않게 테스트로 고정한다.
 */
import { studioOperator } from './siteConfig';
import { getAuthorProfile } from './authorProfile';
import { getOperatorPressCoverage, getOperatorPressRecordNodes } from '../utils/schema/person';

describe('pressCoverage.kind', () => {
  it('모든 항목이 kind를 갖고, 값은 coverage|record 중 하나다', () => {
    for (const article of studioOperator.pressCoverage) {
      expect(['coverage', 'record']).toContain(article.kind);
    }
  });

  it('getOperatorPressCoverage는 record를 제외한 coverage만, 전부 NewsArticle로 낸다', () => {
    const coverage = getOperatorPressCoverage();
    const expectedCount = studioOperator.pressCoverage.filter((a) => a.kind !== 'record').length;
    expect(coverage).toHaveLength(expectedCount);
    for (const article of coverage) {
      expect(article['@type']).toBe('NewsArticle');
    }
  });

  it('getOperatorPressRecordNodes는 record만, 전부 WebPage + mentions로 낸다', () => {
    const SITE = 'https://studionol.co.kr';
    const records = getOperatorPressRecordNodes(SITE);
    const expectedCount = studioOperator.pressCoverage.filter((a) => a.kind === 'record').length;
    expect(records).toHaveLength(expectedCount);
    for (const node of records) {
      expect(node['@type']).toBe('WebPage');
      expect(node.mentions).toEqual({ '@id': `${SITE}/#person-hwang` });
    }
  });

  it('/author "언론 보도" 목록에는 record kind URL이 없다', () => {
    const profile = getAuthorProfile('ko');
    const recordUrls = studioOperator.pressCoverage
      .filter((a) => a.kind === 'record')
      .map((a) => a.url);
    const listedUrls = profile.pressCoverage.map((a) => a.url);
    for (const url of recordUrls) {
      expect(listedUrls).not.toContain(url);
    }
  });

  it('근거가 record 하나뿐인 press 수상(2015·2019 레드어워드)은 evidenceUrl을 갖는다', () => {
    // 그 수상이 더 이상 /author "언론 보도" 목록에 안 보이는 record로만 뒷받침되므로,
    // evidenceUrl이 없으면 화면에서 근거를 확인할 길이 사라진다(2026-10-20 Opus 리뷰).
    const redAwardsWithRecordOnly = studioOperator.awards.filter(
      (a) => a.name === '레드어워드' && a.source === 'press' && (a.year === '2015' || a.year === '2019')
    );
    expect(redAwardsWithRecordOnly.length).toBe(2);
    for (const award of redAwardsWithRecordOnly) {
      expect('evidenceUrl' in award && typeof award.evidenceUrl === 'string' && award.evidenceUrl.length > 0).toBe(true);
    }
  });
});
