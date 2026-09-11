import { POLICY_COPY_BY_LOCALE } from '../../pages/[locale]/privacy-policy';
import {
  FUNDING_COLLECTED_ITEMS,
  FUNDING_COLLECTION_PURPOSES,
  FUNDING_DATA_PROCESSORS,
  PRIVACY_LEGAL_RETENTION_TEXT,
  PRIVACY_RETENTION_TEXT,
} from '../../lib/funding/policy';
import { FUNDING_TERMS_SECTIONS } from '../../pages/[locale]/funding/terms';
import { locales } from '../../lib/i18n-config';

const flatten = (locale: keyof typeof POLICY_COPY_BY_LOCALE): string => {
  const copy = POLICY_COPY_BY_LOCALE[locale];
  return [
    copy.subtitle,
    ...copy.sections.flatMap((s) => [
      s.heading,
      s.body,
      ...(s.items ?? []),
      ...(s.processors ?? []).flatMap((p) => [p.name, p.purpose, p.items]),
    ]),
  ].join('\n');
};

// 같은 동의 체크박스(PledgeWizard)가 처리방침과 펀딩 약관을 함께 동의받는데, 처리방침이
// 펀딩을 한 줄도 담지 않고 보유기간마저 약관과 정반대('상담 완료 후 지체 없이 파기' vs
// '리워드 전달 완료 후 1년')였다. 아래 단언이 그 상태로 되돌아가는 것을 막는다.
describe('ko 처리방침의 펀딩 절', () => {
  const ko = flatten('ko');

  it('수집 항목·이용 목적을 상수 그대로 싣는다', () => {
    for (const item of [...FUNDING_COLLECTED_ITEMS, ...FUNDING_COLLECTION_PURPOSES]) {
      expect(ko).toContain(item);
    }
  });

  it('배송지 6필드와 응원 메시지가 모두 고지된다', () => {
    for (const field of ['받는 분', '우편번호', '상세주소', '배송 메모', '응원 메시지']) {
      expect(ko).toContain(field);
    }
  });

  it('수탁자 표에 토스페이먼츠·Resend·Vercel·Turso가 있다', () => {
    const names = FUNDING_DATA_PROCESSORS.map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(['토스페이먼츠', 'Resend', 'Vercel', 'Turso']));
    for (const p of FUNDING_DATA_PROCESSORS) expect(ko).toContain(p.purpose);
  });

  it('보유기간과 법정 보존 예외는 약관과 같은 상수에서 온다 (문자열 복제 금지)', () => {
    expect(ko).toContain(PRIVACY_RETENTION_TEXT);
    expect(ko).toContain(PRIVACY_LEGAL_RETENTION_TEXT);
    const terms = FUNDING_TERMS_SECTIONS.flatMap((s) => s.body).join('\n');
    expect(terms).toContain(PRIVACY_RETENTION_TEXT);
    expect(terms).toContain(PRIVACY_LEGAL_RETENTION_TEXT);
  });

  it('일반 보유기간 항이 펀딩을 덮어쓰지 않는다 — 상담 파기 문구는 문의·상담으로 한정된다', () => {
    const retention = POLICY_COPY_BY_LOCALE.ko.sections.find((s) => s.heading.includes('보유'));
    expect(retention?.body).toContain('문의·상담으로 수집한');
    expect(retention?.body).toContain('펀딩');
  });
});

// 펀딩은 ko 전용 상품이라(비-ko 경로는 /ko/funding으로 리다이렉트) 절 전체를 번역하지 않는다.
// 다만 '상담 완료 후 지체 없이 파기'가 그대로 남으면 ko와 정면으로 모순되므로, 비-ko도
// 보유기간 항만은 문의 데이터로 범위를 좁히고 펀딩 보유기간(1년)·법정 보존(5년)을 밝힌다.
describe('비-ko 로케일의 보유기간 항', () => {
  const NON_KO = locales.filter((l) => l !== 'ko');

  it.each(NON_KO)('%s — 펀딩 보유기간이 ko와 모순되지 않는다', (locale) => {
    const text = flatten(locale);
    expect(text).toMatch(/1\s*[년年]|one year|un año|một năm|หนึ่งปี|bir yil/i);
    expect(text).toMatch(/5\s*[년年]|five years|cinco años|năm năm|ห้าปี|besh yil/i);
  });
});
