/**
 * 공연 본문 텍스트 규칙 — `shows` 테이블에 구조화 칸이 없는 값(부제·출연진 소개·본문 문단)을
 * 기존 text 칸 안에 **사람이 읽어도 깨지지 않는 평문**으로 담고, 공개 페이지가 이 파서로 푼다.
 *
 * 마이그레이션 없이 넣은 규칙이다. 평문 규칙인 이유: 이 값들은 이메일·주문 요약처럼
 * 파서를 안 거치는 곳에도 그대로 나갈 수 있고, 그때도 어색하지 않아야 한다.
 *
 * - `shows.title`        : `메인 제목 — 부제` (구분자는 앞뒤 공백이 있는 em dash). 부제가 없으면 구분자도 없다.
 * - `shows.performers`   : 출연자 한 줄에 한 명, `이름 — 소개`. 소개가 없으면 이름만.
 *                          소개 안에는 ` — `를 쓰지 않는다(첫 구분자만 이름과 소개를 가른다).
 * - `shows.description`  : 빈 줄(`\n\n`)로 문단을 가른다. 문단 안의 줄바꿈은 그대로 보존한다.
 *                          첫 문단이 곧 목록 카드·메일·OG description의 요약이다.
 */

const SEP = ' — ';

export interface ShowTitleParts {
  main: string;
  subtitle: string | null;
}

export function splitShowTitle(title: string): ShowTitleParts {
  const i = title.indexOf(SEP);
  if (i < 0) return { main: title.trim(), subtitle: null };
  const main = title.slice(0, i).trim();
  const subtitle = title.slice(i + SEP.length).trim();
  return { main, subtitle: subtitle || null };
}

export interface ShowPerformer {
  name: string;
  bio: string | null;
}

export function parsePerformers(text: string): ShowPerformer[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf(SEP);
      if (i < 0) return { name: line, bio: null };
      return { name: line.slice(0, i).trim(), bio: line.slice(i + SEP.length).trim() || null };
    });
}

/** 출연진을 이름만 쉼표로 이은 한 줄 — 목록 카드·메일 제목줄용. */
export function performerNames(text: string): string {
  return parsePerformers(text).map((p) => p.name).join(', ');
}

export function parseDescriptionParagraphs(description: string): string[] {
  return description
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}
