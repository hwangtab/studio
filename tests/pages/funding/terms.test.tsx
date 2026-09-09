import { FUNDING_TERMS_SECTIONS } from '../../../pages/[locale]/funding/terms';

it('스펙 §9의 16개 조항이 모두 있고 핵심 문구를 담는다', () => {
  expect(FUNDING_TERMS_SECTIONS).toHaveLength(16);
  const all = FUNDING_TERMS_SECTIONS.map((s) => `${s.heading}\n${s.body.join('\n')}`).join('\n');
  for (const must of ['통신판매', '기부가 아닙니다', '기부금영수증', 'Keep-it-All', '청약철회', '7일', '3개월', '30일', '3영업일', '리워드 전달 완료 후 1년']) {
    expect(all).toContain(must);
  }
});
