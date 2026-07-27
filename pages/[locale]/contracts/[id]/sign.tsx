import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Markdown from 'markdown-to-jsx';

import ContractContent from '../../../../components/contracts/ContractContent';
import { Button } from '../../../../components/ui/Button';
import { db } from '../../../../db/client';
import {
  serializeAttachment,
  serializeClause,
  serializeContract,
  type SerializedAttachment,
  type SerializedClause,
  type SerializedContract,
} from '../../../../lib/contracts/serialize';
import { expireOverdueContracts } from '../../../../lib/contracts/service';
import { getEffectiveStatus } from '../../../../lib/contracts/status';
import { buildRulesContent } from '../../../../lib/contracts/template';

/** 서명 캔버스 내부 해상도. 표시 크기의 2배로 잡아 고해상도 화면에서도 선이 선명하다. */
const CANVAS_WIDTH = 1440;
const CANVAS_HEIGHT = 400;
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

    const contract = await db.query.contracts.findFirst({
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
        contract: serializeContract({ ...rest, signToken: contract.signToken }),
        clauses: contractClauses.map(serializeClause),
        attachments: contractAttachments.map(serializeAttachment),
        rulesContent: buildRulesContent(),
      },
    };
  } catch (error: unknown) {
    console.error('[contracts/[id]/sign] Failed to load contract:', error);
    return { props: { ...empty, error: '계약서를 불러오는 중 오류가 발생했습니다.' } };
  }
};

const Notice = ({ title, description }: { title: string; description: string }) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
    <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full text-center">
      <h1 className="text-xl font-bold text-gray-900 mb-3">{title}</h1>
      <p className="text-gray-600 leading-relaxed">{description}</p>
      <p className="text-sm text-gray-400 mt-6">
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
  const [agreements, setAgreements] = useState<Record<string, boolean>>({});
  const [showRules, setShowRules] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const allAgreed =
    contract !== null &&
    clauses.every((clause) => agreements[clause.id]) &&
    attachments.every((attachment) => agreements[attachment.id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';
  }, [contract]);

  /**
   * 캔버스 내부 해상도와 화면 표시 크기가 다르므로 비율로 보정한다.
   * 보정하지 않으면 모바일에서 손가락 위치와 그려지는 위치가 크게 어긋난다.
   */
  const getCoordinates = (
    event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const point =
      'touches' in event ? event.touches[0] ?? event.changedTouches[0] : event;

    return {
      x: (point.clientX - rect.left) * scaleX,
      y: (point.clientY - rect.top) * scaleY,
    };
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

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pointCountRef.current = 0;
    setHasSigned(false);
  };

  const handleSubmit = async () => {
    if (!contract) return;
    if (!allAgreed) {
      setSubmitError('모든 동의 항목을 확인해 주세요.');
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
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || '서명 제출에 실패했습니다.');
      }

      await router.push(
        `/${locale}/contracts/${contract.id}/complete?token=${encodeURIComponent(token)}`,
      );
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : '서명 제출 중 오류가 발생했습니다.');
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
      </Head>

      <main className="min-h-screen bg-gray-50 py-8 md:py-12">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="bg-primary p-6 md:p-8">
              <h1 className="text-2xl md:text-3xl font-bold text-white">음악연습실 이용계약서</h1>
              <p className="text-white/80 mt-2">
                {contract.customerName}님, 아래 내용을 확인하고 서명해 주세요.
              </p>
            </div>

            <div className="p-6 md:p-10">
              <ContractContent content={contract.content} />

              {rulesContent && (
                <div className="mt-8 border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowRules((prev) => !prev)}
                    className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 text-left"
                  >
                    <span className="font-medium text-gray-900">
                      첨부 「공동생활 이용수칙」 {showRules ? '접기' : '펼쳐 보기'}
                    </span>
                    <span className="text-gray-400">{showRules ? '−' : '+'}</span>
                  </button>
                  {showRules && (
                    <div className="px-5 py-4 prose prose-sm max-w-none prose-headings:font-bold">
                      <Markdown>{rulesContent}</Markdown>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-10 border-t border-gray-200 pt-8">
                <h2 className="text-lg font-bold text-gray-900 mb-4">필수 동의</h2>

                <div className="space-y-3">
                  {clauses.map((clause) => (
                    <label
                      key={clause.id}
                      className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100"
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                        checked={agreements[clause.id] || false}
                        onChange={(e) =>
                          setAgreements((prev) => ({ ...prev, [clause.id]: e.target.checked }))
                        }
                      />
                      <span className="text-gray-700">
                        <span className="font-semibold">{clause.clauseNumber}</span> {clause.title}
                        에 동의합니다.
                      </span>
                    </label>
                  ))}

                  {attachments.map((attachment) => (
                    <label
                      key={attachment.id}
                      className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100"
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                        checked={agreements[attachment.id] || false}
                        onChange={(e) =>
                          setAgreements((prev) => ({ ...prev, [attachment.id]: e.target.checked }))
                        }
                      />
                      <span className="text-gray-700">
                        「{attachment.title}」을 읽고 동의합니다.
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-10 border-t border-gray-200 pt-8">
                <h2 className="text-lg font-bold text-gray-900 mb-2">전자서명</h2>
                <p className="text-sm text-gray-600 mb-4">
                  아래 영역에 마우스나 손가락으로 서명해 주세요.
                </p>

                <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-white">
                  <canvas
                    ref={canvasRef}
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    className="w-full h-[180px] md:h-[200px] touch-none cursor-crosshair"
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
                  className="mt-3 text-sm text-gray-500 hover:text-gray-700 underline"
                >
                  서명 지우기
                </button>
              </div>

              {submitError && (
                <div className="mt-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm">
                  {submitError}
                </div>
              )}

              <div className="mt-8">
                <Button
                  size="lg"
                  fullWidth
                  disabled={submitting || !allAgreed || !hasSigned}
                  onClick={handleSubmit}
                >
                  {submitting ? '처리 중...' : '계약서 서명 완료'}
                </Button>
                {!submitting && (!allAgreed || !hasSigned) && (
                  <p className="mt-3 text-center text-sm text-gray-500">
                    {!allAgreed ? '모든 동의 항목에 체크해 주세요.' : '서명을 입력해 주세요.'}
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
