import { useEffect, useId, useState, type FormEvent } from 'react';

import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Field, Select, TextInput } from '../../ui/Field';
import { Notice } from '../../ui/Notice';
import { Panel } from '../../ui/Panel';
import {
  FUNDING_PAYMENT_FEE_PERCENT,
  FUNDING_PLATFORM_FEE_PERCENT,
  FUNDING_WITHHOLDING_PERCENT,
} from '../../../data/pricing';
import type { BusinessProfileView } from '../../../lib/funding/businessProfile';
import { businessStatusWarnings, formatBusinessNumber, normalizeBusinessNumber } from '../../../lib/funding/businessStatus';
import { FUNDING_PAYOUT_BUSINESS_DAYS } from '../../../lib/funding/policy';
import { CREATOR_LIMITS } from '../../../lib/funding/creatorValidation';
import { deleteBusinessCertificate, savePayoutSection, uploadBusinessCertificate } from './api';
import { businessStatusBadge, formatKstDate, formatKstDateTime, isBusinessView } from './businessStatusBadge';
import { IDLE_SAVE_STATE, type EditorPayoutSummary, type EditorTaxType, type SaveState } from './types';

interface Props {
  /**
   * 지금 등록 상태 — **계좌는 등록 여부와 계좌번호 뒤 4자리, 주민등록번호는 등록 여부뿐이다.** 은행명·예금주·
   * 계좌번호 전체는 서버가 내려보내지 않는다(`types.ts`의 `EditorPayoutSummary` 주석).
   * 그래서 계좌·주민번호 칸은 늘 빈 채로 시작하고, 개설자는 바꿀 때 다시 입력해 덮어쓴다.
   * 사업자 정보(번호·상호·대표자명)만은 저장된 값으로 채워 시작한다.
   */
  initial: EditorPayoutSummary;
  onSaved: (value: EditorPayoutSummary) => void;
  /** 저장 안 한 입력이 있으면 부모에 알린다(이탈 가드). */
  onDirtyChange?: (dirty: boolean) => void;
}

/** 저장 성공 뒤 dirty 판정의 기준이 되는 값. */
interface Baseline {
  bankName: string;
  account: string;
  holder: string;
  taxType: EditorTaxType;
  /** 주민등록번호 칸의 기준은 늘 빈 문자열이다 — 서버가 값을 안 주고, 저장 뒤에도 비운다. */
  residentNumber: string;
  businessNumber: string;
  businessName: string;
  representativeName: string;
}

/** 서버 `TAX_DOCUMENT_MAX_BYTES`(lib/funding/taxDocument.ts)와 같은 값. 그 모듈은 sharp를 물고 있어 값으로 가져오지 않는다. */
const CERTIFICATE_MAX_BYTES = 4 * 1024 * 1024;
const CERTIFICATE_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';

const last4 = (account: string): string | null => {
  const digits = account.replace(/[^0-9]/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
};

const businessFields = (b: EditorPayoutSummary['business']) => (isBusinessView(b)
  ? { businessNumber: formatBusinessNumber(b.businessNumber), businessName: b.businessName, representativeName: b.representativeName }
  : { businessNumber: '', businessName: '', representativeName: '' });

/** 번호가 바뀌면 국세청 상태는 서버가 새로 조회하고 사업자등록증은 떼어 낸다 — 화면은 그 결과를 추측하지 않는다. */
const freshBusinessView = (b: { businessNumber: string; businessName: string; representativeName: string }): BusinessProfileView => ({
  ...b,
  ntsStatus: 'unverified', ntsTaxTypeCode: null, ntsTaxTypeLabel: null, ntsCheckedAt: null, ntsCheckError: null,
  hasCertificate: false, certificateUploadedAt: null,
});

/**
 * 정산 정보 — 세금 구분, 입금 계좌, 원천징수면 주민등록번호, 사업자면 사업자 정보와 사업자등록증.
 *
 * 계정에 한 벌이라 펀딩·공연·상점 정산에 함께 쓰인다. 이 폼을 그리는 곳은 콘솔의 정산 정보 페이지 하나다
 * (`pages/[locale]/funding/creator/payout.tsx`) — 받아도 되는 계정인지는 그 페이지가 판정해, 아니면 폼을 그리지 않는다.
 */
export function PayoutSectionForm({ initial, onSaved, onDirtyChange }: Props) {
  const savedTaxType: EditorTaxType = initial.taxType ?? 'withholding';
  const [bankName, setBankName] = useState('');
  const [account, setAccount] = useState('');
  const [holder, setHolder] = useState('');
  const [taxType, setTaxType] = useState<EditorTaxType>(savedTaxType);
  const [residentNumber, setResidentNumber] = useState('');
  const [businessNumber, setBusinessNumber] = useState(() => businessFields(initial.business).businessNumber);
  const [businessName, setBusinessName] = useState(() => businessFields(initial.business).businessName);
  const [representativeName, setRepresentativeName] = useState(() => businessFields(initial.business).representativeName);
  const [baseline, setBaseline] = useState<Baseline>(() => ({
    bankName: '', account: '', holder: '', taxType: savedTaxType, residentNumber: '', ...businessFields(initial.business),
  }));
  const [save, setSave] = useState<SaveState>(IDLE_SAVE_STATE);
  /** 마지막 저장 응답의 국세청 안내. `null`이면 저장된 상태에서 다시 만든다. */
  const [savedWarnings, setSavedWarnings] = useState<string[] | null>(null);
  const [businessRetained, setBusinessRetained] = useState(false);

  const businessUnavailable = initial.business === 'unavailable';
  const savedBusiness = isBusinessView(initial.business) ? initial.business : null;

  // 기준이 `initial`이 아니라 `baseline`인 이유: 계좌·주민번호 칸은 서버 값을 받지 못해 늘 빈 문자열로
  // 시작하므로, 저장에 성공한 뒤에도 `initial`과 비교하면 dirty가 영영 안 풀린다.
  const dirty = bankName !== baseline.bankName
    || account !== baseline.account
    || holder !== baseline.holder
    || taxType !== baseline.taxType
    || residentNumber !== baseline.residentNumber
    || businessNumber !== baseline.businessNumber
    || businessName !== baseline.businessName
    || representativeName !== baseline.representativeName;
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  const clearSaveStatus = () => {
    setSave((s) => (s.status === 'idle' ? s : IDLE_SAVE_STATE));
    setBusinessRetained(false);
  };

  const warnings = savedWarnings ?? (savedBusiness && savedTaxType === 'invoice'
    ? businessStatusWarnings({
      status: savedBusiness.ntsStatus, taxTypeCode: savedBusiness.ntsTaxTypeCode, taxTypeLabel: savedBusiness.ntsTaxTypeLabel,
    })
    : []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSave({ status: 'saving' });
    setBusinessRetained(false);
    const business = taxType === 'invoice'
      ? { businessNumber: businessNumber.trim(), businessName: businessName.trim(), representativeName: representativeName.trim() }
      : null;
    const value = {
      taxType,
      bankName: bankName.trim(),
      account: account.trim(),
      holder: holder.trim(),
      // 사업자면 아예 실어 보내지 않는다. 서버도 버리지만(`validatePayoutSection`),
      // 근거가 없는 값을 네트워크에 한 번 더 올릴 이유가 없다.
      residentNumber: taxType === 'withholding' ? residentNumber.replace(/\s/g, '') : '',
      business,
    };
    const result = await savePayoutSection(value);
    if (!result.ok) {
      setSave({ status: 'error', message: result.message });
      return;
    }
    // 정규화한 값으로 로컬 상태를 되돌리되, **제출 시점의 값과 지금 값이 같을 때만** 되돌린다 — 저장 왕복
    // 동안 입력 칸은 계속 활성이라 그 사이 이어서 친 입력을 응답이 덮어쓰면 조용한 유실이 된다(2026-09-22 회귀).
    const digits = business ? normalizeBusinessNumber(business.businessNumber) ?? business.businessNumber : '';
    const shownNumber = business ? formatBusinessNumber(digits) : '';
    setBankName((cur) => (cur === bankName ? value.bankName : cur));
    setAccount((cur) => (cur === account ? value.account : cur));
    setHolder((cur) => (cur === holder ? value.holder : cur));
    // 주민등록번호만은 정규화한 값으로 되돌리지 않고 **비운다** — 저장된 뒤에는 화면에 남아 있을 이유가 없다.
    setResidentNumber((cur) => (cur === residentNumber ? '' : cur));
    if (business) {
      setBusinessNumber((cur) => (cur === businessNumber ? shownNumber : cur));
      setBusinessName((cur) => (cur === businessName ? business.businessName : cur));
      setRepresentativeName((cur) => (cur === representativeName ? business.representativeName : cur));
    }
    // 개인으로 저장해 서버가 사업자 행을 지웠으면(남긴다는 응답이 없으면) 사업자 칸도 비운다.
    const businessDeleted = !business && savedBusiness !== null && !result.businessProfileRetained;
    if (businessDeleted) {
      setBusinessNumber((cur) => (cur === businessNumber ? '' : cur));
      setBusinessName((cur) => (cur === businessName ? '' : cur));
      setRepresentativeName((cur) => (cur === representativeName ? '' : cur));
    }
    // 기준은 무조건 제출한 값으로 옮긴다 — 이어서 친 입력이 남아 있으면 dirty가 열린 채로 유지된다.
    // 개인으로 저장했으면 사업자 칸의 기준은 그대로 두되, 서버가 사업자 행을 지웠으면 빈 값이 기준이다.
    setBaseline((prev) => ({
      bankName: value.bankName,
      account: value.account,
      holder: value.holder,
      taxType: value.taxType,
      residentNumber: '',
      ...(business
        ? { businessNumber: shownNumber, businessName: business.businessName, representativeName: business.representativeName }
        : businessDeleted
          ? { businessNumber: '', businessName: '', representativeName: '' }
          : { businessNumber: prev.businessNumber, businessName: prev.businessName, representativeName: prev.representativeName }),
    }));
    setSave({ status: 'success' });
    setSavedWarnings(business ? result.businessWarnings ?? [] : null);
    setBusinessRetained(Boolean(result.businessProfileRetained));

    // 부모에게도 요약만 올린다. 계좌 전체를 올리면 그 값이 페이지 state를 타고 다른 곳으로 번진다.
    // 바뀐 번호의 국세청 상태는 여기서 추측하지 않는다(미확인으로 둔다) — 페이지가 서버 값을 다시 읽어 갈아 끼운다.
    let nextBusiness: EditorPayoutSummary['business'] = initial.business;
    if (business && !businessUnavailable) {
      const named = { businessNumber: digits, businessName: business.businessName, representativeName: business.representativeName };
      nextBusiness = savedBusiness && savedBusiness.businessNumber === digits ? { ...savedBusiness, ...named } : freshBusinessView(named);
    } else if (businessDeleted) {
      nextBusiness = null;
    }
    onSaved({
      registered: true,
      accountLast4: last4(value.account),
      taxType: value.taxType,
      // 서버와 같은 규칙(`savePayoutSection`): 사업자로 저장하면 지워지고, 빈 값이면 기존 값이 남고, 값을 넣었으면
      // 등록된다. 사업자인데 서버가 `residentNumberRetained`를 돌려줬으면 지우지 않은 것이다 — 서버가 실제로 한 일을 따른다.
      residentNumberRegistered: value.taxType === 'invoice'
        ? Boolean(result.residentNumberRetained) && initial.residentNumberRegistered
        : value.residentNumber.length > 0 || initial.residentNumberRegistered,
      withheldPayoutRecorded: initial.withheldPayoutRecorded,
      business: nextBusiness,
    });
  };

  const switchingToWithholding = taxType === 'withholding' && savedTaxType === 'invoice' && savedBusiness !== null;
  const badge = savedBusiness ? businessStatusBadge(savedBusiness) : null;

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={submit} className="flex flex-col gap-5">
        <Panel className="text-sm">
          <p>
            펀딩은 모금이 끝나고 영업일 {FUNDING_PAYOUT_BUSINESS_DAYS}일 이내에 여기 등록하신 계좌로 정산금을 보내요.
          </p>
          {/*
            환불 차감을 먼저 적는다. 계산 순서가 실제로 그렇고(`lib/funding/payout.ts`의
            netGross = gross − refund, 수수료는 그 뒤에 붙는다), 이 문장에 없으면 환불이 있는
            프로젝트의 개설자는 정산 메일에서 처음 알게 된다.
          */}
          <p className="mt-2">
            펀딩 정산금은 결제된 후원금에서 환불된 금액을 먼저 뺀 뒤, 거기서 플랫폼 수수료{' '}
            {FUNDING_PLATFORM_FEE_PERCENT}%와 결제 수수료 {FUNDING_PAYMENT_FEE_PERCENT}%(둘 다 부가세 포함)를
            빼고, 아래 세금 처리 구분에 따라 부가세 상당액과 원천징수세액을 뺀 금액입니다(개설자 약관
            제6조). 수수료는 환불을 뺀 금액을 기준으로 계산하며, 둘 다 개설자가 부담합니다.
          </p>
        </Panel>

        <Notice tone="info">
          {initial.registered
            ? `계좌가 등록되어 있어요${initial.accountLast4 ? ` (계좌번호 뒤 4자리 ${initial.accountLast4})` : ''}.`
            : '아직 등록된 계좌가 없어요. 정산을 받기 전에 채워 주세요.'}
          {' '}
          보안을 위해 등록한 계좌번호는 화면에 다시 띄우지 않아요. 바꾸시려면 아래에 새로 입력해 저장해 주세요.
        </Notice>

        <Field
          id="payout-tax-type"
          label="세금 유형"
          required
          hint="어느 쪽을 고르느냐에 따라 실제로 받으시는 금액이 달라져요."
        >
          <Select
            value={taxType}
            onChange={(e) => {
              const next = e.target.value as EditorTaxType;
              setTaxType(next);
              // 사업자로 바꾸면 주민등록번호 칸이 사라진다. 사라진 칸에 입력이 남아 있으면
              // 그 값이 보이지 않는 채로 다음 저장까지 브라우저 메모리에 머문다.
              if (next === 'invoice') setResidentNumber('');
              // 개인으로 바꾸면 사업자 칸이 사라진다. 그 칸에 친 값은 보내지도 않으므로 저장된 값으로 되돌린다 —
              // 안 그러면 개인으로 저장해도 dirty가 안 풀리고, 다시 사업자로 돌렸을 때 저장되지 않은 값이 보인다.
              if (next === 'withholding') {
                setBusinessNumber(baseline.businessNumber);
                setBusinessName(baseline.businessName);
                setRepresentativeName(baseline.representativeName);
              }
              clearSaveStatus();
            }}
          >
            <option value="withholding">개인 — 원천징수</option>
            <option value="invoice">사업자 — 세금계산서</option>
          </Select>
        </Field>
        <ul className="-mt-3 list-disc space-y-1 pl-5 text-sm text-gray-600 dark:text-gray-400">
          <li>
            개인: 세금계산서를 발행하지 않으므로 수수료를 뗀 금액에서 부가세 상당액(10/110)을 빼고, 남은
            금액에서 소득세·지방소득세 {FUNDING_WITHHOLDING_PERCENT}%를 원천징수한 나머지를 보내 드려요.
          </li>
          <li>
            사업자: 원천징수 없이 정산금 전액을 보내 드려요. 대신 그 금액에 대한 세금계산서를
            스튜디오 놀 앞으로 발행해 주셔야 해요.
          </li>
        </ul>

        {/*
          주민등록번호 — **원천징수 대상일 때만 보이고, 그때만 받는다.**
          근거는 소득세법상 원천징수의무자의 지급명세서 제출 의무 하나뿐이라, 사업자에게
          받으면 근거 없는 수집이 된다 — 개인정보 보호법이 주민등록번호를 법령에 구체적인
          근거가 있을 때만 처리하도록 정하고 있기 때문이다. 그래서 칸 자체가 사라지고 서버도
          그때 기존 값을 지운다(`savePayoutSection`). **이미 원천징수한 정산이 기록돼 있으면
          지우지 않는다** — 그때는 이미 지급한 소득의 지급명세서 제출 의무가 근거로 남는다.
        */}
        {taxType === 'withholding' ? (
          <>
            {switchingToWithholding && (
              <Notice tone="warning">
                개인(원천징수)으로 바꿔 저장하면 사업자 정보와 사업자등록증이 지워져요.
              </Notice>
            )}
            <Field
              id="payout-resident-number"
              label="주민등록번호"
              hint="하이픈(-)은 넣어도 되고 빼도 돼요."
            >
              <TextInput
                value={residentNumber}
                onChange={(e) => { setResidentNumber(e.target.value); clearSaveStatus(); }}
                maxLength={CREATOR_LIMITS.residentNumberMax}
                inputMode="numeric"
                autoComplete="off"
                placeholder="000000-0000000"
              />
            </Field>
            <div className="-mt-3 space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <p>
                개인으로 정산을 받으시면 스튜디오 놀이 원천징수의무자로서 위 세액을 대신 떼어 신고하고,
                국세청에 지급명세서를 제출해야 해요. 지급명세서에는 소득을 받는 분의 주민등록번호가
                들어가요 — 그래서 원천징수 대상일 때만 받아요.
              </p>
              <p>
                {initial.residentNumberRegistered
                  ? '주민등록번호가 등록되어 있어요. 비워 두고 저장하면 등록된 번호가 그대로 남고, 새로 입력해 저장하면 덮어써요.'
                  : '주민등록번호가 아직 등록되어 있지 않아요. 정산을 보내려면 등록해 주세요.'}
                {' '}
                암호화해 보관하며, 등록한 번호는 계좌와 마찬가지로 화면에 다시 띄우지 않아요.
              </p>
              <p>
                {initial.withheldPayoutRecorded
                  ? '세금 유형을 사업자로 바꾸면 이 칸이 사라지지만, 이미 원천징수한 정산이 있어 지급명세서 제출을 위해 등록된 번호는 그대로 보관돼요 — 이미 떼어 간 세액을 신고할 의무가 남아 있기 때문이에요.'
                  : '세금 유형을 사업자로 바꾸면 이 칸이 사라지고, 이미 등록된 번호도 지워져요 — 원천징수 대상이 아니면 저희가 이 번호를 보관할 근거가 없기 때문이에요.'}
              </p>
            </div>
          </>
        ) : (
          <>
            <p className="-mt-2 text-sm text-gray-600 dark:text-gray-400">
              사업자는 주민등록번호를 받지 않아요. 원천징수를 하지 않으므로 지급명세서 제출 대상이
              아니고, 그러면 저희가 그 번호를 보관할 근거가 없어요.
              {' '}
              {initial.withheldPayoutRecorded
                ? '다만 이미 원천징수한 정산이 있어, 사업자로 바꿔 저장하셔도 지급명세서 제출을 위해 등록된 번호는 그대로 보관돼요 — 이미 떼어 간 세액을 신고할 의무가 남아 있기 때문이에요.'
                : '개인으로 등록해 두셨다가 사업자로 바꿔 저장하시면 이미 등록된 번호도 함께 지워져요.'}
            </p>

            {businessUnavailable ? (
              <Notice tone="warning">사업자 정보 칸은 준비 중이에요. 스튜디오 놀에 알려 주세요.</Notice>
            ) : (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  보내 주신 세금계산서의 공급자 정보와 맞는지 대조하려고 아래 세 가지를 받아요. 저장하면 국세청에
                  사업자등록번호를 조회해 휴업·폐업 여부와 과세 유형을 확인해요.
                </p>
                <Field id="payout-business-number" label="사업자등록번호" required hint="10자리 숫자예요. 하이픈(-)은 넣어도 되고 빼도 돼요.">
                  <TextInput
                    value={businessNumber}
                    onChange={(e) => { setBusinessNumber(e.target.value); clearSaveStatus(); }}
                    maxLength={12}
                    required
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="000-00-00000"
                  />
                </Field>
                <Field id="payout-business-name" label="상호" required hint="사업자등록증에 적힌 이름 그대로 적어 주세요.">
                  <TextInput
                    value={businessName}
                    onChange={(e) => { setBusinessName(e.target.value); clearSaveStatus(); }}
                    maxLength={CREATOR_LIMITS.businessNameMax}
                    required
                    autoComplete="organization"
                  />
                </Field>
                <Field id="payout-representative-name" label="대표자명" required>
                  <TextInput
                    value={representativeName}
                    onChange={(e) => { setRepresentativeName(e.target.value); clearSaveStatus(); }}
                    maxLength={CREATOR_LIMITS.representativeNameMax}
                    required
                    autoComplete="name"
                  />
                </Field>
                {savedBusiness && badge && savedTaxType === 'invoice' && (
                  <p className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <span>국세청 조회</span>
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                    {savedBusiness.ntsCheckedAt && <span>{formatKstDateTime(savedBusiness.ntsCheckedAt)} 기준</span>}
                  </p>
                )}
                {warnings.map((w) => <Notice key={w} tone="warning">{w}</Notice>)}
              </>
            )}
          </>
        )}

        <Field id="payout-bank-name" label="은행명" required>
          <TextInput
            value={bankName}
            onChange={(e) => { setBankName(e.target.value); clearSaveStatus(); }}
            maxLength={CREATOR_LIMITS.payoutBankNameMax}
            required
            placeholder="예: 국민은행"
          />
        </Field>
        <Field id="payout-account" label="계좌번호" required hint="숫자와 하이픈(-)만 넣어 주세요.">
          <TextInput
            value={account}
            onChange={(e) => { setAccount(e.target.value); clearSaveStatus(); }}
            maxLength={CREATOR_LIMITS.payoutAccountMax}
            required
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
            required
            autoComplete="off"
          />
        </Field>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={save.status === 'saving' || (taxType === 'invoice' && businessUnavailable)}>
            {save.status === 'saving' ? '저장 중…' : '정산 정보 저장'}
          </Button>
          {save.status === 'success' && <span className="typo-caption text-green-600 dark:text-green-400">저장했어요.</span>}
          {save.status === 'error' && (
            <span role="alert" className="typo-caption text-red-600 dark:text-red-400">{save.message}</span>
          )}
        </div>
        {businessRetained && (
          <p className="-mt-2 text-sm text-gray-600 dark:text-gray-400">사업자로 정산받은 기록이 있어 사업자 정보는 남겨 두었어요.</p>
        )}
      </form>

      {taxType === 'invoice' && !businessUnavailable && (
        <CertificateControl
          business={savedTaxType === 'invoice' ? savedBusiness : null}
          onChange={(next) => { if (savedBusiness) onSaved({ ...initial, business: { ...savedBusiness, ...next } }); }}
        />
      )}
    </div>
  );
}

/**
 * 사업자등록증 사본(선택). 사업자 정보가 저장된 뒤에만 올릴 수 있다 — 서버도 그 전에는 409로 막는다
 * (`pages/api/funding/creator/payout/certificate.ts`).
 */
function CertificateControl({ business, onChange }: {
  business: BusinessProfileView | null;
  onChange: (next: Pick<BusinessProfileView, 'hasCertificate' | 'certificateUploadedAt'>) => void;
}) {
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  // 올린 뒤 파일 칸을 비우려면 다시 그려야 한다(파일 입력은 값을 코드로 지울 수 없다).
  const [inputKey, setInputKey] = useState(0);
  const [busy, setBusy] = useState<'upload' | 'delete' | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const upload = async () => {
    if (!file) return;
    // 서버 한도(4MB)를 넘으면 함수에 닿기 전에 막혀 메시지 없이 실패한다 — 보내기 전에 여기서 잡는다.
    if (file.size > CERTIFICATE_MAX_BYTES) {
      setMessage({ tone: 'error', text: '파일이 너무 커요. 4MB 이하로 올려 주세요.' });
      return;
    }
    setBusy('upload');
    setMessage(null);
    const result = await uploadBusinessCertificate(file);
    setBusy(null);
    if (!result.ok) {
      setMessage({ tone: 'error', text: result.message });
      return;
    }
    setFile(null);
    setInputKey((k) => k + 1);
    setMessage({ tone: 'success', text: '올렸어요.' });
    onChange({ hasCertificate: true, certificateUploadedAt: result.uploadedAt });
  };

  const remove = async () => {
    setBusy('delete');
    setMessage(null);
    const result = await deleteBusinessCertificate();
    setBusy(null);
    if (!result.ok) {
      setMessage({ tone: 'error', text: result.message });
      return;
    }
    setMessage({ tone: 'success', text: '지웠어요.' });
    onChange({ hasCertificate: false, certificateUploadedAt: null });
  };

  return (
    <Panel as="section" variant="outline" padding="default" title="사업자등록증 사본 (선택)" className="flex flex-col gap-3 text-sm">
      <p>올려 주시면 사업자 정보를 대조하는 데 써요. 이 파일은 스튜디오 놀 운영자만 볼 수 있어요.</p>
      {business === null ? (
        <p className="text-gray-600 dark:text-gray-400">사업자 정보를 먼저 저장해 주세요.</p>
      ) : (
        <p>
          {business.hasCertificate
            ? `등록되어 있어요${business.certificateUploadedAt ? ` (${formatKstDate(business.certificateUploadedAt)}에 올림)` : ''}.`
            : '아직 올린 파일이 없어요.'}
        </p>
      )}
      <Field id={inputId} label="파일 고르기" hint="JPG·PNG·WEBP 이미지나 PDF, 4MB 이하">
        <TextInput
          key={inputKey}
          type="file"
          accept={CERTIFICATE_ACCEPT}
          disabled={business === null || busy !== null}
          onChange={(e) => { setFile(e.target.files?.[0] ?? null); setMessage(null); }}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="weak" onClick={upload} disabled={business === null || !file || busy !== null}>
          {busy === 'upload' ? '올리는 중…' : '올리기'}
        </Button>
        {business?.hasCertificate && (
          <Button type="button" variant="ghost" onClick={remove} disabled={busy !== null}>
            {busy === 'delete' ? '지우는 중…' : '지우기'}
          </Button>
        )}
        {message && (
          <span
            role={message.tone === 'error' ? 'alert' : undefined}
            className={message.tone === 'error' ? 'typo-caption text-red-600 dark:text-red-400' : 'typo-caption text-green-600 dark:text-green-400'}
          >
            {message.text}
          </span>
        )}
      </div>
    </Panel>
  );
}
