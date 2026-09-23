import { useEffect, useState, type FormEvent } from 'react';

import { Button } from '../../ui/Button';
import { Field, Select, TextInput } from '../../ui/Field';
import {
  FUNDING_PAYMENT_FEE_PERCENT,
  FUNDING_PLATFORM_FEE_PERCENT,
  FUNDING_WITHHOLDING_PERCENT,
} from '../../../data/pricing';
import { FUNDING_PAYOUT_BUSINESS_DAYS } from '../../../lib/funding/policy';
import { CREATOR_LIMITS } from '../../../lib/funding/creatorValidation';
import { savePayoutSection } from './api';
import { IDLE_SAVE_STATE, type EditorPayoutSummary, type EditorTaxType, type SaveState } from './types';

interface Props {
  projectId: string;
  /**
   * 지금 등록 상태 — **등록 여부와 계좌번호 뒤 4자리, 세금 유형뿐이다.** 은행명·예금주·
   * 계좌번호 전체는 서버가 내려보내지 않는다(`types.ts`의 `EditorPayoutSummary` 주석).
   * 그래서 입력 칸은 늘 빈 채로 시작하고, 개설자는 바꿀 때 다시 입력해 덮어쓴다.
   */
  initial: EditorPayoutSummary;
  readOnly: boolean;
  onSaved: (value: EditorPayoutSummary) => void;
  /** 다른 구획 폼과 같은 계약 — 저장 안 한 입력이 있으면 부모에 알린다(이탈 가드). */
  onDirtyChange?: (dirty: boolean) => void;
}

/** 저장 성공 뒤 dirty 판정의 기준이 되는 값. 초기값은 "빈 입력 + 서버가 알려준 세금 유형"이다. */
interface Baseline {
  bankName: string;
  account: string;
  holder: string;
  taxType: EditorTaxType;
  /** 주민등록번호 칸의 기준은 늘 빈 문자열이다 — 서버가 값을 안 주고, 저장 뒤에도 비운다. */
  residentNumber: string;
}

const last4 = (account: string): string | null => {
  const digits = account.replace(/[^0-9]/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
};

/**
 * 정산 정보 구획 — 세금 유형과 입금 계좌.
 *
 * 승인 뒤에만 열린다(`EDITABLE_SECTIONS`). 그전에는 `readOnly`로 내려와 왜 아직 못 넣는지만
 * 설명한다 — 반려될 신청서에 계좌 정보를 미리 받지 않는다.
 */
export function PayoutSectionForm({ projectId, initial, readOnly, onSaved, onDirtyChange }: Props) {
  const [bankName, setBankName] = useState('');
  const [account, setAccount] = useState('');
  const [holder, setHolder] = useState('');
  const [taxType, setTaxType] = useState<EditorTaxType>(initial.taxType ?? 'withholding');
  const [residentNumber, setResidentNumber] = useState('');
  const [baseline, setBaseline] = useState<Baseline>({
    bankName: '', account: '', holder: '', taxType: initial.taxType ?? 'withholding', residentNumber: '',
  });
  const [save, setSave] = useState<SaveState>(IDLE_SAVE_STATE);

  // 다른 구획 폼과 같은 방식(파생값, 별도 state 없음). 기준이 `initial`이 아니라 `baseline`인
  // 이유: 이 폼의 입력 칸은 서버 값을 받지 못해 늘 빈 문자열로 시작하므로, 저장에 성공한
  // 뒤에도 `initial`과 비교하면 dirty가 영영 안 풀린다.
  const dirty = bankName !== baseline.bankName
    || account !== baseline.account
    || holder !== baseline.holder
    || taxType !== baseline.taxType
    || residentNumber !== baseline.residentNumber;
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  const clearSaveStatus = () => setSave((s) => (s.status === 'idle' ? s : IDLE_SAVE_STATE));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSave({ status: 'saving' });
    const value = {
      taxType,
      bankName: bankName.trim(),
      account: account.trim(),
      holder: holder.trim(),
      // 사업자면 아예 실어 보내지 않는다. 서버도 버리지만(`validatePayoutSection`),
      // 근거가 없는 값을 네트워크에 한 번 더 올릴 이유가 없다.
      residentNumber: taxType === 'withholding' ? residentNumber.replace(/\s/g, '') : '',
    };
    const result = await savePayoutSection(projectId, value);
    if (result.ok) {
      // CreatorSectionForm과 같은 처방. 정규화(trim)한 값으로 로컬 상태를 되돌리되,
      // **제출 시점의 값과 지금 값이 같을 때만** 되돌린다 — 저장 왕복(100~500ms) 동안
      // 입력 칸은 계속 활성이라 그 사이 이어서 친 입력을 응답이 덮어쓰면 조용한 유실이
      // 된다(2026-09-22에 이 브랜치에서 실제로 난 회귀와 같은 모양).
      setBankName((cur) => (cur === bankName ? value.bankName : cur));
      setAccount((cur) => (cur === account ? value.account : cur));
      setHolder((cur) => (cur === holder ? value.holder : cur));
      // 주민등록번호만은 정규화한 값으로 되돌리지 않고 **비운다** — 저장된 뒤에는 이 값이
      // 화면에 남아 있을 이유가 없다. 같은 조건("제출 시점 값과 지금 값이 같을 때만")을
      // 지켜야 저장 중에 이어서 친 입력이 사라지지 않는다.
      setResidentNumber((cur) => (cur === residentNumber ? '' : cur));
      // 기준은 무조건 제출한 값으로 옮긴다 — 그래야 이어서 친 입력이 남아 있을 때
      // dirty가 열린 채로 유지돼 이탈 가드가 계속 경고한다.
      // 주민번호의 기준만 빈 문자열이다 — 위에서 칸을 비웠으므로 그게 저장 직후의 값이다.
      setBaseline({ ...value, residentNumber: '' });
      setSave({ status: 'success' });
      // 부모에게도 요약만 올린다. 계좌 전체를 올리면 그 값이 페이지 state를 타고
      // 다른 구획으로 번진다.
      onSaved({
        registered: true,
        accountLast4: last4(value.account),
        taxType: value.taxType,
        // 서버와 같은 규칙(`savePayoutSection`): 사업자로 저장하면 지워지고, 빈 값이면
        // 기존 값이 남고, 값을 넣었으면 등록된다.
        residentNumberRegistered: value.taxType === 'invoice'
          ? false
          : value.residentNumber.length > 0 || initial.residentNumberRegistered,
      });
    } else {
      setSave({ status: 'error', message: result.message });
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="rounded-lg bg-gray-100 p-4 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <p>
          모금이 끝나고 영업일 {FUNDING_PAYOUT_BUSINESS_DAYS}일 이내에 여기 등록하신 계좌로 정산금을 보냅니다.
        </p>
        {/*
          환불 차감을 먼저 적는다. 계산 순서가 실제로 그렇고(`lib/funding/payout.ts`의
          netGross = gross − refund, 수수료는 그 뒤에 붙는다), 이 문장에 없으면 환불이 있는
          프로젝트의 개설자는 정산 메일에서 처음 알게 된다.
        */}
        <p className="mt-2">
          정산금은 결제된 후원금에서 환불된 금액을 먼저 뺀 뒤, 거기서 플랫폼 수수료{' '}
          {FUNDING_PLATFORM_FEE_PERCENT}%와 결제 수수료 {FUNDING_PAYMENT_FEE_PERCENT}%(둘 다 부가세 포함)를
          뺀 금액입니다. 수수료는 환불을 뺀 금액을 기준으로 계산하며, 둘 다 개설자가 부담합니다.
        </p>
      </div>

      {readOnly ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          정산 정보는 프로젝트가 승인된 뒤에 넣습니다. 심사에서 반려될 수도 있는 단계에서 계좌 정보를
          미리 받아 두지 않기 위해서입니다.
        </p>
      ) : (
        <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700 dark:bg-gray-900 dark:text-gray-300">
          {initial.registered
            ? `계좌가 등록되어 있습니다${initial.accountLast4 ? ` (계좌번호 뒤 4자리 ${initial.accountLast4})` : ''}.`
            : '아직 등록된 계좌가 없습니다. 모금이 끝나기 전에 채워 주세요.'}
          {' '}
          보안을 위해 등록한 계좌번호는 화면에 다시 띄우지 않습니다. 바꾸시려면 아래에 새로 입력해 저장해 주세요.
        </p>
      )}

      <Field
        id="payout-tax-type"
        label="세금 유형"
        required
        hint="어느 쪽을 고르느냐에 따라 실제로 받으시는 금액이 달라집니다."
      >
        <Select
          value={taxType}
          onChange={(e) => {
            const next = e.target.value as EditorTaxType;
            setTaxType(next);
            // 사업자로 바꾸면 주민등록번호 칸이 사라진다. 사라진 칸에 입력이 남아 있으면
            // 그 값이 보이지 않는 채로 다음 저장까지 브라우저 메모리에 머문다.
            if (next === 'invoice') setResidentNumber('');
            clearSaveStatus();
          }}
          disabled={readOnly}
        >
          <option value="withholding">개인 — 원천징수</option>
          <option value="invoice">사업자 — 세금계산서</option>
        </Select>
      </Field>
      <ul className="-mt-3 list-disc space-y-1 pl-5 text-xs text-gray-600 dark:text-gray-400">
        <li>
          개인: 정산금에서 소득세·지방소득세 {FUNDING_WITHHOLDING_PERCENT}%를 원천징수하고 나머지를 보내 드립니다.
        </li>
        <li>
          사업자: 원천징수 없이 정산금 전액을 보내 드립니다. 대신 그 금액에 대한 세금계산서를
          스튜디오 놀 앞으로 발행해 주셔야 합니다.
        </li>
      </ul>

      {/*
        주민등록번호 — **원천징수 대상일 때만 보이고, 그때만 받는다.**
        근거는 소득세법상 원천징수의무자의 지급명세서 제출 의무 하나뿐이라, 사업자에게
        받으면 근거 없는 수집이 된다(개인정보보호법 §24의2). 그래서 칸 자체가 사라지고
        서버도 그때 기존 값을 지운다(`savePayoutSection`).
      */}
      {taxType === 'withholding' ? (
        <>
          <Field
            id="payout-resident-number"
            label="주민등록번호"
            hint="하이픈(-)은 넣어도 되고 빼도 됩니다."
          >
            <TextInput
              value={residentNumber}
              onChange={(e) => { setResidentNumber(e.target.value); clearSaveStatus(); }}
              maxLength={CREATOR_LIMITS.residentNumberMax}
              disabled={readOnly}
              inputMode="numeric"
              autoComplete="off"
              placeholder="000000-0000000"
            />
          </Field>
          <div className="-mt-3 space-y-1 text-xs text-gray-600 dark:text-gray-400">
            <p>
              개인으로 정산을 받으시면 스튜디오 놀이 원천징수의무자로서 위 세액을 대신 떼어 신고하고,
              국세청에 지급명세서를 제출해야 합니다. 지급명세서에는 소득을 받는 분의 주민등록번호가
              들어갑니다 — 그래서 원천징수 대상일 때만 받습니다.
            </p>
            <p>
              {initial.residentNumberRegistered
                ? '주민등록번호가 등록되어 있습니다. 비워 두고 저장하면 등록된 번호가 그대로 남고, 새로 입력해 저장하면 덮어씁니다.'
                : '주민등록번호가 아직 등록되어 있지 않습니다. 정산을 보내려면 등록해 주세요.'}
              {' '}
              암호화해 보관하며, 등록한 번호는 계좌와 마찬가지로 화면에 다시 띄우지 않습니다.
            </p>
            <p>
              세금 유형을 사업자로 바꾸면 이 칸이 사라지고, 이미 등록된 번호도 지워집니다 — 원천징수
              대상이 아니면 저희가 이 번호를 보관할 근거가 없기 때문입니다.
            </p>
          </div>
        </>
      ) : (
        <p className="-mt-2 text-xs text-gray-600 dark:text-gray-400">
          사업자는 주민등록번호를 받지 않습니다. 원천징수를 하지 않으므로 지급명세서 제출 대상이
          아니고, 그러면 저희가 그 번호를 보관할 근거가 없습니다. 개인으로 등록해 두셨다가 사업자로
          바꿔 저장하시면 이미 등록된 번호도 함께 지워집니다.
        </p>
      )}

      <Field id="payout-bank-name" label="은행명" required>
        <TextInput
          value={bankName}
          onChange={(e) => { setBankName(e.target.value); clearSaveStatus(); }}
          maxLength={CREATOR_LIMITS.payoutBankNameMax}
          disabled={readOnly}
          required={!readOnly}
          placeholder="예: 국민은행"
        />
      </Field>
      <Field id="payout-account" label="계좌번호" required hint="숫자와 하이픈(-)만 넣어 주세요.">
        <TextInput
          value={account}
          onChange={(e) => { setAccount(e.target.value); clearSaveStatus(); }}
          maxLength={CREATOR_LIMITS.payoutAccountMax}
          disabled={readOnly}
          required={!readOnly}
          inputMode="numeric"
          autoComplete="off"
          placeholder="123-456-789012"
        />
      </Field>
      <Field id="payout-holder" label="예금주" required hint="계좌에 등록된 이름 그대로 적어 주세요.">
        <TextInput
          value={holder}
          onChange={(e) => { setHolder(e.target.value); clearSaveStatus(); }}
          maxLength={CREATOR_LIMITS.payoutHolderMax}
          disabled={readOnly}
          required={!readOnly}
          autoComplete="off"
        />
      </Field>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={readOnly || save.status === 'saving'}>
          {save.status === 'saving' ? '저장 중…' : '정산 정보 저장'}
        </Button>
        {save.status === 'success' && <span className="typo-caption text-green-600 dark:text-green-400">저장했습니다.</span>}
        {save.status === 'error' && (
          <span role="alert" className="typo-caption text-red-600 dark:text-red-400">{save.message}</span>
        )}
      </div>
    </form>
  );
}
