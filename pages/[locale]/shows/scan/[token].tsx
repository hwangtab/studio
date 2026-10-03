/* eslint-disable @next/next/no-html-link-for-pages --
 * private 페이지(URL에 스캔 링크 토큰이 실린다)의 이탈 링크는 문서 이동이어야 한다.
 * 근거: lib/analytics/privatePaths.ts, tests/pages/privateLinkNavigation.test.ts
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Head from 'next/head';

import { getDb } from '../../../../db/client';
import { Button } from '../../../../components/ui/Button';
import { denyContractPageCaching } from '../../../../lib/contracts/page-cache';
import { withI18nServerProps } from '../../../../lib/getStatic';
import { formatShowtimeLabel } from '../../../../lib/shows/format';
import { resolveScanAccess } from '../../../../lib/shows/scanAccess';

interface ScanPageProps {
  /** URL에 있던 토큰을 체크인 API 호출에 그대로 재사용한다(다른 값은 내려보내지 않는다). */
  token: string;
  showTitle: string;
  showtimeLabel: string;
  linkLabel: string;
}

/**
 * 스캔 링크 인증은 토큰이 전부다 — 없거나 만료·폐기면 notFound(구분해 알려 주지 않는다).
 * 로케일은 ko만 쓴다(운영 화면). 캐시는 막는다: next.config.mjs의 로케일 공유 캐시 규칙이 이 경로도 덮는다.
 */
export const getServerSideProps = withI18nServerProps<ScanPageProps>(async (context) => {
  denyContractPageCaching(context.res);
  const { locale, token } = context.params as { locale: string; token: string };
  if (locale !== 'ko') return { notFound: true };
  const access = await resolveScanAccess(token);
  if (!access) return { notFound: true };
  const showtime = await getDb().query.showtimes.findFirst({
    where: (s, { eq }) => eq(s.id, access.showtimeId),
    with: { show: true },
  });
  if (!showtime) return { notFound: true };
  return {
    props: {
      token,
      showTitle: showtime.show.title,
      showtimeLabel: formatShowtimeLabel(showtime.startsAt),
      linkLabel: access.label,
    },
  };
});

type Outcome =
  | { kind: 'ok'; entryNumber: string | null; code: string }
  | { kind: 'dup' }
  | { kind: 'invalid' }
  | { kind: 'wrong' }
  | { kind: 'error'; message: string }
  | null;

interface Counts { issued: number; checkedIn: number }

const SCAN_COOLDOWN_MS = 3000;

type BarcodeDetectorLike = { detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>> };
type BarcodeDetectorCtor = new (opts: { formats: string[] }) => BarcodeDetectorLike;

export default function ShowScanPage({ token, showTitle, showtimeLabel, linkLabel }: ScanPageProps) {
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [canScan, setCanScan] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastScan = useRef<{ code: string; at: number } | null>(null);
  const lastOk = useRef<string | null>(null);

  useEffect(() => {
    setCanScan(typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia);
  }, []);

  const submit = useCallback(
    async (raw: string, action?: 'undo') => {
      setBusy(true);
      try {
        const r = await fetch('/api/shows/checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, code: raw, action }),
        });
        if (r.status === 401) {
          setOutcome({ kind: 'error', message: '스캔 링크가 만료됐거나 폐기됐습니다. 관리자에게 새 링크를 요청하세요.' });
          return;
        }
        const j = await r.json();
        if (j.counts) setCounts(j.counts);
        switch (j.status) {
          case 'checked_in':
            lastOk.current = raw;
            setOutcome({ kind: 'ok', entryNumber: j.entryNumber ?? null, code: raw });
            break;
          case 'already_checked_in': setOutcome({ kind: 'dup' }); break;
          case 'wrong_showtime': setOutcome({ kind: 'wrong' }); break;
          case 'undone': setOutcome(null); break;
          case 'undo_rejected': setOutcome({ kind: 'error', message: '입장 취소는 직접 스캔한 뒤 2분 안에만 할 수 있습니다.' }); break;
          default: setOutcome({ kind: 'invalid' });
        }
      } catch {
        setOutcome({ kind: 'error', message: '네트워크 오류 — 다시 시도해 주세요.' });
      } finally {
        setBusy(false);
      }
    },
    [token],
  );

  // 카메라 스캔 — BarcodeDetector가 있는 브라우저에서만. 같은 코드는 SCAN_COOLDOWN_MS 동안 다시 보내지 않는다.
  useEffect(() => {
    if (!cameraOn) return;
    let stream: MediaStream | null = null;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      try {
        const Detector = (window as unknown as { BarcodeDetector: BarcodeDetectorCtor }).BarcodeDetector;
        const detector = new Detector({ formats: ['qr_code'] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        const video = videoRef.current;
        if (!video || stopped) return;
        video.srcObject = stream;
        await video.play();
        const tick = async () => {
          if (stopped) return;
          try {
            const found = await detector.detect(video);
            const value = found[0]?.rawValue;
            const now = Date.now();
            if (value && !(lastScan.current && lastScan.current.code === value && now - lastScan.current.at < SCAN_COOLDOWN_MS)) {
              lastScan.current = { code: value, at: now };
              await submit(value);
            }
          } catch {
            /* 프레임 하나 실패는 다음 프레임에서 다시 */
          }
          timer = setTimeout(tick, 250);
        };
        tick();
      } catch {
        setCameraError('카메라를 열 수 없습니다. 권한을 확인하거나 아래에 코드를 직접 입력하세요.');
        setCameraOn(false);
      }
    })();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [cameraOn, submit]);

  const panel =
    outcome?.kind === 'ok' ? { cls: 'bg-green-600 text-white', title: '입장 확인', sub: outcome.entryNumber ? `입장 번호 ${outcome.entryNumber}` : '입장 번호 없음' }
    : outcome?.kind === 'dup' ? { cls: 'bg-amber-500 text-gray-900', title: '이미 입장한 티켓', sub: '다시 입장시키지 마세요' }
    : outcome?.kind === 'wrong' ? { cls: 'bg-red-700 text-white', title: '다른 회차 티켓', sub: '이 회차의 티켓이 아닙니다' }
    : outcome?.kind === 'invalid' ? { cls: 'bg-red-700 text-white', title: '유효하지 않은 티켓', sub: '환불·취소됐거나 없는 코드입니다' }
    : outcome?.kind === 'error' ? { cls: 'bg-gray-800 text-white', title: '확인 실패', sub: outcome.message }
    : null;

  return (
    <>
      <Head>
        <title>입장 확인 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className="min-h-screen bg-gray-100 text-gray-900 px-4 py-6">
        <div className="mx-auto max-w-md space-y-4">
          <header>
            <p className="text-sm text-gray-600">스튜디오 놀</p>
            <p className="text-sm text-gray-600">{showtimeLabel} · 담당 {linkLabel || '-'}</p>
            <h1 className="text-xl font-bold text-gray-900">{showTitle} 입장 확인</h1>
            {counts && <p className="mt-1 text-sm text-gray-700" aria-live="polite">입장 {counts.checkedIn} / 발권 {counts.issued}</p>}
          </header>

          {canScan && (
            <section className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
              {cameraOn ? (
                <>
                  <video ref={videoRef} playsInline muted className="w-full rounded-xl bg-black aspect-square object-cover" />
                  <Button light variant="outline" fullWidth onClick={() => setCameraOn(false)}>카메라 끄기</Button>
                </>
              ) : (
                <Button light fullWidth onClick={() => { setCameraError(null); setCameraOn(true); }}>QR 스캔 시작</Button>
              )}
              {cameraError && <p role="alert" className="text-sm text-red-700">{cameraError}</p>}
            </section>
          )}
          {!canScan && (
            <p className="text-sm text-gray-700 bg-white rounded-2xl shadow-sm p-4">
              이 브라우저는 카메라 QR 스캔을 지원하지 않습니다. 티켓의 코드(예: SNT1:XXXXXXXXXXXXXXXX)를 아래에 입력해 주세요.
            </p>
          )}

          <form
            className="bg-white rounded-2xl shadow-sm p-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (manual.trim()) submit(manual).then(() => setManual(''));
            }}
          >
            <label htmlFor="manual-code" className="block text-sm font-medium text-gray-800">코드 직접 입력</label>
            <input
              id="manual-code"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              placeholder="SNT1:…"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-base text-gray-900 placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            />
            <Button light type="submit" fullWidth disabled={busy || !manual.trim()}>확인</Button>
          </form>

          {panel && (
            <section role="status" aria-live="assertive" className={`rounded-2xl p-6 text-center ${panel.cls}`}>
              <p className="text-2xl font-extrabold">{panel.title}</p>
              <p className="mt-1 text-lg">{panel.sub}</p>
              {outcome?.kind === 'ok' && (
                <button
                  type="button"
                  className="mt-4 underline text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  onClick={() => lastOk.current && submit(lastOk.current, 'undo')}
                >
                  방금 입장 취소
                </button>
              )}
            </section>
          )}

          {/* 이탈 링크는 문서 이동 + noreferrer — URL에 스캔 토큰이 실린다(lib/analytics/privatePaths.ts). */}
          <p className="pt-2 text-center text-sm text-gray-600">
            <a href="/ko" rel="noreferrer" className="underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-100">홈으로</a>
          </p>
        </div>
      </main>
    </>
  );
}
