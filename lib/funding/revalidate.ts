import type { NextApiResponse } from 'next';

/**
 * 승인·공개 상태 변경 뒤 공개 경로를 즉시 다시 만든다.
 *
 * **목록과 상세 둘 다 해야 한다.** 상세만 하면 `/ko/funding` 카드가 최대 60초 동안 옛 목록을
 * 보여 주고, 목록만 하면 상세가 404로 남는다(상세의 `notFound`도 `revalidate: 60`으로
 * 캐시되기 때문이다).
 *
 * **실패를 삼킨다.** 재검증이 안 되면 60초 뒤 ISR이 따라잡는다 — 그 때문에 판정 자체를
 * 실패시키면 운영자가 같은 버튼을 다시 눌러야 하고, 그 사이 상태는 이미 바뀌어 있어
 * 두 번째 클릭은 409가 난다. 사유는 돌려주고 호출부가 화면에 알린다.
 */
export const revalidateFundingPaths = async (
  res: Pick<NextApiResponse, 'revalidate'>,
  slug: string,
): Promise<string | null> => {
  const paths = ['/ko/funding', `/ko/funding/${slug}`];
  const failed: string[] = [];
  for (const path of paths) {
    try {
      await res.revalidate(path);
    } catch (error: unknown) {
      console.error(`[funding] 재검증 실패 — ${path}:`, error);
      failed.push(path);
    }
  }
  return failed.length === 0 ? null : `재검증 실패: ${failed.join(', ')}`;
};
