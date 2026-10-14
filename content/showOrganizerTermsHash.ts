/**
 * 주최자가 동의한 공연 주최자 약관 내용의 해시 — `SHOW_ORGANIZER_TERMS_VERSION` 갱신을 강제하기 위한 것.
 *
 * `content/creatorTermsHash.ts`(펀딩 개설자 약관 게이트)를 그대로 본떴다 — 이유·구조·우회 차단 방식이
 * 전부 같다. `show_submissions.organizer_terms_version`에는 문자열 하나만 남으므로, "그때 이 내용에
 * 동의했다"는 증거가 되려면 내용이 바뀌면 반드시 문자열도 바뀌어야 한다.
 *
 * 무엇을 해시에 넣는가: 약관 조항 전부(`SHOW_ORGANIZER_TERMS_SECTIONS`)와 **본문에 보간되는 공유 상수
 * 다섯 개**, 그리고 제7조가 싣는 **공연 환불 규정**(환불표·안내)이다. 지금은 본문 보간과 중복이지만, 다음 사람이 숫자를 리터럴로 적거나 본문에서 걷어내도
 * 상수만 바꾼 개정이 조용히 통과하지 않게 따로 싣는다(creatorTermsHash.ts 머리주석과 같은 이유).
 * `FUNDING_WITHHOLDING_PERCENT`는 `FUNDING_INDIVIDUAL_PAYOUT_NOTE` 안에 보간된다.
 */
import {
  FUNDING_PAYMENT_FEE_PERCENT,
  FUNDING_PLATFORM_FEE_PERCENT,
  FUNDING_WITHHOLDING_PERCENT,
} from '../data/pricing';
import { FUNDING_PAYOUT_BUSINESS_DAYS } from '../lib/funding/policy';
import { MIN_LEAD_DAYS } from '../lib/shows/organizer/draft';
import { REFUND_POLICY_FOOTNOTES, refundTierLines } from '../lib/shows/refundPolicy';
import { SHOW_ORGANIZER_TERMS_SECTIONS } from '../pages/[locale]/shows/organizer-terms';

/** 해시 대상을 사람이 읽을 수 있는 형태로 직렬화한다 — 실패했을 때 무엇이 바뀌었는지 diff로 보이도록. */
export const serializeShowOrganizerTerms = (): string => {
  const lines: string[] = ['## 공연 주최자 약관 (pages/[locale]/shows/organizer-terms.tsx)'];
  for (const section of SHOW_ORGANIZER_TERMS_SECTIONS) {
    lines.push(section.heading, ...section.body.map((b) => `  ${b}`));
  }

  lines.push('## 본문에 보간되는 공유 상수 (data/pricing.ts · lib/funding/policy.ts · lib/shows/organizer/draft.ts)');
  lines.push(`FUNDING_PLATFORM_FEE_PERCENT=${FUNDING_PLATFORM_FEE_PERCENT}`);
  lines.push(`FUNDING_PAYMENT_FEE_PERCENT=${FUNDING_PAYMENT_FEE_PERCENT}`);
  lines.push(`FUNDING_WITHHOLDING_PERCENT=${FUNDING_WITHHOLDING_PERCENT}`);
  lines.push(`FUNDING_PAYOUT_BUSINESS_DAYS=${FUNDING_PAYOUT_BUSINESS_DAYS}`);
  lines.push(`MIN_LEAD_DAYS=${MIN_LEAD_DAYS}`);

  // 제7조가 보간하는 공연 환불 규정(lib/shows/refundPolicy.ts) — 표나 안내가 바뀌면 주최자가 동의한 내용도 바뀐다.
  lines.push('## 제7조에 보간되는 공연 환불 규정 (lib/shows/refundPolicy.ts)');
  lines.push(...refundTierLines().map((l) => `REFUND_TIER ${l}`));
  lines.push(...REFUND_POLICY_FOOTNOTES.map((l) => `REFUND_FOOTNOTE ${l}`));

  return lines.join('\n');
};

// creatorTermsHash.ts의 CREATOR_TERMS_VERSION_PATTERN과 같은 모양 — 같은 날 열 번째 이상 개정도 받는다.
export const SHOW_ORGANIZER_TERMS_VERSION_PATTERN = /^show-organizer-terms-\d{4}-\d{2}-\d{2}(-r([2-9]|[1-9]\d+))?$/;

export type ShowOrganizerTermsBaseline = {
  note: string;
  version: string;
  /** serializeShowOrganizerTerms()의 sha256(hex). */
  hash: string;
  covers: string[];
};

/** 기준선 갱신을 허용할지 판정한다 — `assertCreatorTermsBaselineUpdateAllowed`와 같은 규칙이다. */
export const assertShowOrganizerTermsBaselineUpdateAllowed = (
  existing: Pick<ShowOrganizerTermsBaseline, 'version' | 'hash'> | null,
  next: { version: string; hash: string },
  allowCreate: boolean = false,
): void => {
  if (!existing) {
    if (allowCreate) return; // 명시적으로 승인된 최초 생성.
    throw new Error(
      [
        '기준선 생성을 거부한다 — content/show-organizer-terms.baseline.json을 찾을 수 없다.',
        '',
        '이 파일이 원래 있었다면 지우지 말고 git으로 복구할 것:',
        '  git checkout -- content/show-organizer-terms.baseline.json',
        '지우고 이 명령으로 다시 만들면 "이전 내용과 비교"가 통째로 사라져, 판본을 안 올린',
        '변경도 무조건 통과하는 새 기준선이 깔린다 — 이 게이트가 막으려던 상태 그 자체다.',
        '',
        '정말 이 저장소에 처음 만드는 것이 맞다면(초기 세팅) ALLOW_BASELINE_CREATE=1을',
        '함께 주고 다시 실행할 것:',
        '  ALLOW_BASELINE_CREATE=1 UPDATE_SHOW_ORGANIZER_TERMS_BASELINE=1 npx jest content/showOrganizerTerms.baseline.test.ts',
      ].join('\n'),
    );
  }
  if (existing.hash === next.hash) return; // 내용이 그대로면 판본만 손봐도 된다.
  if (existing.version !== next.version) return; // 내용이 바뀌었고 판본도 올렸다 — 정상.
  throw new Error(
    [
      '기준선 갱신을 거부한다 — 공연 주최자 약관의 내용이 바뀌었는데 SHOW_ORGANIZER_TERMS_VERSION이 그대로다.',
      `  판본: ${next.version} (기준선과 동일)`,
      `  해시: ${existing.hash.slice(0, 12)}… → ${next.hash.slice(0, 12)}…`,
      '',
      '이대로 기록하면 "옛 판본 문자열 + 새 내용"이 되어, 서로 다른 내용에 동의한 주최자들이',
      '같은 판본을 갖게 된다 — 이 게이트가 막으려던 상태 그 자체다.',
      '',
      '먼저 lib/shows/organizer/policy.ts의 SHOW_ORGANIZER_TERMS_VERSION을 올린 뒤 다시 실행할 것',
      '(같은 날 두 번째 개정이면 -r2, -r3 접미사를 쓴다).',
    ].join('\n'),
  );
};
