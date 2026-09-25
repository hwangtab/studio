import { inferPublicNameChoice, maskName, previewPublicName, resolvePublicName, stripInvisible } from './publicName';
import { PLEDGE_TEXT_LIMITS } from './policy';

describe('maskName', () => {
  it.each([
    ['홍길동', '홍*동'],
    ['김철', '김*'],
    ['남궁민수', '남**수'],
    // 한 글자 조각은 남길 글자가 곧 실명이라 통째로 가린다.
    ['이', '*'],
    ['A Kim', '* K*m'],
    ['', ''],
    ['Jane Doe', 'J**e D*e'],
    ['  홍길동  ', '홍*동'],
  ])('%s → %s', (input, expected) => {
    expect(maskName(input)).toBe(expected);
  });

  // 코드 유닛으로 세면 서로게이트 쌍이 반쪽으로 잘려 깨진 글자가 명단에 올라간다.
  it('서로게이트 쌍을 한 글자로 센다', () => {
    expect(maskName('𠮷野家')).toBe('𠮷*家');
  });
});

describe('보이지 않는 문자', () => {
  it('폭 없는 공백·방향 재정의만 있는 닉네임은 빈 값으로 거부한다', () => {
    expect(resolvePublicName('nickname', '홍길동', '\u200B').ok).toBe(false);
    expect(resolvePublicName('nickname', '홍길동', '\u202E\u200B ').ok).toBe(false);
  });
  it('섞여 있으면 걷어 내고 저장한다', () => {
    expect(resolvePublicName('nickname', '홍길동', '청\u202E취자\u200B')).toEqual({ ok: true, value: '청취자' });
  });
  it('가린 이름도 결제자 이름의 보이지 않는 문자를 걷고 만든다', () => {
    expect(maskName('홍\u200B길동')).toBe('홍*동');
  });
});

describe('resolvePublicName', () => {
  it('실명은 NULL — 명단이 결제자 이름을 쓴다', () => {
    expect(resolvePublicName('real', '홍길동', '무시됨')).toEqual({ ok: true, value: null });
  });
  it('가린 이름은 결제자 이름에서 만든다', () => {
    expect(resolvePublicName('masked', '홍길동', undefined)).toEqual({ ok: true, value: '홍*동' });
  });
  it('닉네임은 다듬어 담고, 비었거나 길면 거부한다', () => {
    expect(resolvePublicName('nickname', '홍길동', ' 청취자 ')).toEqual({ ok: true, value: '청취자' });
    expect(resolvePublicName('nickname', '홍길동', '   ').ok).toBe(false);
    expect(resolvePublicName('nickname', '홍길동', 'ㄱ'.repeat(PLEDGE_TEXT_LIMITS.publicNickname + 1)).ok).toBe(false);
  });
});

it('미리보기는 명단에 실제로 올라갈 이름이다', () => {
  expect(previewPublicName('real', '홍길동', '')).toBe('홍길동');
  expect(previewPublicName('masked', '홍길동', '')).toBe('홍*동');
  expect(previewPublicName('nickname', '홍길동', '')).toBe('');
});

it('저장값에서 선택 상태를 되짚는다', () => {
  expect(inferPublicNameChoice(null, '홍길동')).toEqual({ style: 'real', nickname: '' });
  expect(inferPublicNameChoice('홍*동', '홍길동')).toEqual({ style: 'masked', nickname: '' });
  expect(inferPublicNameChoice('청취자', '홍길동')).toEqual({ style: 'nickname', nickname: '청취자' });
});

/**
 * 공백처럼 보이지만 Cc·Cf가 아닌 글자들 — 유니코드 카테고리로는 안 걸리고 JS `\s`도 아니라
 * `trim()`과 빈 값 판정을 모두 통과했다. 닉네임 `"ㅤㅤㅤ"`가 명단에 빈 항목으로 올라갔다.
 */
describe('카테고리로 안 걸리는 공백류', () => {
  it.each([
    ['U+3164 한글 채움 문자', 'ㅤ'],
    ['U+FFA0 반각 한글 채움 문자', 'ﾠ'],
    ['U+115F 초성 채움', 'ᅟ'],
    ['U+1160 중성 채움', 'ᅠ'],
    ['U+2800 점자 공백', '⠀'],
  ])('%s만으로 된 닉네임은 거부한다', (_label, ch) => {
    expect(stripInvisible(ch.repeat(3))).toBe('');
    expect(resolvePublicName('nickname', '홍길동', ch.repeat(3))).toMatchObject({ ok: false });
  });

  it('이름 사이에 섞여 와도 걷어 낸다', () => {
    expect(resolvePublicName('nickname', '홍길동', `청ㅤ취⠀자`)).toEqual({ ok: true, value: '청취자' });
  });

  it('정상적인 글자는 건드리지 않는다', () => {
    expect(resolvePublicName('nickname', '홍길동', 'Café 청취자 🎧')).toEqual({ ok: true, value: 'Café 청취자 🎧' });
  });
});

/**
 * `maskName`은 폼 미리보기를 위해 가릴 것이 없으면 빈 문자열을 돌려준다. 그 값을 저장하면
 * COALESCE가 NULL만 대체하므로 `''`가 표시 이름이 되고, 명단 조회의 `display_name <> ''`
 * 필터가 그 행을 버린다 — 공개에 동의한 후원이 오류 없이 명단에서 빠진다.
 */
describe('가릴 이름이 없는 masked', () => {
  it.each([
    ['보이지 않는 문자뿐', '​'],
    ['한글 채움 문자뿐', 'ㅤㅤ'],
    ['빈 문자열', ''],
  ])('%s인 결제자 이름은 빈 문자열이 아니라 NULL이다', (_label, customerName) => {
    expect(resolvePublicName('masked', customerName, undefined)).toEqual({ ok: true, value: null });
  });

  it('가릴 이름이 있으면 그대로 가린 이름이다', () => {
    expect(resolvePublicName('masked', '홍길동', undefined)).toEqual({ ok: true, value: '홍*동' });
  });
});
