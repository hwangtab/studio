/**
 * 결제 직전 폼의 입력값을 같은 탭에만 잠깐 담아 둔다.
 *
 * 왜 필요한가: 후원·예약·주문 폼은 전부 결제 바로 앞에 있고, 그 화면을 벗어나는 동선이
 * 흔하다 — 펀딩은 리워드 모달을 백드롭 터치·ESC로 닫으면 폼이 통째로 언마운트되고,
 * 예약·믹싱 주문은 새로고침·뒤로가기·모바일 탭 정리로 페이지가 다시 뜬다. 되돌아온 화면이
 * 빈 칸이면 이름·연락처·주소를 처음부터 다시 친다(펀딩 배송 리워드는 입력 칸이 10개다).
 *
 * 관용구는 서명 화면(`pages/[locale]/contracts/[id]/sign.tsx`)에서 가져왔다. 그 페이지는
 * 자기 필드 목록을 좁게 유지해야 하는 법적 이유가 따로 있어(연락처 뒷자리·서명 이미지)
 * 페이지 안에 두고, 이 모듈로 옮기지 않았다.
 *
 * ## 지켜야 할 선
 *
 * **무엇을 담느냐가 아니라 무엇을 담지 않느냐가 이 모듈의 계약이다.**
 *
 * - **동의 체크는 담지 않는다.** 복원된 체크는 사람이 한 의사표시가 아니다. 펀딩은
 *   `funding_pledges.terms_version`이 "그때 이 내용에 동의했다"의 증거인데, 저장소에서
 *   되살린 체크가 그 증거를 받치지 못한다(CLAUDE.md 약관 판본 절).
 * - **문자열만 담는다.** 담을 값이 늘어나면 무엇이 저장소에 남는지 읽는 사람이 한눈에
 *   판단할 수 없게 된다. 체크박스 하나 되살리는 편의는 이 명료함보다 싸다.
 * - **고르는 값(리워드·수량·날짜·시간대)은 담지 않는다.** 재고와 예약 가능 시간은 그
 *   사이에 바뀐다 — 되살린 선택이 지금 유효하다고 보장할 수 없고, 아끼는 것도 타이핑이
 *   아니라 탭 한 번이다.
 *
 * localStorage가 아니라 sessionStorage다. 이름·연락처·주소가 공용 PC에 무기한 남지
 * 않으면서, 실수로 닫기·새로고침·뒤로가기·탭 복원은 전부 덮는다. 결제가 확정되면
 * 성공 화면이 지운다.
 */

/** `studionol:funding-draft:<slug>` 꼴. 흐름과 대상별로 갈라 다른 건의 값이 새지 않게 한다. */
export const draftStorageKey = (flow: string, id: string): string =>
  `studionol:${flow}-draft:${id}`;

export type StringDraft<K extends string> = Partial<Record<K, string>>;

/**
 * 알려진 문자열 필드만 골라 되돌려준다.
 *
 * 저장소 값은 사용자가 고칠 수 있으므로 형태를 믿지 않는다 — 파싱 실패·객체 아님·필드
 * 타입 불일치는 전부 "없음"으로 떨어진다. 저장소를 못 쓰는 환경(사생활 보호 모드·차단
 * 설정)에서는 접근 자체가 throw하므로 조용히 포기한다.
 */
export const readStringDraft = <K extends string>(
  key: string,
  fields: readonly K[],
): StringDraft<K> => {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const source = parsed as Record<string, unknown>;
    const picked: StringDraft<K> = {};
    for (const field of fields) {
      const value = source[field];
      if (typeof value === 'string' && value !== '') picked[field] = value;
    }
    return picked;
  } catch {
    return {};
  }
};

/**
 * 허용 목록에 있는 문자열 필드만 담는다.
 *
 * 받은 객체를 그대로 직렬화하지 않는 것이 핵심이다. 타입은 컴파일 때만 막아 주므로,
 * 호출부가 동의 체크나 다른 값을 하나 더 실어 보내면 조용히 저장소에 남는다 —
 * **담지 않기로 한 것을 담지 않는 책임은 호출부가 아니라 여기에 둔다**(서명 화면과 같은 판단).
 *
 * 담을 것이 하나도 없으면 남겨 둘 이유가 없으니 지운다.
 */
export const writeStringDraft = <K extends string>(
  key: string,
  fields: readonly K[],
  draft: StringDraft<K>,
): void => {
  try {
    const stored: StringDraft<K> = {};
    for (const field of fields) {
      const value = draft[field];
      if (typeof value === 'string' && value !== '') stored[field] = value;
    }
    if (Object.keys(stored).length === 0) {
      window.sessionStorage.removeItem(key);
      return;
    }
    window.sessionStorage.setItem(key, JSON.stringify(stored));
  } catch {
    // 용량 초과·차단. 임시 저장은 편의 기능이라 실패해도 결제에는 지장이 없다.
  }
};

export const clearStoredDraft = (key: string): void => {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // 위와 같다.
  }
};

/**
 * 접두사가 같은 초안을 모두 지운다.
 *
 * 성공 화면이 어느 건이었는지 모를 때 쓴다 — 결제 완료 화면은 주문번호만 알고 프로젝트
 * slug·서비스명을 모르는 경우가 있다. 결제가 끝난 시점에 그 흐름의 초안을 남겨 둘 이유는
 * 없으므로, 대상을 특정하지 못하면 흐름 전체를 지우는 것이 맞다.
 */
export const clearDraftsByPrefix = (prefix: string): void => {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const key = window.sessionStorage.key(i);
      if (key && key.startsWith(prefix)) keys.push(key);
    }
    for (const key of keys) window.sessionStorage.removeItem(key);
  } catch {
    // 위와 같다.
  }
};
