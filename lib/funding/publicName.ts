import { PLEDGE_TEXT_LIMITS } from './policy';

/**
 * 후원자 명단에 **어떤 이름으로** 올라갈지.
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
 * 명단에 싣기 전에 **보이지 않는 문자**를 걷어 낸다 — 제어 문자(Cc)와 서식 문자(Cf),
 * 그리고 카테고리로는 안 걸리는 공백류 코드포인트 몇 개.
 *
 * 서식 문자에는 폭 없는 공백(U+200B)과 글자 방향 재정의(U+202E 등)가 들어 있다. 앞의 것만
 * 적으면 `trim()`을 통과해 "빈 이름"이 명단에 올라가고, 뒤의 것은 명단이 이름을 ` · `로
 * 이어 한 문단에 그리므로(components/funding/BackerWall.tsx) **뒤에 오는 다른 사람의
 * 이름까지** 거꾸로 뒤집는다. 이모지 결합용 ZWJ(U+200D)도 서식 문자라 함께 빠진다 —
 * 가족 이모지가 낱개로 풀리는 정도는 감수한다.
 *
 * **카테고리만으로는 부족하다.** 공백처럼 보이지만 Cc·Cf가 아닌 글자들이 있다 —
 * 한글 채움 문자 U+3164(`ㅤ`)와 그 반각 U+FFA0, 초·중성 채움 U+115F·U+1160(전부 Lo),
 * 점자 공백 U+2800(So). JS `\s`도 아니라 `trim()`과 빈 값 판정을 모두 통과해, 닉네임
 * `"ㅤㅤㅤ"`가 명단에 **빈 항목**으로 올라갔다. 이 다섯은 리터럴로 걸러 낸다.
 */
const INVISIBLE_SPACE_LIKE = '\u115F\u1160\u3164\uFFA0\u2800';
export const stripInvisible = (value: string): string =>
  value.replace(new RegExp(`[\\p{Cc}\\p{Cf}${INVISIBLE_SPACE_LIKE}]`, 'gu'), '');

/**
 * 가운데를 가린 이름. 공백으로 나뉜 조각마다 첫 글자(3자 이상이면 끝 글자도)만 남긴다.
 * `홍길동 → 홍*동`, `김철 → 김*`, `남궁민수 → 남**수`, `Jane Doe → J**e D*e`.
 *
 * **한 글자 조각은 통째로 가린다**(`이 → *`). 남길 글자를 고르면 그게 곧 실명이라 "가린
 * 이름"을 고른 사람의 이름이 그대로 나간다.
 *
 * 글자는 `Array.from`으로 센다 — 코드 유닛으로 세면 서로게이트 쌍(이모지·일부 한자)이
 * 반쪽으로 잘려 깨진 글자가 명단에 올라간다.
 */
export const maskName = (name: string): string => {
  const cleaned = stripInvisible(name).trim();
  // 이름을 아직 안 쓴 폼의 미리보기가 `*`를 보이지 않게 — 가릴 이름이 없으면 빈 값이다.
  if (cleaned === '') return '';
  return cleaned
    .split(/\s+/)
    .map((part) => {
      const chars = Array.from(part);
      if (chars.length <= 1) return '*';
      if (chars.length === 2) return `${chars[0]}*`;
      return `${chars[0]}${'*'.repeat(chars.length - 2)}${chars[chars.length - 1]}`;
    })
    .join(' ');
};

export type PublicNameResult = { ok: true; value: string | null } | { ok: false; message: string };

/**
 * 고른 방식으로 `public_name`에 담을 값을 만든다. `real`이면 NULL(명단이 결제자 이름을 쓴다).
 * 서버 검증과 화면 미리보기가 **같은 함수**를 지난다 — 미리보기와 실제 명단이 갈리면
 * 동의한 것과 다른 이름이 올라간다.
 */
export const resolvePublicName = (style: PublicNameStyle, customerName: string, nickname: string | undefined): PublicNameResult => {
  if (style === 'real') return { ok: true, value: null };
  if (style === 'masked') {
    /**
     * **가릴 이름이 없으면 빈 문자열이 아니라 NULL이다.** `maskName`은 폼 미리보기를 위해
     * 가릴 것이 없을 때 빈 문자열을 돌려주는데, 그 값을 그대로 저장하면 `COALESCE`가 NULL만
     * 대체하므로 `''`가 표시 이름이 되고, 명단 조회의 `display_name <> ''` 필터가 그 행을
     * 버린다 — 공개에 동의하고 미리보기까지 본 후원자가 오류 없이 명단에서 빠진다.
     * NULL이면 결제자 이름으로 대신 표시된다(real과 같은 자리로 떨어진다).
     */
    const masked = maskName(customerName);
    return { ok: true, value: masked === '' ? null : masked };
  }
  // 보이지 않는 문자를 먼저 걷고, 남은 것이 공백·결합 부호뿐이면 비어 있는 것으로 본다.
  const trimmed = stripInvisible(nickname ?? '').replace(/\s+/g, ' ').trim();
  if (/^[\s\p{M}]*$/u.test(trimmed)) return { ok: false, message: '명단에 표시할 닉네임을 입력해 주세요.' };
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
