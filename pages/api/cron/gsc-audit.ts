// Vercel Cron — 매주 화요일 04:00 KST (월요일 19:00 UTC) 실행. (schedule: "0 19 * * 1")
// 1. GSC 90일 audit 측정
// 2. Vercel Blob에서 이전 스냅샷 로드 후 diff 계산
// 3. 새 스냅샷을 Vercel Blob latest/history에 저장 (통지 전 저장 = write-then-notify)
// 4. 주 1회 cadence 자체가 필터이므로 dry-run이 아니면 매 실행 이메일 발송
//
// 인증: Vercel Cron이 자동으로 Authorization: Bearer ${CRON_SECRET} 헤더 첨부.
// 환경변수: CRON_SECRET, GSC_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN, GSC_SITE_URL,
//          RESEND_API_KEY, BLOB_READ_WRITE_TOKEN

import type { NextApiRequest, NextApiResponse } from 'next';
import { put, list } from '@vercel/blob';
import { OPERATOR_EMAIL } from '../../../lib/operatorContact';
import { sendEmail } from '../../../lib/email/resend';
import { isCronAuthorized } from '../../../lib/cron/auth';
import { runAudit, type AuditSnapshot } from '../../../lib/seo/gscAudit';
import { diffAudits, formatDiffReport } from '../../../lib/seo/gscDiff';

const BLOB_LATEST_PATH = 'gsc/latest.json';
const BLOB_HISTORY_PREFIX = 'gsc/history/'; // gsc/history/2026-05-13.json
const EMAIL_TO = OPERATOR_EMAIL;

async function loadLatestSnapshot(): Promise<AuditSnapshot | null> {
  // private store: list로 blob URL 확보, BLOB_READ_WRITE_TOKEN으로 fetch 인증
  const { blobs } = await list({ prefix: BLOB_LATEST_PATH, limit: 1 });
  if (blobs.length === 0) return null;
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  const res = await fetch(blobs[0].downloadUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.error('[loadLatestSnapshot] fetch failed', res.status, await res.text().catch(() => ''));
    return null;
  }
  return (await res.json()) as AuditSnapshot;
}

async function saveSnapshot(snapshot: AuditSnapshot): Promise<void> {
  const body = JSON.stringify(snapshot);
  // latest는 매번 동일 경로에 overwrite (addRandomSuffix: false + allowOverwrite)
  await put(BLOB_LATEST_PATH, body, {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  // history는 날짜별 (1개 = 1 day)
  await put(`${BLOB_HISTORY_PREFIX}${snapshot.date}.json`, body, {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}


function getOAuthCreds() {
  const clientId = process.env.GSC_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GSC_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GSC_OAUTH_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('GSC OAuth env vars missing');
  }
  return { clientId, clientSecret, refreshToken };
}

async function sendCronEmail(subject: string, bodyText: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  const result = await sendEmail({ to: EMAIL_TO, subject, text: bodyText });
  if (result.ok) return { ok: true, status: result.status };
  return { ok: false, status: result.status, error: result.errorDetail ?? result.errorCode };
}

// 6+개의 순차 네트워크 호출(GSC API/OAuth·Blob load·save·Resend)을 실행하므로
// Vercel 기본 함수 타임아웃 한도를 넘기지 않도록 상향한다.
export const config = { maxDuration: 60 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Vercel Cron은 GET으로 호출(Authorization: Bearer ${CRON_SECRET} 헤더 첨부).
  // POST는 수동 트리거(curl 등)용으로 함께 허용한다.
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  if (!isCronAuthorized(req, 'cron/gsc-audit')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startedAt = Date.now();

  try {
    // 1. Audit 실행
    const auth = getOAuthCreds();
    const siteUrl = process.env.GSC_SITE_URL || 'sc-domain:studionol.co.kr';
    const currentSnapshot = await runAudit({ siteUrl, windowDays: 90, auth });

    // 2. 이전 스냅샷 로드 (Vercel Blob)
    const previousSnapshot = await loadLatestSnapshot();

    // 3. Diff 계산
    const diff = diffAudits(previousSnapshot, currentSnapshot);

    // 4. Blob 저장 (latest + history by date)
    // write-then-notify: 통지 전에 스냅샷을 먼저 저장한다. 저장이 실패하면 throw되어
    // 아래 catch로 넘어가 이메일을 보내지 않으므로, 다음 실행에서 동일 diff를 재계산·
    // 재시도하게 되어 이미 통지한 변화가 다시 통지되는 불일치가 발생하지 않는다.
    await saveSnapshot(currentSnapshot);

    // 5. 이메일 발송 조건
    // 주 1회 cron이라 cadence 자체가 filter — cron 실행 시 항상 발송 (smart 조건 제거).
    // ?dry=1만 발송 스킵 (테스트용).
    const today = new Date();
    const isMonthlySummary = today.getUTCDate() <= 7; // 매월 첫째 주 월요일 = "월간 종합" 라벨
    const shouldEmail = true; // 주 1회 호출이라 무조건 발송

    const dryRun = req.query.dry === '1';
    let emailResult: { ok: boolean; status?: number; error?: string; skipped?: string } | null = null;
    let reportPreview: { subject: string; body: string } | null = null;

    if (shouldEmail) {
      // 변동 없으면 monthly-style 종합 리포트(전체 분포 + 클러스터 breakdown + Top KEEP)
      const treatAsMonthly = isMonthlySummary || !previousSnapshot || !diff.hasMeaningfulChange;
      const report = formatDiffReport(
        diff,
        currentSnapshot.date,
        treatAsMonthly,
        currentSnapshot,
      );
      if (dryRun) {
        // dry=1: 이메일 호출·전송 안 함, 본문 응답에 포함해 미리보기만
        emailResult = { ok: true, skipped: 'dry-run' };
        reportPreview = report;
      } else {
        emailResult = await sendCronEmail(report.subject, report.body);
      }
    }

    return res.status(200).json({
      ok: true,
      date: currentSnapshot.date,
      durationMs: Date.now() - startedAt,
      pseoSummary: {
        keep: diff.pseo.summary.totalKeep.after,
        watch: diff.pseo.summary.totalWatch.after,
        noindex: diff.pseo.summary.totalNoindex.after,
      },
      diffReasons: diff.reasons,
      isMonthlySummary,
      hadPrevious: Boolean(previousSnapshot),
      emailSent: shouldEmail && !dryRun,
      emailResult,
      ...(reportPreview ? { reportPreview } : {}),
    });
  } catch (err) {
    // 내부 예외 상세(OAuth/Blob/GSC 오류 메시지)는 서버 로그에만 남기고
    // 응답 본문에는 일반 메시지만 반환한다(운영 인프라 정보 노출 방지).
    console.error('[cron/gsc-audit] failed:', err);
    return res.status(500).json({
      ok: false,
      error: 'Internal server error',
      durationMs: Date.now() - startedAt,
    });
  }
}
