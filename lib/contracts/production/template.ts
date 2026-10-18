import { readFileSync } from 'node:fs';
import path from 'node:path';

import { formatCurrency, formatDate } from '../format';
import { fillPlaceholders } from '../placeholders';
import { escapeTableCell } from '../html-escape';
import { KIND_LABEL, PER_SONG_MILESTONES, type ProductionKind, type ProductionTerms, type RefundItemKey, type RefundMilestoneEvent } from './terms';

/**
 * 제작 계약서 본문 만들기. 연습실 template.ts와 같은 규칙을 따른다 — 사용자 값은 표 셀 이스케이프,
 * 치환은 함수로(`$'` 같은 replace 패턴이 템플릿 뒷부분을 끌어오지 못하게), 날짜·금액은 format.ts 한 곳에서.
 *
 * 템플릿 파일은 배포 파일 트레이싱에 걸려 있어야 한다(next.config.mjs outputFileTracingIncludes).
 */

/**
 * 현재 템플릿 원문. 새 계약을 만들 때만 읽는다 — 만든 계약은 저장된 사본(production_contracts.template)을 쓴다.
 *
 * 싱글은 single-template.md, EP·정규는 release-template.md. 뒤쪽은 앞쪽에서 곡 수가 들어가는 문장만 바꾼
 * 판이다 — 공통 조항을 고치면 두 파일을 함께 고친다(template.test.ts가 공통 조항이 같은지 본다).
 */
export const readProductionTemplate = (kind: ProductionKind = 'single'): string =>
  readFileSync(
    path.join(process.cwd(), 'lib', 'contracts', 'production', kind === 'single' ? 'single-template.md' : 'release-template.md'),
    'utf-8',
  );

export interface ProductionTemplateData {
  clientName: string;
  clientStageName: string | null;
  clientPhone: string;
  /** 서명 전에는 비어 있다 — 서명자가 채운다. */
  clientBirthdate?: string | null;
  clientAddress?: string | null;
  /** 계약 종류 — EP·정규 문안의 자리표시자(종류 이름)에 쓴다. */
  kind: ProductionKind;
  /** 미성년 의뢰인의 법정대리인(운영자가 적은 값). 없으면 그 칸이 계약서에 나오지 않는다. */
  guardian?: { name: string; relation: string | null; phone: string | null } | null;
  terms: ProductionTerms;
  /** 계약일. 서명 순간에 확정된다(초안을 만든 날이 아니다). */
  contractDate: string;
}

/** 항목을 주어로 쓸 때의 이름(조사 포함). 제10조 3항 문장에 들어간다. */
const ITEM_SUBJECT: Record<RefundItemKey, string> = {
  arrangement: '편곡(제2조 2호)은',
  recording: '보컬 녹음(제2조 3호)은',
  tuning: '보컬 음정·박자 보정(제2조 4호)은',
  mixmaster: '믹싱·마스터링(제2조 5호)은',
  planning: '기획 상담·유통 등록·발매 홍보(제2조 1·6·7호)는',
};

const EVENT_PHRASE: Record<RefundMilestoneEvent, string> = {
  kickoff: '착수한 때',
  arrangement_delivered: '스튜디오가 편곡 1차 시안을 전달한 때',
  recording_completed: '보컬 녹음 세션을 마친 때',
  tuning_delivered: '스튜디오가 보정 결과물을 전달한 때',
  mixing_delivered: '스튜디오가 믹싱 1차 결과물을 전달한 때',
  mastering_delivered: '스튜디오가 마스터링 결과물을 전달한 때',
  distribution_submitted: '유통 등록을 마친 때',
};

/**
 * 제10조 3항의 "작업분" 경계를 문장으로 쓴다. 정산 계산(ledger.ts)이 같은 terms를 읽으므로, 의뢰인이 서명한
 * 문장과 시스템이 계산하는 공제액이 한 데이터에서 나온다.
 *
 * 예) "편곡(제2조 2호)은 스튜디오가 편곡 1차 시안을 전달한 때 완료된 것으로 본다. 기획 상담·…는 착수한 때
 *      그 금액의 30%를, 유통 등록을 마친 때 전액을 작업분으로 본다."
 */
export const describeRefundMilestones = (terms: ProductionTerms): string => {
  const multi = terms.songs.length > 1;
  return terms.refundSchedule
    .map(({ key, milestones }) => {
      // 여러 곡 계약에서 곡마다 일어나는 경계가 하나라도 있으면 곡마다 그 곡의 몫(항목 금액 ÷ 곡 수)으로 센다 —
      // 음반 전체 경계(마스터링 등)는 모든 곡에 같이 닿는다(ledger.ts itemRatio와 같은 계산).
      const perSong = multi && milestones.some((m) => PER_SONG_MILESTONES.has(m.event));
      if (milestones.length === 1) {
        return perSong
          ? `${ITEM_SUBJECT[key]} 곡마다 ${EVENT_PHRASE[milestones[0].event]} 그 곡의 몫(항목 금액을 곡 수로 나눈 금액)이 완료된 것으로 본다.`
          : `${ITEM_SUBJECT[key]} ${EVENT_PHRASE[milestones[0].event]} 완료된 것으로 본다.`;
      }
      const share = perSong ? '그 곡 몫의' : '그 금액의';
      const parts = milestones.map(({ event, ratio }) =>
        ratio === 1 ? `${EVENT_PHRASE[event]} ${perSong ? '그 곡 몫 ' : ''}전액을` : `${EVENT_PHRASE[event]} ${share} ${Math.round(ratio * 100)}%를`,
      );
      return `${ITEM_SUBJECT[key]} ${perSong ? '곡마다 ' : ''}${parts.join(', ')} 작업분으로 본다.`;
    })
    .join(' ');
};

export const buildProductionContent = (data: ProductionTemplateData, template: string): string => {
  const { terms } = data;
  // 문자열 값은 표 밖(조항 문장)에 들어가도 escapeTableCell을 쓴다. 꺾쇠·파이프가 마크업으로 살아나지
  // 않아야 하는 것은 표 밖에서도 같다.
  const cell = (value: string | null | undefined, fallback = '') => (value ? escapeTableCell(value) : fallback);
  const won = (amount: number) => formatCurrency(amount);

  const refundRows = [
    ...terms.refundSchedule.map((item) => `| ${escapeTableCell(item.label)} | ${won(item.amount)}원 |`),
    `| **합계** | **${won(terms.amount.total)}원** |`,
  ].join('\n');

  const { guardian } = data;
  const guardianSection = guardian
    ? [
        '',
        '**법정대리인** — 의뢰인이 미성년자이므로 함께 서명한다(제14조).',
        '',
        '| 구분 | 내용 |',
        '|---|---|',
        `| 성명 | ${cell(guardian.name)} |`,
        `| 관계 | ${cell(guardian.relation)} |`,
        `| 연락처 | ${cell(guardian.phone)} |`,
        '',
      ].join('\n')
    : '';
  const guardianSignatureRow = guardian ? `| **법정대리인** ${cell(guardian.name)} (${cell(guardian.relation)}) | (전자서명) |` : '';

  const replacements: Record<string, string> = {
    guardianSection,
    guardianSignatureRow,
    clientName: cell(data.clientName),
    clientStageName: cell(data.clientStageName, '-'),
    clientBirthdate: cell(data.clientBirthdate),
    clientPhone: cell(data.clientPhone),
    clientAddress: cell(data.clientAddress),
    songTitle: terms.songs[0]?.title ? escapeTableCell(terms.songs[0].title) : '1곡 (제목 미정)',
    albumTitle: terms.albumTitle ? escapeTableCell(terms.albumTitle) : '제목 미정',
    releaseKind: KIND_LABEL[data.kind],
    songCount: String(terms.songs.length),
    songRows: terms.songs
      .map((song, index) => `| ${index + 1} | ${song.title ? escapeTableCell(song.title) : '제목 미정'} |`)
      .join('\n'),
    recordingHoursTotal: String(terms.scope.recordingHours * terms.songs.length),
    total: won(terms.amount.total),
    deposit: won(terms.amount.deposit),
    balance: won(terms.amount.balance),
    depositDueDays: String(terms.amount.depositDueDays),
    balanceDueDays: String(terms.amount.balanceDueDays),
    bank: escapeTableCell(terms.payment.bank),
    account: escapeTableCell(terms.payment.account),
    holder: escapeTableCell(terms.payment.holder),
    workWeeks: String(terms.workWeeks),
    arrangementTracks: String(terms.scope.arrangementTracks),
    recordingHours: String(terms.scope.recordingHours),
    mixingTracks: String(terms.scope.mixingTracks),
    revArrangement: String(terms.revisions.arrangement),
    revMixing: String(terms.revisions.mixing),
    revMastering: String(terms.revisions.mastering),
    feeArrangement: won(terms.extraRevisionFees.arrangement),
    feeMixing: won(terms.extraRevisionFees.mixing),
    feeMastering: won(terms.extraRevisionFees.mastering),
    deemedApprovalDays: String(terms.deemedApprovalDays),
    clientUnresponsiveDays: String(terms.clientUnresponsiveDays),
    paymentDelayDays: String(terms.paymentDelayDays),
    studioDelayWeeks: String(terms.studioDelayWeeks),
    credits: escapeTableCell(terms.credits),
    refundRows: refundRows,
    refundMilestones: describeRefundMilestones(terms),
    contractDate: formatDate(data.contractDate),
  };

  return fillPlaceholders(template, replacements);
};

/** 템플릿에 남은 자리표시자. 테스트가 "모든 변수가 채워졌다"를 확인하는 데 쓴다. */
export const findUnfilledPlaceholders = (content: string): string[] => content.match(/\{\{[a-zA-Z]+\}\}/g) ?? [];
