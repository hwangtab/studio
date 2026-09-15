/** @jest-environment jsdom */

/**
 * 결제 직전 폼의 임시 저장이 담는 것과 담지 않는 것을 고정한다.
 *
 * 여기서 지켜야 할 선은 "무엇을 담느냐"가 아니라 **무엇을 담지 않느냐**다(lib/formDraft.ts).
 * 편의를 위해 동의 체크나 선택값을 하나만 더 담자는 변경이 들어오면 이 테스트가 막는다.
 */

import {
  clearDraftsByPrefix,
  clearStoredDraft,
  draftStorageKey,
  readStringDraft,
  writeStringDraft,
} from './formDraft';

const FIELDS = ['customerName', 'customerPhone'] as const;
const KEY = draftStorageKey('booking', 'recording');

beforeEach(() => window.sessionStorage.clear());

describe('draftStorageKey', () => {
  it('흐름과 대상으로 키를 가른다', () => {
    expect(draftStorageKey('funding', 'keep-singing')).toBe('studionol:funding-draft:keep-singing');
    expect(draftStorageKey('booking', 'recording')).not.toBe(draftStorageKey('mixing', 'recording'));
  });
});

describe('임시 저장', () => {
  it('담았다가 되돌려준다', () => {
    writeStringDraft(KEY, FIELDS, { customerName: '홍길동', customerPhone: '010-1234-5678' });

    expect(readStringDraft(KEY, FIELDS)).toEqual({
      customerName: '홍길동',
      customerPhone: '010-1234-5678',
    });
  });

  it('다른 흐름의 값을 넘겨주지 않는다', () => {
    writeStringDraft(draftStorageKey('funding', 'a'), FIELDS, { customerName: '홍길동' });

    expect(readStringDraft(draftStorageKey('funding', 'b'), FIELDS)).toEqual({});
    expect(readStringDraft(draftStorageKey('booking', 'a'), FIELDS)).toEqual({});
  });

  /**
   * 허용 목록 밖의 값은 호출부가 실어 보내도 저장소에 닿지 않는다.
   *
   * 타입은 컴파일 때만 막아 주므로, 동의 체크를 하나 더 실어 보내는 변경이 들어와도
   * 여기서 걸러진다 — 복원된 체크는 사람이 한 의사표시가 아니다.
   */
  it('허용 목록에 없는 값은 담지 않는다', () => {
    writeStringDraft(KEY, FIELDS, {
      customerName: '홍길동',
      // @ts-expect-error 호출부가 실수로 더 실어 보내는 상황을 재현한다.
      termsAgreed: 'true',
      rewardId: 'reward-1',
    });

    const raw = JSON.parse(window.sessionStorage.getItem(KEY) as string);
    expect(raw).toEqual({ customerName: '홍길동' });
  });

  it('문자열이 아닌 값은 담지 않는다', () => {
    writeStringDraft(KEY, FIELDS, {
      customerName: '홍길동',
      // @ts-expect-error 체크박스 상태가 섞여 들어오는 상황을 재현한다.
      customerPhone: true,
    });

    expect(readStringDraft(KEY, FIELDS)).toEqual({ customerName: '홍길동' });
  });

  it('담을 것이 없으면 저장소에 남기지 않는다', () => {
    writeStringDraft(KEY, FIELDS, { customerName: '홍길동' });
    writeStringDraft(KEY, FIELDS, { customerName: '', customerPhone: '' });

    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it('지우면 사라진다', () => {
    writeStringDraft(KEY, FIELDS, { customerName: '홍길동' });
    clearStoredDraft(KEY);

    expect(readStringDraft(KEY, FIELDS)).toEqual({});
  });
});

describe('손상된 값 방어', () => {
  it.each([
    ['JSON이 아닌 문자열', '{{{'],
    ['객체가 아닌 JSON', '"문자열"'],
    ['null', 'null'],
    ['배열', '[1,2,3]'],
  ])('%s은 없는 것으로 본다', (_label, raw) => {
    window.sessionStorage.setItem(KEY, raw);

    expect(readStringDraft(KEY, FIELDS)).toEqual({});
  });

  it('빈 문자열은 값으로 보지 않는다 — 빈 칸으로 덮어쓰지 않게', () => {
    window.sessionStorage.setItem(KEY, JSON.stringify({ customerName: '' }));

    expect(readStringDraft(KEY, FIELDS)).toEqual({});
  });
});

describe('접두사 일괄 삭제', () => {
  it('같은 흐름만 지우고 다른 흐름은 남긴다', () => {
    writeStringDraft(draftStorageKey('funding', 'a'), FIELDS, { customerName: '가' });
    writeStringDraft(draftStorageKey('funding', 'b'), FIELDS, { customerName: '나' });
    writeStringDraft(draftStorageKey('booking', 'a'), FIELDS, { customerName: '다' });

    clearDraftsByPrefix('studionol:funding-draft:');

    expect(readStringDraft(draftStorageKey('funding', 'a'), FIELDS)).toEqual({});
    expect(readStringDraft(draftStorageKey('funding', 'b'), FIELDS)).toEqual({});
    expect(readStringDraft(draftStorageKey('booking', 'a'), FIELDS)).toEqual({ customerName: '다' });
  });

  it('무관한 sessionStorage 항목은 건드리지 않는다', () => {
    window.sessionStorage.setItem('funding:lastOrderNo:keep-singing', 'SNB-1');
    clearDraftsByPrefix('studionol:funding-draft:');

    expect(window.sessionStorage.getItem('funding:lastOrderNo:keep-singing')).toBe('SNB-1');
  });
});

describe('저장소를 못 쓰는 환경', () => {
  const broken = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
    removeItem: () => { throw new Error('blocked'); },
    key: () => { throw new Error('blocked'); },
    get length() { throw new Error('blocked'); },
  };

  /** 사생활 보호 모드·저장 차단 브라우저는 접근 자체가 throw한다. 편의 기능이라 조용히 포기한다. */
  it('읽기·쓰기·삭제가 예외를 밖으로 내보내지 않는다', () => {
    const original = window.sessionStorage;
    Object.defineProperty(window, 'sessionStorage', { value: broken, configurable: true });
    try {
      expect(readStringDraft(KEY, FIELDS)).toEqual({});
      expect(() => writeStringDraft(KEY, FIELDS, { customerName: '홍길동' })).not.toThrow();
      expect(() => clearStoredDraft(KEY)).not.toThrow();
      expect(() => clearDraftsByPrefix('studionol:')).not.toThrow();
    } finally {
      Object.defineProperty(window, 'sessionStorage', { value: original, configurable: true });
    }
  });
});
