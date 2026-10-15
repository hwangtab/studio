import fs from 'node:fs';
import path from 'node:path';

import { orderTypeEnum } from '../../db/schema';

/**
 * 결제 화면은 공용 체크아웃(usePaymentCheckout + PaymentMethodPicker)으로 만든다. 결제수단은 토스(카드·간편결제)와
 * 우리 계좌번호를 안내하는 직접 입금이다 — 토스 계좌이체(TRANSFER)는 뱅크페이가 떠 고령층이 쓰지 못해 2026-10-14에 뺐다.
 *
 *
 * 2026-10-06 예약금 결제 링크가 "코드를 가장 적게 쓰는" 설계로 카드 전용 위젯(TossPaymentWidget)을 골라
 * 계좌 입금 없이 PR까지 나갔다. 새 결제 흐름이 공용 체크아웃을 빼먹으면 CI가 서게 한다 —
 * 규칙의 근거와 새 결제 흐름 체크리스트는 CLAUDE.md "새 결제 흐름" 절.
 */

const ROOT = path.resolve(__dirname, '../..');

const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const walk = (dir: string): string[] =>
  fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.posix.join(dir, e.name);
    if (e.isDirectory()) return walk(rel);
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\.(ts|tsx)$/.test(e.name) ? [rel] : [];
  });

/** 주문 종류별 결제 화면. 새 종류를 orderTypeEnum에 더하면 여기에도 적어야 테스트가 통과한다. */
const CHECKOUT_FORM_BY_ORDER_TYPE: Record<
  (typeof orderTypeEnum)[number],
  { file: string; tossOnly?: true } | { exempt: string }
> = {
  session: { file: 'components/booking/BookingWizard.tsx' },
  mixing: { file: 'components/booking/MixingOrderWizard.tsx' },
  // 공연은 2026-10-12에 직접 입금을 접고 계좌이체로 바꿨다가 2026-10-14에 직접 입금으로 되돌렸다.
  ticket: { file: 'components/shows/ShowBookingForm.tsx' },
  // 펀딩은 폴백을 고르면 자기 표(funding_pledges.payment_method)로 갈라 접수한다.
  funding: { file: 'components/funding/PledgeWizard.tsx' },
  deposit: { file: 'components/payments/PaymentLinkCheckout.tsx' },
  // 상점(음반·굿즈)도 결제수단이 전부 토스다(직접 입금 없음, 2026-10-12).
  merch: { file: 'components/shop/ShopOrderForm.tsx' }, // 2026-10-14 직접 입금 흐름 도입(lib/shop/bankDeposit.ts)
  software: { file: 'components/software/SoftwareOrderForm.tsx', tossOnly: true },
  subscription: { exempt: '토스 빌링키 자동결제 — 결제창 위젯을 쓰지 않는다(components/billing/BillingAuthButton.tsx)' },
};

/** 토스 SDK·위젯 훅·카드 전용 위젯을 직접 쓰는 것이 허용된 파일(공용 체크아웃의 내부와 빌링). */
const DIRECT_TOSS_ALLOWED = new Set([
  'components/payments/usePaymentCheckout.ts',
  'components/billing/BillingAuthButton.tsx',
]);

describe('공용 결제 체크아웃 가드', () => {
  it('orderTypeEnum의 모든 종류가 결제 화면(또는 면제 사유)과 짝지어져 있다', () => {
    expect(Object.keys(CHECKOUT_FORM_BY_ORDER_TYPE).sort()).toEqual([...orderTypeEnum].sort());
  });

  it.each(Object.entries(CHECKOUT_FORM_BY_ORDER_TYPE).filter(([, v]) => 'file' in v))(
    '%s 결제 화면은 usePaymentCheckout과 결제수단 목록을 공용 컴포넌트로 쓴다',
    (_type, spec) => {
      const { file, tossOnly } = spec as { file: string; tossOnly?: true };
      const source = read(file);
      expect(source).toMatch(/usePaymentCheckout/);
      expect(source).toMatch(/<PaymentMethodPicker/);
      if (tossOnly) {
        // 입금 확인 흐름이 없는 화면 — 계좌 줄을 켜면(withBank) 접수는 되는데 확정해 줄 경로가 없다.
        expect(source).not.toMatch(/\bwithBank\b|paymentMethod: 'bank_transfer'/);
      } else {
        // 입금 확인 흐름이 있는 화면 — 결제가 어려운 분의 길(우리 계좌번호 안내)이 목록에 있어야 한다.
        expect(source).toMatch(/\bwithBank\b/);
      }
    },
  );

  it('위젯 경로·옛 선택 컴포넌트·토스 계좌이체(뱅크페이)가 되살아나지 않는다', () => {
    expect(fs.existsSync(path.join(ROOT, 'components/payments/PaymentMethodChoice.tsx'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'components/booking/useTossPaymentWidgets.ts'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'components/booking/TossPaymentWidget.tsx'))).toBe(false);
    // 토스 계좌이체는 뱅크페이가 떠 고령층이 쓰지 못한다(2026-10-14) — 계좌 줄은 우리 계좌번호를 안내하는 직접 입금뿐이다.
    expect(read('lib/payments/paymentChoices.ts')).not.toMatch(/id: 'transfer'|method: 'TRANSFER', \.\.\./);
    expect(read('components/payments/usePaymentCheckout.ts')).not.toMatch(/TRANSFER/);
  });

  it('결제 실패 화면(예약·믹싱·펀딩·공연·예약금 링크)에 "계좌로 직접 입금" 안내가 있다', () => {
    for (const file of ['pages/[locale]/booking/fail.tsx', 'pages/[locale]/funding/fail.tsx', 'pages/[locale]/shows/fail.tsx', 'pages/[locale]/pay/fail.tsx']) {
      expect(read(file)).toMatch(/<FailBankFallback/);
    }
  });

  it('면제 사유는 비어 있지 않다', () => {
    for (const spec of Object.values(CHECKOUT_FORM_BY_ORDER_TYPE)) {
      if ('exempt' in spec) expect(spec.exempt.length).toBeGreaterThan(10);
    }
  });

  it('공용 체크아웃 밖에서 토스 SDK·위젯 훅·카드 전용 위젯을 직접 쓰지 않는다', () => {
    const offenders: string[] = [];
    for (const file of [...walk('pages'), ...walk('components')]) {
      if (DIRECT_TOSS_ALLOWED.has(file)) continue;
      const source = read(file);
      const importsSdk = /from\s+['"]@tosspayments\//.test(source);
      const importsWidgetHook = /import[^;]*\buseTossPaymentWidgets\b[^;]*from/s.test(source);
      const importsCardOnlyWidget = /import\s+[^;]*\bTossPaymentWidget\b[^;]*from/s.test(source);
      if (importsSdk || importsWidgetHook || importsCardOnlyWidget) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});
