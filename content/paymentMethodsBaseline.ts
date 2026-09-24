/**
 * 결제수단 목록 ↔ 처리방침 1항 기준선의 **갱신 자물쇠**.
 *
 * 게이트 자체는 `content/paymentMethods.baseline.test.ts`에 있고, 여기 있는 것은
 * "갱신을 허용할지" 판정 하나다. 갈라 둔 이유는 `content/fundingTermsHash.ts`와 같다 —
 * 검사 모드만 막으면 자물쇠 옆에 열쇠를 걸어 두는 셈이기 때문이다.
 *
 * 막으려는 우회는 이렇게 생겼다: 토스 콘솔에서 수단을 열고 `KNOWN_PAYMENT_METHODS`에
 * 값을 더한다 → 검사 모드가 선다 → **실패 메시지가 시키는 대로 `UPDATE_...=1`만 실행한다**
 * → 새 목록과 손대지 않은 처리방침 해시가 함께 기록되고 CI는 초록이 된다. 처리방침 1항은
 * 그 수단이 무엇을 저장하는지 한 글자도 말하지 않은 채 남는다. 개발자가 **반드시 지나는**
 * 경로가 게이트를 무력화하는 셈이라, 갱신 경로에서 그 조합을 거부한다.
 * (`FUNDING_TERMS_VERSION`에서 이미 한 번 겪은 실패 유형이다.)
 */

export type PaymentMethodsBaseline = {
  note: string;
  methods: string[];
  policyDescribedMethods: string[];
  /** ko 개인정보 처리방침 1항 본문의 sha256(hex). */
  policyParagraphSha256: string;
};

const sameList = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * 기준선 갱신을 허용할지 판정한다.
 *
 * 거부하는 조합은 하나다 — **목록이 바뀌었는데 처리방침 1항 본문은 그대로**.
 *
 * 다만 그 조합이 항상 잘못은 아니다. 1항의 마지막 문장("그 밖에도 이용하신 결제수단에
 * 따라 결제사가 함께 보내는 항목이 저장될 수 있습니다")이 포괄하는 수단이라면 본문을
 * 고치지 않는 것이 맞을 수 있다. 그래서 막되 **명시적인 탈출구**를 둔다: 판단을 한
 * 사람이 `ALLOW_CATCHALL_ONLY=1`을 손으로 붙이고, 같은 커밋에 왜 그렇게 판단했는지 적는다.
 * 기본값은 거부다 — 아무 인자 없이 부르면(실수로든 우회 목적으로든) 서게 된다.
 *
 * 파일이 없을 때도 막는다. 거부 메시지를 본 사람이 기준선을 지우고 다시 돌리면
 * "최초 생성"으로 취급돼 대조가 통째로 사라지기 때문이다(fundingTermsHash.ts가
 * `ALLOW_BASELINE_CREATE`로 막은 것과 같은 우회).
 */
export const assertPaymentMethodsBaselineUpdateAllowed = (
  existing: PaymentMethodsBaseline | null,
  next: Pick<PaymentMethodsBaseline, 'methods' | 'policyParagraphSha256'>,
  options: { allowCreate?: boolean; allowCatchallOnly?: boolean } = {},
): void => {
  if (!existing) {
    if (options.allowCreate) return; // 명시적으로 승인된 최초 생성.
    throw new Error(
      [
        '기준선 생성을 거부한다 — content/payment-methods.baseline.json을 찾을 수 없다.',
        '',
        '원래 있던 파일이라면 지우지 말고 git으로 복구할 것:',
        '  git checkout -- content/payment-methods.baseline.json',
        '지우고 다시 만들면 "이전 기준선과 비교"가 사라져, 처리방침을 안 고친 변경도 무조건',
        '통과하는 새 기준선이 깔린다 — 이 게이트가 막으려던 상태 그 자체다.',
        '',
        '정말 처음 만드는 것이 맞다면 ALLOW_BASELINE_CREATE=1을 함께 줄 것.',
      ].join('\n'),
    );
  }

  if (sameList(existing.methods, next.methods)) return; // 목록이 그대로면 문구만 손봐도 된다.
  if (existing.policyParagraphSha256 !== next.policyParagraphSha256) return; // 둘 다 움직였다 — 정상.
  if (options.allowCatchallOnly) return; // 캐치올로 충분하다고 사람이 판단했다.

  const added = next.methods.filter((m) => !existing.methods.includes(m));
  const removed = existing.methods.filter((m) => !next.methods.includes(m));
  throw new Error(
    [
      '기준선 갱신을 거부한다 — 결제수단 목록이 바뀌었는데 처리방침 1항 본문은 그대로다.',
      `  추가: ${added.length ? added.join(', ') : '-'}`,
      `  삭제: ${removed.length ? removed.join(', ') : '-'}`,
      '',
      '이대로 기록하면 "새 수단 + 그 수단을 설명하지 않는 고지"가 초록으로 굳는다 —',
      '이 게이트가 막으려던 상태 그 자체다.',
      '',
      '먼저 그 수단의 승인 응답에 무엇이 실리는지 확인하고, 처리방침 1항에 반영할 것.',
      '⚠ ko 본문은 후원자 동의 문서다 — lib/funding/policy.ts의 FUNDING_TERMS_VERSION을',
      '   먼저 올린 뒤 UPDATE_FUNDING_TERMS_BASELINE=1로 약관 기준선도 다시 써야 한다.',
      '',
      '1항의 마지막 캐치올 문장으로 충분하다고 판단했다면 ALLOW_CATCHALL_ONLY=1을 함께 주고',
      '다시 실행할 것. 그때는 **같은 커밋에 왜 문서를 고치지 않아도 되는지 적을 것** —',
      '이유 없는 탈출은 게이트를 무력화한다.',
    ].join('\n'),
  );
};
