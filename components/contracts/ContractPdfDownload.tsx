import React, { useEffect, useState } from 'react';

import { IDENTITY_DIGITS } from '../../lib/contracts/identity';
import { classifyPaymentBrowser } from '../../lib/payments/browserKind';
import { Button } from '../ui/Button';
import { TextInput } from '../ui/Field';
import { Notice } from '../ui/Notice';

const OPERATOR_PHONE = '010-4255-7893';

/** 받은 파일 주소를 바로 지우면 일부 휴대폰 브라우저가 저장을 끝내기 전에 파일을 잃는다 — 한 분쯤 뒤에 푼다. */
const REVOKE_DELAY_MS = 60_000;

/** 카카오톡 인앱 브라우저에서 현재 주소를 기본 브라우저로 여는 주소(카카오 공식 스킴). */
export const kakaoOpenExternalUrl = (pageUrl: string): string => `kakaotalk://web/openExternal?url=${encodeURIComponent(pageUrl)}`;

interface ContractPdfDownloadProps {
  /** 서명본을 받는 API 주소(토큰 포함). POST로 연락처 뒷자리를 보낸다. */
  downloadUrl: string;
  /** 저장될 파일 이름. */
  fileName: string;
  /** 뒷자리 입력 칸의 안내 문구. */
  labelText: React.ReactNode;
  /** 연습실 화면은 합니다체, 제작 화면은 해요체. */
  formal?: boolean;
  /** 버튼 아래에 붙일 안내(화면마다 다르다). */
  footer?: React.ReactNode;
}

/**
 * 계약서 PDF 내려받기 — 연락처 뒷자리를 받고, 받아서 저장한다(연습실·제작 완료 화면이 함께 쓴다).
 *
 * 링크로 바로 이동하지 않는 이유: API는 실패를 JSON으로 돌려주므로 링크를 그대로 누르면 계약서 대신
 * {"ok":false,...} 한 줄짜리 흰 화면이 뜬다. 입력은 `<form>`이라 키보드의 완료·Enter로도 보낸다.
 *
 * 카카오톡 인앱 브라우저는 blob 저장이 막히는 일이 잦아, 안내와 함께 기본 브라우저로 여는 버튼을 둔다.
 */
export default function ContractPdfDownload({ downloadUrl, fileName, labelText, formal = false, footer }: ContractPdfDownloadProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [identityDigits, setIdentityDigits] = useState('');
  const [inKakao, setInKakao] = useState(false);

  // 서버에서는 UA를 모르므로 마운트 뒤에 판정한다(하이드레이션 불일치 방지).
  useEffect(() => {
    setInKakao(classifyPaymentBrowser(navigator.userAgent) === 'kakaotalk');
  }, []);

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError(null);
    setDownloaded(false);
    try {
      const response = await fetch(downloadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identityDigits }),
      });
      if (!response.ok) {
        const message = await response
          .json()
          .then((body) => (typeof body?.message === 'string' ? body.message : null))
          .catch(() => null);
        setDownloadError(message ?? (formal ? '계약서를 받지 못했습니다. 잠시 후 다시 시도해 주세요.' : '계약서를 받지 못했어요. 잠시 후 다시 시도해 주세요.'));
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), REVOKE_DELAY_MS);
      setDownloaded(true);
    } catch {
      setDownloadError(formal ? '연결이 끊겼습니다. 잠시 후 다시 시도해 주세요.' : '연결이 끊겼어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      {inKakao && (
        <Notice tone="warning" light className="mb-4 text-left" title={formal ? '카카오톡 안에서는 저장이 안 될 수 있습니다' : '카카오톡 안에서는 저장이 안 될 수 있어요'}>
          <span className="block">
            {formal
              ? '아래 버튼으로 기본 브라우저에서 이 화면을 열면 확실히 받으실 수 있습니다.'
              : '아래 버튼으로 기본 브라우저에서 이 화면을 열면 확실히 받을 수 있어요.'}
          </span>
          <span className="block">{formal ? '서명본은 메일로도 보내 드렸습니다.' : '서명본은 메일로도 보내 드렸어요.'}</span>
          <Button
            type="button"
            light
            size="sm"
            variant="secondary"
            className="mt-3"
            onClick={() => {
              window.location.href = kakaoOpenExternalUrl(window.location.href);
            }}
          >
            외부 브라우저로 열기
          </Button>
        </Notice>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!downloading && identityDigits.length === IDENTITY_DIGITS) void handleDownload();
        }}
      >
        <label htmlFor="download-identity-digits" className="block text-left text-sm text-gray-600 dark:text-gray-600 mb-2">
          {labelText}
        </label>
        <TextInput
          id="download-identity-digits"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={IDENTITY_DIGITS}
          value={identityDigits}
          onChange={(event) => setIdentityDigits(event.target.value.replace(/\D/g, ''))}
          placeholder="0000"
          aria-describedby={downloadError ? 'download-identity-error' : undefined}
          aria-invalid={downloadError ? true : undefined}
          invalid={Boolean(downloadError)}
          light
          className="mb-4 px-4 py-3 text-center text-lg tracking-[0.5em]"
        />
        <Button type="submit" light size="lg" fullWidth disabled={downloading || identityDigits.length !== IDENTITY_DIGITS}>
          {downloading ? '준비 중…' : '계약서 PDF 내려받기'}
        </Button>
      </form>

      {downloadError && (
        <Notice id="download-identity-error" tone="error" light className="mt-3 text-left">
          <span className="block">{downloadError}</span>
          <span className="block">
            {formal
              ? `계약서는 메일로도 보내 드렸습니다. 급하시면 ${OPERATOR_PHONE}으로 연락해 주세요.`
              : `계약서는 메일로도 보내 드렸어요. 급하시면 ${OPERATOR_PHONE}으로 연락해 주세요.`}
          </span>
        </Notice>
      )}

      {downloaded && !downloadError && (
        <Notice tone="success" light className="mt-3 text-left">
          {formal
            ? '내려받기를 시작했습니다. 받은 파일은 기기의 다운로드 폴더(또는 파일 앱)에서 확인해 주세요.'
            : '내려받기를 시작했어요. 받은 파일은 기기의 다운로드 폴더(또는 파일 앱)에서 확인해 주세요.'}
        </Notice>
      )}

      {footer}
    </>
  );
}
