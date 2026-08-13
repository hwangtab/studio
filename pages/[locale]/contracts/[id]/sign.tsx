import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Markdown from 'markdown-to-jsx';

import ContractContent from '../../../../components/contracts/ContractContent';
import { Button } from '../../../../components/ui/Button';
import { getDb } from '../../../../db/client';
import {
  serializeAttachment,
  serializeClause,
  serializeContract,
  type SerializedAttachment,
  type SerializedClause,
  type SerializedContract,
} from '../../../../lib/contracts/serialize';
import {
  IDENTITY_DIGITS,
  maskIdentityDigits,
  maskIdentityDigitsInContent,
} from '../../../../lib/contracts/identity';
import { expireOverdueContracts } from '../../../../lib/contracts/service';
import { getEffectiveStatus } from '../../../../lib/contracts/status';
import { resolveRulesContent } from '../../../../lib/contracts/template';

/** 점 하나만 찍고 제출하는 것을 막기 위한 최소 획 점 개수. */
const MIN_STROKE_POINTS = 12;

type UnavailableReason = 'expired' | 'cancelled';

interface SignPageProps {
  locale: string;
  token: string;
  contract: SerializedContract | null;
  clauses: SerializedClause[];
  attachments: SerializedAttachment[];
  rulesContent: string;
  unavailable?: UnavailableReason;
  error?: string;
}

export const getServerSideProps: GetServerSideProps<SignPageProps> = async (context) => {
  const { locale, id } = context.params as { locale: string; id: string };
  const { token } = context.query;

  if (!id || typeof token !== 'string' || token.trim() === '') {
    return { notFound: true };
  }

  const empty = { locale, token, contract: null, clauses: [], attachments: [], rulesContent: '' };

  try {
    // 접근 시점에 만료를 판정한다(크론 없는 lazy 방식).
    await expireOverdueContracts();

    const contract = await getDb().query.contracts.findFirst({
      where: (contracts, { eq, and }) => and(eq(contracts.id, id), eq(contracts.signToken, token)),
      with: { contractClauses: true, contractAttachments: true },
    });

    if (!contract) {
      return { notFound: true };
    }

    const status = getEffectiveStatus(contract);

    if (status === 'signed') {
      return {
        redirect: {
          destination: `/${locale}/contracts/${id}/complete?token=${encodeURIComponent(token)}`,
          permanent: false,
        },
      };
    }

    if (status === 'expired' || status === 'cancelled' || status === 'draft') {
      // draft는 아직 발송 전이라 고객에게 링크가 노출될 일이 없다. 만료와 같이 안내한다.
      return {
        props: {
          ...empty,
          unavailable: status === 'cancelled' ? 'cancelled' : 'expired',
        },
      };
    }

    const { contractClauses, contractAttachments, ...rest } = contract;

    return {
      props: {
        locale,
        token,
        /**
         * 확인 값을 이 페이지에서 완전히 걷어낸다.
         *
         * 본문만 가리는 것으로는 부족하다. Next.js는 이 props를 __NEXT_DATA__로 HTML에
         * 직렬화해 넣으므로, 연락처 컬럼을 그대로 두면 페이지 소스에서 그대로 읽힌다.
         * 같은 페이지에 답이 남아 있으면 본인 확인이 무의미하다.
         */
        contract: serializeContract({
          ...rest,
          content: maskIdentityDigitsInContent(contract.content, contract.customerPhone),
          customerPhone: maskIdentityDigits(contract.customerPhone),
          signToken: contract.signToken,
        }),
        clauses: contractClauses.map(serializeClause),
        attachments: contractAttachments.map(serializeAttachment),
        rulesContent: resolveRulesContent(contractAttachments),
      },
    };
  } catch (error: unknown) {
    console.error('[contracts/[id]/sign] Failed to load contract:', error);
    return { props: { ...empty, error: '계약서를 불러오는 중 오류가 발생했습니다.' } };
  }
};

const Notice = ({ title, description }: { title: string; description: string }) => (
  <div className="min-h-screen bg-gray-50 dark:bg-gray-50 flex items-center justify-center px-4">
    <div className="bg-white dark:bg-white rounded-2xl shadow-sm p-8 max-w-md w-full text-center">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-900 mb-3">{title}</h1>
      <p className="text-gray-600 dark:text-gray-600 leading-relaxed">{description}</p>
      <p className="text-sm text-gray-400 dark:text-gray-400 mt-6">
        문의: 스튜디오 놀 010-4255-7893
      </p>
    </div>
  </div>
);

export default function ContractSignPage({
  locale,
  token,
  contract,
  clauses,
  attachments,
  rulesContent,
  unavailable,
  error,
}: SignPageProps) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const pointCountRef = useRef(0);

  const [hasSigned, setHasSigned] = useState(false);
  const [identityDigits, setIdentityDigits] = useState('');
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [agreements, setAgreements] = useState<Record<string, boolean>>({});
  const [showRules, setShowRules] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const allAgreed =
    contract !== null &&
    clauses.every((clause) => agreements[clause.id]) &&
    attachments.every((attachment) => agreements[attachment.id]);

  const identityReady = identityDigits.length === IDENTITY_DIGITS && identityConfirmed;

  /**
   * 캔버스 해상도를 화면에 보이는 크기에 맞춘다.
   *
   * 내부 해상도를 고정해 두고 CSS로 늘리면 가로세로 비율이 어긋난다. 좌표를 축별로
   * 따로 보정하면 찍히는 위치는 맞지만 획 자체가 늘어나, 모바일에서는 서명이 가로로
   * 두 배가량 늘어난 채 저장된다. 서명은 필적이라 형태가 달라지면 안 된다.
   *
   * 표시 크기 × devicePixelRatio로 잡고 컨텍스트를 같은 배율로 확대하면, 비율은
   * 그대로면서 고해상도 화면에서도 선이 또렷하다. 이후 그리기 좌표는 CSS 픽셀이다.
   */
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 해상도를 바꾸면 컨텍스트 상태가 초기화되므로 매번 다시 지정한다.
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';

    pointCountRef.current = 0;
    setHasSigned(false);
  }, []);

  useEffect(() => {
    setupCanvas();

    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;

    // 화면을 회전하면 표시 크기가 바뀐다. 그대로 두면 그 순간부터 다시 비율이 어긋나므로
    // 캔버스를 다시 잡는다(그리던 내용은 지워지고 사용자가 다시 서명한다).
    let lastWidth = canvas.getBoundingClientRect().width;
    const observer = new ResizeObserver(() => {
      const width = canvas.getBoundingClientRect().width;
      if (Math.abs(width - lastWidth) < 1) return;
      lastWidth = width;
      setupCanvas();
    });

    observer.observe(canvas);
    return () => observer.disconnect();
  }, [setupCanvas, contract]);

  /** 컨텍스트가 dpr 배율로 확대돼 있으므로 좌표는 CSS 픽셀 그대로 쓴다. */
  const getCoordinates = (
    event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const point = 'touches' in event ? event.touches[0] ?? event.changedTouches[0] : event;

    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  };

  const startDrawing = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;

      const { x, y } = getCoordinates(event);
      ctx.beginPath();
      ctx.moveTo(x, y);
      drawingRef.current = true;
    },
    [],
  );

  const draw = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      if (!drawingRef.current) return;

      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;

      const { x, y } = getCoordinates(event);
      ctx.lineTo(x, y);
      ctx.stroke();

      pointCountRef.current += 1;
      if (pointCountRef.current >= MIN_STROKE_POINTS && !hasSigned) {
        setHasSigned(true);
      }
    },
    [hasSigned],
  );

  const stopDrawing = useCallback(() => {
    drawingRef.current = false;
  }, []);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // 컨텍스트가 dpr 배율로 확대돼 있어 CSS 픽셀 기준으로 지운다.
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    pointCountRef.current = 0;
    setHasSigned(false);
  };

  const handleSubmit = async () => {
    if (!contract) return;
    if (!allAgreed) {
      setSubmitError('모든 동의 항목을 확인해 주세요.');
      return;
    }
    if (!identityReady) {
      setSubmitError(
        identityDigits.length !== IDENTITY_DIGITS
          ? `연락처 뒤 ${IDENTITY_DIGITS}자리를 입력해 주세요.`
          : '본인 확인 및 전자서명 방식 동의에 체크해 주세요.',
      );
      return;
    }
    if (!hasSigned) {
      setSubmitError('서명을 완료해 주세요.');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch(`/api/contracts/${contract.id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          signatureData: canvas.toDataURL('image/png'),
          agreements: [...clauses.map((c) => c.id), ...attachments.map((a) => a.id)],
          identityDigits,
          identityConfirmed,
        }),
      });

      const result = await response.json().catch(() => ({}));

      /**
       * 이미 서명이 끝난 계약이면 오류가 아니다.
       *
       * 응답을 받기 전에 연결이 끊기면 화면에는 실패로 보이는데 서버에서는 서명이 확정된
       * 상태가 된다. 고객이 버튼을 다시 누르면 "서명완료 상태의 계약은 서명할 수 없습니다"
       * 같은 관리자용 문구를 보게 되고, 정작 자기 계약서를 받을 길은 화면에 없다.
       * 결과가 이미 서명 완료라면 완료 화면으로 보내는 것이 사실에 맞다.
       */
      if (response.status === 409 && result.status === 'signed') {
        await router.push(
          `/${locale}/contracts/${contract.id}/complete?token=${encodeURIComponent(token)}`,
        );
        return;
      }

      if (!response.ok || !result.ok) {
        throw new Error(result.message || '서명 제출에 실패했습니다.');
      }

      await router.push(
        `/${locale}/contracts/${contract.id}/complete?token=${encodeURIComponent(token)}`,
      );
    } catch (err: unknown) {
      /**
       * 네트워크가 끊긴 경우 브라우저는 "Failed to fetch"(사파리는 "Load failed")를 준다.
       * 그 말을 그대로 보여 주면 고객은 무엇을 해야 할지 알 수 없고, 서명이 접수됐는지조차
       * 모른다. 실제로 접수된 경우가 있으므로 다시 눌러 보라고 안내한다.
       */
      const isNetworkError = err instanceof TypeError;
      setSubmitError(
        isNetworkError
          ? '제출 결과를 확인하지 못했습니다. 연결을 확인한 뒤 아래 버튼을 다시 눌러 주세요. 이미 접수되었다면 완료 화면으로 이동합니다.'
          : err instanceof Error
            ? err.message
            : '서명 제출 중 오류가 발생했습니다.',
      );
      setSubmitting(false);
    }
  };

  if (unavailable === 'expired') {
    return (
      <>
        <Head>
          <title>서명 링크 만료 | Studio NOL</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <Notice
          title="서명 링크가 만료되었습니다"
          description="보안을 위해 서명 링크는 일정 기간이 지나면 사용할 수 없습니다. 운영자에게 재발송을 요청해 주세요."
        />
      </>
    );
  }

  if (unavailable === 'cancelled') {
    return (
      <>
        <Head>
          <title>취소된 계약 | Studio NOL</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <Notice
          title="취소된 계약입니다"
          description="이 계약은 운영자가 취소했습니다. 내용이 맞지 않는다면 스튜디오로 문의해 주세요."
        />
      </>
    );
  }

  if (error || !contract) {
    return (
      <>
        <Head>
          <title>계약서를 찾을 수 없습니다 | Studio NOL</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <Notice
          title="계약서를 찾을 수 없습니다"
          description={error || '잘못된 링크입니다. 메일에 포함된 링크를 다시 확인해 주세요.'}
        />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{contract.title} — 서명 요청 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
        {/* URL에 서명 토큰이 들어 있다. 계약 본문·이용수칙은 사람이 고치는 마크다운이라
            나중에 외부 링크가 들어가면 Referer로 토큰이 조용히 샌다. 미리 막는다. */}
        <meta name="referrer" content="no-referrer" />
      </Head>

      <main className="min-h-screen bg-gray-50 dark:bg-gray-50 py-8 md:py-12">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-white dark:bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="bg-primary p-6 md:p-8">
              <h1 className="text-2xl md:text-3xl font-bold text-white dark:text-white">음악연습실 이용계약서</h1>
              <p className="text-white dark:text-white/80 mt-2">
                {contract.customerName}님, 아래 내용을 확인하고 서명해 주세요.
              </p>
            </div>

            <div className="p-6 md:p-10">
              <ContractContent content={contract.content} />

              {rulesContent && (
                <div className="mt-8 border border-gray-200 dark:border-gray-200 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowRules((prev) => !prev)}
                    className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 dark:bg-gray-50 hover:bg-gray-100 text-left"
                  >
                    <span className="font-medium text-gray-900 dark:text-gray-900">
                      첨부 「공동생활 이용수칙」 {showRules ? '접기' : '펼쳐 보기'}
                    </span>
                    <span className="text-gray-400 dark:text-gray-400">{showRules ? '−' : '+'}</span>
                  </button>
                  {showRules && (
                    <div className="px-5 py-4 prose prose-sm max-w-none prose-headings:font-bold">
                      <Markdown>{rulesContent}</Markdown>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-10 border-t border-gray-200 dark:border-gray-200 pt-8">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 mb-4">필수 동의</h2>

                <div className="space-y-3">
                  {clauses.map((clause) => (
                    <label
                      key={clause.id}
                      className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100"
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-5 w-5 rounded border-gray-300 dark:border-gray-300 text-primary focus:ring-primary"
                        checked={agreements[clause.id] || false}
                        onChange={(e) =>
                          setAgreements((prev) => ({ ...prev, [clause.id]: e.target.checked }))
                        }
                      />
                      <span className="text-gray-700 dark:text-gray-700">
                        <span className="font-semibold">{clause.clauseNumber}</span> {clause.title}
                        에 동의합니다.
                      </span>
                    </label>
                  ))}

                  {attachments.map((attachment) => (
                    <label
                      key={attachment.id}
                      className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100"
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-5 w-5 rounded border-gray-300 dark:border-gray-300 text-primary focus:ring-primary"
                        checked={agreements[attachment.id] || false}
                        onChange={(e) =>
                          setAgreements((prev) => ({ ...prev, [attachment.id]: e.target.checked }))
                        }
                      />
                      <span className="text-gray-700 dark:text-gray-700">
                        「{attachment.title}」을 읽고 동의합니다.
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-10 border-t border-gray-200 dark:border-gray-200 pt-8">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 mb-2">본인 확인</h2>
                <p className="text-sm text-gray-600 dark:text-gray-600 mb-4">
                  계약 체결 시 등록하신 연락처의 뒤 {IDENTITY_DIGITS}자리를 입력해 주세요.
                  <span className="block mt-1 text-gray-500 dark:text-gray-500">
                    본인 확인을 위해 위 계약서에서는 이 자리를 가려 두었습니다. 서명이 끝난
                    계약서에는 전체 번호가 기재됩니다.
                  </span>
                </p>

                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={IDENTITY_DIGITS}
                  value={identityDigits}
                  onChange={(e) =>
                    setIdentityDigits(e.target.value.replace(/\D/g, '').slice(0, IDENTITY_DIGITS))
                  }
                  placeholder={'0'.repeat(IDENTITY_DIGITS)}
                  aria-label={`연락처 뒤 ${IDENTITY_DIGITS}자리`}
                  /* 배경·글자색을 명시한다. globals.css의 `color-scheme: light dark` 때문에
                     OS가 다크 모드면 브라우저가 입력칸을 제멋대로 어둡게 칠하고, 글자색은
                     상속을 따라가 입력한 네 자리가 보이지 않는 조합이 만들어진다. */
                  className="w-32 text-center tracking-[0.4em] text-lg rounded-xl border border-gray-300 dark:border-gray-300 bg-white dark:bg-white text-gray-900 dark:text-gray-900 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary [color-scheme:light]"
                />

                <label className="mt-5 flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100">
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 rounded border-gray-300 dark:border-gray-300 text-primary focus:ring-primary"
                    checked={identityConfirmed}
                    onChange={(e) => setIdentityConfirmed(e.target.checked)}
                  />
                  <span className="text-gray-700 dark:text-gray-700">
                    본인이 계약 당사자임을 확인하며, 위 계약 내용을 모두 읽고 이해했습니다.
                    아래 <strong>전자서명</strong>이 자필 서명과 같은 효력을 가지는 데 동의합니다.
                  </span>
                </label>
              </div>

              <div className="mt-10 border-t border-gray-200 dark:border-gray-200 pt-8">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 mb-2">전자서명</h2>
                <p className="text-sm text-gray-600 dark:text-gray-600 mb-4">
                  아래 영역에 마우스나 손가락으로 서명해 주세요.
                </p>

                <div className="border-2 border-dashed border-gray-300 dark:border-gray-300 rounded-xl overflow-hidden bg-white dark:bg-white">
                  {/* 해상도는 마운트 후 표시 크기에 맞춰 잡는다(setupCanvas). 여기서
                      width/height를 고정하면 화면 비율과 어긋나 서명이 늘어난다. */}
                  <canvas
                    ref={canvasRef}
                    className="block w-full h-[180px] md:h-[200px] touch-none cursor-crosshair"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                </div>

                <button
                  type="button"
                  onClick={clearSignature}
                  className="mt-3 text-sm text-gray-500 dark:text-gray-500 hover:text-gray-700 underline"
                >
                  서명 지우기
                </button>
              </div>

              {submitError && (
                <div className="mt-6 p-4 bg-red-50 dark:bg-red-50 text-red-700 dark:text-red-700 rounded-xl text-sm">
                  {submitError}
                </div>
              )}

              <div className="mt-8">
                <Button
                  size="lg"
                  fullWidth
                  disabled={submitting || !allAgreed || !identityReady || !hasSigned}
                  onClick={handleSubmit}
                >
                  {submitting ? '처리 중...' : '계약서 서명 완료'}
                </Button>
                {!submitting && (!allAgreed || !identityReady || !hasSigned) && (
                  <p className="mt-3 text-center text-sm text-gray-500 dark:text-gray-500">
                    {!allAgreed
                      ? '모든 동의 항목에 체크해 주세요.'
                      : !identityReady
                        ? '본인 확인을 완료해 주세요.'
                        : '서명을 입력해 주세요.'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
