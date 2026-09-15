import { draftStorageKey } from '../formDraft';

/**
 * 예약 위저드(BookingWizard)와 믹싱 주문 위저드(MixingOrderWizard)가 공통으로 임시
 * 저장하는 고객 정보 필드.
 *
 * 두 위저드가 정확히 같은 네 칸(이름·연락처·이메일·요청사항)을 같은 방식으로 다루므로
 * 필드 목록과 키만 여기서 공유한다. 저장·복원 로직 자체를 훅으로 묶지 않는 이유는
 * 두 위저드의 단계 구성(예약 4단계·믹싱 3단계)과 상태 이름이 이미 다르고, 훅으로 감싸면
 * `draftRestored` 게이트가 어느 위저드의 어느 effect와 맞물리는지 위저드 밖에서 읽어야
 * 해서 오히려 추적이 어려워진다. 한 번씩만 쓰이는 두 곳을 위해 추상화를 새로 만들지 않는다.
 */
export const CUSTOMER_DRAFT_FIELDS = ['customerName', 'customerPhone', 'customerEmail', 'customerNote'] as const;

export type CustomerDraftField = (typeof CUSTOMER_DRAFT_FIELDS)[number];

/**
 * 흐름별로 키를 가르되 서비스별로는 가르지 않는다 — 같은 사람이 녹음을 예약하고 이어서
 * 성우 녹음을 예약할 때 이름·연락처가 그대로 따라오는 편이 낫다(서비스가 달라도 예약이라는
 * 흐름은 같다). 다만 예약과 믹싱은 갈라야 한다: `customerNote`의 뜻이 다르다(예약은
 * 요청사항, 믹싱은 파일 링크) — 같은 키를 쓰면 예약 요청사항이 믹싱 주문 화면에 파일 링크
 * 자리로 잘못 복원된다.
 */
export const BOOKING_CUSTOMER_DRAFT_KEY = draftStorageKey('booking', 'customer');
export const MIXING_CUSTOMER_DRAFT_KEY = draftStorageKey('mixing', 'customer');
