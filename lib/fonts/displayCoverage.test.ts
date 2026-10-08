import { fitsDisplayFont } from './displayCoverage';

test('서브셋 글자만이면 true, 하나라도 밖이면 false', () => {
  expect(fitsDisplayFont('출연')).toBe(true);
  expect(fitsDisplayFont('Hearts That Won\'t Be Cut Down')).toBe(true);
  expect(fitsDisplayFont('똠얌꿍 펀딩')).toBe(false); // 똠·꿍은 어느 제목에도 없다
  expect(fitsDisplayFont('공연 中文')).toBe(true); // 한자는 설계상 로케일 폰트로 간다
});
