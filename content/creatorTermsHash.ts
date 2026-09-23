/**
 * 개설자가 동의한 약관 내용의 해시 — `FUNDING_CREATOR_TERMS_VERSION` 갱신을 강제하기 위한 것.
 *
 * `content/fundingTermsHash.ts`(후원자 약관 게이트)를 본떴다 — 이유·구조·우회 차단 방식이
 * 전부 같다. 왜 필요한지는 그 파일 머리주석과 lib/funding/policy.ts의 FUNDING_TERMS_VERSION
 * 주석을 그대로 참조할 것: `funding_projects.creator_terms_version`에는 문자열 하나만
 * 남으므로, "그때 이 내용에 동의했다"는 증거가 되려면 내용이 바뀌면 반드시 문자열도
 * 바뀌어야 한다.
 *
 * 무엇을 해시에 넣는가: 개설자 약관 조항 전부(`FUNDING_CREATOR_TERMS_SECTIONS`)와, **제6조
 * 본문에 보간되는 공유 상수 네 개**다. 2026-09-23에 6조가 "별도 정산 계약으로 정한다"에서
 * 확정 요율·정산 시점을 적는 조항으로 바뀌면서 이 문서도 후원자 약관과 같은 모양이 됐다.
 *
 * **상수 블록은 지금 당장은 중복이다** — 6조 body가 템플릿 리터럴이라 모듈 로드 시점에 값이
 * 박히고, 직렬화 출력에 `플랫폼 수수료는 5.5%`가 그대로 실린다. 즉 요율을 바꾸면 본문
 * 경로만으로도 해시가 이미 움직인다. 그런데도 상수를 따로 싣는 이유는, 그 방어가 **6조를
 * 지금 쓰인 방식 그대로 두는 데 걸려 있기 때문**이다. 다음 사람이 문장을 다듬다 `5.5%`를
 * 리터럴로 적거나 요율을 표로 빼면서 본문에서 숫자를 걷어내는 순간, 상수만 바꾼 개정이
 * 조용히 통과한다 — 개설자가 동의한 내용이 판본 문자열은 그대로인 채 달라지는, 이 게이트가
 * 막으려는 상태다. 상수 블록은 그 경우에도 해시를 움직인다.
 * `content/fundingTermsHash.ts`가 공유 상수를 넣는 방식과 같다.
 */
import {
  FUNDING_PAYMENT_FEE_PERCENT,
  FUNDING_PLATFORM_FEE_PERCENT,
  FUNDING_WITHHOLDING_PERCENT,
} from '../data/pricing';
import { FUNDING_PAYOUT_BUSINESS_DAYS } from '../lib/funding/policy';
import { FUNDING_CREATOR_TERMS_SECTIONS } from '../pages/[locale]/funding/creator-terms';

/** 해시 대상을 사람이 읽을 수 있는 형태로 직렬화한다 — 실패했을 때 무엇이 바뀌었는지 diff로 보이도록. */
export const serializeCreatorTerms = (): string => {
  const lines: string[] = ['## 개설자 약관 (pages/[locale]/funding/creator-terms.tsx)'];
  for (const section of FUNDING_CREATOR_TERMS_SECTIONS) {
    lines.push(section.heading, ...section.body.map((b) => `  ${b}`));
  }

  // 지금은 6조 본문이 이 값들을 보간하고 있어 중복이다(머리주석 참조). 6조가 숫자를 본문에서
  // 걷어내는 방향으로 바뀌어도 요율 변경을 잡도록 따로 싣는다.
  lines.push('## 제6조에 보간되는 공유 상수 (data/pricing.ts · lib/funding/policy.ts)');
  lines.push(`FUNDING_PLATFORM_FEE_PERCENT=${FUNDING_PLATFORM_FEE_PERCENT}`);
  lines.push(`FUNDING_PAYMENT_FEE_PERCENT=${FUNDING_PAYMENT_FEE_PERCENT}`);
  lines.push(`FUNDING_WITHHOLDING_PERCENT=${FUNDING_WITHHOLDING_PERCENT}`);
  lines.push(`FUNDING_PAYOUT_BUSINESS_DAYS=${FUNDING_PAYOUT_BUSINESS_DAYS}`);

  return lines.join('\n');
};

// content/fundingTermsHash.ts의 TERMS_VERSION_PATTERN과 같은 모양 — 이유도 같다(같은 날
// 열 번째 이상 개정도 받아야 한다).
export const CREATOR_TERMS_VERSION_PATTERN = /^funding-creator-terms-\d{4}-\d{2}-\d{2}(-r([2-9]|[1-9]\d+))?$/;

export type FundingCreatorTermsBaseline = {
  note: string;
  version: string;
  /** serializeCreatorTerms()의 sha256(hex). */
  hash: string;
  covers: string[];
};

/**
 * 기준선 갱신을 허용할지 판정한다 — `assertBaselineUpdateAllowed`(fundingTermsHash.ts)와
 * 완전히 같은 규칙이다. 두 자물쇠를 하나로 합치지 않는 이유: 대상 문서(후원자 약관 vs
 * 개설자 약관)와 판본 문자열 포맷이 다르고, 둘을 합치면 어느 쪽 검사가 실패했는지
 * 에러 메시지에서 구분하기 더 어려워진다.
 */
export const assertCreatorTermsBaselineUpdateAllowed = (
  existing: Pick<FundingCreatorTermsBaseline, 'version' | 'hash'> | null,
  next: { version: string; hash: string },
  allowCreate: boolean = false,
): void => {
  if (!existing) {
    if (allowCreate) return; // 명시적으로 승인된 최초 생성.
    throw new Error(
      [
        '기준선 생성을 거부한다 — content/creator-terms.baseline.json을 찾을 수 없다.',
        '',
        '이 파일이 원래 있었다면 지우지 말고 git으로 복구할 것:',
        '  git checkout -- content/creator-terms.baseline.json',
        '지우고 이 명령으로 다시 만들면 "이전 내용과 비교"가 통째로 사라져, 판본을 안 올린',
        '변경도 무조건 통과하는 새 기준선이 깔린다 — 이 게이트가 막으려던 상태 그 자체다.',
        '',
        '정말 이 저장소에 처음 만드는 것이 맞다면(초기 세팅) ALLOW_BASELINE_CREATE=1을',
        '함께 주고 다시 실행할 것:',
        '  ALLOW_BASELINE_CREATE=1 UPDATE_CREATOR_TERMS_BASELINE=1 npx jest content/creatorTerms.baseline.test.ts',
      ].join('\n'),
    );
  }
  if (existing.hash === next.hash) return; // 내용이 그대로면 판본만 손봐도 된다.
  if (existing.version !== next.version) return; // 내용이 바뀌었고 판본도 올렸다 — 정상.
  throw new Error(
    [
      '기준선 갱신을 거부한다 — 개설자 약관의 내용이 바뀌었는데 FUNDING_CREATOR_TERMS_VERSION이 그대로다.',
      `  판본: ${next.version} (기준선과 동일)`,
      `  해시: ${existing.hash.slice(0, 12)}… → ${next.hash.slice(0, 12)}…`,
      '',
      '이대로 기록하면 "옛 판본 문자열 + 새 내용"이 되어, 서로 다른 내용에 동의한 개설자들이',
      '같은 판본을 갖게 된다 — 이 게이트가 막으려던 상태 그 자체다.',
      '',
      '먼저 lib/funding/policy.ts의 FUNDING_CREATOR_TERMS_VERSION을 올린 뒤 다시 실행할 것',
      '(같은 날 두 번째 개정이면 -r2, -r3 접미사를 쓴다).',
    ].join('\n'),
  );
};
