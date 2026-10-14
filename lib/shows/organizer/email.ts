import { eq } from 'drizzle-orm';

import { getDb } from '../../../db/client';
import { fundingCreators, showSubmissions, shows } from '../../../db/schema';
import { adminUrl, buildEmailLayout, escapeHtml, strong, type EmailLayoutInput } from '../../email/layout';
import { sendEmail } from '../../email/resend';
import { SITE_URL } from '../../funding/email';
import { CUSTOMER_REPLY_TO, OPERATOR_EMAIL } from '../../operatorContact';

import { parseDraft, type ShowSubmissionDraft } from './draft';

/**
 * 주최자 공연 알림 메일. 발송 실패는 던진다 — 호출부(submissions.ts·review.ts)가 잡아서
 * warnings로 돌려준다(저장·판정은 메일 때문에 실패하지 않는다).
 */

export type ShowReviewResult = 'approved' | 'changes_requested' | 'rejected';

export interface ShowMailContext {
  submissionId: string;
  draft: ShowSubmissionDraft;
  reviewNote: string | null;
  creatorName: string;
  creatorEmail: string;
  slug: string | null;
}

export interface BuiltMail {
  subject: string;
  text: string;
  html: string;
}

const editUrl = (id: string): string => `${SITE_URL}/ko/funding/creator/shows/${id}`;
const publicUrl = (slug: string): string => `${SITE_URL}/ko/shows/${slug}`;
const adminSubmissionUrl = (id: string): string => adminUrl(`/admin/shows/submissions/${id}`);

const won = (n: number | null): string => (n === null ? '미정' : `${n.toLocaleString('ko-KR')}원`);

/** 'YYYY-MM-DDTHH:mm'(KST 벽시계) → '10/21(수) 19:00' 형태. 형식이 어긋나면 원문 그대로. */
export const formatShowtime = (wall: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(wall);
  if (!m) return wall;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const dow = ['일', '월', '화', '수', '목', '금', '토'][d.getUTCDay()];
  return `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일(${dow}) ${m[4]}:${m[5]}`;
};

const ticketSummary = (draft: ShowSubmissionDraft): string =>
  draft.ticketTypes.map((t) => `${t.name || '이름 없음'} ${won(t.price)}`).join(' / ');

const titleOf = (draft: ShowSubmissionDraft): string => draft.title.trim() || '(제목 없음)';

const noteParagraph = (note: string | null): string =>
  `${strong('운영자 메모')}<br />${escapeHtml(note ?? '').replace(/\n/g, '<br />')}`;

const contactText = `문의: ${CUSTOMER_REPLY_TO}`;

export function buildOperatorMail(kind: 'submitted' | 'edited', ctx: ShowMailContext): BuiltMail {
  const { draft } = ctx;
  const title = titleOf(draft);
  // 입력 순서는 날짜순이 아니다 — 정렬한 사본에서 가장 이른 회차를 고른다('YYYY-MM-DDTHH:MM'라 문자열 순서가 곧 시간 순서).
  const firstShowtime = draft.showtimes.filter(Boolean).sort()[0];
  const heading = kind === 'submitted' ? '새 공연 신청이 들어왔어요' : '공개된 공연이 수정됐어요';
  const lead =
    kind === 'submitted'
      ? '주최자가 공연을 제출했어요. 심사해 주세요.'
      : '주최자가 공개된 공연의 내용을 고쳤어요. 심사를 거치지 않는 경로예요.';
  const rowsData: Array<[string, string]> = [
    ['제목', title],
    ['주최', draft.presenterName],
    ['첫 회차', firstShowtime ? formatShowtime(firstShowtime) : '미정'],
    ['정원', draft.capacity === null ? '미정' : `${draft.capacity}명`],
    ['티켓', ticketSummary(draft)],
  ];
  const link = adminSubmissionUrl(ctx.submissionId);
  const subject = `[공연] ${kind === 'submitted' ? '새 공연 신청' : '공개된 공연 수정'} — ${title}`;
  return {
    subject,
    text: [lead, '', ...rowsData.map(([k, v]) => `${k}: ${v}`), `주최자: ${ctx.creatorName} <${ctx.creatorEmail}>`, '', `관리자 심사 화면: ${link}`].join('\n'),
    html: buildEmailLayout({
      audience: 'operator',
      preheader: `${ctx.creatorName} · ${title}`,
      heading,
      paragraphs: [escapeHtml(lead)],
      rows: [
        ...rowsData.map(([label, value]) => ({ label, value })),
        { label: '주최자', value: ctx.creatorName },
        { label: '주최자 이메일', value: ctx.creatorEmail, href: `mailto:${ctx.creatorEmail}` },
      ],
      cta: { label: '심사 화면 열기', url: link },
    }),
  };
}

const REVIEW_SUBJECT: Record<ShowReviewResult, string> = {
  approved: '공연이 승인됐어요',
  changes_requested: '공연 신청 보완 요청',
  rejected: '공연 신청 심사 결과',
};

export function buildReviewMail(result: ShowReviewResult, ctx: ShowMailContext): BuiltMail {
  const title = titleOf(ctx.draft);
  const heading = REVIEW_SUBJECT[result];
  const greeting = `${escapeHtml(ctx.creatorName)}님,`;
  const row = { label: '공연', value: title };
  let paragraphs: string[];
  let cta: EmailLayoutInput['cta'];
  let textLines: string[];

  if (result === 'approved') {
    const url = ctx.slug ? publicUrl(ctx.slug) : `${SITE_URL}/ko/shows`;
    paragraphs = [greeting, '제출하신 공연이 승인되어 지금 공개됐어요. 예매를 받을 수 있어요.'];
    cta = { label: '공연 페이지 보기', url };
    textLines = ['제출하신 공연이 승인되어 지금 공개됐어요. 예매를 받을 수 있어요.', '', `공연 페이지: ${url}`];
  } else if (result === 'changes_requested') {
    const url = editUrl(ctx.submissionId);
    paragraphs = [greeting, '제출하신 공연에 보완이 필요해요.', noteParagraph(ctx.reviewNote), '편집 화면에서 내용을 고친 뒤 다시 제출해 주세요.'];
    cta = { label: '편집 화면 열기', url };
    textLines = ['제출하신 공연에 보완이 필요해요.', '', '[운영자 메모]', ctx.reviewNote ?? '', '', `편집 화면에서 내용을 고친 뒤 다시 제출해 주세요: ${url}`];
  } else {
    paragraphs = [greeting, '제출하신 공연 심사 결과를 안내드려요. 이번 심사에서는 공개가 어려워요.', noteParagraph(ctx.reviewNote), escapeHtml(contactText)];
    textLines = ['제출하신 공연 심사 결과를 안내드려요. 이번 심사에서는 공개가 어려워요.', '', '[운영자 메모]', ctx.reviewNote ?? '', '', contactText];
  }

  return {
    subject: `[스튜디오 놀] ${heading} — ${title}`,
    text: [`${ctx.creatorName}님,`, '', ...textLines].join('\n'),
    html: buildEmailLayout({ preheader: heading, heading, paragraphs, rows: [row], ...(cta ? { cta } : {}) }),
  };
}

async function loadContext(submissionId: string): Promise<ShowMailContext> {
  const db = getDb();
  const [row] = await db
    .select({
      draftJson: showSubmissions.draftJson,
      reviewNote: showSubmissions.reviewNote,
      creatorName: fundingCreators.name,
      creatorEmail: fundingCreators.email,
      slug: shows.slug,
    })
    .from(showSubmissions)
    .innerJoin(fundingCreators, eq(fundingCreators.id, showSubmissions.creatorId))
    .leftJoin(shows, eq(shows.id, showSubmissions.showId))
    .where(eq(showSubmissions.id, submissionId))
    .limit(1);
  if (!row) throw new Error(`show submission not found: ${submissionId}`);
  return {
    submissionId,
    draft: parseDraft(row.draftJson),
    reviewNote: row.reviewNote,
    creatorName: row.creatorName,
    creatorEmail: row.creatorEmail,
    slug: row.slug ?? null,
  };
}

async function deliver(to: string, mail: BuiltMail, replyTo?: string): Promise<void> {
  const result = await sendEmail({ to, subject: mail.subject, text: mail.text, html: mail.html, ...(replyTo ? { replyTo } : {}) });
  if (!result.ok) throw new Error(`show mail failed: ${result.errorCode ?? 'unknown'}`);
}

export async function notifyOperatorShowSubmitted(submissionId: string): Promise<void> {
  await deliver(OPERATOR_EMAIL, buildOperatorMail('submitted', await loadContext(submissionId)));
}

export async function notifyOperatorShowEdited(submissionId: string): Promise<void> {
  await deliver(OPERATOR_EMAIL, buildOperatorMail('edited', await loadContext(submissionId)));
}

export async function sendShowReviewResultEmail(submissionId: string, result: ShowReviewResult): Promise<void> {
  const ctx = await loadContext(submissionId);
  await deliver(ctx.creatorEmail, buildReviewMail(result, ctx), CUSTOMER_REPLY_TO);
}
