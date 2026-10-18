/**
 * 서명 화면의 임시 저장 — 연습실·제작 계약 서명 화면이 함께 쓴다(원래 연습실 sign.tsx 안에 있던 코드).
 *
 * 이 모듈은 아무것도 import하지 않는다 — 클라이언트 번들이 가져간다.
 */

/**
 * 입력하던 생년월일·주소를 이 탭에만 잠깐 보관한다.
 *
 * 이 페이지는 `Cache-Control: no-store`다(page-cache.ts — 계약 본문이 공유 캐시에 남으면
 * 재발송·취소로 링크를 죽여도 옛 계약이 계속 서빙된다). 그 헤더가 붙은 페이지는 bfcache에
 * 들어가지 않으므로, 뒤로가기나 앱 전환 후 복귀가 전부 전체 재로드가 된다 — 되돌아온 화면은
 * 복원된 상태가 아니라 빈 화면이다.
 *
 * 하필 이 페이지는 폰에서 16화면이 넘고(계약서 12쪽), 입력란은 14화면쯤 내려가야 나온다.
 * 주소를 정확히 적으려고 지도·메모 앱을 열었다 돌아오는 것은 흔한 동선인데, 그때마다
 * 스크롤과 타이핑을 처음부터 다시 하게 된다. 헤더도 길이도 줄일 수 없으니 입력값을 살린다.
 *
 * 담는 것은 생년월일·주소뿐이다. **동의 체크와 연락처 뒷자리, 서명은 담지 않는다** —
 * 앞의 둘은 사람이 그 자리에서 해야 하는 의사표시이고(복원된 체크는 동의한 행위가 아니다),
 * 뒷자리는 본인확인 수단, 서명은 서명 그 자체라 기기에 남길 것이 아니다. 생년월일·주소는
 * 계약서에 인쇄되는 사실 정보라 다시 입력해도 같은 값이고, 아낄 수 있는 것은 타이핑뿐이다.
 *
 * sessionStorage라 탭을 닫으면 사라지고, 같은 탭에서 이미 계약 본문이 보이고 있으므로
 * 노출면이 넓어지지 않는다. 계약마다 키를 나눠 다른 계약의 값이 새지 않게 한다.
 */
export const draftKey = (contractId: string) => `studionol:contract-draft:${contractId}`;

export interface SignDraft {
  customerBirthdate?: string;
  customerAddress?: string;
}

/** 저장소를 못 쓰는 환경(사생활 보호 모드·차단 설정)에서는 조용히 포기한다. */
export const readDraft = (contractId: string): SignDraft => {
  try {
    const raw = window.sessionStorage.getItem(draftKey(contractId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const { customerBirthdate, customerAddress } = parsed as SignDraft;
    return {
      ...(typeof customerBirthdate === 'string' ? { customerBirthdate } : {}),
      ...(typeof customerAddress === 'string' ? { customerAddress } : {}),
    };
  } catch {
    return {};
  }
};

export const writeDraft = (contractId: string, draft: SignDraft): void => {
  try {
    // 받은 객체를 그대로 직렬화하지 않고 두 항목만 골라 담는다. 타입은 컴파일 때만
    // 막아 주므로, 호출부가 하나 더 실어 보내면 뒷자리나 서명이 조용히 저장소에 남는다.
    // 담지 않기로 한 것을 담지 않는 책임은 호출부가 아니라 여기에 둔다.
    const stored: SignDraft = {
      ...(typeof draft.customerBirthdate === 'string'
        ? { customerBirthdate: draft.customerBirthdate }
        : {}),
      ...(typeof draft.customerAddress === 'string'
        ? { customerAddress: draft.customerAddress }
        : {}),
    };
    window.sessionStorage.setItem(draftKey(contractId), JSON.stringify(stored));
  } catch {
    // 용량 초과·차단. 임시 저장은 편의 기능이라 실패해도 서명에는 지장이 없다.
  }
};

export const clearDraft = (contractId: string): void => {
  try {
    window.sessionStorage.removeItem(draftKey(contractId));
  } catch {
    // 위와 같다.
  }
};
