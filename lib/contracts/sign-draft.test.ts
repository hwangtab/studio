/** @jest-environment jsdom */

/**
 * 서명 화면의 임시 저장이 담는 것과 담지 않는 것을 고정한다.
 *
 * 이 페이지는 `Cache-Control: no-store`라 bfcache에 들어가지 않는다 — 앱 전환 후 복귀가
 * 전체 재로드가 되고, 폰에서 14화면쯤 내려가야 나오는 입력란을 처음부터 다시 채워야 한다.
 * 그래서 생년월일·주소만 같은 탭에 잠깐 담는다.
 *
 * 여기서 지켜야 할 선은 "무엇을 담느냐"가 아니라 **무엇을 담지 않느냐**다. 연락처 뒷자리는
 * 본인확인 수단이고, 서명 이미지는 서명 그 자체이며, 동의 체크는 사람이 그 자리에서 해야
 * 하는 의사표시다(복원된 체크는 동의한 행위가 아니다). 편의를 위해 하나만 더 담자는 변경이
 * 들어오면 이 테스트가 막는다.
 */

import {
  clearDraft,
  draftKey,
  readDraft,
  writeDraft,
} from '../../pages/[locale]/contracts/[id]/sign';

const CONTRACT = 'c-1';
const OTHER = 'c-2';

beforeEach(() => window.sessionStorage.clear());

describe('임시 저장', () => {
  it('생년월일과 주소를 담았다가 되돌려준다', () => {
    writeDraft(CONTRACT, { customerBirthdate: '1990-05-15', customerAddress: '서울시 은평구' });

    expect(readDraft(CONTRACT)).toEqual({
      customerBirthdate: '1990-05-15',
      customerAddress: '서울시 은평구',
    });
  });

  /** 계약마다 키가 갈려야 한 사람의 주소가 다른 계약 화면에 뜨지 않는다. */
  it('다른 계약의 값을 넘겨주지 않는다', () => {
    writeDraft(CONTRACT, { customerAddress: '서울시 은평구' });

    expect(draftKey(CONTRACT)).not.toBe(draftKey(OTHER));
    expect(readDraft(OTHER)).toEqual({});
  });

  it('서명이 끝나면 지운다', () => {
    writeDraft(CONTRACT, { customerAddress: '서울시 은평구' });
    clearDraft(CONTRACT);

    expect(readDraft(CONTRACT)).toEqual({});
    expect(window.sessionStorage.getItem(draftKey(CONTRACT))).toBeNull();
  });

  it('저장한 적 없으면 빈 값이다', () => {
    expect(readDraft(CONTRACT)).toEqual({});
  });
});

describe('담지 않는 것', () => {
  /**
   * 본인확인 수단·서명·동의가 저장소에 닿으면 안 된다. writeDraft에 실어 보내도
   * 걸러져야 하고, 저장된 JSON 어디에도 그 값이 남으면 안 된다.
   */
  it('뒷자리·서명·동의를 함께 넘겨도 저장하지 않는다', () => {
    writeDraft(CONTRACT, {
      customerBirthdate: '1990-05-15',
      customerAddress: '서울시 은평구',
      // @ts-expect-error — 타입이 이미 막지만, 런타임에서도 새지 않는지 본다
      identityDigits: '5678',
      signatureData: 'data:image/png;base64,AAA',
      agreements: { 'clause-1': true },
    });

    const raw = window.sessionStorage.getItem(draftKey(CONTRACT)) ?? '';
    expect(raw).not.toContain('5678');
    expect(raw).not.toContain('base64');
    expect(raw).not.toContain('clause-1');
    expect(readDraft(CONTRACT)).toEqual({
      customerBirthdate: '1990-05-15',
      customerAddress: '서울시 은평구',
    });
  });

  /** 저장소에 손으로 심어 둔 값도 읽어 들이지 않는다. */
  it('저장소에 심어진 다른 키는 읽지 않는다', () => {
    window.sessionStorage.setItem(
      draftKey(CONTRACT),
      JSON.stringify({ customerAddress: '서울시 은평구', identityDigits: '5678' }),
    );

    expect(readDraft(CONTRACT)).toEqual({ customerAddress: '서울시 은평구' });
  });
});

describe('저장소를 못 쓰는 환경', () => {
  /** 사생활 보호 모드나 차단 설정에서 던지더라도 서명 자체는 진행돼야 한다. */
  it('예외를 던져도 서명을 막지 않는다', () => {
    const storage = window.sessionStorage;
    const boom = () => {
      throw new Error('SecurityError');
    };
    const stub = { getItem: boom, setItem: boom, removeItem: boom } as unknown as Storage;
    Object.defineProperty(window, 'sessionStorage', { value: stub, configurable: true });

    try {
      expect(readDraft(CONTRACT)).toEqual({});
      expect(() => writeDraft(CONTRACT, { customerAddress: '서울시' })).not.toThrow();
      expect(() => clearDraft(CONTRACT)).not.toThrow();
    } finally {
      Object.defineProperty(window, 'sessionStorage', { value: storage, configurable: true });
    }
  });

  it('깨진 JSON이 들어 있어도 빈 값으로 넘어간다', () => {
    window.sessionStorage.setItem(draftKey(CONTRACT), '{깨진');
    expect(readDraft(CONTRACT)).toEqual({});
  });
});
