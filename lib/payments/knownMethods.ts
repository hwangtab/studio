/**
 * 우리가 아는 결제수단 목록 — 처리방침 1항이 설명하는 범위를 코드로 붙들어 둔다.
 *
 * ## 왜 있는가
 *
 * 개인정보 처리방침 1항은 **결제수단별로** 승인 응답에 무엇이 실리는지 적는다(카드의
 * 마스킹 번호, 가상계좌의 구매자명·입금자명·계좌번호·환불 계좌 예금주명, 휴대폰 결제의
 * 번호). 그런데 **코드에는 수단 제한이 없다** — 위젯은 토스 콘솔에서 개통된 수단을 그대로
 * 그리므로(`lib/booking/toss.ts`), 콘솔에서 수단을 하나 열면 그 순간부터 우리가 설명한 적
 * 없는 항목이 `payments.raw_response`에 쌓이기 시작하고 아무도 그 사실을 모른다.
 *
 * 그래서 승인 응답의 `method`가 이 목록에 없으면 운영자에게 알린다
 * (`lib/payments/methodAlert.ts`). **결제는 막지 않는다** — 이미 승인된 돈이고, 고지가
 * 불완전한 것은 거래를 끊어서 고칠 문제가 아니다.
 *
 * ## 목록의 출처 (값마다 다르다)
 *
 * - **저장소에서 확인**: `가상계좌`(`lib/booking/toss.ts`의 `VIRTUAL_ACCOUNT_METHODS`가
 *   한국어 문자열을 그대로 비교한다 — 2026-09-11 실사건에서 확인된 값),
 *   `간편결제`(`lib/booking/admin-serialize.test.ts`의 payments.method 픽스처).
 * - **토스 레퍼런스에서 확인**: Payment 객체의 `method`는 위 8개 한국어 문자열 중 하나다.
 *   저장소 안에서 실제로 관측된 것은 위 둘뿐이므로, 나머지 여섯은 문서 근거로만 싣는다.
 *
 * ## 확인하지 못한 것
 *
 * 결제창(`payment()`)과 위젯(`widgets()`)이 같은 값을 쓰는지, 그리고 영문 응답 경로가
 * 따로 있는지는 확인하지 못했다. 우리는 위젯 키만 쓰므로(CLAUDE.md "토스 연동 키는
 * 위젯 키다") 실제로 오는 값은 위젯 경로 하나지만, 문서가 갈라 적고 있지 않아 단언하지
 * 않는다. 영문·다른 표기가 오면 이 목록에 없으므로 **알림으로 드러난다** — 그게 이
 * 장치의 목적이다.
 */

/** 토스 Payment 객체의 `method`가 가질 수 있는 값(위 주석의 출처 참조). */
export const KNOWN_PAYMENT_METHODS = [
  '카드',
  '가상계좌',
  '간편결제',
  '휴대폰',
  '계좌이체',
  '문화상품권',
  '도서문화상품권',
  '게임문화상품권',
] as const;

export type KnownPaymentMethod = (typeof KNOWN_PAYMENT_METHODS)[number];

/**
 * 처리방침 1항이 **저장되는 항목까지 따로 설명하는** 수단.
 *
 * 나머지 수단은 1항의 마지막 문장("그 밖에도 이용하신 결제수단에 따라 결제사가 함께 보내는
 * 항목이 저장될 수 있습니다")이 포괄한다. 이 배열은 게이트가 대조하는 값이고, 문서가
 * 어느 수단의 설명을 빼면 CI가 선다(`content/paymentMethods.baseline.test.ts`).
 */
export const POLICY_DESCRIBED_METHODS = ['카드', '가상계좌', '휴대폰'] as const;

/**
 * 아는 수단인가.
 *
 * 앞뒤 공백과 대소문자는 무시한다 — `isVirtualAccountMethod`와 같은 판정 기준이다.
 * 한국어 값에는 대소문자가 없지만, 영문 표기가 섞여 들어오는 경우를 같은 규칙으로 다룬다.
 */
export const isKnownPaymentMethod = (method: string | null | undefined): boolean =>
  typeof method === 'string' &&
  KNOWN_PAYMENT_METHODS.some((known) => known.toLowerCase() === method.trim().toLowerCase());

/**
 * 알림 대상인가 — 값이 있는데 목록에 없을 때만 참.
 *
 * **비어 있으면 알리지 않는다.** 취소·재조회 응답은 `method`를 싣지 않고 오는 경우가 있고
 * (우리 타입도 `method?`로 선언한다), 무엇이 열렸는지 이름을 댈 수 없는 알림은 운영자가
 * 할 수 있는 일이 없다. 새 수단이 개통되면 승인 응답에는 그 이름이 실려 오므로 이 조건에
 * 걸린다.
 */
export const isUnknownPaymentMethod = (method: string | null | undefined): boolean =>
  typeof method === 'string' && method.trim() !== '' && !isKnownPaymentMethod(method);
