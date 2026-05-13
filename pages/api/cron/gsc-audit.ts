// Vercel Cron — 매일 04:00 KST (19:00 UTC) 실행.
// 1. GSC 90일 audit 측정
// 2. KV에서 이전 스냅샷 로드 후 diff 계산
// 3. Smart Daily 조건: 의미있는 변동 OR 매월 1일 → 이메일 발송
// 4. 새 스냅샷 KV 저장
//
// 인증: Vercel Cron이 자동으로 Authorization: Bearer ${CRON_SECRET} 헤더 첨부.
// 환경변수: CRON_SECRET, GSC_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN, GSC_SITE_URL,
//          EMAILJS_SERVICE_ID/TEMPLATE_ID/PUBLIC_KEY/PRIVATE_KEY, KV_REST_API_URL/TOKEN

import type { NextApiRequest, NextApiResponse } from 'next';
import { put, list } from '@vercel/blob';
import { runAudit, type AuditSnapshot } from '../../../lib/seo/gscAudit';
import { diffAudits, formatDiffReport } from '../../../lib/seo/gscDiff';

const BLOB_LATEST_PATH = 'gsc/latest.json';
const BLOB_HISTORY_PREFIX = 'gsc/history/'; // gsc/history/2026-05-13.json
const EMAIL_TO = 'hwangtab@gmail.com';
const EMAILJS_ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send';

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

function isAuthorized(req: NextApiRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.authorization;
  return header === `Bearer ${secret}`;
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

async function sendEmail(subject: string, bodyText: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;
  if (!serviceId || !templateId || !publicKey) {
    return { ok: false, error: 'EmailJS env vars missing' };
  }

  // 기존 contact form 템플릿 재사용 — name/email/message 필드에 cron 컨텍스트 매핑.
  const payload: Record<string, unknown> = {
    service_id: serviceId,
    template_id: templateId,
    user_id: publicKey,
    template_params: {
      name: '[Studio NOL SEO Cron]',
      email: EMAIL_TO,
      phone: '-',
      message: `${subject}\n\n${bodyText}`,
    },
  };
  if (privateKey) payload.accessToken = privateKey;

  try {
    const res = await fetch(EMAILJS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, status: res.status, error: errText };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAuthorized(req)) {
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

    // 4. 이메일 발송 조건
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
        // dry=1: EmailJS 호출·전송 안 함, 본문 응답에 포함해 미리보기만
        emailResult = { ok: true, skipped: 'dry-run' };
        reportPreview = report;
      } else {
        emailResult = await sendEmail(report.subject, report.body);
      }
    }

    // 5. Blob 저장 (latest + history by date)
    await saveSnapshot(currentSnapshot);

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
    console.error('[cron/gsc-audit] failed:', err);
    return res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startedAt,
    });
  }
}
