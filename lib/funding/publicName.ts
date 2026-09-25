import { PLEDGE_TEXT_LIMITS } from './policy';

/**
 * 서포터 명단에 **어떤 이름으로** 올라갈지.
 *
 * 공개 동의(`display_name_public`)와는 다른 축이다. 동의는 "명단에 오르는가", 이것은
 * "오른다면 어떤 이름으로"다. 예전에는 공개하면 결제자 실명이 그대로 올라가서, 실명이
 * 부담스러운 후원자는 응원 메시지를 써 놓고도 공개를 누르지 않았다.
 *
 * - `real` — 결제자 이름 그대로. `funding_pledges.public_name`은 NULL이다.
 * - `masked` — 가운데를 가린 이름(`홍*동`). 서버가 결제자 이름에서 만든다.
 * - `nickname` — 후원자가 적은 닉네임.
 *
 * DB에는 **최종 표시 문자열 하나**(`public_name`)만 남긴다. 방식 컬럼을 따로 두지 않는
 * 이유: 명단 조회가 `COALESCE(public_name, customer_name)` 한 줄로 끝나고, 방식은
 * 화면에서 다시 고를 때만 필요해 `inferPublicNameChoice`로 되짚으면 충분하다.
 *
 * 이 모듈은 클라이언트 번들에 들어간다(위저드·완료 화면·펀딩 확인 화면). DB·fs를
 * import하지 말 것.
 */
export const PUBLIC_NAME_STYLES = ['real', 'masked', 'nickname'] as const;
export type PublicNameStyle = (typeof PUBLIC_NAME_STYLES)[number];

export const isPublicNameStyle = (v: unknown): v is PublicNameStyle =>
  typeof v === 'string' && (PUBLIC_NAME_STYLES as readonly string[]).includes(v);

/**
 * 가운데를 가린 이름. 공백으로 나뉜 조각마다 첫 글자(3자 이상이면 끝 글자도)만 남긴다.
 * `홍길동 → 홍*동`, `김철 → 김*`, `남궁민수 → 남**수`, `Jane Doe → J**e D*e`.
 *
 * 글자는 `Array.from`으로 센다 — 코드 유닛으로 세면 서로게이트 쌍(이모지·일부 한자)이
 * 반쪽으로 잘려 깨진 글자가 명단에 올라간다.
 */
export const maskName = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .map((part) => {
      const chars = Array.from(part);
      if (chars.length <= 1) return part;
      if (chars.length === 2) return `${chars[0]}*`;
      return `${chars[0]}${'*'.repeat(chars.length - 2)}${chars[chars.length - 1]}`;
    })
    .join(' ');

export type PublicNameResult = { ok: true; value: string | null } | { ok: false; message: string };

/**
 * 고른 방식으로 `public_name`에 담을 값을 만든다. `real`이면 NULL(명단이 결제자 이름을 쓴다).
 * 서버 검증과 화면 미리보기가 **같은 함수**를 지난다 — 미리보기와 실제 명단이 갈리면
 * 동의한 것과 다른 이름이 올라간다.
 */
export const resolvePublicName = (style: PublicNameStyle, customerName: string, nickname: string | undefined): PublicNameResult => {
  if (style === 'real') return { ok: true, value: null };
  if (style === 'masked') return { ok: true, value: maskName(customerName) };
  const trimmed = (nickname ?? '').trim();
  if (trimmed === '') return { ok: false, message: '명단에 표시할 닉네임을 입력해 주세요.' };
  if (Array.from(trimmed).length > PLEDGE_TEXT_LIMITS.publicNickname)
    return { ok: false, message: `닉네임은 ${PLEDGE_TEXT_LIMITS.publicNickname}자까지 입력할 수 있습니다.` };
  return { ok: true, value: trimmed };
};

/** 명단에 실제로 보일 이름 — 미리보기용. */
export const previewPublicName = (style: PublicNameStyle, customerName: string, nickname: string): string => {
  const r = resolvePublicName(style, customerName, nickname);
  return r.ok ? r.value ?? customerName.trim() : '';
};

/**
 * 저장된 `public_name`에서 화면의 선택 상태를 되짚는다. 가린 이름과 글자까지 같은 닉네임은
 * `masked`로 읽히는데, 명단에 보이는 결과가 같으니 문제가 없다.
 */
export const inferPublicNameChoice = (stored: string | null, customerName: string): { style: PublicNameStyle; nickname: string } => {
  if (stored === null) return { style: 'real', nickname: '' };
  if (stored === maskName(customerName)) return { style: 'masked', nickname: '' };
  return { style: 'nickname', nickname: stored };
};
