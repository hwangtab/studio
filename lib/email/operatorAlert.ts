import { buildEmailLayout, escapeHtml, type EmailLayoutRow } from './layout';

/**
 * 크론·점검이 운영자에게 보내는 알림 메일의 공용 HTML 골격.
 *
 * 모양은 늘 같다: 무슨 크론이 → 언제 → 몇 건/무슨 사유로 → 어디서 보면 되는지.
 * `text` 본문은 호출부가 그대로 두고, 이 함수는 같은 내용을 레이아웃에 입힌 `html`만 만든다.
 */

/** Vercel 로그 화면. 프로젝트 경로를 확인할 수 없어 프로젝트 첫 화면으로 보낸다. */
export const VERCEL_PROJECT_URL = 'https://vercel.com/hwang-khs-projects/studio';

export const formatKst = (date: Date): string =>
  `${new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)} (KST)`;

/** 줄바꿈을 살려 escape한다. 외부·DB에서 온 사유 원문에 쓴다. */
export const escapeMultiline = (text: string): string => escapeHtml(text).replace(/\r?\n/g, '<br />');

export interface OperatorAlertInput {
  /** 본문 맨 위 제목 — 무슨 크론이 왜 실패했는지 */
  title: string;
  /** 크론 이름(예: `cron/billing-charge`) */
  cron: string;
  /** 앞에 오는 설명 문단(평문 — 이 함수가 escape) */
  summary?: string;
  /** 크론 이름·시각 뒤에 붙는 핵심 값(건수 등) */
  rows?: EmailLayoutRow[];
  /** 사유 원문(평문 — 이 함수가 escape). 붉은 블록으로 보인다. */
  reason?: string;
  /** 사유 뒤에 붙는 안내(평문, 각 항목이 한 줄) */
  hints?: string[];
  /** 긴 평문 본문(리포트 등). 줄바꿈을 보존한 블록으로 보인다. */
  preformatted?: string;
  /** alert(기본): 실패 알림, info: 정기 리포트 */
  tone?: 'alert' | 'info';
  ctaLabel?: string;
  ctaUrl?: string;
  now?: Date;
}

export const buildOperatorAlertHtml = (input: OperatorAlertInput): string => {
  const tone = input.tone ?? 'alert';
  const notices: string[] = [];
  if (input.reason) notices.push(escapeMultiline(input.reason));
  for (const hint of input.hints ?? []) notices.push(escapeMultiline(hint));

  const paragraphs: string[] = [];
  if (input.summary) paragraphs.push(escapeMultiline(input.summary));
  if (input.preformatted) {
    paragraphs.push(
      `<span style="display: block; padding: 14px 16px; background-color: #f9f9fb; border: 1px solid #e5e5e5; border-radius: 8px; font-family: Menlo, Consolas, monospace; font-size: 12px; line-height: 1.6; white-space: pre-wrap; word-break: break-word;">${escapeHtml(input.preformatted)}</span>`,
    );
  }

  return buildEmailLayout({
    audience: 'operator',
    preheader: input.title,
    heading: input.title,
    paragraphs,
    rows: [
      { label: '크론', value: input.cron },
      { label: '시각', value: formatKst(input.now ?? new Date()) },
      ...(input.rows ?? []),
    ],
    cta: { label: input.ctaLabel ?? 'Vercel 로그 보기', url: input.ctaUrl ?? VERCEL_PROJECT_URL },
    notices,
    noticeTone: tone,
  });
};
