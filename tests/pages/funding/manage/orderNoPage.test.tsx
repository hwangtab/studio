import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import FundingManagePage from '../../../../pages/[locale]/funding/manage/[orderNo]';

const baseProps = {
  orderNo: 'FND-1', token: 'tok', projectSlug: 'demo', projectTitle: '데모', rewardTitle: '감사 메일',
  quantity: 1, additionalAmount: 0, totalAmount: 30000, status: 'paid', fulfillmentStatus: 'none', shipping: null,
  canCancel: true, cancelBlockedReason: null, refundRequested: false, downloads: [], lookupFailed: false,
  displayNamePublic: false, canEditDisplayName: true,
  customerName: '홍길동', publicName: null, supporterMessage: null, listingHidden: false,
};

beforeEach(() => {
  window.confirm = jest.fn().mockReturnValue(true);
});

it('토스 결제 취소 성공 → 환불 금액 확인 문구', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true, headers: { get: () => 'application/json' },
    json: async () => ({ ok: true, mode: 'refunded', refundAmount: 30000 }),
  }) as never;
  render(<FundingManagePage {...baseProps} paymentMethod="toss" />);
  await userEvent.click(screen.getByRole('button', { name: /펀딩 취소/ }));
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('환불받을까요'));
  expect(await screen.findByText('취소되었습니다. 30,000원이 환불됩니다.')).toBeInTheDocument();
});

it('비JSON 응답이면 서버 오류 문구', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true, headers: { get: () => 'text/html' },
    json: async () => { throw new Error('should not be called'); },
  }) as never;
  render(<FundingManagePage {...baseProps} paymentMethod="toss" />);
  await userEvent.click(screen.getByRole('button', { name: /펀딩 취소/ }));
  expect(await screen.findByText('서버 오류가 발생했습니다.')).toBeInTheDocument();
});

// 이 페이지의 URL에는 관리 토큰이 실린다. 이탈 링크가 클라 전환이면 공개 페이지에 나갔다
// 뒤로가기 할 때 gtag가 토큰 붙은 URL로 page_view를 보낸다 — 링크 종류(next/link 아님)는
// tests/pages/privateLinkNavigation.test.ts가 소스로 단언하고, 여기서는 href를 확인한다.
it('프로젝트 링크는 href를 가진 앵커다', () => {
  render(<FundingManagePage {...baseProps} paymentMethod="toss" />);
  expect(screen.getByRole('link', { name: '데모' })).toHaveAttribute('href', '/ko/funding/demo');
});

// 부분환불 건은 상태 코드가 그대로 노출돼 고객이 'partially_refunded'를 읽고 있었다.
it('partially_refunded 상태는 한국어 라벨로 보인다', () => {
  render(<FundingManagePage {...baseProps} status="partially_refunded" canCancel={false} paymentMethod="toss" />);
  expect(screen.getByText('일부 환불')).toBeInTheDocument();
});

/**
 * 약관 제13조 2항 — "후원자 명단 이름 공개 동의는 후원 확인 페이지에서 철회할 수 있다".
 * 그런데 이 화면에는 공개 여부 표시조차 없었다(약관이 있다고 말한 기능이 코드에 없었다).
 */
describe('명단 공개 설정', () => {
  const okFetch = (body: Record<string, unknown>) => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true, headers: { get: () => 'application/json' }, json: async () => body,
    });
    global.fetch = fetchMock as never;
    return fetchMock;
  };

  it('명단에서 내리면 PATCH를 보내고 결과 문구를 띄운다', async () => {
    const fetchMock = okFetch({ ok: true, displayNamePublic: false, publicName: null });
    render(<FundingManagePage {...baseProps} displayNamePublic paymentMethod="toss" />);
    expect(screen.getByText(/후원자 명단에/)).toHaveTextContent('홍길동(으)로 올라가 있습니다');
    await userEvent.click(screen.getByRole('button', { name: '명단에서 내리기' }));
    // 공개 명단은 상태 API 캐시(s-maxage=60 · SWR 300)를 통해 나가므로 즉시 반영되지 않는다 —
    // 그걸 말하지 않으면 "철회가 안 됐다"는 문의가 온다.
    expect(await screen.findByText(/후원자 명단에서 내렸습니다\. 프로젝트 페이지에는 최대 몇 분 뒤 반영됩니다\./)).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/funding/display-name');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ orderNo: 'FND-1', token: 'tok', displayNamePublic: false });
    expect(screen.getByRole('button', { name: '명단에 올리기' })).toBeInTheDocument();
  });

  it('닉네임으로 바꿔 저장하면 방식과 닉네임을 함께 보낸다', async () => {
    const fetchMock = okFetch({ ok: true, displayNamePublic: true, publicName: '청취자' });
    render(<FundingManagePage {...baseProps} displayNamePublic paymentMethod="toss" />);
    const save = screen.getByRole('button', { name: '표시 이름 저장' });
    // 바뀐 것이 없으면 저장할 것도 없다.
    expect(save).toBeDisabled();
    await userEvent.click(screen.getByLabelText('닉네임'));
    await userEvent.type(screen.getByLabelText('명단에 표시할 닉네임'), '청취자');
    await userEvent.click(save);
    expect(await screen.findByText(/후원자 명단에 올렸습니다/)).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      orderNo: 'FND-1', token: 'tok', displayNamePublic: true, publicNameStyle: 'nickname', publicNickname: '청취자',
    });
  });

  it('저장된 가린 이름을 선택 상태로 되살린다', () => {
    render(<FundingManagePage {...baseProps} displayNamePublic publicName="홍*동" paymentMethod="toss" />);
    expect(screen.getByLabelText(/가린 이름/)).toBeChecked();
  });

  it('실패하면 서버 문구를 보이고 공개 상태를 바꾸지 않는다 — 화면이 서버보다 앞서지 않는다', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false, headers: { get: () => 'application/json' },
      json: async () => ({ ok: false, message: '이 펀딩은 이름 공개 설정을 바꿀 수 없습니다.' }),
    }) as never;
    render(<FundingManagePage {...baseProps} displayNamePublic paymentMethod="toss" />);
    await userEvent.click(screen.getByRole('button', { name: '명단에서 내리기' }));
    expect(await screen.findByText('이 펀딩은 이름 공개 설정을 바꿀 수 없습니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '명단에서 내리기' })).toBeInTheDocument();
  });

  // 공개 동의가 켜져 있어도 운영자가 내렸으면 "올라가 있습니다"라고 말하면 안 된다.
  it('운영자가 내렸으면 그 사실을 알린다', () => {
    render(<FundingManagePage {...baseProps} displayNamePublic listingHidden paymentMethod="toss" />);
    expect(screen.getByText(/후원자 명단에서 내려 두었습니다/)).toBeInTheDocument();
    expect(screen.queryByText(/올라가 있습니다/)).toBeNull();
    // 내려진 뒤에는 표시 이름을 바꿀 자리가 없다 — 바꿔도 명단에 뜨지 않는다. 동의 철회만 남는다.
    expect(screen.queryByRole('button', { name: '표시 이름 저장' })).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByRole('button', { name: '공개 동의 철회' })).toBeInTheDocument();
  });

  /**
   * 서버가 이 상태에서 **켜는** 저장을 409로 거부하므로(pages/api/funding/display-name.ts)
   * 올리기·표시 이름 저장 버튼을 남기면 눌러도 실패만 한다. 예전에는 저장이 200으로 성공해
   * "명단에 올렸습니다"라는 거짓 성공을 돌려줬다.
   */
  it.each([['공개 동의 켜짐', true], ['공개 동의 꺼짐', false]])(
    '운영자가 내렸으면 올리기·이름 편집을 그리지 않는다 (%s)',
    (_label, displayNamePublic) => {
      render(<FundingManagePage {...baseProps} displayNamePublic={displayNamePublic} listingHidden paymentMethod="toss" />);
      expect(screen.queryByRole('button', { name: '명단에 올리기' })).toBeNull();
      expect(screen.queryByRole('button', { name: '표시 이름 저장' })).toBeNull();
      expect(screen.queryByLabelText(/가린 이름/)).toBeNull();
    },
  );

  /**
   * 철회는 약관 제13조 2항이 이 화면에서 약속한 것이고 서버도 받아 준다 — 운영자가 내려 뒀다는
   * 사정이 그 권리를 없앨 이유가 없다.
   */
  it('운영자가 내렸어도 공개에 동의해 둔 상태면 철회 버튼은 남긴다', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, headers: { get: () => 'application/json' },
      json: async () => ({ ok: true, displayNamePublic: false, publicName: null }),
    }) as never;
    render(<FundingManagePage {...baseProps} displayNamePublic listingHidden paymentMethod="toss" />);
    await userEvent.click(screen.getByRole('button', { name: '공개 동의 철회' }));
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)).toEqual({
      orderNo: 'FND-1', token: 'tok', displayNamePublic: false,
    });
    expect(await screen.findByText(/후원자 명단에서 내렸습니다/)).toBeInTheDocument();
  });

  it('공개 동의가 꺼져 있으면 철회 버튼도 없다 — 거둘 것이 없다', () => {
    render(<FundingManagePage {...baseProps} listingHidden paymentMethod="toss" />);
    expect(screen.queryByRole('button', { name: '공개 동의 철회' })).toBeNull();
  });

  it('바꿀 수 없는 상태면 편집 칸 대신 현재 값만 보인다', () => {
    render(<FundingManagePage {...baseProps} status="refunded" canCancel={false} canEditDisplayName={false} displayNamePublic paymentMethod="toss" />);
    expect(screen.queryByRole('button', { name: '명단에서 내리기' })).toBeNull();
    expect(screen.getByText('공개')).toBeInTheDocument();
  });
});


/**
 * 토스 결제가 아닌 후원(운영자가 계좌로 받아 수기 등록한 건, 무통장입금 중단 전의 건)은
 * 취소할 결제가 없어 환불이 계좌 송금이다. `assessSelfCancel`이 그걸 보지 않던 동안
 * 화면은 "후원 취소 (전액 환불)" 버튼을 띄웠는데, 누르면 서버가 거절하는 죽은 버튼이었다.
 * 약관 제8조가 약속한 "후원 확인 페이지에서 바로 취소"와도 어긋났다.
 */
describe('토스 결제가 아닌 펀딩', () => {
  it('셀프 취소 버튼 대신 문의 안내를 보여준다', () => {
    render(
      <FundingManagePage
        {...baseProps}
        paymentMethod="bank_transfer"
        canCancel={false}
        cancelBlockedReason="계좌로 받은 펀딩은 화면에서 취소할 수 없습니다. 청약철회는 문의로 접수해 주시면 계좌로 환불해 드립니다."
      />,
    );
    expect(screen.queryByRole('button', { name: /펀딩 취소/ })).not.toBeInTheDocument();
    expect(screen.getByText(/문의로 접수해 주시면 계좌로 환불/)).toBeInTheDocument();
  });
});

/**
 * `getFundingProjectAsync`가 DB 오류를 삼켜 null을 주는 것은 공개 페이지를 위한 설계인데,
 * 이 화면이 그 null을 곧바로 "마감"으로 읽었다. 모금 중인데 "펀딩 마감 후에는 온라인
 * 취소가 불가합니다"가 뜨고 내려받기 링크도 사라졌다 — 사실이 아닌 안내다.
 */
it('프로젝트 조회가 실패하면 마감이 아니라 일시 오류로 안내한다', () => {
  render(<FundingManagePage {...baseProps} paymentMethod="toss" lookupFailed canCancel={false} cancelBlockedReason={null} />);
  expect(screen.getByText(/지금은 후원 정보를 불러오지 못했습니다/)).toBeInTheDocument();
  expect(screen.queryByText(/마감/)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /펀딩 취소/ })).not.toBeInTheDocument();
});
