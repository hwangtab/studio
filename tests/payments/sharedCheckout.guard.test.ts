import fs from 'node:fs';
import path from 'node:path';

import { orderTypeEnum } from '../../db/schema';

/**
 * 결제 화면은 공용 체크아웃(usePaymentCheckout + PaymentMethodChoice)으로 만든다.
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
  { file: string; ownMethodChoice?: true } | { exempt: string }
> = {
  session: { file: 'components/booking/BookingWizard.tsx' },
  mixing: { file: 'components/booking/MixingOrderWizard.tsx' },
  ticket: { file: 'components/shows/ShowBookingForm.tsx' },
  // 펀딩 후원 폼은 같은 두 줄을 자기 표(funding_pledges.payment_method)로 갈라 직접 그린다.
  funding: { file: 'components/funding/PledgeWizard.tsx', ownMethodChoice: true },
  deposit: { file: 'components/payments/PaymentLinkCheckout.tsx' },
  subscription: { exempt: '토스 빌링키 자동결제 — 결제창 위젯을 쓰지 않는다(components/billing/BillingAuthButton.tsx)' },
};

/** 토스 SDK·위젯 훅·카드 전용 위젯을 직접 쓰는 것이 허용된 파일(공용 체크아웃의 내부와 빌링). */
const DIRECT_TOSS_ALLOWED = new Set([
  'components/payments/usePaymentCheckout.ts',
  'components/booking/useTossPaymentWidgets.ts',
  'components/booking/TossPaymentWidget.tsx',
  'components/billing/BillingAuthButton.tsx',
]);

describe('공용 결제 체크아웃 가드', () => {
  it('orderTypeEnum의 모든 종류가 결제 화면(또는 면제 사유)과 짝지어져 있다', () => {
    expect(Object.keys(CHECKOUT_FORM_BY_ORDER_TYPE).sort()).toEqual([...orderTypeEnum].sort());
  });

  it.each(Object.entries(CHECKOUT_FORM_BY_ORDER_TYPE).filter(([, v]) => 'file' in v))(
    '%s 결제 화면은 usePaymentCheckout과 결제수단 선택을 공용 컴포넌트로 쓴다',
    (_type, spec) => {
      const { file, ownMethodChoice } = spec as { file: string; ownMethodChoice?: true };
      const source = read(file);
      expect(source).toMatch(/usePaymentCheckout/);
      if (!ownMethodChoice) expect(source).toMatch(/PaymentMethodChoice/);
    },
  );

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
