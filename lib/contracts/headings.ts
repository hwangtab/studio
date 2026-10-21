/**
 * 계약 본문(마크다운)의 조문 제목(`## `) 목차 — 서명 화면의 "목차" 접기가 쓴다.
 *
 * 앵커 id는 제목 글자에서 **결정적으로** 만든다(같은 글이면 서버·브라우저 어디서나 같은 id).
 * markdown-to-jsx 기본 slugify는 한글을 모두 지워 id가 비므로 `ContractContent`가 이 함수를 `slugify` 옵션으로 넘긴다.
 * 목차(extractContractHeadings)와 본문(ContractContent)이 같은 함수를 쓰므로 링크가 끊기지 않는다 —
 * lib/contracts/headings.test.ts가 실제 템플릿으로 확인한다.
 *
 * **이 모듈은 아무것도 import하지 않는다** — 클라이언트 번들이 가져간다.
 */

/** 제목 글자 → 앵커 id. 글자·숫자만 남기고 나머지는 하이픈 하나로 접는다. */
export const headingAnchorId = (text: string): string => {
  const slug = text
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `sec-${slug || 'section'}`;
};

export interface ContractHeading {
  id: string;
  text: string;
}

/** 제목 줄 안의 강조 표시(`**`, `_`, 역따옴표 등)를 걷어 화면에 보이는 글자만 남긴다. */
const plainHeadingText = (line: string): string =>
  line
    .replace(/\\([\\`*_{}[\]()#+\-.!|<>~])/g, '$1')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * `## ` 제목만 뽑는다(코드 울타리 안은 제외). 같은 id가 이미 나온 제목은 건너뛴다 — 본문에서도 같은 id가 두 번 생기므로
 * 앞의 것으로만 이동한다.
 */
export const extractContractHeadings = (content: string): ContractHeading[] => {
  const headings: ContractHeading[] = [];
  const seen = new Set<string>();
  let inFence = false;
  for (const line of content.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;
    const text = plainHeadingText(match[1]);
    if (!text) continue;
    const id = headingAnchorId(text);
    if (seen.has(id)) continue;
    seen.add(id);
    headings.push({ id, text });
  }
  return headings;
};
