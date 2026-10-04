import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import PledgeWizard from './PledgeWizard';
import { parseFundingProject } from '../../lib/funding/projects';
import { trackMicroEvent } from '../../utils/analytics';
import { MAX_ADDITIONAL_AMOUNT, MAX_QUANTITY } from '../../lib/funding/policy';
import type { KakaoPostcodeData } from './kakaoPostcode';

/**
 * 결제위젯은 폼 안에 떠 있고, 제출은 그 위젯의 `requestPayment`를 부른다. 테스트에서는
 * 무엇을 어떤 금액으로 여는지를 본다 — 그게 이 폼의 계약이다.
 */
const requestPayment = jest.fn().mockResolvedValue(undefined);
const retryPayment = jest.fn();
let widgetReady = true;
let widgetError: string | null = null;
// 위젯 약관 동의 상태. 위젯이 iframe 안에서 체크를 받으므로 실제로는 SDK의
// `agreementStatusChange`가 알려 준다. null은 "아직 모름"(= 한 번도 건드리지 않음).
//
// 기본값을 `true`로 두는 이유: 대부분의 테스트는 결제까지 가는 정상 경로를 본다.
// 가드를 확인하는 테스트만 `false`·`null`로 내려 쓴다.
let widgetAgreed: boolean | null = true;
jest.mock('../booking/useTossPaymentWidgets', () => ({
  useTossPaymentWidgets: () => ({
    methodsId: 'toss-methods-test', agreementId: 'toss-agreement-test',
    ready: widgetReady, error: widgetError, retry: retryPayment, requestPayment,
    agreedRequiredTerms: widgetAgreed,
  }),
  // 모듈을 통째로 대체하므로 상수도 함께 내보내야 한다 — 빠뜨리면 호출부가 undefined를
  // setError에 넣어 경고가 조용히 사라진다(2026-09-16에 실제로 그랬다).
  TOSS_TERMS_REQUIRED_MESSAGE: '결제수단 아래 [필수] 결제 서비스 이용 약관에도 동의해 주세요.',
}));
jest.mock('../../utils/analytics', () => ({ trackMicroEvent: jest.fn() }));

/**
 * 주소는 카카오 우편번호 검색으로 넣는다(2026-09-29). 실제 서비스는 외부 스크립트 + iframe이라,
 * 테스트에서는 embed하는 순간 곧바로 "고른 결과"를 돌려주는 가짜로 바꾼다. 결과 문자열은
 * 실제 포맷 함수(formatKakaoAddress)를 그대로 탄다.
 */
const mockPostcodeBase: KakaoPostcodeData = {
  zonecode: '12345', roadAddress: '서울시 어딘가', jibunAddress: '서울시 어딘가 1-1',
  userSelectedType: 'R', bname: '', buildingName: '', apartment: 'N',
};
let mockPostcodeResult: KakaoPostcodeData = { ...mockPostcodeBase };
let mockPostcodeFails = false;
jest.mock('./kakaoPostcode', () => {
  const actual = jest.requireActual('./kakaoPostcode');
  return {
    ...actual,
    loadKakaoPostcode: () => (mockPostcodeFails
      ? Promise.reject(new Error('blocked'))
      : Promise.resolve(class {
        constructor(private readonly opts: { oncomplete: (d: unknown) => void }) {}
        embed() { this.opts.oncomplete(mockPostcodeResult); }
      })),
  };
});

/** 주소 검색을 눌러 결과를 고른다 — 우편번호·주소 칸이 채워질 때까지 기다린다. */
const searchAddress = async (roadAddress = '서울시 어딘가') => {
  mockPostcodeResult = { ...mockPostcodeBase, roadAddress };
  await userEvent.click(screen.getByRole('button', { name: '주소 검색' }));
  await waitFor(() => expect(screen.getByLabelText(/^주소\*$/)).toHaveValue(roadAddress));
};

const project = parseFundingProject(`---
slug: demo
title: 데모
summary: s
cover: /c.webp
goalAmount: 1000
startAt: 2026-01-01T00:00:00+09:00
endAt: 2036-01-01T00:00:00+09:00
rewards:
  - id: cd
    title: CD
    description: d
    amount: 30000
    totalQuantity: 5
    requiresShipping: true
    addOn: true
    estimatedDelivery: 2026-12
  - id: mail
    title: 감사 메일
    description: d
    amount: 5000
    requiresShipping: false
    estimatedDelivery: 2026-11
---
`, 'demo');

afterEach(() => jest.restoreAllMocks());

beforeEach(() => {
  mockPostcodeFails = false;
  mockPostcodeResult = { ...mockPostcodeBase };
  // 임시 저장(lib/formDraft.ts)이 sessionStorage에 쓴다 — 안 지우면 이 파일의 다른
  // 테스트가 남긴 이름·연락처·주소가 다음 테스트에서 되살아나 서로 간섭한다.
  window.sessionStorage.clear();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true, status: 201, headers: { get: () => 'application/json' },
    json: async () => ({
      ok: true, orderNo: 'FND-1', paymentMethod: 'toss',
      holdExpiresAt: new Date(Date.now() + 900000).toISOString(), serverNow: new Date().toISOString(),
      itemAmount: 27273, vatAmount: 2727, totalAmount: 30000,
    }),
  }) as never;
});

it('배송 리워드는 배송지 입력이 보인다 — 받는 분은 기본이 후원자 본인이라 따로 묻지 않는다', async () => {
  render(<PledgeWizard project={project} initialRewardId="cd" remaining={{ cd: 5, mail: null }} />);
  expect(screen.getByLabelText(/^주소\*$/)).toBeInTheDocument();
  expect(screen.queryByLabelText(/^받는 분\*$/)).toBeNull();
  await userEvent.click(screen.getByLabelText('후원자가 아닌 다른 분이 받습니다'));
  expect(screen.getByLabelText(/^받는 분\*$/)).toBeInTheDocument();
});

describe('배송지', () => {
  const fill = async () => {
    await userEvent.type(screen.getByLabelText(/^이름\*$/), '김후원');
    await userEvent.type(screen.getByLabelText(/^연락처\*$/), '010-1111-2222');
    await userEvent.type(screen.getByLabelText(/^이메일\*$/), 'a@b.com');
  };
  const sentShipping = () => JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).shipping;

  it('주소 검색으로 우편번호·주소가 채워지고, 칸은 직접 고칠 수 없다', async () => {
    render(<PledgeWizard project={project} initialRewardId="cd" remaining={{ cd: 5, mail: null }} />);
    expect(screen.getByLabelText(/^우편번호\*$/)).toHaveAttribute('readonly');
    mockPostcodeResult = { ...mockPostcodeBase, bname: '역삼동', buildingName: '놀아파트', apartment: 'Y' };
    await userEvent.click(screen.getByRole('button', { name: '주소 검색' }));
    await waitFor(() => expect(screen.getByLabelText(/^우편번호\*$/)).toHaveValue('12345'));
    expect(screen.getByLabelText(/^주소\*$/)).toHaveValue('서울시 어딘가 (역삼동, 놀아파트)');
    // 고른 뒤에는 상세주소로 커서가 간다.
    await waitFor(() => expect(screen.getByLabelText(/상세주소/)).toHaveFocus());
  });

  it('받는 분을 따로 적지 않으면 후원자 이름·연락처로 보낸다', async () => {
    render(<PledgeWizard project={project} initialRewardId="cd" remaining={{ cd: 5, mail: null }} />);
    await fill();
    await searchAddress();
    await userEvent.click(screen.getByRole('button', { name: /결제하기/ }));
    await waitFor(() => expect(requestPayment).toHaveBeenCalled());
    expect(sentShipping()).toMatchObject({ name: '김후원', phone: '010-1111-2222', postcode: '12345', address1: '서울시 어딘가' });
  });

  it('다른 분이 받으면 그분의 이름·연락처로 보낸다', async () => {
    render(<PledgeWizard project={project} initialRewardId="cd" remaining={{ cd: 5, mail: null }} />);
    await fill();
    await userEvent.click(screen.getByLabelText('후원자가 아닌 다른 분이 받습니다'));
    await userEvent.type(screen.getByLabelText(/^받는 분\*$/), '박수령');
    await userEvent.type(screen.getByLabelText(/^받는 분 연락처\*$/), '010-3333-4444');
    await searchAddress();
    await userEvent.click(screen.getByRole('button', { name: /결제하기/ }));
    await waitFor(() => expect(requestPayment).toHaveBeenCalled());
    expect(sentShipping()).toMatchObject({ name: '박수령', phone: '010-3333-4444' });
  });

  // 읽기 전용 칸은 브라우저의 required 검사에서 빠진다 — 비운 채 보내면 주문만 만들어진다.
  it('주소를 넣지 않고 제출하면 주문을 만들지 않고 막는다', async () => {
    render(<PledgeWizard project={project} initialRewardId="cd" remaining={{ cd: 5, mail: null }} />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: /결제하기/ }));
    expect(await screen.findByText('주소 검색으로 받으실 주소를 넣어 주세요.')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('우편번호 서비스를 못 불러오면 직접 입력으로 연다', async () => {
    mockPostcodeFails = true;
    render(<PledgeWizard project={project} initialRewardId="cd" remaining={{ cd: 5, mail: null }} />);
    await userEvent.click(screen.getByRole('button', { name: '주소 검색' }));
    expect(await screen.findByText(/주소 검색을 불러오지 못했습니다/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/^우편번호\*$/), '54321');
    await userEvent.type(screen.getByLabelText(/^주소\*$/), '부산시 어딘가');
    expect(screen.getByLabelText(/^주소\*$/)).toHaveValue('부산시 어딘가');
  });
});
it('제출하면 곧바로 결제창을 연다 — 중간 화면이 없다', async () => {
  render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
  await userEvent.type(screen.getByLabelText(/^이름\*$/), '김후원');
  await userEvent.type(screen.getByLabelText(/^연락처\*$/), '010-1111-2222');
  await userEvent.type(screen.getByLabelText(/^이메일\*$/), 'a@b.com');
  await userEvent.click(screen.getByRole('button', { name: /결제하기/ }));
  await waitFor(() => expect(requestPayment).toHaveBeenCalled());
  // 청구는 **서버가 확정한 금액**으로 연다 — 화면 추정치로 열면 청구액이 어긋난다.
  expect(requestPayment).toHaveBeenCalledWith(expect.objectContaining({
    orderId: 'FND-1', amount: 30000,
  }));
  // funding_pledge_start는 페이지 진입 시 pledge.tsx에서 발화한다 — 제출에서는 발화하지 않는다.
  expect(trackMicroEvent).not.toHaveBeenCalled();
});

/**
 * 이 블록은 **반드시 한 글자씩** 입력해야 의미가 있다. 예전 onChange는 매 키 입력마다
 * 정규화한 값을 상태로 되돌려 넣어서, 값을 통째로 주입하는 fireEvent.change로는 버그가
 * 드러나지 않았다(추가 후원금은 `5`→0, `50`→0 … 으로 타이핑 자체가 불가능했고 수량은
 * `1`에 한 글자만 더 쳐도 상한으로 튀었다). 정규화는 blur·제출 직전에만 일어난다.
 */
const typeInto = async (input: HTMLInputElement, value: string) => {
  await userEvent.clear(input);
  await userEvent.type(input, value);
};

it('추가 펀딩 금액을 한 글자씩 타이핑할 수 있다 — 중간 글자에서 0으로 깎이지 않는다', async () => {
  render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
  const input = screen.getByLabelText(/추가 펀딩 금액/) as HTMLInputElement;
  await typeInto(input, '5000');
  expect(input.value).toBe('5000');
  await userEvent.tab();
  expect(input.value).toBe('5000');
});

it('추가 펀딩 금액은 blur 때 1,000원 단위로 내림된다', async () => {
  render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
  const input = screen.getByLabelText(/추가 펀딩 금액/) as HTMLInputElement;
  await typeInto(input, '5500');
  expect(input.value).toBe('5500');
  await userEvent.tab();
  expect(input.value).toBe('5000');
});

it('추가 펀딩 금액을 비우면 0으로 폴백된다', async () => {
  render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
  const input = screen.getByLabelText(/추가 펀딩 금액/) as HTMLInputElement;
  await userEvent.clear(input);
  expect(input.value).toBe('');
  await userEvent.tab();
  expect(input.value).toBe('0');
});

/**
 * 리워드는 **하나만 고른다**(2026-10-04, 되돌림). 라디오로 바꾸면 그 리워드로 바뀌고, 수량은
 * 입력 칸으로 조절한다. 2026-09-28~10-04 사이 "담는" 방식을 썼는데, 그 기간 실제 결제
 * 완료 12건이 전부 리워드 1개였다 — 담기·빼기 UI가 거의 안 쓰이는 경우를 위한 것이었다.
 */
describe('리워드 선택', () => {
  const fillBacker = async () => {
    await userEvent.type(screen.getByLabelText(/^이름\*$/), '김후원');
    await userEvent.type(screen.getByLabelText(/^연락처\*$/), '010-1111-2222');
    await userEvent.type(screen.getByLabelText(/^이메일\*$/), 'a@b.com');
  };

  it('넘겨받은 리워드가 고른 채로 시작하고, 다른 리워드를 고르면 바뀐다', async () => {
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    expect(screen.getByRole('radio', { name: /감사 메일/ })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: /CD/ }));
    expect(screen.getByRole('radio', { name: /CD/ })).toBeChecked();
    // 합계는 바뀐 리워드 하나다(배송비 줄은 없다 — 리워드가가 최종가).
    expect(screen.getByText('CD × 1')).toBeInTheDocument();
  });

  it('제출하면 고른 리워드 하나만 items로 나간다', async () => {
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    await userEvent.click(screen.getByRole('radio', { name: /CD/ }));
    await fillBacker();
    // CD는 배송 리워드라 배송지가 필요하다. 받는 분은 후원자 본인이 기본이다.
    await searchAddress('서울');
    await userEvent.click(screen.getByRole('button', { name: /결제하기/ }));
    await waitFor(() => expect(requestPayment).toHaveBeenCalled());
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.items).toEqual([{ rewardId: 'cd', quantity: 1 }]);
    expect(body.rewardId).toBeUndefined();
    expect(body.shipping).toMatchObject({ name: '김후원', address1: '서울' });
    expect(requestPayment.mock.calls.at(-1)[0].orderName).toBe('[펀딩] 데모 · CD');
  });

  it('배송 리워드를 고르면 배송지를 묻는다', async () => {
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    expect(screen.queryByLabelText(/^주소\*$/)).toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: /CD/ }));
    expect(screen.getByLabelText(/^주소\*$/)).toBeInTheDocument();
  });

  it('남은 수량까지만 늘릴 수 있다', async () => {
    render(<PledgeWizard project={project} initialRewardId="cd" remaining={{ cd: 2, mail: null }} />);
    const qty = screen.getByLabelText(/^수량/) as HTMLInputElement;
    await typeInto(qty, '5');
    await userEvent.tab();
    expect(qty.value).toBe('2');
  });

  it(`무제한 리워드도 한 주문에 ${MAX_QUANTITY}개까지다`, async () => {
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    const qty = screen.getByLabelText(/^수량/) as HTMLInputElement;
    await typeInto(qty, String(MAX_QUANTITY + 5));
    await userEvent.tab();
    expect(qty.value).toBe(String(MAX_QUANTITY));
  });

  it('품절 리워드는 고를 수 없다', () => {
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 0, mail: null }} />);
    expect(screen.getByRole('radio', { name: /CD/ })).toBeDisabled();
  });
});

/**
 * 모달에서 카드를 눌러 들어오면(`lockedReward`) 그 리워드로 시작하지만, 완전히 숨기지는
 * 않는다 — "다른 리워드 보기"로 접어 두고 펼치면 라디오로 바꿀 수 있다(2026-10-04). 고르면
 * **바뀐다**(여러 개를 더하는 것이 아니다 — 위 '리워드 선택' 블록과 같은 단일 선택 규칙).
 */
describe('리워드 잠금(모달)과 다른 리워드 보기', () => {
  it('잠겨 있으면 라디오 목록 대신 고른 리워드 요약과 "다른 리워드 보기"가 보인다', () => {
    render(<PledgeWizard project={project} initialRewardId="cd" lockedReward remaining={{ cd: 5, mail: null }} />);
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByText('고르신 리워드')).toBeInTheDocument();
    expect(screen.getByText('CD')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다른 리워드 보기 (1)' })).toBeInTheDocument();
  });

  it('펼치면 라디오 목록이 보이고, 고르면 그 리워드로 바뀐다', async () => {
    render(<PledgeWizard project={project} initialRewardId="cd" lockedReward remaining={{ cd: 5, mail: null }} />);
    await userEvent.click(screen.getByRole('button', { name: '다른 리워드 보기 (1)' }));
    expect(screen.getByRole('radio', { name: /CD/ })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: /감사 메일/ }));
    expect(screen.getByRole('radio', { name: /감사 메일/ })).toBeChecked();
    expect(screen.getByText('감사 메일 × 1')).toBeInTheDocument();
  });

  it('접으면 다시 요약으로 돌아간다', async () => {
    render(<PledgeWizard project={project} initialRewardId="cd" lockedReward remaining={{ cd: 5, mail: null }} />);
    await userEvent.click(screen.getByRole('button', { name: '다른 리워드 보기 (1)' }));
    await userEvent.click(screen.getByRole('button', { name: '접기' }));
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByText('고르신 리워드')).toBeInTheDocument();
  });

  it('리워드가 하나뿐이면 "다른 리워드 보기"를 보이지 않는다', () => {
    const single = parseFundingProject(`---
slug: solo
title: 데모
summary: s
cover: /c.webp
goalAmount: 1000
startAt: 2026-01-01T00:00:00+09:00
endAt: 2036-01-01T00:00:00+09:00
rewards:
  - id: only
    title: 유일한 리워드
    description: d
    amount: 10000
    requiresShipping: false
    estimatedDelivery: 2026-11
---
`, 'solo');
    render(<PledgeWizard project={single} initialRewardId="only" lockedReward remaining={{ only: 5 }} />);
    expect(screen.queryByRole('button', { name: /다른 리워드 보기/ })).toBeNull();
  });

  it('잠겨 있지 않으면 토글이 없고 항상 전체 목록이 보인다', () => {
    render(<PledgeWizard project={project} initialRewardId="cd" remaining={{ cd: 5, mail: null }} />);
    expect(screen.queryByRole('button', { name: /다른 리워드 보기/ })).toBeNull();
    expect(screen.getAllByRole('radio').length).toBe(2);
  });
});

it('제출하면 결제수단이 toss로 나간다', async () => {
  render(<PledgeWizard project={project} initialRewardId="cd" remaining={{ cd: 5, mail: null }} />);
  await userEvent.type(screen.getByLabelText(/^이름\*$/), '김후원');
  await userEvent.type(screen.getByLabelText(/^연락처\*$/), '010-1111-2222');
  await userEvent.type(screen.getByLabelText(/^이메일\*$/), 'a@b.com');
  await searchAddress();
  await userEvent.click(screen.getByRole('button', { name: /결제하기/ }));
  await waitFor(() => expect(requestPayment).toHaveBeenCalled());
  const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
  expect(body.paymentMethod).toBe('toss');
});

// 체크박스가 사라져도 서버로는 계속 동의를 보내야 한다 — 결제하기를 누르는 행위가 곧
// 동의이므로, 이 값이 조용히 빠지면 서버 검증(termsAgreed)과 terms_version 기록이 깨진다.
it('결제하기를 누르면 서버로 termsAgreed: true가 나간다', async () => {
  render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
  await userEvent.type(screen.getByLabelText(/^이름\*$/), '김후원');
  await userEvent.type(screen.getByLabelText(/^연락처\*$/), '010-1111-2222');
  await userEvent.type(screen.getByLabelText(/^이메일\*$/), 'a@b.com');
  await userEvent.click(screen.getByRole('button', { name: /결제하기/ }));
  await waitFor(() => expect(requestPayment).toHaveBeenCalled());
  const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
  expect(body.termsAgreed).toBe(true);
});

// 실명 공개는 옵트인이어야 한다 — 기본 체크는 후원자가 모르는 사이에 이름이 명단에 올라간다.
it('후원자 명단 이름 공개는 기본 해제', () => {
  render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
  expect(screen.getByLabelText(/후원자 명단에 이름 표시/)).not.toBeChecked();
});

/**
 * 메시지는 이름과 따로 간다(2026-09-28) — 이름을 표시하지 않으면 "익명"으로 올라간다고
 * 칸 바로 아래에서 알린다. 이름 표시 체크는 여전히 미리 켜지 않는다.
 */
describe('후원자 명단', () => {
  const renderWizard = () => render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);

  it('메시지가 익명으로 올라간다고 알리고, 메시지를 써도 이름 표시는 저절로 켜지지 않는다', async () => {
    renderWizard();
    expect(screen.getByText(/이름을 표시하지 않으면 .익명.으로 보입니다/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('응원 메시지'), '응원합니다');
    expect(screen.getByLabelText(/후원자 명단에 이름 표시/)).not.toBeChecked();
  });

  it('공개하면 표시 이름을 고를 수 있고, 미리보기가 명단에 뜰 모습을 보여 준다', async () => {
    renderWizard();
    await userEvent.type(screen.getByLabelText(/^이름\*$/), '홍길동');
    await userEvent.type(screen.getByLabelText('응원 메시지'), '끝까지 함께');
    await userEvent.click(screen.getByLabelText(/후원자 명단에 이름 표시/));
    expect(screen.getByLabelText(/실명 \(홍길동\)/)).toBeChecked();
    await userEvent.click(screen.getByLabelText(/가린 이름 \(홍\*동\)/));
    expect(screen.getByText(/이렇게 보입니다/).parentElement).toHaveTextContent('홍*동 “끝까지 함께”');
  });

  it('고른 방식과 닉네임이 서버로 나간다', async () => {
    renderWizard();
    await userEvent.type(screen.getByLabelText(/^이름\*$/), '홍길동');
    await userEvent.type(screen.getByLabelText(/^연락처\*$/), '010-1111-2222');
    await userEvent.type(screen.getByLabelText(/^이메일\*$/), 'a@b.com');
    await userEvent.click(screen.getByLabelText(/후원자 명단에 이름 표시/));
    await userEvent.click(screen.getByLabelText('닉네임'));
    await userEvent.type(screen.getByLabelText('명단에 표시할 닉네임'), '연대하는 청취자');
    await userEvent.click(screen.getByRole('button', { name: /결제하기/ }));
    await waitFor(() => expect(requestPayment).toHaveBeenCalled());
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body).toMatchObject({ displayNamePublic: true, publicNameStyle: 'nickname', publicNickname: '연대하는 청취자' });
  });
});

// 상한 없이 두면 5,000,000원을 넘긴 값이 그대로 서버로 가서 400으로 튕긴다 —
// 입력 단계에서 잘라내야 후원자가 이유 없이 실패를 본다는 느낌을 받지 않는다.
it('추가 펀딩 금액은 blur에서 MAX_ADDITIONAL_AMOUNT로 클램프된다', async () => {
  render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
  const input = screen.getByLabelText(/추가 펀딩 금액/) as HTMLInputElement;
  await typeInto(input, '99999999');
  await userEvent.tab();
  expect(Number(input.value)).toBe(MAX_ADDITIONAL_AMOUNT);
});

// blur 없이 Enter로 바로 제출해도 서버에는 정규화된 값이 나가야 한다(서버 검증과 같은 규칙).
/**
 * 숫자 칸에서 Enter로 곧바로 제출하는 경로. blur가 없어 **정규화 전 중간값이 화면에 남아
 * 있는 상태**여야 의미가 있으므로, 다른 필드를 모두 채운 **뒤** 숫자 칸에서 Enter로 끝낸다.
 * (순서를 바꿔 숫자 칸을 먼저 채우면 다음 `userEvent.type`이 포커스를 옮기며 blur를
 * 일으켜 이미 정규화돼 버린다 — 그러면 파생값 덕분에 submit의 setText 두 줄을 지워도
 * 통과하는 무의미한 테스트가 된다.)
 *
 * 브라우저에서 이 Enter는 `handleNumericEnter`가 가로챈다. 그대로 두면 제약 검증
 * (step 1,000 · max 10)이 `5500`·`12`에 말풍선을 띄워 제출을 막는다.
 */
it('추가 펀딩 칸에서 Enter로 바로 제출해도 서버에는 정규화된 추가금이 나간다', async () => {
  render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
  await userEvent.type(screen.getByLabelText(/^이름\*$/), '김후원');
  await userEvent.type(screen.getByLabelText(/^연락처\*$/), '010-1111-2222');
  await userEvent.type(screen.getByLabelText(/^이메일\*$/), 'a@b.com');
  await userEvent.type(screen.getByLabelText(/추가 펀딩 금액/), '{selectall}5500{Enter}');
  await waitFor(() => expect(requestPayment).toHaveBeenCalled());
  const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
  expect(body.items).toEqual([{ rewardId: 'mail', quantity: 1 }]);
  expect(body.additionalAmount).toBe(5000);
});

// 제출이 실패해 폼이 그대로 남는 경우로 submit()의 "제출 직전 확정"을 본다 — 성공 경로는
// 곧바로 결제 단계로 넘어가 입력 칸이 사라져서 확인할 자리가 없다.
it('Enter 제출 뒤 입력 칸에는 실제로 청구될 정규화 값이 남는다', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: false, status: 400, headers: { get: () => 'application/json' },
    json: async () => ({ ok: false, message: '펀딩 신청에 실패했습니다.' }),
  });
  render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
  await userEvent.type(screen.getByLabelText(/^이름\*$/), '김후원');
  await userEvent.type(screen.getByLabelText(/^연락처\*$/), '010-1111-2222');
  await userEvent.type(screen.getByLabelText(/^이메일\*$/), 'a@b.com');
  const additionalInput = screen.getByLabelText(/추가 펀딩 금액/) as HTMLInputElement;
  await userEvent.type(additionalInput, '{selectall}5500{Enter}');
  expect(await screen.findByRole('alert')).toHaveTextContent('펀딩 신청에 실패했습니다.');
  expect(additionalInput).toHaveValue(5000);
});

/**
 * 품절 리워드 초기 선택 회귀 — 첫 리워드가 품절이면 disabled 라디오가 선택된 채로 시작해서,
 * 후원자는 폼을 전부 채우고 제출한 **뒤에야** 409를 봤다.
 */
// 하단 바·히어로의 "펀딩하기"는 리워드 없이 결제 화면을 연다 — 고를 수 있는 첫 리워드가
// 기본으로 고른 채로 시작한다.
it('넘겨받은 리워드가 없으면 고를 수 있는 첫 리워드가 기본으로 고른 채로 시작한다', () => {
  render(<PledgeWizard project={project} initialRewardId={null} remaining={{ cd: 0, mail: null }} />);
  expect(screen.getByRole('radio', { name: /감사 메일/ })).toBeChecked();
  expect(screen.getByRole('radio', { name: /CD/ })).toBeDisabled();
});

it('넘겨받은 리워드가 품절이면 고를 수 있는 다른 리워드로 시작한다 — 비활성 라디오가 선택된 채로 시작하지 않는다', () => {
  render(<PledgeWizard project={project} initialRewardId="cd" remaining={{ cd: 0, mail: null }} />);
  expect(screen.getByRole('radio', { name: /감사 메일/ })).toBeChecked();
  expect(screen.getByRole('radio', { name: /CD/ })).toBeDisabled();
});

it('전 리워드 품절이면 제출을 막고 이유를 밝힌다', async () => {
  const { container } = render(<PledgeWizard project={project} initialRewardId={null} remaining={{ cd: 0, mail: 0 }} />);
  const submit = container.querySelector('button[type=submit]') as HTMLButtonElement;
  expect(submit).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('모든 리워드가 품절되었습니다');
  // 폼 자체를 제출해도(Enter 등) 서버를 부르지 않는다.
  fireEvent.submit(submit.closest('form')!);
  await act(async () => { await Promise.resolve(); });
  expect(global.fetch).not.toHaveBeenCalled();
});

/**
 * 자기 홀드 해제의 **소유 증명**(직전 자기 주문번호)이 살아남는지.
 *
 * React state만 쓰면 가장 흔한 동선에서 증명이 항상 사라진다 — 결제 위젯은 토스로 **전체
 * 이동**하므로, 실패·뒤로가기로 돌아오면 페이지가 새로 뜨고 state가 초기화된다. 그러면
 * 본인 홀드가 15분간 한정 재고를 붙들고 본인이 "품절"을 본다.
 */
// 만료 주문이 "결제창까지는 갔는가"를 가르는 근거 — 결제창을 열기 직전에 비콘을 보낸다.
it('결제창을 열기 전에 결제창 열기 비콘을 보낸다', async () => {
  render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
  await userEvent.type(screen.getByLabelText(/^이름\*$/), '김후원');
  await userEvent.type(screen.getByLabelText(/^연락처\*$/), '010-1111-2222');
  await userEvent.type(screen.getByLabelText(/^이메일\*$/), 'a@b.com');
  await userEvent.click(screen.getByRole('button', { name: /결제하기/ }));
  await waitFor(() => expect(requestPayment).toHaveBeenCalled());
  const calls = (global.fetch as jest.Mock).mock.calls.map((c) => String(c[0]));
  expect(calls).toEqual(['/api/funding/pledges', '/api/payments/opened']);
  const beacon = (global.fetch as jest.Mock).mock.calls[1];
  expect(JSON.parse(beacon[1].body)).toEqual({ orderNo: 'FND-1' });
});

/**
 * 결제창은 토스로 전체 이동했다가 돌아온다. 실패·취소 뒤 다시 들어오면 고른 리워드가 사라져
 * 기본값으로 되돌아갔다 — 결제를 시도한 선택을 되살린다(지금 재고로 다시 자름).
 */
describe('결제를 시도한 선택 되살리기', () => {
  const KEY = 'funding:lastSelection:demo';
  const save = (rewardId: string, quantity: number, at = Date.now()) =>
    window.sessionStorage.setItem(KEY, JSON.stringify({ at, rewardId, quantity }));

  it('제출하면 고른 것을 기억한다', async () => {
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    await userEvent.type(screen.getByLabelText(/^이름\*$/), '김후원');
    await userEvent.type(screen.getByLabelText(/^연락처\*$/), '010-1111-2222');
    await userEvent.type(screen.getByLabelText(/^이메일\*$/), 'a@b.com');
    await userEvent.click(screen.getByRole('button', { name: /결제하기/ }));
    await waitFor(() => expect(requestPayment).toHaveBeenCalled());
    expect(JSON.parse(window.sessionStorage.getItem(KEY)!)).toMatchObject({ rewardId: 'mail', quantity: 1 });
  });

  it('다시 들어오면 되살리되, 지금 남은 수량으로 자른다', async () => {
    save('cd', 4);
    render(<PledgeWizard project={project} initialRewardId={null} remaining={{ cd: 3, mail: null }} />);
    expect(await screen.findByText('지난번 결제를 시도할 때 고른 리워드를 다시 담아 두었습니다.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /CD/ })).toBeChecked();
    expect(screen.getByLabelText(/^수량/)).toHaveValue(3);
  });

  it('그 사이 품절된 리워드는 되살리지 않는다', async () => {
    save('cd', 1);
    render(<PledgeWizard project={project} initialRewardId={null} remaining={{ cd: 0, mail: null }} />);
    await act(async () => {});
    expect(screen.getByRole('radio', { name: /감사 메일/ })).toBeChecked();
  });

  it('리워드가 잠겨 있으면(카드로 눌러 들어온 경우) 되살리지 않는다 — 그 카드가 곧 새 선택이다', async () => {
    save('mail', 2);
    render(<PledgeWizard project={project} initialRewardId="cd" lockedReward remaining={{ cd: 5, mail: null }} />);
    await act(async () => {});
    expect(screen.getByText('CD')).toBeInTheDocument();
    expect(screen.queryByText('감사 메일')).toBeNull();
  });

  it('30분이 지난 기록은 쓰지 않는다', async () => {
    save('cd', 2, Date.now() - 31 * 60 * 1000);
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    await act(async () => {});
    expect(screen.getByRole('radio', { name: /감사 메일/ })).toBeChecked();
  });
});

// 폼을 열어 둔 사이 한정 리워드가 팔려 나가면 수량을 지금 남은 만큼으로 자르거나, 고른
// 것 자체가 품절되면 고를 수 있는 다른 리워드로 옮기고 무엇을 바꿨는지 알린다.
describe('폼을 여는 동안 재고가 줄면', () => {
  it('남은 수량으로 줄인다', async () => {
    const { rerender } = render(<PledgeWizard project={project} initialRewardId="cd" remaining={{ cd: 5, mail: null }} />);
    const qty = screen.getByLabelText(/^수량/) as HTMLInputElement;
    await typeInto(qty, '3');
    await userEvent.tab();
    expect(qty.value).toBe('3');

    rerender(<PledgeWizard project={project} initialRewardId="cd" remaining={{ cd: 1, mail: null }} />);
    expect(await screen.findByText('남은 수량이 바뀌어 1개로 조정했습니다.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^수량/)).toHaveValue(1);
  });

  it('고른 리워드가 품절되면 다른 리워드로 옮긴다', async () => {
    const { rerender } = render(<PledgeWizard project={project} initialRewardId="cd" remaining={{ cd: 5, mail: null }} />);
    rerender(<PledgeWizard project={project} initialRewardId="cd" remaining={{ cd: 0, mail: null }} />);
    expect(await screen.findByText('CD이 품절되어 다른 리워드로 옮겼습니다.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /감사 메일/ })).toBeChecked();
  });
});

describe('자기 홀드 해제 증명 보관', () => {
  // clear 후 입력 — "페이지가 새로 떠도" 테스트는 같은 테스트 안에서 두 번째로 마운트한
  // 인스턴스가 첫 제출의 임시 저장(lib/formDraft.ts)을 그대로 복원해 온다. 지우지 않고
  // type만 하면 값이 뒤에 이어붙어(예: 이메일이 `a@b.coma@b.com`) 브라우저 native
  // 제약 검증(type=email)에 걸려 제출 자체가 안 된다.
  const submitOnce = async () => {
    const name = screen.getByLabelText(/^이름\*$/);
    await userEvent.clear(name);
    await userEvent.type(name, '김후원');
    const phone = screen.getByLabelText(/^연락처\*$/);
    await userEvent.clear(phone);
    await userEvent.type(phone, '010-1111-2222');
    const email = screen.getByLabelText(/^이메일\*$/);
    await userEvent.clear(email);
    await userEvent.type(email, 'a@b.com');
    await userEvent.click(screen.getByRole('button', { name: /결제하기/ }));
    await waitFor(() => expect(requestPayment).toHaveBeenCalled());
  };

  // 마지막 **후원 생성** 요청의 본문. 결제창 열기 비콘(/api/payments/opened)도 fetch라
  // 단순히 마지막 호출을 보면 그 비콘을 읽는다.
  const lastBody = () => JSON.parse(
    (global.fetch as jest.Mock).mock.calls.filter((c) => String(c[0]).includes('/api/funding/pledges')).at(-1)![1].body,
  );

  beforeEach(() => window.sessionStorage.clear());

  it('첫 제출에는 증명이 없고, 받은 주문번호를 보관한다', async () => {
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    await submitOnce();
    expect(lastBody().previousOrderNo).toBeUndefined();
    expect(window.sessionStorage.getItem('funding:lastOrderNo:demo')).toBe('FND-1');
  });

  // 토스 전체 이동에서 돌아온 동선 — 컴포넌트가 완전히 새로 마운트된다.
  it('페이지가 새로 떠도 보관된 증명을 다시 싣는다', async () => {
    const { unmount } = render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    await submitOnce();
    unmount();

    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    await submitOnce();
    expect(lastBody().previousOrderNo).toBe('FND-1');
  });

  // 자기 홀드 해제 UPDATE는 프로젝트별로 걸린다 — 다른 프로젝트 주문번호는 쓸모가 없다.
  it('증명은 프로젝트(slug)별로 나뉜다', async () => {
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    await submitOnce();
    const other = { ...project, slug: 'other' };
    render(<PledgeWizard project={other} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    expect(window.sessionStorage.getItem('funding:lastOrderNo:other')).toBeNull();
  });

  // 사생활 보호 모드 등에서는 접근 자체가 throw한다 — 결제가 막히면 안 된다.
  it('저장소 접근이 막혀도 제출은 진행된다', async () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    await submitOnce();
    expect(requestPayment).toHaveBeenCalled();
  });
});

/**
 * 임시 저장(lib/formDraft.ts) — 리워드 모달 백드롭을 잘못 눌러 `RewardModal`이
 * `if (!reward) return null`로 PledgeWizard를 통째로 언마운트해도, 새로고침·뒤로가기와
 * 같은 방식으로 다시 채워져야 한다.
 */
describe('임시 저장', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('입력 후 언마운트했다가 다시 마운트하면 10칸이 복원된다', async () => {
    const { unmount } = render(<PledgeWizard project={project} initialRewardId="cd" remaining={{ cd: 5, mail: null }} />);
    await userEvent.type(screen.getByLabelText(/^이름\*$/), '김후원');
    await userEvent.type(screen.getByLabelText(/^연락처\*$/), '010-1111-2222');
    await userEvent.type(screen.getByLabelText(/^이메일\*$/), 'a@b.com');
    await userEvent.type(screen.getByLabelText(/^응원 메시지$/), '화이팅');
    // 다른 분이 받는 경우라야 받는 분 두 칸이 저장된다 — 복원하면 체크도 다시 켜진다.
    await userEvent.click(screen.getByLabelText('후원자가 아닌 다른 분이 받습니다'));
    await userEvent.type(screen.getByLabelText(/^받는 분\*$/), '박수령');
    await userEvent.type(screen.getByLabelText(/^받는 분 연락처\*$/), '010-3333-4444');
    await searchAddress();
    await userEvent.type(screen.getByLabelText(/상세주소/), '101호');
    await userEvent.type(screen.getByLabelText(/배송 메모/), '문 앞');
    unmount();

    render(<PledgeWizard project={project} initialRewardId="cd" remaining={{ cd: 5, mail: null }} />);
    expect(await screen.findByLabelText(/^이름\*$/)).toHaveValue('김후원');
    expect(screen.getByLabelText(/^연락처\*$/)).toHaveValue('010-1111-2222');
    expect(screen.getByLabelText(/^이메일\*$/)).toHaveValue('a@b.com');
    expect(screen.getByLabelText(/^응원 메시지$/)).toHaveValue('화이팅');
    expect(screen.getByLabelText(/^받는 분\*$/)).toHaveValue('박수령');
    expect(screen.getByLabelText(/^받는 분 연락처\*$/)).toHaveValue('010-3333-4444');
    expect(screen.getByLabelText(/^우편번호\*$/)).toHaveValue('12345');
    expect(screen.getByLabelText(/^주소\*$/)).toHaveValue('서울시 어딘가');
    expect(screen.getByLabelText(/상세주소/)).toHaveValue('101호');
    expect(screen.getByLabelText(/배송 메모/)).toHaveValue('문 앞');
  });

  // 동의는 이제 체크박스가 아니라 결제하기를 누르는 행위다 — 되살릴 체크 자체가 없다.
  // 대신 임시 저장이 담는 값이 여전히 DRAFT_FIELDS 10칸뿐인지, 동의 관련 값이 저장소에
  // 섞여 들어가지 않는지를 직접 확인한다(lib/formDraft.ts "지켜야 할 선").
  it('임시 저장에는 동의 관련 값이 들어가지 않는다', async () => {
    const { unmount } = render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    await userEvent.type(screen.getByLabelText(/^이름\*$/), '김후원');
    await userEvent.type(screen.getByLabelText(/^연락처\*$/), '010-1111-2222');
    await userEvent.type(screen.getByLabelText(/^이메일\*$/), 'a@b.com');
    unmount();

    const raw = window.sessionStorage.getItem('studionol:funding-draft:demo');
    expect(raw).not.toBeNull();
    const saved = JSON.parse(raw as string) as Record<string, unknown>;
    expect(Object.keys(saved).sort()).toEqual(['customerEmail', 'customerName', 'customerPhone']);
  });

  // 재고는 그 사이 바뀐다 — 되살린 리워드·수량·추가금이 지금도 유효하다고 보장할 수 없다.
  // 이름 공개는 체크 한 번이라 잃어도 손해가 없고, 문자열만 담는 계약을 깰 이유가 아니다.
  it('고른 리워드·수량·추가금·이름 공개는 복원되지 않는다', async () => {
    const { unmount } = render(<PledgeWizard project={project} initialRewardId="cd" remaining={{ cd: 5, mail: null }} />);
    await userEvent.click(screen.getByRole('radio', { name: /감사 메일/ }));
    const additionalInput = screen.getByLabelText(/추가 펀딩 금액/) as HTMLInputElement;
    await typeInto(additionalInput, '2000');
    await userEvent.tab();
    await userEvent.click(screen.getByLabelText(/후원자 명단에 이름 표시/));
    unmount();

    render(<PledgeWizard project={project} initialRewardId="cd" remaining={{ cd: 5, mail: null }} />);
    // initialRewardId 그대로의 처음 상태로 돌아온다(sessionStorage에 쓴 적이 없으므로).
    expect(screen.getByRole('radio', { name: /CD/ })).toBeChecked();
    expect(screen.getByLabelText(/^수량/)).toHaveValue(1);
    expect(screen.getByLabelText(/추가 펀딩 금액/)).toHaveValue(0);
    expect(screen.getByLabelText(/후원자 명단에 이름 표시/)).not.toBeChecked();
  });

  /**
   * 복원 effect보다 저장 effect가 먼저 "빈 폼"으로 실행되면 방금 읽은 초안을 지워 버린다
   * — `draftRestored` 게이트가 없으면 나는 함정이다. 컴포넌트 로직만으로는 재현하기
   * 어려우므로(React가 두 effect를 한 커밋에서 순서대로 돌린다는 사실 자체가 회귀 지점),
   * 여기서는 결과로 확인한다: 마운트 직후 세션에 남아 있던 초안이 사라지지 않아야 한다.
   */
  it('마운트 직후에도 저장소의 기존 초안이 지워지지 않는다', () => {
    window.sessionStorage.setItem('studionol:funding-draft:demo', JSON.stringify({ customerName: '홍길동' }));
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    expect(window.sessionStorage.getItem('studionol:funding-draft:demo')).toBe(JSON.stringify({ customerName: '홍길동' }));
  });

  // holdProofKey와 같은 이유 — 갈지 않으면 다른 펀딩의 이름·연락처·주소가 새어 들어온다.
  it('다른 프로젝트의 초안은 새지 않는다', async () => {
    const { unmount } = render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    await userEvent.type(screen.getByLabelText(/^이름\*$/), '김후원');
    unmount();

    const other = { ...project, slug: 'other' };
    render(<PledgeWizard project={other} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    expect(await screen.findByLabelText(/^이름\*$/)).toHaveValue('');
  });

  // 사생활 보호 모드 등에서는 접근 자체가 throw한다 — 임시 저장은 편의 기능이라 폼 자체가
  // 막히면 안 된다.
  it('저장소가 막힌 환경에서도 폼이 정상 동작한다', async () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    await userEvent.type(screen.getByLabelText(/^이름\*$/), '김후원');
    expect(screen.getByLabelText(/^이름\*$/)).toHaveValue('김후원');
  });
});

/**
 * 결제 버튼 바는 **어디서든 바닥에 고정**한다(2026-09-29 통일 규칙). 예전엔 모달에서만 끄는
 * 설정이 있어 같은 폼이 진입 경로에 따라 버튼 위치가 달랐다. 요약은 흐름 안의 카드로 두고
 * 바에는 약관 고지와 "금액 · 결제하기"만 둔다.
 */
describe('결제 버튼 바', () => {
  const remaining = { cd: 5, mail: null } as Record<string, number | null>;
  const bar = (container: HTMLElement) => (container.querySelector('button[type=submit]') as HTMLElement).parentElement!;

  it.each(['page', 'modal'] as const)('%s에서도 바닥에 고정되고, 금액과 동작을 함께 적는다', (layout) => {
    const { container } = render(<PledgeWizard project={project} initialRewardId="cd" remaining={remaining} layout={layout} />);
    expect(bar(container).className).toContain('sticky');
    // 모달은 본문 패딩만큼 끌어내려 바닥에 붙인다(sticky가 패딩 안쪽에 붙는다).
    expect(bar(container).className).toContain(layout === 'modal' ? '-bottom-5' : 'bottom-0');
    expect(container.querySelector('button[type=submit]')).toHaveTextContent('30,000원 · 결제하기');
  });

  it('약관 고지는 버튼과 같은 바 안에 있다 — 버튼만 떠서 고지를 못 보고 누르는 일이 없게', () => {
    const { container } = render(<PledgeWizard project={project} initialRewardId="cd" remaining={remaining} />);
    expect(bar(container)).toHaveTextContent('결제하기를 누르면');
  });

  it('요약은 바가 아니라 흐름 안의 카드다', () => {
    const { container } = render(<PledgeWizard project={project} initialRewardId="cd" remaining={remaining} />);
    expect(bar(container)).not.toHaveTextContent('예상 합계');
    expect(screen.getByRole('heading', { name: '결제 요약' })).toBeInTheDocument();
  });
});

/**
 * `<legend>`는 브라우저가 fieldset **테두리 위에** 얹어 그려서 패딩 박스를 빠져나간다.
 * 카드에 rounded와 패딩을 준 이 화면에서는 단계 제목이 카드 밖으로 떠 보였다.
 * div + aria-labelledby로 바꿨고, 되돌아가지 않게 고정한다.
 */
describe('단계 제목이 카드를 벗어나지 않는다', () => {
  const remaining = { cd: 5, mail: null } as Record<string, number | null>;

  it('legend를 쓰지 않는다', () => {
    const { container } = render(<PledgeWizard project={project} initialRewardId="cd" remaining={remaining} />);
    expect(container.querySelectorAll('legend').length).toBe(0);
  });

  it('fieldset의 접근성 이름이 유지된다', () => {
    const { container } = render(<PledgeWizard project={project} initialRewardId="cd" remaining={remaining} />);
    const sets = [...container.querySelectorAll('fieldset')];
    expect(sets.length).toBeGreaterThan(0);
    for (const fs of sets) {
      const id = fs.getAttribute('aria-labelledby');
      expect(id).toBeTruthy();
      expect(container.querySelector(`#${CSS.escape(id!)}`)).not.toBeNull();
    }
  });
});

/**
 * 수량·추가 후원금 칸에서 Enter를 연타하면(모바일 '완료' 연타·키 리피트 포함) 같은 tick에
 * submit()이 두 번 불린다. `submitting` 상태는 비동기라 두 번째를 못 막고, pending 주문이
 * 두 건 생긴다. 한정 리워드면 본인이 남은 재고를 잠근 채 한 건만 결제하게 된다.
 */
it('추가 펀딩 칸에서 Enter를 연타해도 주문은 한 번만 생성된다', async () => {
  const user = userEvent.setup();
  render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
  await user.type(screen.getByLabelText(/^이름\*$/), '김후원');
  await user.type(screen.getByLabelText(/^연락처\*$/), '010-1111-2222');
  await user.type(screen.getByLabelText(/^이메일\*$/), 'a@b.com');

  // **같은 tick에** 세 번 — userEvent.keyboard는 키 사이에 await가 들어가 상태가 갱신되므로
  // 이 버그(비동기 setState를 재진입 가드로 쓴 것)를 재현하지 못한다.
  const add = screen.getByLabelText(/추가 펀딩 금액/);
  await act(async () => {
    fireEvent.keyDown(add, { key: 'Enter' });
    fireEvent.keyDown(add, { key: 'Enter' });
    fireEvent.keyDown(add, { key: 'Enter' });
  });

  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  const pledgeCalls = (global.fetch as jest.Mock).mock.calls
    .filter((c) => String(c[0]).includes('/api/funding/pledges'));
  expect(pledgeCalls.length).toBe(1);
});

/**
 * 결제위젯을 **폼 안에** 두는 구조가 지키는 것들.
 *
 * 예전에는 제출하면 화면이 하나 더 떴다 — 위젯이 수단 목록을 보여 주고, 고른 뒤
 * 「결제하기」를 또 눌러야 했다. 위젯이 폼 안에 있으니 그 화면은 같은 것을 두 번 보여
 * 주는 자리였다.
 */
describe('폼 안의 결제위젯', () => {
  // requestPayment는 파일 전체가 공유하는 모의라 앞선 테스트의 호출이 쌓인다 —
  // "부르지 않았다"를 보려면 매번 비워야 한다.
  beforeEach(() => { requestPayment.mockClear(); });
  afterEach(() => { widgetReady = true; widgetError = null; widgetAgreed = true; });

  const fill = async () => {
    await userEvent.type(screen.getByLabelText(/^이름\*$/), '김후원');
    await userEvent.type(screen.getByLabelText(/^연락처\*$/), '010-1111-2222');
    await userEvent.type(screen.getByLabelText(/^이메일\*$/), 'a@b.com');
  };

  it('수단 목록과 약관 동의를 붙일 자리가 폼 안에 있다', () => {
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    expect(document.getElementById('toss-methods-test')).not.toBeNull();
    expect(document.getElementById('toss-agreement-test')).not.toBeNull();
  });

  /**
   * 위젯이 아직 안 떴는데 제출되면 **주문만 만들어지고 결제창은 안 열린다** — 후원자는
   * 아무 일도 안 일어난 줄 알고, 한정 리워드면 본인이 재고를 붙든 채 품절을 본다.
   */
  it('위젯이 준비되기 전에는 제출할 수 없다', () => {
    widgetReady = false;
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    expect(screen.getByRole('button', { name: /결제하기/ })).toBeDisabled();
  });

  it('위젯이 안 떴으면 추가 펀딩 칸의 Enter도 제출하지 않고 약관 문구도 띄우지 않는다', async () => {
    widgetReady = false;
    widgetAgreed = null;
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    await fill();
    await userEvent.type(screen.getByLabelText(/추가 펀딩 금액/), '{selectall}5000{Enter}');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    expect(requestPayment).not.toHaveBeenCalled();
  });

  it('위젯을 못 불러오면 이유와 다시 시도를 준다', async () => {
    widgetError = '결제 모듈을 불러오지 못했습니다.';
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('결제 모듈을 불러오지 못했습니다.');
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(retryPayment).toHaveBeenCalled();
  });

  it('성공·실패 주소와 주문 이름을 함께 넘긴다', async () => {
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: /결제하기/ }));
    await waitFor(() => expect(requestPayment).toHaveBeenCalled());
    const payload = requestPayment.mock.calls.at(-1)![0];
    expect(payload.successUrl).toContain('/ko/funding/success');
    expect(payload.failUrl).toContain('/ko/funding/fail?slug=demo');
    expect(payload.orderName).toContain('데모');
  });

  /**
   * 결제창을 닫은 것은 오류가 아니다. 빨간 경고를 띄우면 "결제가 실패했다"로 읽혀,
   * 실제로는 멀쩡한 주문을 두고 이탈한다.
   */
  it('결제창을 닫으면 오류를 띄우지 않고, 다시 누를 수 있다', async () => {
    requestPayment.mockRejectedValueOnce(Object.assign(new Error('취소'), { code: 'USER_CANCEL' }));
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: /결제하기/ }));
    await waitFor(() => expect(requestPayment).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: /결제하기/ })).not.toBeDisabled();
  });

  /**
   * 신용·체크카드를 고르고 카드사를 안 고른 채 누른 경우. 옛 문구("결제 수단과 약관 동의를
   * 확인해 주세요")로는 무엇을 하라는지 몰라 한 후원자가 30초에 네 번 다시 눌렀다(2026-09-29).
   */
  it('카드사를 안 고르고 누르면 카드사를 고르라고 알려 준다', async () => {
    requestPayment.mockRejectedValueOnce(Object.assign(new Error('카드'), { code: 'NEED_CARD_PAYMENT_DETAIL' }));
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: /결제하기/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('카드사를 먼저 골라 주세요');
    expect(screen.getByRole('button', { name: /결제하기/ })).not.toBeDisabled();
  });

  /**
   * 위젯 약관을 빼먹은 경우.
   *
   * 예전엔 그냥 보내고 `requestPayment`가 실패하게 두고 `code === 'NEED_AGREEMENT'`로
   * 사유를 가리려 했는데 **그 코드는 SDK에 없다**. 그래서 약관만 빼먹은 사람이 "결제를
   * 시작하지 못했습니다. 잠시 후 다시 시도해 주세요"를 봤고, 그 시점엔 한정 재고 홀드가
   * 잡힌 주문이 이미 만들어져 있었다. 지금은 제출 전에 막는다.
   */
  it('위젯 약관을 빼먹으면 주문을 만들지 않고 어느 약관인지 알려 준다', async () => {
    widgetAgreed = false;
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: /결제하기/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('결제 서비스 이용 약관');
    expect(requestPayment).not.toHaveBeenCalled();
    // 주문 생성 요청도 나가지 않는다 — 실패가 홀드를 남기지 않는다.
    expect(fetch).not.toHaveBeenCalled();
  });

  /**
   * 동의 상태를 **모를 때도** 막는다.
   *
   * 위젯은 체크를 한 번이라도 건드릴 때만 이벤트를 준다 — 한 번도 건드리지 않은 경로가
   * 정확히 `null`이고, 그게 약관을 빼먹는 가장 흔한 경우다. 여기를 열어 두면 가드가
   * 실사용에서 아무것도 막지 못한다(2026-09-16 프로덕션 실측으로 확인).
   */
  it('동의 상태를 모르면(위젯을 건드리지 않았으면) 주문을 만들지 않는다', async () => {
    widgetAgreed = null;
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: /결제하기/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('결제 서비스 이용 약관');
    expect(requestPayment).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  /** 체크하면 이벤트가 true로 오고, 그때는 막지 않는다. */
  it('위젯 약관에 동의했으면 정상 진행한다', async () => {
    widgetAgreed = true;
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: /결제하기/ }));

    await waitFor(() => expect(requestPayment).toHaveBeenCalled());
  });
});

/**
 * 약관 체크박스를 **찾을 수 있는가**.
 *
 * 예전에는 체크박스가 '후원자 정보' 안, 결제수단 위젯보다 위에 있었다. 미동의로 제출하면
 * 에러는 제출 버튼 옆에 뜨는데 체크박스는 위젯 하나를 건너뛴 위쪽이라, 모바일에서 화면
 * 몇 개를 거슬러 올라가야 찾을 수 있었다. 게다가 위젯이 그리는 **결제 약관 동의**가 에러
 * 바로 위에 보여서, "약관에 동의해 주세요"를 본 사람이 그쪽을 먼저 본다.
 *
 * 두 약관은 겹치지 않는다(위젯 쪽은 토스와 이용자 사이의 결제 서비스 약관, 이쪽은 우리와
 * 후원자 사이의 거래 약관·개인정보 수집 동의). 줄일 수 없으므로 자리와 문구로 구분한다.
 */
/**
 * 동의는 이제 체크박스가 아니라 **결제하기를 누르는 행위 자체**로 받는다
 * (2026-09-16, PledgeWizard.tsx 결제하기 버튼 위 고지 주석 참고). 여기서는 그 계약이
 * 실제로 화면에 그렇게 나와 있는지를 본다 — 우리 쪽 필수 체크박스가 없는 것, 고지 문구와
 * 약관·처리방침 링크가 버튼 앞에 있는 것.
 */
describe('약관 동의 찾기', () => {
  const renderForm = () =>
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);

  it('우리 쪽 동의 체크박스가 없다 — 화면의 체크박스는 이름 공개뿐이다', () => {
    renderForm();
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(1);
    expect(checkboxes[0]).toHaveAccessibleName(/후원자 명단에 이름 표시/);
    expect(screen.queryByLabelText(/약관/)).toBeNull();
  });

  it('결제하기 버튼 위에 동의 고지와 약관·처리방침 링크 두 개가 있다', () => {
    renderForm();
    expect(screen.getByText(/결제하기를 누르면/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '펀딩 약관(청약철회·환불)' })).toHaveAttribute('href', '/ko/funding/terms');
    expect(screen.getByRole('link', { name: '개인정보 처리방침' })).toHaveAttribute('href', '/ko/privacy-policy');
  });

  it('동의 고지는 결제하기 버튼보다 앞(문서 순서상 위)에 온다', () => {
    renderForm();
    const notice = screen.getByText(/결제하기를 누르면/);
    const button = screen.getByRole('button', { name: /결제하기/ });

    // DOCUMENT_POSITION_FOLLOWING(4) — button이 notice보다 문서 순서상 뒤.
    expect(notice.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

/**
 * 계좌로 직접 입금(2026-10-04 재도입). 위젯 위에서 고르고, 고르면 위젯을 숨기고 마지막 버튼 말이
 * "계좌 안내 받기"가 된다. 한정 수량 리워드는 서버와 같은 판정(bankTransferBlockReason)으로 막는다.
 */
describe('결제수단 — 계좌로 직접 입금', () => {
  const originalLocation = window.location;
  const fillBacker = async () => {
    await userEvent.type(screen.getByLabelText(/^이름\*$/), '김후원');
    await userEvent.type(screen.getByLabelText(/^연락처\*$/), '010-1111-2222');
    await userEvent.type(screen.getByLabelText(/^이메일\*$/), 'a@b.com');
  };
  beforeEach(() => {
    widgetReady = true; widgetError = null; widgetAgreed = true;
    requestPayment.mockClear();
    Object.defineProperty(window, 'location', { value: { ...originalLocation, assign: jest.fn() }, writable: true });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 201, headers: { get: () => 'application/json' },
      json: async () => ({ ok: true, orderNo: 'FND-B', paymentMethod: 'bank_transfer', manageUrl: '/ko/funding/manage/FND-B?token=t', totalAmount: 5000 }),
    }) as never;
  });
  afterEach(() => {
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
  });

  it('계좌를 고르면 위젯을 숨기고 버튼이 "계좌 안내 받기"가 된다', async () => {
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    expect(document.getElementById('toss-methods-test')).toBeVisible();
    expect(screen.getByRole('button', { name: '5,000원 · 결제하기' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /계좌로 직접 입금/ }));
    expect(document.getElementById('toss-methods-test')).not.toBeVisible();
    expect(screen.getByRole('button', { name: '5,000원 · 계좌 안내 받기' })).toBeInTheDocument();
    expect(screen.getByText(/계좌 안내 받기를 누르면/)).toBeInTheDocument();
    // 카드로 돌아오면 위젯이 그대로 다시 보인다(언마운트하지 않는다).
    await userEvent.click(screen.getByRole('radio', { name: /^카드·간편결제\(토스\)/ }));
    expect(document.getElementById('toss-methods-test')).toBeVisible();
  });

  it('제출하면 bank_transfer로 신청하고 결제창 없이 펀딩 확인 페이지로 옮긴다', async () => {
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    await userEvent.click(screen.getByRole('radio', { name: /계좌로 직접 입금/ }));
    await fillBacker();
    await userEvent.click(screen.getByRole('button', { name: /계좌 안내 받기/ }));
    await waitFor(() => expect(window.location.assign).toHaveBeenCalledWith('/ko/funding/manage/FND-B?token=t'));
    const sent = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(sent.paymentMethod).toBe('bank_transfer');
    expect(sent.items).toEqual([{ rewardId: 'mail', quantity: 1 }]);
    expect(requestPayment).not.toHaveBeenCalled();
  });

  it('위젯이 아직 안 떴거나 위젯 약관을 안 눌렀어도 계좌 입금은 낼 수 있다', async () => {
    widgetReady = false; widgetAgreed = null;
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    expect(screen.getByRole('button', { name: /결제하기/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('radio', { name: /계좌로 직접 입금/ }));
    expect(screen.getByRole('button', { name: /계좌 안내 받기/ })).toBeEnabled();
  });

  it('한정 수량 리워드면 계좌 입금을 막고 이유를 한 줄로 알린다', () => {
    render(<PledgeWizard project={project} initialRewardId="cd" remaining={{ cd: 5, mail: null }} />);
    expect(screen.getByRole('radio', { name: /계좌로 직접 입금/ })).toBeDisabled();
    expect(screen.getByText(/수량이 정해진 리워드는 카드·간편결제로만/)).toBeInTheDocument();
  });

  it('계좌를 고른 뒤 한정 리워드로 바꾸면 카드로 되돌린다', async () => {
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    await userEvent.click(screen.getByRole('radio', { name: /계좌로 직접 입금/ }));
    await userEvent.click(screen.getByRole('radio', { name: /CD/ }));
    expect(screen.getByRole('radio', { name: /^카드·간편결제\(토스\)/ })).toBeChecked();
    expect(screen.getByRole('button', { name: /결제하기/ })).toBeInTheDocument();
    expect(document.getElementById('toss-methods-test')).toBeVisible();
  });
});
