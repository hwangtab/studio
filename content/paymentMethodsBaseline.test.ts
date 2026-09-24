/** @jest-environment node */

import {
  assertPaymentMethodsBaselineUpdateAllowed,
  type PaymentMethodsBaseline,
} from './paymentMethodsBaseline';

/**
 * 갱신 경로의 자물쇠 — 검사 모드만 막으면 자물쇠 옆에 열쇠를 걸어 두는 셈이다.
 * 실제 게이트는 content/paymentMethods.baseline.test.ts가 돌린다.
 */

const baseline: PaymentMethodsBaseline = {
  note: '',
  methods: ['카드', '가상계좌'],
  policyDescribedMethods: ['카드', '가상계좌'],
  policyParagraphSha256: 'aaa',
};

describe('assertPaymentMethodsBaselineUpdateAllowed', () => {
  it('목록만 바뀌고 처리방침이 그대로면 거부한다 — 이 게이트를 무력화하는 조합이다', () => {
    expect(() =>
      assertPaymentMethodsBaselineUpdateAllowed(baseline, {
        methods: ['카드', '가상계좌', '휴대폰'],
        policyParagraphSha256: 'aaa',
      }),
    ).toThrow(/추가: 휴대폰/);
  });

  it('둘 다 바뀌면 통과한다', () => {
    expect(() =>
      assertPaymentMethodsBaselineUpdateAllowed(baseline, {
        methods: ['카드', '가상계좌', '휴대폰'],
        policyParagraphSha256: 'bbb',
      }),
    ).not.toThrow();
  });

  it('문구만 다듬은 경우(목록 그대로)는 통과한다', () => {
    expect(() =>
      assertPaymentMethodsBaselineUpdateAllowed(baseline, {
        methods: ['카드', '가상계좌'],
        policyParagraphSha256: 'bbb',
      }),
    ).not.toThrow();
  });

  it('캐치올로 충분하다는 판단은 명시할 때만 통과한다', () => {
    expect(() =>
      assertPaymentMethodsBaselineUpdateAllowed(
        baseline,
        { methods: ['카드', '가상계좌', '휴대폰'], policyParagraphSha256: 'aaa' },
        { allowCatchallOnly: true },
      ),
    ).not.toThrow();
  });

  it('기준선 파일이 없으면 조용히 새로 만들지 않는다 — 지우고 다시 쓰는 우회를 막는다', () => {
    expect(() =>
      assertPaymentMethodsBaselineUpdateAllowed(null, { methods: ['카드'], policyParagraphSha256: 'aaa' }),
    ).toThrow(/ALLOW_BASELINE_CREATE=1/);

    expect(() =>
      assertPaymentMethodsBaselineUpdateAllowed(
        null,
        { methods: ['카드'], policyParagraphSha256: 'aaa' },
        { allowCreate: true },
      ),
    ).not.toThrow();
  });
});
