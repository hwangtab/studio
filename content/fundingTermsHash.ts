/**
 * 후원자가 동의한 문서 묶음의 내용 해시 — `FUNDING_TERMS_VERSION` 갱신을 강제하기 위한 것.
 *
 * 왜 필요한가: `funding_pledges.terms_version`에는 문자열 하나만 남는다. 그 문자열이
 * "그때 이 내용에 동의했다"는 증거가 되려면 **내용이 바뀌면 반드시 문자열도 바뀌어야** 한다.
 * 규칙은 lib/funding/policy.ts 주석에만 있었다 — 다음 사람이 약관 제8조(청약철회)를 고치고
 * 버전을 안 올리면, 서로 다른 내용에 동의한 후원 행들이 같은 판본 문자열을 갖게 되어
 * 증거 능력이 통째로 무효가 된다. CLAUDE.md가 이름 붙인 실패 유형 그대로다 —
 * "규칙은 주석이 아니라 테스트로 고정할 것".
 *
 * 무엇을 해시에 넣는가: 같은 동의 체크박스(PledgeWizard) 하나가 **펀딩 약관 + 개인정보
 * 처리방침**을 함께 동의받으므로 둘 다 넣는다. 처리방침은 ko만 본다 — 펀딩은 ko 전용
 * 상품이고(비-ko 경로는 /ko/funding으로 리다이렉트) 동의 화면에 뜨는 것도 ko 문서다.
 * 약관 본문에 보간되는 공유 상수(보유기간·법정 보존·결제 대기 시간)도 함께 넣는다 —
 * 상수만 바뀌어도 후원자가 읽는 문장이 달라지기 때문이다.
 */
import {
  BANK_HOLD_SECONDS,
  FUNDING_COLLECTED_ITEMS,
  FUNDING_COLLECTION_PURPOSES,
  FUNDING_DATA_PROCESSORS,
  PRIVACY_LEGAL_RETENTION_TEXT,
  PRIVACY_RETENTION_TEXT,
  TOSS_HOLD_SECONDS,
} from '../lib/funding/policy';
import { POLICY_COPY_BY_LOCALE } from '../data/privacyPolicy';
import { FUNDING_TERMS_SECTIONS } from '../pages/[locale]/funding/terms';

/** 해시 대상을 사람이 읽을 수 있는 형태로 직렬화한다 — 실패했을 때 무엇이 바뀌었는지 diff로 보이도록. */
export const serializeAgreedDocuments = (): string => {
  const ko = POLICY_COPY_BY_LOCALE.ko;
  const lines: string[] = [];

  lines.push('## 펀딩 약관 (pages/[locale]/funding/terms.tsx)');
  for (const section of FUNDING_TERMS_SECTIONS) {
    lines.push(section.heading, ...section.body.map((b) => `  ${b}`));
  }

  lines.push('## 개인정보 처리방침 ko (pages/[locale]/privacy-policy.tsx)');
  lines.push(ko.title, ko.subtitle, `${ko.lastUpdatedLabel}: ${ko.lastUpdatedValue}`);
  for (const section of ko.sections) {
    lines.push(section.heading, `  ${section.body}`);
    for (const item of section.items ?? []) lines.push(`  - ${item}`);
    for (const p of section.processors ?? []) lines.push(`  | ${p.name} | ${p.purpose} | ${p.items}`);
  }

  lines.push('## 공유 상수 (lib/funding/policy.ts)');
  lines.push(`PRIVACY_RETENTION_TEXT=${PRIVACY_RETENTION_TEXT}`);
  lines.push(`PRIVACY_LEGAL_RETENTION_TEXT=${PRIVACY_LEGAL_RETENTION_TEXT}`);
  lines.push(`TOSS_HOLD_SECONDS=${TOSS_HOLD_SECONDS}`);
  lines.push(`BANK_HOLD_SECONDS=${BANK_HOLD_SECONDS}`);
  for (const item of FUNDING_COLLECTED_ITEMS) lines.push(`COLLECTED=${item}`);
  for (const item of FUNDING_COLLECTION_PURPOSES) lines.push(`PURPOSE=${item}`);
  for (const p of FUNDING_DATA_PROCESSORS) lines.push(`PROCESSOR=${p.name}|${p.purpose}|${p.items}`);

  return lines.join('\n');
};

// -r2~-r9뿐 아니라 -r10 이상(선행 0 없는 두 자리 이상)도 받는다. 이전 패턴(-r[2-9]\d*)은
// 첫 자리를 [2-9]로 고정해 두 번째 개정부터 아홉 번째까지만 통과시키고 -r10~-r19,
// -r100~-r199를 전부 거부했다 — 같은 날 열 번째 이상 개정이 필요해지면 판본을 못 올린다.
export const TERMS_VERSION_PATTERN = /^funding-terms-\d{4}-\d{2}-\d{2}(-r([2-9]|[1-9]\d+))?$/;

export type FundingTermsBaseline = {
  note: string;
  version: string;
  /** serializeAgreedDocuments()의 sha256(hex). */
  hash: string;
  /** 사람이 "무엇이 들어 있는지" 눈으로 확인하는 용도. 판정에는 쓰지 않는다. */
  covers: string[];
};

/**
 * 기준선 갱신을 허용할지 판정한다 — **이 게이트의 유일한 자물쇠**다.
 *
 * 처음 구현은 update 모드가 기존 baseline을 읽지도 않고 `{ version: 현재 상수, hash: 새 해시 }`를
 * 무조건 덮어썼다. 그러면 실패 메시지의 갱신 절차 중 ①(버전 올리기)을 빠뜨리고 ②만 실행해도
 * 기준선이 "옛 버전 + 새 내용"으로 기록되고 다음 실행은 초록이 된다 — 리뷰 샌드박스에서 실제로
 * 재현됐다(제10조 환불 기한 3영업일 → 5영업일, 버전 그대로, 5 passed).
 * 절차 한 단계를 빠뜨리는 것이 정확히 사람이 하는 실수라, 그 우회는 예외가 아니라 기본 동작이었다.
 *
 * 그래서 **갱신 경로 자체가** 내용이 바뀌었는데 판본이 그대로인 조합을 거부한다.
 * 검사 모드만 막으면 자물쇠 옆에 열쇠를 걸어 두는 것과 같다.
 *
 * 두 번째 우회도 같은 모양으로 재현됐다: `existing`이 없으면(= 파일이 없으면) 무조건
 * `return`했으므로, 거부 메시지를 본 사람이 `content/funding-terms.baseline.json`을 지우고
 * 다시 쓰면 "최초 생성"으로 취급돼 판본 검사를 통째로 건너뛴다 — 지운 순간 "옛 판본 + 새 내용"이
 * 그대로 새 기준선이 되고, 그 뒤로는 검사 모드도 초록이다. 그래서 최초 생성에도 자물쇠를 단다:
 * `allowCreate`가 명시적으로 true일 때만 파일 없음을 통과시킨다. 기본값은 false다 — 아무도
 * 이 인자를 넣지 않고 호출하면(실수로든, 우회 목적으로든) 거부가 기본 동작이 된다.
 */
export const assertBaselineUpdateAllowed = (
  existing: Pick<FundingTermsBaseline, 'version' | 'hash'> | null,
  next: { version: string; hash: string },
  allowCreate: boolean = false,
): void => {
  if (!existing) {
    if (allowCreate) return; // 명시적으로 승인된 최초 생성.
    throw new Error(
      [
        '기준선 생성을 거부한다 — content/funding-terms.baseline.json을 찾을 수 없다.',
        '',
        '이 파일이 원래 있었다면 지우지 말고 git으로 복구할 것:',
        '  git checkout -- content/funding-terms.baseline.json',
        '지우고 이 명령으로 다시 만들면 "이전 내용과 비교"가 통째로 사라져, 판본을 안 올린',
        '변경도 무조건 통과하는 새 기준선이 깔린다 — 이 게이트가 막으려던 상태 그 자체다.',
        '',
        '정말 이 저장소에 처음 만드는 것이 맞다면(초기 세팅) ALLOW_BASELINE_CREATE=1을',
        '함께 주고 다시 실행할 것:',
        '  ALLOW_BASELINE_CREATE=1 UPDATE_FUNDING_TERMS_BASELINE=1 npx jest content/fundingTerms.baseline.test.ts',
      ].join('\n'),
    );
  }
  if (existing.hash === next.hash) return; // 내용이 그대로면 판본만 손봐도 된다.
  if (existing.version !== next.version) return; // 내용이 바뀌었고 판본도 올렸다 — 정상.
  throw new Error(
    [
      '기준선 갱신을 거부한다 — 동의 문서의 내용이 바뀌었는데 FUNDING_TERMS_VERSION이 그대로다.',
      `  판본: ${next.version} (기준선과 동일)`,
      `  해시: ${existing.hash.slice(0, 12)}… → ${next.hash.slice(0, 12)}…`,
      '',
      '이대로 기록하면 "옛 판본 문자열 + 새 내용"이 되어, 서로 다른 내용에 동의한 후원 행들이',
      '같은 판본을 갖게 된다 — 이 게이트가 막으려던 상태 그 자체다.',
      '',
      '먼저 lib/funding/policy.ts의 FUNDING_TERMS_VERSION을 올린 뒤 다시 실행할 것',
      '(같은 날 두 번째 개정이면 -r2, -r3 접미사를 쓴다).',
    ].join('\n'),
  );
};
