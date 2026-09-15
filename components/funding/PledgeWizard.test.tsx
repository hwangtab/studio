import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import PledgeWizard from './PledgeWizard';
import { parseFundingProject } from '../../lib/funding/projects';
import { trackMicroEvent } from '../../utils/analytics';
import { MAX_ADDITIONAL_AMOUNT, MAX_QUANTITY } from '../../lib/funding/policy';

/**
 * 토스 SDK는 폼 제출 뒤 **동적 import**로 불러 결제창으로 전체 이동한다. 테스트에서는
 * 그 호출 인자를 본다 — 무엇을 눌렀을 때 어느 결제창이 열리는지가 이 컴포넌트의 계약이다.
 */
const requestPayment = jest.fn().mockResolvedValue(undefined);
jest.mock('@tosspayments/tosspayments-sdk', () => ({
  ANONYMOUS: 'ANONYMOUS',
  loadTossPayments: jest.fn().mockResolvedValue({ payment: () => ({ requestPayment }) }),
}));
jest.mock('../../utils/analytics', () => ({ trackMicroEvent: jest.fn() }));

// 결제 클라이언트 키가 없으면 제출이 "결제 설정이 없습니다"에서 멈춘다(운영에서도 그렇다).
process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY = 'test_ck_dummy';

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

it('배송 리워드는 배송지 입력이 보인다', async () => {
  render(<PledgeWizard project={project} initialRewardId="cd" remaining={{ cd: 5, mail: null }} />);
  expect(screen.getByLabelText(/^받는 분\*$/)).toBeInTheDocument();
});
it('제출하면 곧바로 고른 결제수단의 결제창으로 간다 — 중간 화면이 없다', async () => {
  render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
  await userEvent.type(screen.getByLabelText(/^이름\*$/), '김후원');
  await userEvent.type(screen.getByLabelText(/^연락처\*$/), '010-1111-2222');
  await userEvent.type(screen.getByLabelText(/^이메일\*$/), 'a@b.com');
  await userEvent.click(screen.getByLabelText(/약관/));
  await userEvent.click(screen.getByRole('button', { name: /결제하기/ }));
  await waitFor(() => expect(requestPayment).toHaveBeenCalled());
  // 서버가 확정한 금액·주문번호로 연다. 화면이 하나 더 뜨지 않는다.
  expect(requestPayment).toHaveBeenCalledWith(expect.objectContaining({
    method: 'CARD', orderId: 'FND-1', amount: { currency: 'KRW', value: 30000 },
  }));
  expect(screen.queryByText(/결제 대기/)).toBeNull();
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

it('추가 후원금을 한 글자씩 타이핑할 수 있다 — 중간 글자에서 0으로 깎이지 않는다', async () => {
  render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
  const input = screen.getByLabelText(/추가 후원금/) as HTMLInputElement;
  await typeInto(input, '5000');
  expect(input.value).toBe('5000');
  await userEvent.tab();
  expect(input.value).toBe('5000');
});

it('추가 후원금은 blur 때 1,000원 단위로 내림된다', async () => {
  render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
  const input = screen.getByLabelText(/추가 후원금/) as HTMLInputElement;
  await typeInto(input, '5500');
  expect(input.value).toBe('5500');
  await userEvent.tab();
  expect(input.value).toBe('5000');
});

it('추가 후원금을 비우면 0으로 폴백된다', async () => {
  render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
  const input = screen.getByLabelText(/추가 후원금/) as HTMLInputElement;
  await userEvent.clear(input);
  expect(input.value).toBe('');
  await userEvent.tab();
  expect(input.value).toBe('0');
});

it('수량을 한 글자씩 타이핑해도 상한으로 튀지 않고, blur에서 클램프된다', async () => {
  render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
  const input = screen.getByLabelText('수량') as HTMLInputElement;
  await typeInto(input, '12');
  // 타이핑 중에는 손대지 않는다 — 예전엔 `1` 뒤의 `2`에서 곧바로 10으로 튀었다.
  expect(input.value).toBe('12');
  await userEvent.tab();
  expect(input.value).toBe('10');
});

it('수량을 비우면 1로 폴백된다', async () => {
  render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
  const input = screen.getByLabelText('수량') as HTMLInputElement;
  await userEvent.clear(input);
  expect(input.value).toBe('');
  await userEvent.tab();
  expect(input.value).toBe('1');
});

it('remaining보다 큰 수량을 입력하면 blur에서 remaining으로 클램프된다', async () => {
  render(<PledgeWizard project={project} initialRewardId="cd" remaining={{ cd: 3, mail: null }} />);
  const quantityInput = screen.getByLabelText('수량') as HTMLInputElement;
  await typeInto(quantityInput, '10');
  await userEvent.tab();
  expect(quantityInput.value).toBe('3');
});

it('선택된 리워드의 remaining이 0이어도(품절) 수량이 0이 아니라 1로 바닥 고정된다', async () => {
  render(<PledgeWizard project={project} initialRewardId="cd" remaining={{ cd: 0, mail: null }} />);
  const quantityInput = screen.getByLabelText('수량') as HTMLInputElement;
  await typeInto(quantityInput, '5');
  await userEvent.tab();
  expect(quantityInput.value).toBe('1');
});

it('리워드를 바꾸면 수량이 1로 리셋된다', async () => {
  render(<PledgeWizard project={project} initialRewardId="cd" remaining={{ cd: 5, mail: null }} />);
  const quantityInput = screen.getByLabelText('수량') as HTMLInputElement;
  await typeInto(quantityInput, '4');
  expect(quantityInput.value).toBe('4');
  await userEvent.click(screen.getByLabelText(/감사 메일/));
  expect((screen.getByLabelText('수량') as HTMLInputElement).value).toBe('1');
});

it('제출하면 결제수단이 toss로 나간다', async () => {
  render(<PledgeWizard project={project} initialRewardId="cd" remaining={{ cd: 5, mail: null }} />);
  await userEvent.type(screen.getByLabelText(/^이름\*$/), '김후원');
  await userEvent.type(screen.getByLabelText(/^연락처\*$/), '010-1111-2222');
  await userEvent.type(screen.getByLabelText(/^이메일\*$/), 'a@b.com');
  await userEvent.type(screen.getByLabelText(/^받는 분\*$/), '김후원');
  await userEvent.type(screen.getByLabelText(/^받는 분 연락처\*$/), '010-1111-2222');
  await userEvent.type(screen.getByLabelText(/^우편번호\*$/), '12345');
  await userEvent.type(screen.getByLabelText(/^주소\*$/), '서울시 어딘가');
  await userEvent.click(screen.getByLabelText(/약관/));
  await userEvent.click(screen.getByRole('button', { name: /결제하기/ }));
  await waitFor(() => expect(requestPayment).toHaveBeenCalled());
  const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
  expect(body.paymentMethod).toBe('toss');
});

// 실명 공개는 옵트인이어야 한다 — 기본 체크는 후원자가 모르는 사이에 이름이 명단에 올라간다.
it('후원자 명단 이름 공개는 기본 해제', () => {
  render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
  expect(screen.getByLabelText(/이름과 응원 메시지 공개/)).not.toBeChecked();
});

// 상한 없이 두면 5,000,000원을 넘긴 값이 그대로 서버로 가서 400으로 튕긴다 —
// 입력 단계에서 잘라내야 후원자가 이유 없이 실패를 본다는 느낌을 받지 않는다.
it('추가 후원금은 blur에서 MAX_ADDITIONAL_AMOUNT로 클램프된다', async () => {
  render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
  const input = screen.getByLabelText(/추가 후원금/) as HTMLInputElement;
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
it('숫자 칸에서 Enter로 바로 제출해도 서버에는 정규화된 수량·추가금이 나간다', async () => {
  render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
  await userEvent.type(screen.getByLabelText(/^이름\*$/), '김후원');
  await userEvent.type(screen.getByLabelText(/^연락처\*$/), '010-1111-2222');
  await userEvent.type(screen.getByLabelText(/^이메일\*$/), 'a@b.com');
  await userEvent.click(screen.getByLabelText(/약관/));
  await userEvent.type(screen.getByLabelText(/추가 후원금/), '{selectall}5500');
  const quantityInput = screen.getByLabelText('수량') as HTMLInputElement;
  await userEvent.type(quantityInput, '{selectall}12{Enter}');
  // 수량 칸은 blur 없이 Enter로 끝나 `12`가 그대로 남은 상태에서 제출됐다.
  await waitFor(() => expect(requestPayment).toHaveBeenCalled());
  const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
  expect(body.quantity).toBe(MAX_QUANTITY);
  expect(body.additionalAmount).toBe(5000);
});

// 제출이 실패해 폼이 그대로 남는 경우로 submit()의 "제출 직전 확정"을 본다 — 성공 경로는
// 곧바로 결제 단계로 넘어가 입력 칸이 사라져서 확인할 자리가 없다.
it('Enter 제출 뒤 입력 칸에는 실제로 청구될 정규화 값이 남는다', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: false, status: 400, headers: { get: () => 'application/json' },
    json: async () => ({ ok: false, message: '후원 신청에 실패했습니다.' }),
  });
  render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
  await userEvent.type(screen.getByLabelText(/^이름\*$/), '김후원');
  await userEvent.type(screen.getByLabelText(/^연락처\*$/), '010-1111-2222');
  await userEvent.type(screen.getByLabelText(/^이메일\*$/), 'a@b.com');
  await userEvent.click(screen.getByLabelText(/약관/));
  const additionalInput = screen.getByLabelText(/추가 후원금/) as HTMLInputElement;
  await userEvent.type(additionalInput, '{selectall}5500{Enter}');
  expect(await screen.findByRole('alert')).toHaveTextContent('후원 신청에 실패했습니다.');
  expect(additionalInput).toHaveValue(5000);
});

/**
 * 품절 리워드 초기 선택 회귀 — 첫 리워드가 품절이면 disabled 라디오가 선택된 채로 시작해서,
 * 후원자는 폼을 전부 채우고 제출한 **뒤에야** 409를 봤다.
 */
it('첫 리워드가 품절이면 고를 수 있는 리워드가 선택된 채로 시작한다', () => {
  render(<PledgeWizard project={project} initialRewardId={null} remaining={{ cd: 0, mail: null }} />);
  expect(screen.getByLabelText(/CD/)).toBeDisabled();
  expect(screen.getByLabelText(/CD/)).not.toBeChecked();
  expect(screen.getByLabelText(/감사 메일/)).toBeChecked();
  // 선택된 리워드가 하단 요약에도 그대로 반영된다(품절 카드가 아니라 고를 수 있는 쪽).
  expect(screen.getAllByText('감사 메일').length).toBeGreaterThan(0);
});

it('전 리워드 품절이면 제출을 막고 이유를 밝힌다', async () => {
  render(<PledgeWizard project={project} initialRewardId={null} remaining={{ cd: 0, mail: 0 }} />);
  const submit = screen.getByRole('button', { name: /결제하기/ });
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
    await userEvent.click(screen.getByLabelText(/약관/));
    await userEvent.click(screen.getByRole('button', { name: /결제하기/ }));
    await waitFor(() => expect(requestPayment).toHaveBeenCalled());
  };

  const lastBody = () => JSON.parse((global.fetch as jest.Mock).mock.calls.at(-1)![1].body);

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
    await userEvent.type(screen.getByLabelText(/^받는 분\*$/), '박수령');
    await userEvent.type(screen.getByLabelText(/^받는 분 연락처\*$/), '010-3333-4444');
    await userEvent.type(screen.getByLabelText(/^우편번호\*$/), '12345');
    await userEvent.type(screen.getByLabelText(/^주소\*$/), '서울시 어딘가');
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

  // 복원된 체크는 사람이 한 의사표시가 아니다 — funding_pledges.terms_version이 "그때 이
  // 내용에 동의했다"의 증거인데, 되살린 체크가 그 증거를 받치지 못한다.
  it('약관 동의는 복원되지 않는다', async () => {
    const { unmount } = render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    await userEvent.type(screen.getByLabelText(/^이름\*$/), '김후원');
    await userEvent.click(screen.getByLabelText(/약관/));
    unmount();

    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    expect(await screen.findByLabelText(/^이름\*$/)).toHaveValue('김후원');
    expect(screen.getByLabelText(/약관/)).not.toBeChecked();
  });

  // 재고는 그 사이 바뀐다 — 되살린 리워드·수량·추가금이 지금도 유효하다고 보장할 수 없다.
  // 이름 공개는 체크 한 번이라 잃어도 손해가 없고, 문자열만 담는 계약을 깰 이유가 아니다.
  it('리워드·수량·추가금·이름 공개는 복원되지 않는다', async () => {
    const { unmount } = render(<PledgeWizard project={project} initialRewardId="cd" remaining={{ cd: 5, mail: null }} />);
    await userEvent.click(screen.getByLabelText(/감사 메일/));
    const quantityInput = screen.getByLabelText('수량') as HTMLInputElement;
    await typeInto(quantityInput, '2');
    await userEvent.tab();
    const additionalInput = screen.getByLabelText(/추가 후원금/) as HTMLInputElement;
    await typeInto(additionalInput, '2000');
    await userEvent.tab();
    await userEvent.click(screen.getByLabelText(/이름과 응원 메시지 공개/));
    unmount();

    render(<PledgeWizard project={project} initialRewardId="cd" remaining={{ cd: 5, mail: null }} />);
    // initialRewardId가 그대로 다시 주어지므로 첫 리워드(cd)로 되돌아온다 — "감사 메일" 선택은 안 남는다.
    expect(await screen.findByLabelText(/CD/)).toBeChecked();
    expect(screen.getByLabelText('수량')).toHaveValue(1);
    expect(screen.getByLabelText(/추가 후원금/)).toHaveValue(0);
    expect(screen.getByLabelText(/이름과 응원 메시지 공개/)).not.toBeChecked();
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
 * 리워드 카드를 눌러 연 모달은 **이미 고르고 들어온** 화면이다. 거기서 네 개를 다시
 * 보여 주면 방금 고른 것이 반영됐는지 의심하게 된다. 그리고 모달 본문은 자체 스크롤
 * 컨테이너라, sticky 요약이 컨테이너 바닥에 붙으면서 폼 위로 떠 내용과 겹친다.
 * 둘 다 실제로 그렇게 배포됐다가 잡았다.
 */
describe('모달에서 여는 경우 (lockedReward · stickySummary)', () => {
  const remaining = { cd: 5, mail: null } as Record<string, number | null>;

  it('잠그면 리워드 라디오를 보여 주지 않는다', () => {
    render(<PledgeWizard project={project} initialRewardId="cd" remaining={remaining} lockedReward />);
    // 결제수단 라디오는 남아 있어야 한다 — 없어지는 것은 **리워드** 선택뿐이다.
    expect(document.querySelectorAll('input[name="reward"]')).toHaveLength(0);
    expect(document.querySelectorAll('input[name="paymentChoice"]').length).toBeGreaterThan(0);
    const picked = screen.getByText('고르신 리워드').parentElement!;
    expect(picked.textContent).toContain('30,000원');
    expect(picked.textContent).toContain('CD');
  });

  it('잠그지 않으면 종전대로 고를 수 있다', () => {
    render(<PledgeWizard project={project} initialRewardId="cd" remaining={remaining} />);
    expect(screen.getAllByRole('radio').length).toBeGreaterThan(1);
    expect(screen.queryByText('고르신 리워드')).toBeNull();
  });

  it('잠그면 후원자 정보가 1단계가 된다 — 빈 번호를 남기지 않는다', () => {
    const { container } = render(
      <PledgeWizard project={project} initialRewardId="cd" remaining={remaining} lockedReward />
    );
    expect(container.textContent).toContain('후원자 정보');
    expect(screen.queryByText('리워드', { selector: 'h2,h3' })).toBeNull();
  });

  it('stickySummary=false면 요약 줄이 sticky가 아니다', () => {
    const { container } = render(
      <PledgeWizard project={project} initialRewardId="cd" remaining={remaining} stickySummary={false} />
    );
    const summary = [...container.querySelectorAll('div')].find((d) => d.textContent?.includes('예상 합계'));
    expect(summary!.className).not.toContain('sticky');
  });

  it('기본값에서는 요약 줄이 sticky다 — 페이지에서는 붙는 게 맞다', () => {
    const { container } = render(<PledgeWizard project={project} initialRewardId="cd" remaining={remaining} />);
    const summary = [...container.querySelectorAll('div')].find((d) => d.className.includes('bottom-0'));
    expect(summary!.className).toContain('sticky');
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

  it('잠긴 모달에서도 제목과 fieldset이 어긋나지 않는다', () => {
    const { container } = render(
      <PledgeWizard project={project} initialRewardId="cd" remaining={remaining} lockedReward />
    );
    expect(container.querySelectorAll('legend').length).toBe(0);
    const labelled = [...container.querySelectorAll('fieldset[aria-labelledby]')];
    for (const fs of labelled) {
      expect(container.querySelector(`#${CSS.escape(fs.getAttribute('aria-labelledby')!)}`)).not.toBeNull();
    }
  });
});

/**
 * 수량·추가 후원금 칸에서 Enter를 연타하면(모바일 '완료' 연타·키 리피트 포함) 같은 tick에
 * submit()이 두 번 불린다. `submitting` 상태는 비동기라 두 번째를 못 막고, pending 주문이
 * 두 건 생긴다. 한정 리워드면 본인이 남은 재고를 잠근 채 한 건만 결제하게 된다.
 */
it('수량 칸에서 Enter를 연타해도 주문은 한 번만 생성된다', async () => {
  const user = userEvent.setup();
  render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
  await user.type(screen.getByLabelText(/^이름\*$/), '김후원');
  await user.type(screen.getByLabelText(/^연락처\*$/), '010-1111-2222');
  await user.type(screen.getByLabelText(/^이메일\*$/), 'a@b.com');
  await user.click(screen.getByLabelText(/약관/));

  // **같은 tick에** 세 번 — userEvent.keyboard는 키 사이에 await가 들어가 상태가 갱신되므로
  // 이 버그(비동기 setState를 재진입 가드로 쓴 것)를 재현하지 못한다.
  const qty = screen.getByLabelText(/^수량$/);
  await act(async () => {
    fireEvent.keyDown(qty, { key: 'Enter' });
    fireEvent.keyDown(qty, { key: 'Enter' });
    fireEvent.keyDown(qty, { key: 'Enter' });
  });

  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  const pledgeCalls = (global.fetch as jest.Mock).mock.calls
    .filter((c) => String(c[0]).includes('/api/funding/pledges'));
  expect(pledgeCalls.length).toBe(1);
});

/**
 * 고른 결제수단이 **그대로 결제창으로 이어지는지**.
 *
 * 예전에는 제출 뒤 토스 결제위젯이 수단 목록을 한 번 더 보여 주고, 거기서 고른 뒤
 * 「결제하기」를 또 눌러야 했다 — 같은 질문을 두 번 하는 화면이었다. 지금은 폼에서 고른
 * 것이 곧 열리는 창이므로, 그 대응이 어긋나면 후원자가 엉뚱한 결제창을 만난다.
 */
describe('결제수단 선택', () => {
  const submitWith = async (label: RegExp) => {
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    await userEvent.type(screen.getByLabelText(/^이름\*$/), '김후원');
    await userEvent.type(screen.getByLabelText(/^연락처\*$/), '010-1111-2222');
    await userEvent.type(screen.getByLabelText(/^이메일\*$/), 'a@b.com');
    await userEvent.click(screen.getByRole('radio', { name: label }));
    await userEvent.click(screen.getByLabelText(/약관/));
    await userEvent.click(screen.getByRole('button', { name: /결제하기/ }));
    await waitFor(() => expect(requestPayment).toHaveBeenCalled());
    return requestPayment.mock.calls.at(-1)![0];
  };

  it('기본값은 카드이고, 버튼이 무엇이 열릴지 말한다', () => {
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    expect(screen.getByRole('radio', { name: /신용·체크카드/ })).toBeChecked();
    expect(screen.getByRole('button', { name: '신용·체크카드로 결제하기' })).toBeInTheDocument();
  });

  it('계좌이체는 TRANSFER로 열고, 간편결제 옵션을 싣지 않는다', async () => {
    const payload = await submitWith(/실시간 계좌이체/);
    expect(payload.method).toBe('TRANSFER');
    expect(payload.card).toBeUndefined();
  });

  /**
   * 간편결제는 통합 결제창을 거치지 않고 그 브랜드 창으로 직행한다. `easyPay`는 **한국어
   * 이름**이어야 한다 — 영문 enum('KAKAOPAY')은 토스가 거부한다.
   */
  it('카카오페이는 카카오페이 창으로 직행한다', async () => {
    const payload = await submitWith(/카카오페이/);
    expect(payload.method).toBe('CARD');
    expect(payload.card).toEqual({ flowMode: 'DIRECT', easyPay: '카카오페이' });
  });

  it('카드는 통합 결제창이다 — 직행 옵션이 붙지 않는다', async () => {
    const payload = await submitWith(/신용·체크카드/);
    expect(payload.method).toBe('CARD');
    expect(payload.card).toBeUndefined();
  });

  it('성공·실패 주소와 주문 이름을 함께 넘긴다', async () => {
    const payload = await submitWith(/토스페이/);
    expect(payload.successUrl).toContain('/ko/funding/success');
    expect(payload.failUrl).toContain('/ko/funding/fail?slug=demo');
    expect(payload.orderName).toContain('데모');
  });

  /**
   * 후원자가 결제창을 닫은 것은 오류가 아니다. 빨간 경고를 띄우면 "결제가 실패했다"로
   * 읽혀, 실제로는 멀쩡한 주문을 두고 이탈한다.
   */
  it('결제창을 닫으면 오류를 띄우지 않는다', async () => {
    requestPayment.mockRejectedValueOnce(Object.assign(new Error('취소'), { code: 'USER_CANCEL' }));
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    await userEvent.type(screen.getByLabelText(/^이름\*$/), '김후원');
    await userEvent.type(screen.getByLabelText(/^연락처\*$/), '010-1111-2222');
    await userEvent.type(screen.getByLabelText(/^이메일\*$/), 'a@b.com');
    await userEvent.click(screen.getByLabelText(/약관/));
    await userEvent.click(screen.getByRole('button', { name: /결제하기/ }));
    await waitFor(() => expect(requestPayment).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
    // 다시 누를 수 있어야 한다 — 닫았다고 버튼이 잠기면 그 자리에서 끝난다.
    expect(screen.getByRole('button', { name: /결제하기/ })).not.toBeDisabled();
  });
});

/**
 * 애플페이는 **되는 기기에서만** 목록에 있어야 한다. 토스 애플페이는 PC=Safari, 모바일=iOS
 * 에서만 동작하고 그 환경에서만 `window.ApplePaySession`이 있다. 안드로이드·윈도우에서
 * 고르게 두면 결제창이 열리지 않아 후원자는 자기가 뭘 잘못한 줄 안다.
 */
describe('애플페이 노출 조건', () => {
  const setApplePay = (supported: boolean) => {
    if (supported) {
      (window as unknown as { ApplePaySession?: unknown }).ApplePaySession = { canMakePayments: () => true };
    } else {
      delete (window as unknown as { ApplePaySession?: unknown }).ApplePaySession;
    }
  };
  afterEach(() => setApplePay(false));

  it('지원하지 않는 기기에는 애플페이가 없다', () => {
    setApplePay(false);
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    expect(screen.queryByRole('radio', { name: /애플페이/ })).toBeNull();
    // 나머지 수단은 그대로 있다 — 애플페이 하나만 빠진다.
    expect(screen.getByRole('radio', { name: /네이버페이/ })).toBeInTheDocument();
  });

  it('지원하는 기기에는 애플페이가 뜬다', () => {
    setApplePay(true);
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    expect(screen.getByRole('radio', { name: /애플페이/ })).toBeInTheDocument();
  });

  it('네이버페이는 네이버페이 창으로 직행한다', async () => {
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
    await userEvent.type(screen.getByLabelText(/^이름\*$/), '김후원');
    await userEvent.type(screen.getByLabelText(/^연락처\*$/), '010-1111-2222');
    await userEvent.type(screen.getByLabelText(/^이메일\*$/), 'a@b.com');
    await userEvent.click(screen.getByRole('radio', { name: /네이버페이/ }));
    await userEvent.click(screen.getByLabelText(/약관/));
    await userEvent.click(screen.getByRole('button', { name: /결제하기/ }));
    await waitFor(() => expect(requestPayment).toHaveBeenCalled());
    expect(requestPayment.mock.calls.at(-1)![0].card).toEqual({ flowMode: 'DIRECT', easyPay: '네이버페이' });
  });
});
