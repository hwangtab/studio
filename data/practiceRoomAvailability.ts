// 연습실 공실 상태 — 만실/공실은 오가는 사실이라 코드가 아니라 여기서 바꾼다.
// 바꿀 때 updatedOn도 함께 갱신할 것(오래된 "지금 입주 가능"은 거짓 광고가 된다).
export const PRACTICE_ROOM_HAS_VACANCY = true;

/**
 * 남은 방 수. ko 카피가 이 숫자를 그대로 말한다("지금 N자리 남았습니다").
 *
 * 비-ko 로케일은 **수량을 말하지 않는다** — 로케일마다 단복수·양사 규칙이 달라
 * 숫자를 넣으면 2자리가 됐을 때 여섯 언어가 한꺼번에 틀린 문장이 된다.
 * "지금 입주 가능"만 말하면 1자리든 3자리든 항상 사실이다.
 *
 * 0이면 PRACTICE_ROOM_HAS_VACANCY를 false로 두는 것이 정본이다(카피가 만실 문구로 바뀐다).
 */
export const PRACTICE_ROOM_VACANT_ROOMS = 1;
export const PRACTICE_ROOM_AVAILABILITY_UPDATED_ON = '2026-09-16';
