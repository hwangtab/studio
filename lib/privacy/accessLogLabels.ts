/**
 * 접속기록 화면의 행동 이름. `privacyAccessActionEnum`의 모든 값이 여기 있어야 한다(accessLogLabels.test.ts가 지킨다) —
 * 빠지면 화면에 영문 코드가 그대로 보인다.
 */
export const ACTION_LABEL: Record<string, string> = {
  funding_resident_number_view: '주민등록번호 조회',
  funding_resident_number_decrypt_check: '주민등록번호 복호화 점검',
  funding_payout_account_view: '정산 계좌 조회',
  funding_payout_account_decrypt_check: '정산 계좌 복호화 점검',
  funding_payout_account_email: '정산 안내 메일의 계좌 복호화',
  funding_pledge_export: '펀딩 주문 CSV',
  funding_pledge_view: '펀딩 후원 상세 열람',
  shop_order_view: '상점 주문 상세 열람',
  software_license_list_view: '소프트웨어 라이선스 목록 열람',
  sales_ledger_export: '매출장부 CSV',
  artist_supporter_export: '아티스트 후원자 CSV',
  funding_creator_shipping_export: '개설자 배송 목록 CSV',
  contract_pdf_download: '계약서 PDF',
  contract_view: '계약서 상세 열람',
  show_roster_export: '공연 명단 CSV',
  shop_artist_shipping_view: '상점 아티스트 발송 화면 열람',
  creator_business_certificate_view: '사업자등록증 열람',
  creator_payout_account_view: '정산 계좌 조회(개설자 단위)',
  refund_account_view: '환불 계좌 조회',
  funding_refund_account_view: '환불 계좌 조회(펀딩)',
};
