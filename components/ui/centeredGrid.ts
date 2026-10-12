/**
 * 마지막 줄이 덜 차는 카드 묶음을 가운데로 모으는 배치(docs/grid-orphan-audit-2026-10.md).
 *
 * CSS grid는 덜 찬 마지막 줄을 가운데로 보낼 수 없다 — 3칸에 7장이면 마지막 한 장이 왼쪽 ⅓에 홀로 남는다.
 * 그래서 flex-wrap + justify-center로 줄을 가운데 정렬하고, 카드 폭은 "그 칸 수일 때의 grid 칸 폭"으로 고정한다.
 * 줄이 꽉 차면 grid와 똑같아 보이고, 덜 찬 줄만 가운데로 모인다. 카드 수가 칸 수보다 적어도 같은 규칙으로 가운데에 선다.
 *
 * Tailwind는 클래스 문자열을 소스에서 그대로 찾아 만들므로 폭 클래스는 조합하지 않고 리터럴로 둔다.
 */
type Gap = 4 | 6 | 8;
type Cols = 1 | 2 | 3 | 4;
type LgCols = Cols | 5;

const GAP_CLASS: Record<Gap, string> = { 4: 'gap-4', 6: 'gap-6', 8: 'gap-8' };

// [gap][cols] — md·lg 접두는 아래 두 표가 따로 갖는다.
const MD_WIDTH: Record<Gap, Record<Cols, string>> = {
  4: { 1: 'md:w-full', 2: 'md:w-[calc((100%_-_1rem)/2)]', 3: 'md:w-[calc((100%_-_2rem)/3)]', 4: 'md:w-[calc((100%_-_3rem)/4)]' },
  6: { 1: 'md:w-full', 2: 'md:w-[calc((100%_-_1.5rem)/2)]', 3: 'md:w-[calc((100%_-_3rem)/3)]', 4: 'md:w-[calc((100%_-_4.5rem)/4)]' },
  8: { 1: 'md:w-full', 2: 'md:w-[calc((100%_-_2rem)/2)]', 3: 'md:w-[calc((100%_-_4rem)/3)]', 4: 'md:w-[calc((100%_-_6rem)/4)]' },
};
const LG_WIDTH: Record<Gap, Partial<Record<LgCols, string>>> = {
  4: { 1: 'lg:w-full', 2: 'lg:w-[calc((100%_-_1rem)/2)]', 3: 'lg:w-[calc((100%_-_2rem)/3)]', 4: 'lg:w-[calc((100%_-_3rem)/4)]' },
  6: { 1: 'lg:w-full', 2: 'lg:w-[calc((100%_-_1.5rem)/2)]', 3: 'lg:w-[calc((100%_-_3rem)/3)]', 4: 'lg:w-[calc((100%_-_4.5rem)/4)]', 5: 'lg:w-[calc((100%_-_6rem)/5)]' },
  8: { 1: 'lg:w-full', 2: 'lg:w-[calc((100%_-_2rem)/2)]', 3: 'lg:w-[calc((100%_-_4rem)/3)]', 4: 'lg:w-[calc((100%_-_6rem)/4)]' },
};

export interface CenteredGridOptions {
  /** md(768px~) 칸 수. */
  md: Cols;
  /** lg(1024px~) 칸 수. 없으면 md와 같다. */
  lg?: LgCols;
  gap?: Gap;
}

/** 컨테이너·항목 클래스. 항목 클래스는 각 카드의 가장 바깥 요소에 붙인다(모바일은 한 줄에 한 장). */
export function centeredGrid({ md, lg = md, gap = 6 }: CenteredGridOptions): { container: string; item: string } {
  return {
    container: `flex flex-wrap justify-center ${GAP_CLASS[gap]}`,
    item: `w-full ${MD_WIDTH[gap][md]} ${LG_WIDTH[gap][lg] ?? ''}`.trim(),
  };
}
