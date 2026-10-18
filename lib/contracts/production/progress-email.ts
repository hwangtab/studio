import type { ProductionContract, ProductionContractEvent } from '../../../db/schema';
import { sendEmail } from '../../email/resend';
import { OPERATOR_EMAIL } from '../../operatorContact';
import type { SendContractEmailResult } from '../email';
import { buildContractEmailHtml, type ContractEmailRow } from '../email-template';
import { formatCurrency, formatDate } from '../format';
import { escapeHtml } from '../html-escape';
import { STAGE_LABEL, type ProductionStage } from './event-spec';
import { deemedBaseDay, findStage, kstDayStart, parseEventData, songOf, type ProductionLedger, type Todo } from './ledger';
import { productionAdminUrl } from './links';
import { REVISION_STAGES, songLabel, type ProductionTerms, type RevisionStage } from './terms';

/**
 * 진행 통지 메일. 기록 하나에 메일 하나다 — 이 메일이 나갔다는 사실(notice_status = sent)이 "언제 알렸는가"의
 * 증거가 된다. 특히 결과물 전달 메일은 제5조 5항(기간 경과 시 승인 간주)의 문장과 그 기한을 반드시 담는다.
 * 의뢰인이 그 사실을 알 수 있었는지가 간주 승인의 효력을 가르기 때문이다(progress-email.test.ts가 고정한다).
 *
 * 문체는 해요체(고객 화면 규칙). 모든 값은 escape한다 — 메모·링크는 운영자 입력이다.
 */

interface NoticeContent {
  subject: string;
  heading: string;
  paragraphs: string[];
  rows?: ContractEmailRow[];
  notices?: string[];
  ctaLabel: string;
}

const isRevisionStage = (stage: string | null): stage is RevisionStage =>
  stage !== null && (REVISION_STAGES as readonly string[]).includes(stage);

/** 단계 이름 — 여러 곡 계약에서 곡마다 일어나는 단계면 곡 이름을 붙인다("2번 곡 「제목」 믹싱"). */
const stageName = (terms: Pick<ProductionTerms, 'songs'>, stage: string | null, song: number | null = null) => {
  if (!stage) return '';
  const label = STAGE_LABEL[stage as ProductionStage] ?? stage;
  return terms.songs.length > 1 && stage !== 'mastering' ? `${songLabel(terms, song ?? 0)} ${label}` : label;
};
const won = (amount: number) => `${formatCurrency(amount)}원`;

const buildContent = (
  contract: ProductionContract,
  terms: ProductionTerms,
  event: ProductionContractEvent,
  ledger: ProductionLedger,
  now: Date = new Date(),
): NoticeContent | null => {
  const data = parseEventData(event);
  /** 이 기록이 그 (단계, 곡)의 몇 번째 효력 있는 같은 종류 기록인가 — 통지를 나중에 다시 보내도 그때의 차수다. */
  const ordinal = () =>
    ledger.events
      .filter((e) => e.type === event.type && e.stage === event.stage && (event.stage === 'mastering' || songOf(e) === songOf(event)))
      .findIndex((e) => e.id === event.id) + 1;
  const name = escapeHtml(contract.clientName);
  const noteRow: ContractEmailRow[] = data.note ? [{ label: '메모', value: data.note }] : [];
  const linkRow: ContractEmailRow[] = data.link ? [{ label: '파일', value: data.link, href: data.link }] : [];
  const { payments, work } = ledger;
  const remaining = Math.max(0, payments.totalDue - payments.received);

  switch (event.type) {
    case 'payment_received':
      return {
        subject: '입금을 확인했어요',
        heading: '입금을 확인했어요',
        paragraphs: [`${name}님, 보내 주신 금액을 확인했어요.`],
        rows: [
          { label: '이번 입금', value: won(event.amount ?? 0), emphasis: true },
          { label: '받은 금액 합계', value: won(payments.received) },
          { label: '남은 금액', value: won(remaining) },
        ],
        ctaLabel: '작업 진행 보기',
      };
    case 'source_received':
    case 'source_replaced':
      return {
        subject: event.type === 'source_received' ? '1차 완성본을 받았어요' : '1차 완성본 교체를 기록했어요',
        heading: event.type === 'source_received' ? '1차 완성본을 받았어요' : '1차 완성본 교체를 기록했어요',
        paragraphs: [
          `${name}님, 보내 주신 1차 완성본을 받았어요.`,
          event.type === 'source_replaced'
            ? '1차 완성본을 바꾸면 작업 기간은 교체한 날부터 다시 셉니다(계약서 제4조 2항).'
            : `작업 기간은 계약금 입금과 1차 완성본 수령이 모두 끝난 날부터 약 ${terms.workWeeks}주예요(계약서 제4조).`,
        ],
        rows: [...(work.dueOn ? [{ label: '작업 완료 예정', value: `${formatDate(work.dueOn)} 무렵` }] : []), ...linkRow, ...noteRow],
        ctaLabel: '작업 진행 보기',
      };
    case 'kickoff':
      return {
        subject: '작업을 시작했어요',
        heading: '작업을 시작했어요',
        paragraphs: [`${name}님, 기획 상담·편곡 작업을 시작했어요(계약서 제10조 1항의 "착수").`],
        rows: noteRow,
        ctaLabel: '작업 진행 보기',
      };
    case 'stage_delivered': {
      const stage = event.stage;
      if (!isRevisionStage(stage)) {
        return {
          subject: `${stageName(terms, stage, event.song)} 결과물을 보내 드려요`,
          heading: `${stageName(terms, stage, event.song)} 결과물을 보내 드려요`,
          paragraphs: [`${name}님, ${escapeHtml(stageName(terms, stage, event.song))} 결과물을 전달해요.`],
          rows: [...linkRow, ...noteRow],
          ctaLabel: '작업 진행 보기',
        };
      }
      const state = findStage(ledger, stage, event.song);
      if (!state) return null;
      // 기한은 전달한 날과 이 통지가 나가는 날 중 늦은 날부터 센다 — 장부(deemedBaseDay)와 같은 기준이다. 통지가
      // 실패했다가 다시 나가면 의뢰인은 그날부터 온전한 기간을 받는다.
      const lastDay = formatDate(kstDayStart(deemedBaseDay(event, now) + terms.deemedApprovalDays));
      const nth = ordinal() || state.deliveries;
      return {
        subject: `${stageName(terms, stage, event.song)} 결과물을 보내 드려요 — ${lastDay}까지 확인해 주세요`,
        heading: `${stageName(terms, stage, event.song)} 결과물을 보내 드려요`,
        paragraphs: [
          `${name}님, ${escapeHtml(stageName(terms, stage, event.song))} ${nth}차 결과물을 전달해요. 들어 보시고 진행 페이지에서 승인하거나 수정을 요청해 주세요.`,
        ],
        rows: [
          ...linkRow,
          { label: '확인 기한', value: `${lastDay}까지`, emphasis: true },
          { label: '남은 무료 수정', value: `${state.freeRemaining}회 (넘으면 회당 ${won(terms.extraRevisionFees[stage])})` },
          ...noteRow,
        ],
        notices: [
          // 제5조 5항 — 이 문장이 빠진 전달 메일은 간주 승인의 근거가 되지 못한다.
          `<strong>${escapeHtml(lastDay)}까지 수정 요청이 없으면 이 단계는 승인된 것으로 봐요</strong>(계약서 제5조 5항, ${terms.deemedApprovalDays}일).`,
          '수정 요청은 한 번에 정리해 보내 주시면 1회로 셉니다(계약서 제5조 2항).',
        ],
        ctaLabel: '확인하고 승인·수정 요청하기',
      };
    }
    case 'recording_completed':
      return {
        subject: '보컬 녹음을 마쳤어요',
        heading: '보컬 녹음을 마쳤어요',
        paragraphs: [`${name}님, 보컬 녹음 세션을 마쳤어요. 다음은 음정·박자 보정과 믹싱이에요.`],
        rows: noteRow,
        ctaLabel: '작업 진행 보기',
      };
    case 'revision_requested': {
      if (!isRevisionStage(event.stage)) return null;
      const state = findStage(ledger, event.stage, event.song);
      if (!state) return null;
      const nth = ordinal() || state.revisions;
      const extra = nth > terms.revisions[event.stage];
      const freeRemaining = Math.max(0, terms.revisions[event.stage] - nth);
      return {
        subject: `${stageName(terms, event.stage, event.song)} 수정 요청을 받았어요`,
        heading: `${stageName(terms, event.stage, event.song)} 수정 요청을 받았어요`,
        paragraphs: [`${name}님, ${escapeHtml(stageName(terms, event.stage, event.song))} ${nth}회차 수정 요청을 접수했어요. 반영해서 다시 보내 드릴게요.`],
        rows: [
          ...noteRow,
          extra
            ? { label: '추가 요금', value: `무료 ${terms.revisions[event.stage]}회를 넘어 ${won(terms.extraRevisionFees[event.stage])}이 더해져요`, emphasis: true }
            : { label: '남은 무료 수정', value: `${freeRemaining}회` },
        ],
        ctaLabel: '작업 진행 보기',
      };
    }
    case 'stage_approved': {
      if (!isRevisionStage(event.stage)) return null;
      const mode = data.mode ?? 'proxy';
      const balance =
        event.stage === 'mastering' && payments.balanceLastDay && remaining > 0
          ? [`잔금 <strong>${escapeHtml(won(remaining))}</strong>을 ${escapeHtml(formatDate(payments.balanceLastDay))}까지 보내 주세요. 입금을 확인한 뒤 최종 파일을 드려요(계약서 제5조 6항).`]
          : [];
      return {
        subject: `${stageName(terms, event.stage, event.song)} 단계가 승인됐어요`,
        heading: `${stageName(terms, event.stage, event.song)} 단계가 승인됐어요`,
        paragraphs: [
          mode === 'deemed'
            ? `${name}님, ${escapeHtml(stageName(terms, event.stage, event.song))} 결과물 확인 기한(${terms.deemedApprovalDays}일)까지 수정 요청이 없어 승인된 것으로 처리했어요(계약서 제5조 5항).`
            : `${name}님, ${escapeHtml(stageName(terms, event.stage, event.song))} 단계 승인을 기록했어요.`,
        ],
        notices: balance,
        ctaLabel: '작업 진행 보기',
      };
    }
    case 'pause_started':
      return {
        subject: '작업을 잠시 멈춰요',
        heading: '작업을 잠시 멈춰요',
        paragraphs: [
          data.cause === 'client'
            ? `${name}님, 의뢰인 사정으로 작업을 잠시 멈춰요. 멈춘 기간만큼 작업 기간이 늘어나요(계약서 제4조 2항).`
            : `${name}님, 스튜디오 사정으로 작업을 잠시 멈춰요. 작업 기간은 늘어나지 않아요.`,
        ],
        rows: noteRow,
        ctaLabel: '작업 진행 보기',
      };
    case 'pause_ended':
      return {
        subject: '작업을 다시 시작했어요',
        heading: '작업을 다시 시작했어요',
        paragraphs: [`${name}님, 멈췄던 작업을 다시 시작했어요.`],
        rows: [...(work.dueOn ? [{ label: '작업 완료 예정', value: `${formatDate(work.dueOn)} 무렵` }] : []), ...noteRow],
        ctaLabel: '작업 진행 보기',
      };
    case 'extra_cost_agreed':
      return {
        subject: '추가 비용을 기록했어요',
        heading: '추가 비용을 기록했어요',
        paragraphs: [`${name}님, 동의해 주신 추가 비용을 기록했어요(계약서 제6조).`],
        rows: [{ label: '추가 비용', value: won(event.amount ?? 0), emphasis: true }, ...noteRow, { label: '남은 금액', value: won(remaining) }],
        ctaLabel: '작업 진행 보기',
      };
    case 'final_delivered':
      return {
        subject: '최종 파일을 보내 드려요',
        heading: '최종 파일을 보내 드려요',
        paragraphs: [`${name}님, 최종 마스터 WAV·MP3 파일을 전달해요. 이어서 유통 등록을 진행할게요.`],
        rows: [...linkRow, ...noteRow],
        ctaLabel: '작업 진행 보기',
      };
    case 'distribution_submitted':
      return {
        subject: '유통 등록을 마쳤어요',
        heading: '유통 등록을 마쳤어요',
        paragraphs: [`${name}님, 국내외 디지털 유통 등록을 마쳤어요. 플랫폼 노출 시점은 각 플랫폼의 심사 일정에 따라요(계약서 제4조 3항).`],
        rows: noteRow,
        ctaLabel: '작업 진행 보기',
      };
    case 'released':
      return {
        subject: '발매됐어요',
        heading: '발매를 축하드려요',
        paragraphs: [`${name}님, 곡이 발매됐어요.`],
        rows: noteRow,
        ctaLabel: '작업 진행 보기',
      };
    case 'termination_notice':
      return {
        subject: '계약 해지 통지',
        heading: '계약 해지 통지',
        paragraphs: [
          `${name}님, 음원 제작 용역 계약서 제10조 5항에 따라 계약 해지를 통지해요.`,
          '정산은 계약서 제10조 3항의 항목표에 따라 진행한 작업분을 공제하고 남은 금액을 돌려드려요.',
        ],
        rows: [...noteRow, { label: '받은 금액', value: won(payments.received) }],
        ctaLabel: '작업 진행 보기',
      };
    default:
      return null;
  }
};

/** 기록 하나의 통지 메일을 보낸다. 통지 대상이 아닌 기록이면 null(보내지 않았다). */
export const sendProgressNotice = async (
  contract: ProductionContract,
  terms: ProductionTerms,
  event: ProductionContractEvent,
  ledger: ProductionLedger,
  progressUrl: string,
  now: Date = new Date(),
): Promise<SendContractEmailResult | null> => {
  const content = buildContent(contract, terms, event, ledger, now);
  if (!content) return null;

  const html = buildContractEmailHtml({
    heading: content.heading,
    paragraphs: content.paragraphs,
    rows: content.rows,
    notices: content.notices,
    cta: { label: content.ctaLabel, url: progressUrl },
  });
  const text = [
    `[${content.heading}]`,
    '',
    ...content.paragraphs.map((p) => p.replace(/<[^>]+>/g, '')),
    '',
    ...(content.rows ?? []).map((row) => `${row.label}: ${row.value}`),
    ...(content.notices ?? []).map((n) => `· ${n.replace(/<[^>]+>/g, '')}`),
    '',
    `작업 진행 보기: ${progressUrl}`,
    '',
    '스튜디오 놀 · 문의 010-4255-7893',
  ].join('\n');

  return sendEmail({
    to: contract.clientEmail,
    subject: `[스튜디오 놀] ${content.subject}`,
    html,
    text,
  });
};

/** 테스트가 문구를 직접 보기 위한 입구(메일을 보내지 않는다). */
export const buildProgressNoticeContent = buildContent;

export interface DueReminder {
  kind: 'deemed_approval_soon' | 'deposit_due' | 'balance_due';
  /** 안내가 가리키는 기록 — 간주 승인은 결과물 전달, 잔금은 마스터링 승인. 같은 기록에는 한 번만 보낸다. */
  refEventId?: string;
  stage?: RevisionStage;
  song?: number | null;
  lastDay: Date;
}

/** 기한 안내(간주 승인 이틀 전, 계약금·잔금 기한 전날). */
export const sendDueReminderEmail = async (
  contract: ProductionContract,
  terms: ProductionTerms,
  ledger: ProductionLedger,
  reminder: DueReminder,
  progressUrl: string,
): Promise<SendContractEmailResult> => {
  const name = escapeHtml(contract.clientName);
  const lastDay = formatDate(reminder.lastDay);
  const remaining = Math.max(0, ledger.payments.totalDue - ledger.payments.received);
  const content =
    reminder.kind === 'deemed_approval_soon'
      ? {
          subject: `${stageName(terms, reminder.stage ?? null, reminder.song ?? null)} 결과물 확인 기한이 ${lastDay}이에요`,
          paragraphs: [
            `${name}님, ${escapeHtml(stageName(terms, reminder.stage ?? null, reminder.song ?? null))} 결과물 확인 기한이 다가와요. <strong>${escapeHtml(lastDay)}까지 수정 요청이 없으면 승인된 것으로 봐요</strong>(계약서 제5조 5항).`,
          ],
          rows: [] as ContractEmailRow[],
        }
      : {
          subject: `${reminder.kind === 'deposit_due' ? '계약금' : '잔금'} 입금 기한이 ${lastDay}이에요`,
          paragraphs: [`${name}님, ${reminder.kind === 'deposit_due' ? '계약금' : '잔금'} 입금 기한이 내일이에요.`],
          rows: [
            {
              label: reminder.kind === 'deposit_due' ? '계약금' : '남은 금액',
              value: won(reminder.kind === 'deposit_due' ? terms.amount.deposit : remaining),
              emphasis: true,
            },
            { label: '입금 계좌', value: `${terms.payment.bank} ${terms.payment.account} (예금주 ${terms.payment.holder})` },
          ],
        };

  return sendEmail({
    to: contract.clientEmail,
    subject: `[스튜디오 놀] ${content.subject}`,
    html: buildContractEmailHtml({
      heading: content.subject,
      paragraphs: content.paragraphs,
      rows: content.rows,
      cta: { label: '작업 진행 보기', url: progressUrl },
    }),
    text: [...content.paragraphs.map((p) => p.replace(/<[^>]+>/g, '')), ...content.rows.map((r) => `${r.label}: ${r.value}`), '', progressUrl].join('\n'),
  });
};

/** 기한 크론이 운영자에게 보내는 할 일 요약. 할 일이 있는 계약만 싣는다. */
export const sendOperatorTodoDigest = async (
  items: ReadonlyArray<{ contract: ProductionContract; todos: Todo[] }>,
): Promise<SendContractEmailResult> => {
  const rows: ContractEmailRow[] = items.flatMap(({ contract, todos }) =>
    todos.map((todo) => ({
      label: contract.clientName,
      value: `${todo.severity === 'alert' ? '⚠ ' : ''}${todo.message}`,
      href: productionAdminUrl(contract.id),
    })),
  );
  return sendEmail({
    to: OPERATOR_EMAIL,
    subject: `[스튜디오 놀] 제작 계약 오늘 할 일 ${rows.length}건`,
    html: buildContractEmailHtml({
      heading: '제작 계약 — 오늘 볼 것',
      paragraphs: ['진행 기록으로 계산한 기한·지연·미통지 항목이에요. 이름을 누르면 관리자 화면이 열려요.'],
      rows,
    }),
    text: rows.map((row) => `${row.label}: ${row.value}`).join('\n'),
  });
};
