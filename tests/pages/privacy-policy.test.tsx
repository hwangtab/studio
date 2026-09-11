import { POLICY_COPY_BY_LOCALE, SERVICE_DATA_PROCESSORS } from '../../pages/[locale]/privacy-policy';
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

// 4항 제목은 "제3자 제공 및 처리위탁"인데 본문은 "원칙적으로 외부에 제공하지 않으며"로 끝나고
// 수탁자를 한 곳도 밝히지 않았다 — 바로 아래 9항이 펀딩 수탁자 4곳을 표로 싣는데도. 그리고
// 문의·예약 데이터가 실제로 거치는 곳은 어디에도 고지돼 있지 않았다(개인정보보호법 제26조·제30조).
//
// 고친 뒤 한 번 더 틀릴 뻔한 자리도 함께 고정한다: 본문이 "아래와 같이 위탁하고 있으며"라는
// 열거형 단언이 된 이상 **표가 곧 사실 주장**이다. Resend·Vercel만 싣고 예약 플로우의
// Turso·Google·토스페이먼츠를 빠뜨리면 모호했던 옛 문장보다 적극적으로 부정확해진다.
describe('처리방침 4항 — 문의·예약의 처리위탁 고지', () => {
  const ko4 = POLICY_COPY_BY_LOCALE.ko.sections.find((s) => s.heading.startsWith('4.'))!;

  it('ko 4항이 수탁자 표를 싣고, 그 내용이 상수에서 온다', () => {
    expect(ko4.processors).toBe(SERVICE_DATA_PROCESSORS);
  });

  // 아래 다섯은 전부 코드에서 확인된 실제 경로다. 하나라도 빠지면 4항의 열거가 거짓이 된다.
  //   Resend        lib/booking/email.ts → lib/email/resend.ts, pages/api/contact/send-email.ts
  //   Vercel        vercel.json · data/siteConfig.ts hostingProvider
  //   Turso         db/client.ts — orders·bookings 영속
  //   Google LLC    lib/booking/gcal.ts + confirm.ts (이벤트 본문에 이름·전화·이메일·요청사항)
  //   토스페이먼츠   components/booking/TossPaymentWidget.tsx · lib/booking/toss.ts
  it('예약 플로우의 수탁자가 모두 들어 있다', () => {
    expect(SERVICE_DATA_PROCESSORS.map((p) => p.name).sort()).toEqual(
      ['Google LLC', 'Resend', 'Turso', 'Vercel', '토스페이먼츠'].sort(),
    );
  });

  it('구글 캘린더 위탁 항목이 실제로 이벤트에 담기는 필드를 밝힌다', () => {
    const google = SERVICE_DATA_PROCESSORS.find((p) => p.name === 'Google LLC')!;
    // lib/booking/confirm.ts가 이벤트 description에 고객 이름·전화·이메일을 담는다.
    for (const field of ['이름', '연락처', '이메일']) expect(google.items).toContain(field);
  });

  it('ko 4항이 펀딩 위탁은 9항, 언론 홍보는 10~12항이라고 가리킨다', () => {
    expect(ko4.body).toContain('9항');
    expect(ko4.body).toContain('10~12항');
    // "원칙적으로 제공하지 않으며"로 끝나 수탁자를 감추던 문장은 돌아오면 안 된다.
    expect(ko4.body).not.toContain('원칙적으로');
  });

  it('ko 4항이 9항과 같은 3열 형식(수탁자·업무·항목)을 쓴다', () => {
    for (const row of SERVICE_DATA_PROCESSORS) {
      expect(Object.keys(row).sort()).toEqual(['items', 'name', 'purpose']);
      expect(row.purpose.length).toBeGreaterThan(0);
      expect(row.items.length).toBeGreaterThan(0);
    }
  });

  // 4항이 예약을 포함한다고 말하는 이상 1항도 예약 수집 항목을 밝혀야 한다 —
  // 예전엔 "문의 양식"만 말해 예약이 통째로 빠져 있었다.
  it('1항이 예약·결제 수집 항목을 밝힌다', () => {
    const collected = POLICY_COPY_BY_LOCALE.ko.sections.find((s) => s.heading.startsWith('1.'))!.body;
    for (const field of ['예약 일시', '요청사항', '주문번호', '결제 금액']) {
      expect(collected).toContain(field);
    }
  });

  it.each(locales.filter((l) => l !== 'ko'))('%s — 4항이 문의·예약 수탁자를 모두 밝힌다', (locale) => {
    const section = POLICY_COPY_BY_LOCALE[locale].sections.find((s) => s.heading.startsWith('4.'))!;
    for (const name of ['Resend', 'Vercel', 'Turso', 'Google', 'Toss']) {
      expect(section.body).toContain(name);
    }
    expect(section.body).toMatch(/9/);
  });
});
