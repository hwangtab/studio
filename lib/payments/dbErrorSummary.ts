/**
 * DB 오류를 로그에 실을 때 이름·코드만 남긴다 — drizzle 오류 메시지에는 바인딩된 값(개인정보)이 실린다.
 * 의존이 없는 모듈로 둔다: 관리자 화면 클라이언트 번들이 끌어오는 모듈(businessLineStore 등)이 이걸 쓰는데,
 * refundAccount.ts에서 가져오면 fieldCrypto(node:crypto)까지 번들에 딸려 와 빌드가 깨진다.
 */
export const safeDbErrorSummary = (error: unknown): { name: string; code?: string } => {
  if (!(error instanceof Error)) return { name: 'unknown' };
  const pick = (e: unknown): string | undefined => {
    const c = (e as { code?: unknown } | null)?.code;
    return typeof c === 'string' ? c : undefined;
  };
  const code = pick(error) ?? pick((error as { cause?: unknown }).cause);
  return code ? { name: error.name, code } : { name: error.name };
};
