/**
 * 계약 변경 행위의 종류와 화면 라벨. DB·서버 코드를 import하지 않는 **순수 모듈**이다 — 관리자 계약 상세 화면(클라이언트 번들)이
 * 라벨을 읽는데, `admin-events.ts`에서 가져오면 그 모듈이 끌고 오는 DB 클라이언트가 클라이언트 번들로 따라간다.
 */
export type ContractAdminAction =
  | 'create'
  | 'update'
  | 'send'
  | 'resend'
  | 'cancel'
  | 'delete'
  | 'terminate'
  | 'resend-signed';

export const CONTRACT_ADMIN_ACTION_LABELS: Record<ContractAdminAction, string> = {
  create: '계약서 작성',
  update: '초안 수정',
  send: '고객에게 발송',
  resend: '재발송',
  cancel: '계약 취소',
  delete: '초안 삭제',
  terminate: '이용 종료 처리',
  'resend-signed': '완료 메일 재발송',
};
