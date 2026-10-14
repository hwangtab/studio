import React, { useEffect, useState } from 'react';

import { businessStatusBadge, formatKstDateTime } from '../funding/creator/businessStatusBadge';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';
import type { BusinessProfileView } from '../../lib/funding/businessProfile';
import { formatBusinessNumber, type NtsLookupError } from '../../lib/funding/businessStatus';

/**
 * 운영자 화면의 개설자 사업자 정보 — 펀딩 프로젝트 상세·공연 등록 상세·상점 아티스트 화면이 같은 패널을 쓴다.
 * 마운트 때 `/api/admin/creators/<id>/tax-profile`에서 읽는다 — 세 화면의 SSR props에 사업자 정보를 싣지 않으려고.
 * 계좌·주민등록번호는 여기서 다루지 않는다(펀딩 정산 절의 조회 버튼이 따로 연다).
 */

type TaxType = 'withholding' | 'invoice' | null;

interface TaxProfileResponse {
  ok: boolean;
  message?: string;
  taxType?: TaxType;
  business?: BusinessProfileView | null;
  businessUnavailable?: boolean;
}

const CHECK_ERROR_LABEL: Record<NtsLookupError, string> = {
  missing_key: 'API 키 없음',
  timeout: '시간 초과',
  http_error: '국세청 응답 오류',
  bad_response: '응답 형식 이상',
  network: '연결 실패',
  rate_limited: '조회 한도',
};

const checkErrorLabel = (code: string | null): string | null =>
  code ? (CHECK_ERROR_LABEL[code as NtsLookupError] ?? code) : null;

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex justify-between gap-4">
    <dt className="shrink-0 text-gray-500">{label}</dt>
    <dd className="min-w-0 break-words text-right font-medium text-gray-900">{children}</dd>
  </div>
);

export function CreatorTaxProfilePanel({ creatorId, heading = true }: { creatorId: string; heading?: boolean }) {
  const [data, setData] = useState<TaxProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rechecking, setRechecking] = useState(false);
  const [recheckError, setRecheckError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/admin/creators/${encodeURIComponent(creatorId)}/tax-profile`, { credentials: 'same-origin' });
        const body = (await r.json()) as TaxProfileResponse;
        if (cancelled) return;
        if (!r.ok || !body.ok) setError(body.message ?? '사업자 정보를 읽지 못했어요.');
        else setData(body);
      } catch {
        if (!cancelled) setError('네트워크 오류');
      }
    })();
    return () => { cancelled = true; };
  }, [creatorId]);

  const recheck = async () => {
    setRechecking(true);
    setRecheckError(null);
    try {
      const r = await fetch(`/api/admin/creators/${encodeURIComponent(creatorId)}/tax-profile`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recheck' }),
      });
      const body = (await r.json()) as { ok: boolean; message?: string; business?: BusinessProfileView };
      if (!r.ok || !body.ok || !body.business) setRecheckError(body.message ?? '다시 조회하지 못했어요.');
      else setData((prev) => (prev ? { ...prev, business: body.business } : prev));
    } catch {
      setRecheckError('네트워크 오류');
    }
    setRechecking(false);
  };

  const business = data?.business ?? null;
  const badge = business ? businessStatusBadge(business) : null;
  const reason = business?.ntsStatus === 'unverified' ? checkErrorLabel(business.ntsCheckError) : null;

  return (
    <div className="mb-6">
      {heading && <h2 className="mb-3 text-lg font-bold text-gray-900">사업자 정보</h2>}
      {error ? (
        <Notice tone="error" light>{error}</Notice>
      ) : !data ? (
        <p className="text-sm text-gray-500">불러오는 중…</p>
      ) : data.businessUnavailable ? (
        <Notice tone="warning" light>사업자 정보 표가 아직 준비되지 않아 읽지 못했어요.</Notice>
      ) : data.taxType !== 'invoice' && !business ? (
        <p className="text-sm text-gray-700">
          {data.taxType === 'withholding' ? '개인(원천징수) — 사업자 정보 없음' : '세금 구분 미등록 — 사업자 정보 없음'}
        </p>
      ) : !business ? (
        <p className="text-sm text-gray-700">세금 구분: 사업자(세금계산서) — 사업자 정보가 아직 없어요.</p>
      ) : (
        <div className="space-y-3">
          <dl className="space-y-2 text-sm">
            <Row label="세금 구분">{data.taxType === 'invoice' ? '사업자(세금계산서)' : '개인(원천징수) — 사업자로 정산한 기록 때문에 남긴 정보'}</Row>
            <Row label="사업자등록번호"><span className="tabular-nums">{formatBusinessNumber(business.businessNumber)}</span></Row>
            <Row label="상호">{business.businessName}</Row>
            <Row label="대표자명">{business.representativeName}</Row>
            <Row label="국세청 상태">
              <span className="inline-flex flex-wrap items-center justify-end gap-2">
                {badge && <Badge tone={badge.tone}>{badge.label}</Badge>}
                {business.ntsTaxTypeLabel && <span className="font-normal text-gray-700">{business.ntsTaxTypeLabel}</span>}
              </span>
            </Row>
            <Row label="조회 시각">{business.ntsCheckedAt ? formatKstDateTime(business.ntsCheckedAt) : '조회한 적 없음'}</Row>
          </dl>
          {reason && (
            <Notice tone="warning" light>국세청 상태를 확인하지 못했어요 — 사유: {reason}</Notice>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button light variant="weak" size="sm" disabled={rechecking} onClick={recheck}>
              {rechecking ? '조회 중…' : '국세청 다시 조회'}
            </Button>
            {business.hasCertificate && (
              <a
                href={`/api/admin/creators/${encodeURIComponent(creatorId)}/business-certificate`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-primary-dark underline underline-offset-2"
              >
                사업자등록증 보기
              </a>
            )}
          </div>
          {business.hasCertificate && (
            <p className="text-xs text-gray-500">사업자등록증을 열면 열람 사실이 접속기록에 남아요. PDF는 내려받기로 열려요.</p>
          )}
          {recheckError && <p role="alert" className="text-sm text-red-700">{recheckError}</p>}
        </div>
      )}
    </div>
  );
}
