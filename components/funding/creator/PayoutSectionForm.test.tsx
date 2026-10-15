import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useState } from 'react';

import {
  FUNDING_PAYMENT_FEE_PERCENT,
  FUNDING_PLATFORM_FEE_PERCENT,
  FUNDING_WITHHOLDING_PERCENT,
} from '../../../data/pricing';
import type { BusinessProfileView } from '../../../lib/funding/businessProfile';
import { FUNDING_PAYOUT_BUSINESS_DAYS } from '../../../lib/funding/policy';
import { PayoutSectionForm } from './PayoutSectionForm';
import type { EditorPayoutSummary } from './types';

const UNREGISTERED: EditorPayoutSummary = {
  registered: false, accountLast4: null, taxType: null, residentNumberRegistered: false, withheldPayoutRecorded: false, keepsResidentNumber: false, keepsBusinessProfile: false,
  business: null,
};

const BUSINESS: BusinessProfileView = {
  businessNumber: '7537400653',
  businessName: '스튜디오 놀',
  representativeName: '황경하',
  ntsStatus: 'active',
  ntsTaxTypeCode: '01',
  ntsTaxTypeLabel: '부가가치세 일반과세자',
  ntsCheckedAt: '2026-10-14T03:00:00.000Z',
  ntsCheckError: null,
  hasCertificate: false,
  certificateUploadedAt: null,
};

const INVOICE: EditorPayoutSummary = {
  registered: true, accountLast4: '9012', taxType: 'invoice', residentNumberRegistered: false, withheldPayoutRecorded: false, keepsResidentNumber: false, keepsBusinessProfile: false,
  business: BUSINESS,
};

/** 페이지처럼 onSaved로 받은 요약을 다시 내려 준다. dirty는 마지막 보고 값을 화면에 적어 확인한다. */
function Harness({ initial }: { initial: EditorPayoutSummary }) {
  const [summary, setSummary] = useState(initial);
  const [dirty, setDirty] = useState(false);
  return (
    <>
      <PayoutSectionForm initial={summary} onSaved={setSummary} onDirtyChange={setDirty} />
      <output data-testid="dirty">{dirty ? 'dirty' : 'clean'}</output>
    </>
  );
}

const renderForm = (initial: EditorPayoutSummary = UNREGISTERED) => render(<Harness initial={initial} />);

const bankField = () => screen.getByLabelText('은행명', { exact: false });
const accountField = () => screen.getByLabelText('계좌번호', { exact: false });
const holderField = () => screen.getByLabelText('예금주', { exact: false });
const taxField = () => screen.getByLabelText('세금 유형', { exact: false });
const rrnField = () => screen.getByLabelText('주민등록번호', { exact: false });
const queryRrnField = () => screen.queryByLabelText('주민등록번호', { exact: false });
const queryBankField = () => screen.queryByLabelText('은행명', { exact: false });
const queryAccountField = () => screen.queryByLabelText('계좌번호', { exact: false });
const queryHolderField = () => screen.queryByLabelText('예금주', { exact: false });
const changeAccountButton = () => screen.getByRole('button', { name: '계좌 바꾸기' });
const queryBizNumber = () => screen.queryByLabelText('사업자등록번호', { exact: false });
const dirtyState = () => screen.getByTestId('dirty').textContent;
const saveButton = () => screen.getByRole('button', { name: '정산 정보 저장' });

const fillAccount = (account = '123-456-789012') => {
  fireEvent.change(bankField(), { target: { value: '국민은행' } });
  fireEvent.change(accountField(), { target: { value: account } });
  fireEvent.change(holderField(), { target: { value: '황경하' } });
};

const mockFetchOk = (body: Record<string, unknown> = { ok: true }) => {
  const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => body });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
};

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('화면 문구는 상수에서 온다', () => {
  it('정산 시점·플랫폼 수수료·원천징수율이 상수 값으로 적혀 있다', () => {
    renderForm();
    expect(screen.getByText(`영업일 ${FUNDING_PAYOUT_BUSINESS_DAYS}일`, { exact: false })).toBeInTheDocument();
    // 결제 수수료율과 원천징수율이 우연히 같은 값(3.3%)이라 항목별 접두어로 구분한다.
    expect(screen.getByText(`플랫폼 수수료 ${FUNDING_PLATFORM_FEE_PERCENT}%`, { exact: false })).toBeInTheDocument();
    expect(screen.getByText(`결제 수수료 ${FUNDING_PAYMENT_FEE_PERCENT}%`, { exact: false })).toBeInTheDocument();
    expect(screen.getByText(`지방소득세 ${FUNDING_WITHHOLDING_PERCENT}%`, { exact: false })).toBeInTheDocument();
  });

  it('신분증 사본을 요구하는 문구가 없다', () => {
    renderForm(INVOICE);
    expect(document.body.textContent).not.toContain('신분증');
  });
});

describe('등록 상태 표시', () => {
  it('미등록이면 아직 없다고 말한다', () => {
    renderForm();
    expect(screen.getByText('아직 등록된 계좌가 없어요', { exact: false })).toBeInTheDocument();
  });

  it('등록됐으면 뒤 4자리만 보여 주고 계좌 칸은 숨긴다 — 사업자 칸은 저장된 값으로 채워진다', () => {
    renderForm(INVOICE);
    expect(screen.getByText('등록된 계좌를 그대로 써요 (계좌번호 뒤 4자리 9012).')).toBeInTheDocument();
    expect(queryBankField()).toBeNull();
    expect(queryAccountField()).toBeNull();
    expect(queryHolderField()).toBeNull();
    expect(taxField()).toHaveValue('invoice');
    expect(queryBizNumber()).toHaveValue('753-74-00653');
    expect(screen.getByLabelText('상호', { exact: false })).toHaveValue('스튜디오 놀');
    expect(screen.getByLabelText('대표자명', { exact: false })).toHaveValue('황경하');
    expect(dirtyState()).toBe('clean');
  });
});

describe('사업자 칸', () => {
  it('사업자를 고르면 칸 셋이 나오고, 원천징수로 돌리면 사라진다', () => {
    renderForm();
    expect(queryBizNumber()).toBeNull();
    fireEvent.change(taxField(), { target: { value: 'invoice' } });
    expect(queryBizNumber()).toBeInTheDocument();
    expect(queryBizNumber()).toHaveAttribute('inputmode', 'numeric');
    expect(screen.getByLabelText('상호', { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText('대표자명', { exact: false })).toBeInTheDocument();
    fireEvent.change(taxField(), { target: { value: 'withholding' } });
    expect(queryBizNumber()).toBeNull();
    expect(screen.queryByLabelText('상호', { exact: false })).toBeNull();
  });

  it('저장된 국세청 상태를 배지로 보인다 — 정상', () => {
    renderForm(INVOICE);
    expect(screen.getByText('정상')).toBeInTheDocument();
    // 조회 시각은 한국 시간으로 적는다(03:00Z = 12:00 KST).
    expect(screen.getByText('2026년 10월 14일 12:00 기준')).toBeInTheDocument();
  });

  it('휴업이면 배지와 경고 문구를 보인다', () => {
    renderForm({ ...INVOICE, business: { ...BUSINESS, ntsStatus: 'suspended' } });
    expect(screen.getByText('휴업')).toBeInTheDocument();
    expect(screen.getByText('휴업 중에는 세금계산서를 발행할 수 없어요', { exact: false })).toBeInTheDocument();
  });

  it('과세 유형이 세금계산서 발급 대상이 아니면 경고', () => {
    renderForm({ ...INVOICE, business: { ...BUSINESS, ntsTaxTypeCode: '02', ntsTaxTypeLabel: '부가가치세 간이과세자' } });
    expect(screen.getByText('과세 유형 확인 필요')).toBeInTheDocument();
    expect(screen.getByText('부가가치세 간이과세자', { exact: false })).toBeInTheDocument();
  });

  it('저장 응답의 경고가 오면 그것으로 갈아 끼운다', async () => {
    mockFetchOk({ ok: true, businessWarnings: ['국세청에 등록되지 않은 번호로 나와요. 사업자등록번호를 다시 확인해 주세요.'] });
    renderForm(INVOICE);
    fireEvent.change(queryBizNumber()!, { target: { value: '1208147521' } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(screen.getByText('저장했어요.')).toBeInTheDocument());
    expect(screen.getByText('국세청에 등록되지 않은 번호로 나와요', { exact: false })).toBeInTheDocument();
  });

  it('사업자로 저장하면 사업자 정보를 함께 보내고, 주민등록번호는 빈 값이다', async () => {
    const fetchMock = mockFetchOk();
    renderForm();
    fireEvent.change(rrnField(), { target: { value: '900101-1234567' } });
    fireEvent.change(taxField(), { target: { value: 'invoice' } });
    fireEvent.change(queryBizNumber()!, { target: { value: '7537400653' } });
    fireEvent.change(screen.getByLabelText('상호', { exact: false }), { target: { value: ' 스튜디오 놀 ' } });
    fireEvent.change(screen.getByLabelText('대표자명', { exact: false }), { target: { value: '황경하' } });
    fillAccount();
    fireEvent.click(saveButton());
    await waitFor(() => expect(screen.getByText('저장했어요.')).toBeInTheDocument());

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/funding/creator/payout');
    expect(JSON.parse((init as { body: string }).body)).toEqual({
      value: {
        taxType: 'invoice', bankName: '국민은행', account: '123-456-789012', holder: '황경하', residentNumber: '',
        business: { businessNumber: '7537400653', businessName: '스튜디오 놀', representativeName: '황경하' },
      },
    });
    // 번호는 하이픈을 넣은 모양으로 되돌아가고, dirty가 풀린다.
    expect(queryBizNumber()).toHaveValue('753-74-00653');
    await waitFor(() => expect(dirtyState()).toBe('clean'));
  });

  it('표가 없으면(unavailable) 사업자 칸 대신 준비 중 안내를 보이고 저장을 끈다', () => {
    renderForm({ ...UNREGISTERED, business: 'unavailable' });
    fireEvent.change(taxField(), { target: { value: 'invoice' } });
    expect(queryBizNumber()).toBeNull();
    expect(screen.getByText('사업자 정보 칸은 준비 중이에요', { exact: false })).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    // 원천징수 저장은 그대로 된다.
    fireEvent.change(taxField(), { target: { value: 'withholding' } });
    expect(saveButton()).toBeEnabled();
  });

  it('저장된 사업자를 개인으로 돌리면 지워진다고 미리 말한다', () => {
    renderForm(INVOICE);
    expect(screen.queryByText('사업자 정보와 사업자등록증이 지워져요', { exact: false })).toBeNull();
    fireEvent.change(taxField(), { target: { value: 'withholding' } });
    expect(screen.getByText('개인(원천징수)으로 바꿔 저장하면 사업자 정보와 사업자등록증이 지워져요.')).toBeInTheDocument();
  });

  it('사업자 번호를 치다가 개인으로 바꿔 저장하면 dirty가 풀린다(이탈 가드 없음)', async () => {
    mockFetchOk();
    renderForm();
    fireEvent.change(taxField(), { target: { value: 'invoice' } });
    fireEvent.change(queryBizNumber()!, { target: { value: '1208147521' } });
    fireEvent.change(taxField(), { target: { value: 'withholding' } });
    fillAccount();
    fireEvent.click(saveButton());
    await waitFor(() => expect(screen.getByText('저장했어요.')).toBeInTheDocument());
    await waitFor(() => expect(dirtyState()).toBe('clean'));
    // 다시 사업자로 돌리면 저장된 값(없음)이 보인다 — 저장하지 않은 번호가 되살아나지 않는다.
    fireEvent.change(taxField(), { target: { value: 'invoice' } });
    expect(queryBizNumber()).toHaveValue('');
  });

  it('개인으로 바꾸면 사업자 칸이 저장된 값으로 돌아간다', () => {
    renderForm(INVOICE);
    fireEvent.change(queryBizNumber()!, { target: { value: '1208147521' } });
    fireEvent.change(taxField(), { target: { value: 'withholding' } });
    fireEvent.change(taxField(), { target: { value: 'invoice' } });
    expect(queryBizNumber()).toHaveValue('753-74-00653');
    expect(dirtyState()).toBe('clean');
  });

  it('저장된 사업자를 개인으로 저장해 서버가 지우면 사업자 칸이 비고 dirty가 풀린다', async () => {
    mockFetchOk();
    renderForm(INVOICE);
    fireEvent.change(taxField(), { target: { value: 'withholding' } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(screen.getByText('저장했어요.')).toBeInTheDocument());
    await waitFor(() => expect(dirtyState()).toBe('clean'));
    fireEvent.change(taxField(), { target: { value: 'invoice' } });
    expect(queryBizNumber()).toHaveValue('');
  });

  it('개인으로 저장했는데 서버가 사업자 정보를 남겼다고 답하면 그렇게 말한다', async () => {
    mockFetchOk({ ok: true, businessProfileRetained: true });
    renderForm(INVOICE);
    fireEvent.change(taxField(), { target: { value: 'withholding' } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(screen.getByText('저장했어요.')).toBeInTheDocument());
    expect(screen.getByText('사업자 정보는 정산 대조와 세금 신고에 필요해 남겨 두었어요.')).toBeInTheDocument();
  });

  it('사업자 정보를 남기는 계정이면 개인으로 바꿀 때 "지워져요" 대신 "남겨 둬요"라고 말한다', () => {
    renderForm({ ...INVOICE, keepsBusinessProfile: true });
    fireEvent.change(taxField(), { target: { value: 'withholding' } });
    expect(screen.getByText('사업자등록증은 정산 대조와 세금 신고에 필요해 남겨 둬요', { exact: false })).toBeInTheDocument();
    expect(screen.queryByText('사업자 정보와 사업자등록증이 지워져요', { exact: false })).toBeNull();
  });

  it('남길 근거가 없으면 개인으로 바꿀 때 지워진다고 말한다', () => {
    renderForm(INVOICE);
    fireEvent.change(taxField(), { target: { value: 'withholding' } });
    expect(screen.getByText('사업자 정보와 사업자등록증이 지워져요', { exact: false })).toBeInTheDocument();
  });
});

describe('사업자등록증', () => {
  it('개인으로 바뀐 뒤 남은 사업자등록증은 지우기만 보이고, 지울 수 있다', async () => {
    const fetchMock = mockFetchOk({ ok: true });
    renderForm({
      ...INVOICE, taxType: 'withholding', keepsBusinessProfile: true,
      business: { ...BUSINESS, hasCertificate: true, certificateUploadedAt: '2026-10-14T03:00:00.000Z' },
    });
    expect(screen.getByText('개인 전환 뒤에도 정산 대조를 위해 보관 중인 파일이에요', { exact: false })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '올리기' })).toBeNull();
    expect(screen.queryByLabelText('파일 고르기', { exact: false })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '지우기' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/certificate'), expect.objectContaining({ method: 'DELETE' }),
    ));
    await waitFor(() => expect(screen.queryByRole('button', { name: '지우기' })).toBeNull());
  });

  it('개인이고 남은 사업자등록증이 없으면 사업자등록증 칸을 그리지 않는다', () => {
    renderForm({ ...INVOICE, taxType: 'withholding', keepsBusinessProfile: true });
    expect(screen.queryByText('사업자등록증 사본', { exact: false })).toBeNull();
  });

  it('사업자 정보를 저장하기 전에는 올리기를 끄고 먼저 저장하라고 말한다', () => {
    renderForm();
    fireEvent.change(taxField(), { target: { value: 'invoice' } });
    expect(screen.getByText('사업자 정보를 먼저 저장해 주세요.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '올리기' })).toBeDisabled();
    expect(screen.getByLabelText('파일 고르기', { exact: false })).toBeDisabled();
  });

  it('저장된 사업자면 파일을 골라 원문 그대로 올리고, 등록 표시가 바뀐다', async () => {
    const fetchMock = mockFetchOk({ ok: true, uploadedAt: '2026-10-14T03:00:00.000Z' });
    renderForm(INVOICE);
    expect(screen.getByText('운영자만 볼 수 있어요', { exact: false })).toBeInTheDocument();
    const input = screen.getByLabelText('파일 고르기', { exact: false });
    expect(input).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp,application/pdf');
    const file = new File(['%PDF-1.4'], 'cert.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: '올리기' }));
    await waitFor(() => expect(screen.getByText('올렸어요.')).toBeInTheDocument());

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/funding/creator/payout/certificate');
    expect(init).toEqual({ method: 'POST', body: file });
    expect(screen.getByText('등록되어 있어요 (2026년 10월 14일에 올림).')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '지우기' })).toBeInTheDocument();
  });

  it('4MB를 넘는 파일은 보내지 않는다', async () => {
    const fetchMock = mockFetchOk();
    renderForm(INVOICE);
    const big = new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'big.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('파일 고르기', { exact: false }), { target: { files: [big] } });
    fireEvent.click(screen.getByRole('button', { name: '올리기' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('4MB 이하');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('등록된 사업자등록증은 지울 수 있다', async () => {
    const fetchMock = mockFetchOk();
    renderForm({ ...INVOICE, business: { ...BUSINESS, hasCertificate: true, certificateUploadedAt: '2026-10-01T00:00:00.000Z' } });
    fireEvent.click(screen.getByRole('button', { name: '지우기' }));
    await waitFor(() => expect(screen.getByText('지웠어요.')).toBeInTheDocument());
    expect(fetchMock.mock.calls[0]).toEqual(['/api/funding/creator/payout/certificate', { method: 'DELETE' }]);
    expect(screen.getByText('아직 올린 파일이 없어요.')).toBeInTheDocument();
  });
});

describe('저장', () => {
  it('입력한 값을 계정 라우트로 보내고, 성공하면 dirty가 풀리고 뒤 4자리가 바뀐다', async () => {
    const fetchMock = mockFetchOk();
    renderForm();
    fillAccount(' 123-456-789012 ');
    expect(dirtyState()).toBe('dirty');
    fireEvent.click(saveButton());
    await waitFor(() => expect(screen.getByText('저장했어요.')).toBeInTheDocument());

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/funding/creator/payout');
    expect(JSON.parse((init as { body: string }).body)).toEqual({
      value: {
        taxType: 'withholding', bankName: '국민은행', account: '123-456-789012', holder: '황경하',
        residentNumber: '', business: null,
      },
    });
    // 저장하면 등록된 계좌를 그대로 쓰는 상태로 돌아간다 — 입력한 계좌번호는 화면에 남지 않는다.
    await waitFor(() => expect(dirtyState()).toBe('clean'));
    expect(screen.getByText('등록된 계좌를 그대로 써요 (계좌번호 뒤 4자리 9012).')).toBeInTheDocument();
    expect(queryAccountField()).toBeNull();
    expect(document.body.innerHTML).not.toContain('789012');
  });

  it('저장 요청이 도는 동안 이어서 친 입력은 응답이 덮어쓰지 않는다', async () => {
    let resolveFetch: (v: unknown) => void = () => {};
    global.fetch = jest.fn().mockImplementation(
      () => new Promise((resolve) => { resolveFetch = resolve; }),
    ) as unknown as typeof fetch;
    renderForm();
    fillAccount('123-456-7890');
    fireEvent.click(saveButton());
    fireEvent.change(accountField(), { target: { value: '123-456-789012' } });
    resolveFetch({ ok: true, json: async () => ({ ok: true }) });
    await waitFor(() => expect(screen.getByText('저장했어요.')).toBeInTheDocument());

    expect(accountField()).toHaveValue('123-456-789012');
    expect(dirtyState()).toBe('dirty');
  });

  it('서버가 형식 오류를 돌려주면 그 문구를 그대로 보여 준다', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false, message: '계좌번호는 숫자와 하이픈(-)만 넣어 주세요.' }),
    }) as unknown as typeof fetch;
    renderForm();
    fillAccount();
    fireEvent.click(saveButton());
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('숫자와 하이픈'));
  });
});

describe('주민등록번호는 원천징수 대상만', () => {
  it('원천징수면 칸이 보이고 왜 받는지가 적혀 있다', () => {
    renderForm();
    expect(rrnField()).toHaveAttribute('autocomplete', 'off');
    expect(rrnField()).toHaveAttribute('inputmode', 'numeric');
    expect(screen.getByText('지급명세서', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('주민등록번호가 아직 등록되어 있지 않아요', { exact: false })).toBeInTheDocument();
  });

  it('사업자를 고르면 칸이 사라지고, 기존 값이 지워진다는 것을 말한다', () => {
    renderForm();
    fireEvent.change(rrnField(), { target: { value: '900101-1234567' } });
    fireEvent.change(taxField(), { target: { value: 'invoice' } });
    expect(queryRrnField()).toBeNull();
    expect(screen.getByText('이미 등록된 번호도 함께 지워져요', { exact: false })).toBeInTheDocument();
  });

  it('상점 아티스트처럼 정산 기록 없이도 서버가 남기는 계정이면 "보관됩니다"라고 말한다', () => {
    renderForm({ ...UNREGISTERED, registered: true, taxType: 'withholding', residentNumberRegistered: true, keepsResidentNumber: true });
    fireEvent.change(taxField(), { target: { value: 'invoice' } });
    expect(screen.getByText('등록된 번호는 그대로 보관돼요', { exact: false })).toBeInTheDocument();
    expect(screen.queryByText('이미 등록된 번호도 함께 지워져요', { exact: false })).toBeNull();
  });

  it('사업자로 저장해 서버가 번호를 남겼다고 답하면 저장 뒤에 그렇게 말한다', async () => {
    mockFetchOk({ ok: true, residentNumberRetained: true });
    renderForm({ ...UNREGISTERED, registered: true, taxType: 'withholding', residentNumberRegistered: true, keepsResidentNumber: true });
    fireEvent.change(taxField(), { target: { value: 'invoice' } });
    fireEvent.change(queryBizNumber()!, { target: { value: '7537400653' } });
    fireEvent.change(screen.getByLabelText('상호', { exact: false }), { target: { value: '스튜디오 놀' } });
    fireEvent.change(screen.getByLabelText('대표자명', { exact: false }), { target: { value: '황경하' } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(screen.getByText('저장했어요.')).toBeInTheDocument());
    expect(screen.getByText('주민등록번호는 정산 대조와 세금 신고에 필요해 남겨 두었어요.')).toBeInTheDocument();
  });

  it('원천징수한 정산 기록이 있으면 "보관됩니다"라고 말한다', () => {
    renderForm({ ...UNREGISTERED, registered: true, taxType: 'withholding', residentNumberRegistered: true, withheldPayoutRecorded: true, keepsResidentNumber: true });
    expect(screen.getByText('등록된 번호는 그대로 보관돼요', { exact: false })).toBeInTheDocument();
    fireEvent.change(taxField(), { target: { value: 'invoice' } });
    expect(screen.getByText('등록된 번호는 그대로 보관돼요', { exact: false })).toBeInTheDocument();
    expect(screen.queryByText('이미 등록된 번호도 함께 지워져요', { exact: false })).toBeNull();
  });

  it('사업자로 저장했는데 서버가 보관했다고 답하면 등록 표시가 유지된다', async () => {
    mockFetchOk({ ok: true, residentNumberRetained: true });
    renderForm({ ...UNREGISTERED, registered: true, taxType: 'withholding', residentNumberRegistered: true, withheldPayoutRecorded: true, keepsResidentNumber: true });
    fireEvent.change(taxField(), { target: { value: 'invoice' } });
    fireEvent.change(queryBizNumber()!, { target: { value: '7537400653' } });
    fireEvent.change(screen.getByLabelText('상호', { exact: false }), { target: { value: '스튜디오 놀' } });
    fireEvent.change(screen.getByLabelText('대표자명', { exact: false }), { target: { value: '황경하' } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(screen.getByText('저장했어요.')).toBeInTheDocument());
    fireEvent.change(taxField(), { target: { value: 'withholding' } });
    expect(screen.getByText('주민등록번호가 등록되어 있어요', { exact: false })).toBeInTheDocument();
  });

  it('저장하면 주민번호 칸이 비고, 입력한 번호가 화면 어디에도 남지 않는다', async () => {
    mockFetchOk();
    renderForm();
    fillAccount();
    fireEvent.change(rrnField(), { target: { value: '900101-1234567' } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(screen.getByText('저장했어요.')).toBeInTheDocument());
    expect(rrnField()).toHaveValue('');
    await waitFor(() => expect(dirtyState()).toBe('clean'));
    expect(screen.getByText('주민등록번호가 등록되어 있어요', { exact: false })).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain('1234567');
    expect(document.body.innerHTML).not.toContain('900101');
  });

  it('저장이 도는 동안 이어서 친 주민등록번호는 응답이 지우지 않는다', async () => {
    let resolveFetch: (v: unknown) => void = () => {};
    global.fetch = jest.fn().mockImplementation(
      () => new Promise((resolve) => { resolveFetch = resolve; }),
    ) as unknown as typeof fetch;
    renderForm();
    fillAccount();
    fireEvent.change(rrnField(), { target: { value: '900101-123' } });
    fireEvent.click(saveButton());
    fireEvent.change(rrnField(), { target: { value: '900101-1234567' } });
    resolveFetch({ ok: true, json: async () => ({ ok: true }) });
    await waitFor(() => expect(screen.getByText('저장했어요.')).toBeInTheDocument());
    expect(rrnField()).toHaveValue('900101-1234567');
    expect(dirtyState()).toBe('dirty');
  });
});

describe('등록된 계좌 그대로 두기', () => {
  const REGISTERED: EditorPayoutSummary = { ...UNREGISTERED, registered: true, accountLast4: '0123', taxType: 'withholding' };

  it('미등록이면 계좌 칸이 바로 보이고 바꾸기 버튼은 없다', () => {
    renderForm();
    expect(bankField()).toBeRequired();
    expect(accountField()).toBeRequired();
    expect(holderField()).toBeRequired();
    expect(screen.queryByRole('button', { name: '계좌 바꾸기' })).toBeNull();
  });

  it('등록돼 있으면 계좌 없이 keepAccount로 저장한다 — 계좌 칸 값은 실어 보내지 않는다', async () => {
    const fetchMock = mockFetchOk();
    renderForm(REGISTERED);
    expect(screen.getByText('등록된 계좌를 그대로 써요 (계좌번호 뒤 4자리 0123).')).toBeInTheDocument();
    fireEvent.change(taxField(), { target: { value: 'invoice' } });
    fireEvent.change(queryBizNumber()!, { target: { value: '7537400653' } });
    fireEvent.change(screen.getByLabelText('상호', { exact: false }), { target: { value: '스튜디오 놀' } });
    fireEvent.change(screen.getByLabelText('대표자명', { exact: false }), { target: { value: '황경하' } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(screen.getByText('저장했어요.')).toBeInTheDocument());
    expect(JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body)).toEqual({
      value: {
        taxType: 'invoice', keepAccount: true, residentNumber: '',
        business: { businessNumber: '7537400653', businessName: '스튜디오 놀', representativeName: '황경하' },
      },
    });
    // 뒤 4자리는 그대로다.
    expect(screen.getByText('등록된 계좌를 그대로 써요 (계좌번호 뒤 4자리 0123).')).toBeInTheDocument();
    await waitFor(() => expect(dirtyState()).toBe('clean'));
  });

  it('계좌 바꾸기를 눌러도 입력 전에는 dirty가 아니고, 취소하면 입력이 사라지고 다시 그대로 두기다', () => {
    renderForm(REGISTERED);
    fireEvent.click(changeAccountButton());
    expect(bankField()).toHaveValue('');
    expect(accountField()).toHaveValue('');
    expect(holderField()).toHaveValue('');
    expect(dirtyState()).toBe('clean');
    fillAccount();
    expect(dirtyState()).toBe('dirty');
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(queryAccountField()).toBeNull();
    expect(dirtyState()).toBe('clean');
    // 다시 열면 빈 칸이다 — 취소한 값이 되살아나지 않는다.
    fireEvent.click(changeAccountButton());
    expect(accountField()).toHaveValue('');
  });

  it('바꾸기로 새 계좌를 저장하면 keepAccount 없이 세 칸을 보내고, 그대로 두기로 돌아와 새 뒤 4자리를 보인다', async () => {
    const fetchMock = mockFetchOk();
    renderForm(REGISTERED);
    fireEvent.click(changeAccountButton());
    fillAccount('110-222-333444');
    fireEvent.click(saveButton());
    await waitFor(() => expect(screen.getByText('저장했어요.')).toBeInTheDocument());
    expect(JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body)).toEqual({
      value: { taxType: 'withholding', bankName: '국민은행', account: '110-222-333444', holder: '황경하', residentNumber: '', business: null },
    });
    expect(screen.getByText('등록된 계좌를 그대로 써요 (계좌번호 뒤 4자리 3444).')).toBeInTheDocument();
    expect(queryAccountField()).toBeNull();
    await waitFor(() => expect(dirtyState()).toBe('clean'));
    expect(document.body.innerHTML).not.toContain('333444');
  });

  it('서버에 그대로 둘 계좌가 없다고 답하면 계좌 칸을 열어 바로 입력하게 한다', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false, code: 'no_payout_account', message: '등록된 계좌가 없어요. 은행명·계좌번호·예금주를 입력해 주세요.' }),
    }) as unknown as typeof fetch;
    renderForm(REGISTERED);
    expect(queryAccountField()).toBeNull();
    fireEvent.click(saveButton());
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('등록된 계좌가 없어요'));
    expect(accountField()).toHaveValue('');
    expect(bankField()).toBeRequired();
  });

  it('다른 오류면 그대로 두기 상태를 유지한다', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false, json: async () => ({ ok: false, message: '요청이 너무 잦아요.' }),
    }) as unknown as typeof fetch;
    renderForm(REGISTERED);
    fireEvent.click(saveButton());
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('요청이 너무 잦아요'));
    expect(queryAccountField()).toBeNull();
  });

  it('뒤 4자리를 모르는 옛 등록이면 숫자 없이 그대로 둔다고 말한다', () => {
    renderForm({ ...REGISTERED, accountLast4: null });
    expect(screen.getByText('등록된 계좌를 그대로 써요.')).toBeInTheDocument();
  });
});
