import { inferPublicNameChoice, maskName, previewPublicName, resolvePublicName } from './publicName';
import { PLEDGE_TEXT_LIMITS } from './policy';

describe('maskName', () => {
  it.each([
    ['홍길동', '홍*동'],
    ['김철', '김*'],
    ['남궁민수', '남**수'],
    ['이', '이'],
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
