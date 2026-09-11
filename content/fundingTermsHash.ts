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
import { POLICY_COPY_BY_LOCALE } from '../pages/[locale]/privacy-policy';
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

export type FundingTermsBaseline = {
  note: string;
  version: string;
  /** serializeAgreedDocuments()의 sha256(hex). */
  hash: string;
  /** 사람이 "무엇이 들어 있는지" 눈으로 확인하는 용도. 판정에는 쓰지 않는다. */
  covers: string[];
};
