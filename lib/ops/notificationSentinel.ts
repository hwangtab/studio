/**
 * `notification_error`에 실리는 **두 단계 센티널**과 그것을 사람 문구로 옮기는 자리.
 *
 * 이 컬럼은 원래 "알림 발송이 실패한 사유"를 담는 자유 문자열이었는데, 확정 후처리
 * 소유권을 CAS로 정하면서 두 개의 예약어가 함께 들어오게 됐다.
 *
 * - `send_pending` — 확정 트랜잭션과 **같은 batch**에 써 넣는다. "주문은 확정됐고 발송은
 *   아직 시작되지 않았다." 웹훅이 재도착하면 이 값을 보고 대신 보낸다.
 * - `send_inflight` — 선점에 성공한 실행이 `send_pending`을 이 값으로 바꾼다. "누가 지금
 *   보내고 있다." 경쟁자를 막으면서도 비어 있지 않아, 발송 구간에서 죽으면 이 값이 남아
 *   운영 점검(`isNotNull(notification_error)`)에 걸린다.
 *
 * 정상 종료하면 결과가 덮어쓴다 — 성공이면 `null`, 실패면 실제 사유 문자열이다.
 * 즉 화면에서 이 두 값을 보는 것은 **비정상이 아니라 진행 중이거나 중단된 상태**다.
 *
 * 왜 한곳에 모으는가: 값은 lib/booking/confirm.ts와 lib/funding/confirm.ts가 각자
 * 정의해 쓰고 있었고, 읽는 쪽은 관리자 화면 세 곳과 운영 점검이다. 한쪽만 바꾸면
 * 판정이 조용히 갈린다 — 상수와 해석을 같은 파일에 두어 그 드리프트를 없앤다.
 *
 * 이 모듈은 db·네트워크를 import하지 않는다. 관리자 페이지(클라이언트 번들)가
 * 그대로 가져다 쓸 수 있어야 하기 때문이다.
 */

export const SEND_PENDING = 'send_pending';
export const SEND_INFLIGHT = 'send_inflight';

/** 후처리 진행 상태를 나타내는 예약어인가 — 참이면 "발송 실패"가 아니다. */
export const isNotificationSentinel = (value: string | null | undefined): boolean =>
  value === SEND_PENDING || value === SEND_INFLIGHT;

export interface NotificationErrorCopy {
  /** `sentinel`이면 진행/대기 상태, `failure`면 실제 발송 실패다. 배너 제목이 갈린다. */
  kind: 'sentinel' | 'failure';
  /** 배너 제목 — 센티널에 "실패했습니다"라고 쓰면 거짓말이 된다. */
  title: string;
  /** 제목 아래 한 줄. 실패일 때는 원래 사유 문자열이 그대로 온다. */
  detail: string;
  /** 목록 화면의 짧은 배지 문구. */
  badge: string;
}

/**
 * `notification_error` 원문을 운영자가 읽을 문구로 옮긴다. 값이 없으면 `null`.
 *
 * 센티널을 원문 그대로 보여주면 "알림 발송에 실패했습니다 send_inflight"가 되어,
 * 정상 진행 중인 주문을 사고로 읽게 만든다. 반대로 진짜 실패 사유는 원문이 가장
 * 유용한 정보라 그대로 싣는다.
 */
export const describeNotificationError = (
  value: string | null | undefined,
): NotificationErrorCopy | null => {
  if (!value) return null;

  if (value === SEND_PENDING) {
    return {
      kind: 'sentinel',
      title: '확인 메일이 아직 발송되지 않았습니다',
      detail:
        '주문은 정상 확정됐고 발송이 시작되기 전 단계입니다. 토스 웹훅이 곧 대신 보내므로 '
        + '대개 몇 분 안에 사라집니다. 한참 지나도 그대로면 아래에서 다시 보내 주세요.',
      badge: '발송 대기',
    };
  }

  if (value === SEND_INFLIGHT) {
    return {
      kind: 'sentinel',
      title: '확인 메일 발송이 진행 중입니다',
      detail:
        '발송이 시작됐는데 끝났다는 기록이 없습니다. 보통 몇 초면 끝나므로, 이 표시가 계속 '
        + '남아 있다면 발송 도중에 중단된 것입니다 — 아래에서 다시 보내 주세요.',
      badge: '발송 중단?',
    };
  }

  return {
    kind: 'failure',
    title: '알림 발송에 실패했습니다',
    detail: value,
    badge: '알림 실패',
  };
};
