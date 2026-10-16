/**
 * 계약서 PDF의 Blob **경로**(`contracts/<id>.pdf`).
 *
 * `contracts.pdf_url`에는 업로드 때 받은 전체 주소가 들어 있다 — 호스트가 곧 Blob 저장소 ID다
 * (`<store>.private.blob.vercel-storage.com`). 주소로 읽고·지우고·비교하면 저장소를 옮기는 순간
 * 세 곳이 함께 틀어진다.
 *
 * - 보관본 읽기가 옛 저장소 주소를 새 토큰으로 물어 실패한다(다시 만들어 주므로 문서는 나간다).
 * - 개인정보 파기(`retention.ts`)가 옛 주소를 지우려다 실패해, 새 저장소의 사본이 기한을 넘겨 남는다.
 * - 고아 정리(`backup.ts`)가 새 저장소의 PDF 주소를 DB에서 못 찾아 **멀쩡한 계약서를 지운다.**
 *
 * 경로는 저장소와 무관하므로, 세 곳 모두 이 값으로 다룬다. DB의 옛 주소는 고치지 않아도 된다.
 * 경로만 저장된 값(앞으로 생길 수 있다)은 그대로 돌려준다.
 */
export const contractPdfPathname = (pdfUrl: string): string => {
  if (!/^https?:\/\//i.test(pdfUrl)) return pdfUrl.replace(/^\/+/, '');
  return decodeURIComponent(new URL(pdfUrl).pathname).replace(/^\/+/, '');
};
