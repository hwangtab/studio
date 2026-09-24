import { relations, sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const contractStatusEnum = [
  'draft',
  'sent',
  'signed',
  'cancelled',
  'expired',
  /**
   * 이용이 끝난 계약.
   *
   * 서명까지 마친 계약은 지우거나 되돌릴 수 없지만(법적 보존), 이용 관계는 언젠가 끝난다 —
   * 기간 만료, 중도 퇴실(제4조), 해지(제9조). 그 사실을 적을 자리가 없으면 방이 비어도
   * 시스템은 계속 점유로 보고, 새 이용자에게 그 호실로 계약을 만들 수 없다.
   */
  'terminated',
] as const;
export const signatureStatusEnum = ['pending', 'signed', 'declined'] as const;

export const contracts = sqliteTable('contracts', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => sql`lower(hex(randomblob(16)))`),
  title: text('title').notNull(),
  description: text('description'),

  // 이용자 정보
  customerName: text('customer_name').notNull(),
  customerBirthdate: text('customer_birthdate'),
  customerEmail: text('customer_email').notNull(),
  customerPhone: text('customer_phone').notNull(),
  customerAddress: text('customer_address'),

  // 이용 대상
  roomNumber: text('room_number').notNull(),
  roomArea: text('room_area').default('3m × 2m'),

  // 이용 기간
  startDate: integer('start_date', { mode: 'timestamp' }).notNull(),
  endDate: integer('end_date', { mode: 'timestamp' }).notNull(),

  // 비용
  monthlyRent: integer('monthly_rent').notNull(),
  depositAmount: integer('deposit_amount').notNull(),
  paymentDay: integer('payment_day').notNull().default(1),
  paymentBank: text('payment_bank').default('카카오뱅크'),
  paymentAccount: text('payment_account').default('3333-12-5480849'),
  paymentAccountHolder: text('payment_account_holder').default('황경하 / 스튜디오 놀'),

  // 계약 본문 및 상태
  content: text('content').notNull(), // 마크다운/HTML 계약서 본문
  status: text('status', { enum: contractStatusEnum }).notNull().default('draft'),
  rulesAgreed: integer('rules_agreed', { mode: 'boolean' }).notNull().default(false),
  rulesAgreedAt: integer('rules_agreed_at', { mode: 'timestamp' }),
  specialTerms: text('special_terms'), // 특약사항 JSON 배열

  // 발송·서명
  sentAt: integer('sent_at', { mode: 'timestamp' }),
  signedAt: integer('signed_at', { mode: 'timestamp' }),

  /**
   * 서명 링크가 처음·마지막으로 열린 시각과 횟수, 그리고 처음 연 접속의 IP.
   *
   * 감사추적의 빈칸이었다. 발송(sentAt)과 서명(signedAt)은 남는데 그 사이 "받아서 열어 봤다"가
   * 없어, 서명을 부인당했을 때 사슬이 한 칸 끊긴다. Obi v. Exeter Health(D.N.H. 2019)에서
   * 법원이 위조 주장을 기각한 근거가 바로 이 열람 기록이었고, Moton v. Maplebear(S.D.N.Y.)는
   * "수령·열람·실행"을 잇는 타임스탬프 추적을 진정성립 입증에 충분하다고 봤다.
   *
   * 지문(integrity.ts)에는 넣지 않는다. 지문은 "서명된 문서"를 덮는 것이고 열람은 문서가 아니라
   * 그 주변 정황이다. 계약서 PDF에도 인쇄하지 않는다 — 감사추적은 계약서와 별개 문서로 내는 것이
   * 업계 관행이고(DocuSign Certificate of Completion), 인쇄하면 지문 버전을 올려야 해서
   * 이미 서명된 계약의 대조가 전부 어긋난다. 관리자 감사추적 화면에서 본다.
   *
   * 한계: 일부 메일 보안 스캐너가 링크를 미리 열어 본다. 그런 접속도 열람으로 기록되므로,
   * 이 값은 "당사자가 열었다"가 아니라 "이 링크가 이 시각에 이 IP에서 열렸다"로만 읽어야 한다.
   */
  firstViewedAt: integer('first_viewed_at', { mode: 'timestamp' }),
  lastViewedAt: integer('last_viewed_at', { mode: 'timestamp' }),
  viewCount: integer('view_count').notNull().default(0),
  firstViewedIp: text('first_viewed_ip'),

  /**
   * 서명자가 계약서에 적힌 연락처 뒷자리를 맞춘 시각.
   *
   * 링크를 받은 사람이 계약 당사자인지 확인할 근거다. 완전한 본인인증은 아니지만,
   * "링크만 아는 제3자"는 걸러진다. 값이 없으면 그 확인 없이 서명된 계약이다.
   */
  identityVerifiedAt: integer('identity_verified_at', { mode: 'timestamp' }),

  /**
   * 서명 시점 문서의 SHA-256.
   *
   * 계약 본문·첨부·서명 이미지·서명 시각을 묶어 계산한다. 나중에 다시 계산해 이 값과
   * 맞춰 보면 "그때 서명한 그 문서인지"를 애플리케이션 밖에서도 확인할 수 있다.
   */
  contentHash: text('content_hash'),
  // 서명 링크 만료 시각. 발송(sent 전환) 시점에 설정되며, 재발송하면 갱신된다.
  expiresAt: integer('expires_at', { mode: 'timestamp' }),

  // 서명 인증 토큰 (URL 노출용)
  signToken: text('sign_token').notNull().unique(),
  signTokenUsedAt: integer('sign_token_used_at', { mode: 'timestamp' }),

  // PDF 보관
  pdfUrl: text('pdf_url'),
  pdfGeneratedAt: integer('pdf_generated_at', { mode: 'timestamp' }),

  /**
   * 마지막 알림 메일이 실패한 사유. 성공하면 비운다.
   *
   * 메일 발송은 응답을 보낸 뒤 처리되므로 실패해도 화면에는 아무 표시가 없었다.
   * 고객은 서명 링크를 받지 못했는데 관리자는 발송된 줄 아는 상태가 조용히 유지된다.
   * 실패를 남겨 두어야 관리자가 알아채고 재발송하거나 링크를 직접 전달할 수 있다.
   */
  notificationError: text('notification_error'),
  notifiedAt: integer('notified_at', { mode: 'timestamp' }),

  /**
   * 이용이 실제로 끝난 시각과 사유.
   *
   * 계약서에 적힌 종료일(endDate)과 다를 수 있다 — 중도 퇴실이면 그보다 이르고, 제3조의
   * 자동 갱신으로 계속 이용했다면 그보다 늦다. 호실이 언제부터 비었는지는 이 값이 답한다.
   *
   * 값이 없는 서명 계약은 기간이 지났어도 이용 중으로 본다. 갱신은 통지가 없으면 자동으로
   * 이뤄지므로, 종료일이 지났다는 사실만으로 방이 비었다고 볼 수 없기 때문이다.
   */
  terminatedAt: integer('terminated_at', { mode: 'timestamp' }),
  terminationReason: text('termination_reason'),

  /**
   * 개인정보를 파기한 시각.
   *
   * 계약서 제12조는 "계약 종료 후 3년간 보관한 뒤 파기한다"고 약속한다. 이 값이 있으면
   * 이름·연락처·주소·서명 이미지 등을 지운 뒤이며, 계약 기간·금액처럼 개인을 식별하지
   * 않는 항목만 남아 있다. 같은 계약을 두 번 처리하지 않도록 표식으로도 쓴다.
   */
  purgedAt: integer('purged_at', { mode: 'timestamp' }),

  // 감사
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const contractsRelations = relations(contracts, ({ many }) => ({
  signatures: many(signatures),
  contractClauses: many(contractClauses),
  contractAttachments: many(contractAttachments),
}));

export const signatures = sqliteTable('signatures', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => sql`lower(hex(randomblob(16)))`),
  contractId: text('contract_id')
    .notNull()
    .references(() => contracts.id, { onDelete: 'cascade' }),
  signerName: text('signer_name').notNull(),
  signerEmail: text('signer_email').notNull(),
  signerRole: text('signer_role').notNull().default('customer'), // 'operator' | 'customer'
  status: text('status', { enum: signatureStatusEnum }).notNull().default('pending'),
  signedAt: integer('signed_at', { mode: 'timestamp' }),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  signatureData: text('signature_data'), // 서명 이미지 base64 또는 해시값
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const signaturesRelations = relations(signatures, ({ one }) => ({
  contract: one(contracts, {
    fields: [signatures.contractId],
    references: [contracts.id],
  }),
}));

export const contractClauses = sqliteTable('contract_clauses', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => sql`lower(hex(randomblob(16)))`),
  contractId: text('contract_id')
    .notNull()
    .references(() => contracts.id, { onDelete: 'cascade' }),
  clauseNumber: text('clause_number').notNull(), // e.g. '제5조', '이용수칙 1-1'
  title: text('title').notNull(),
  agreedAt: integer('agreed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const contractClausesRelations = relations(contractClauses, ({ one }) => ({
  contract: one(contracts, {
    fields: [contractClauses.contractId],
    references: [contracts.id],
  }),
}));

export const contractAttachments = sqliteTable('contract_attachments', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => sql`lower(hex(randomblob(16)))`),
  contractId: text('contract_id')
    .notNull()
    .references(() => contracts.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'rules', 'appendix'
  title: text('title').notNull(),
  /**
   * 계약 시점의 첨부 문서 원본.
   *
   * 파일에서 매번 읽으면 수칙을 고치는 순간 이미 서명된 계약의 화면과 PDF까지 바뀐다.
   * 고객이 동의한 문서와 보관되는 문서가 달라지므로, 계약을 만들 때 내용을 그대로
   * 떠서 보관한다(계약 본문 content와 같은 이유).
   */
  content: text('content'),
  agreedAt: integer('agreed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const contractAttachmentsRelations = relations(contractAttachments, ({ one }) => ({
  contract: one(contracts, {
    fields: [contractAttachments.contractId],
    references: [contracts.id],
  }),
}));

// ─── 예약·결제 (Phase 1: 세션 예약) ───────────────────────────────────────────

export const orderStatusEnum = [
  'pending', // 주문 생성, 결제 대기 (15분 슬롯 선점)
  'paid',
  'partially_refunded',
  'refunded',
  'failed', // 승인 실패
  'expired', // 15분 내 미결제
] as const;
export const orderTypeEnum = ['session', 'mixing', 'subscription', 'funding'] as const;
export const bookingStatusEnum = ['pending', 'confirmed', 'completed', 'no_show', 'cancelled'] as const;
export const refundStatusEnum = ['done', 'failed'] as const;
export const refundRequesterEnum = ['customer', 'admin', 'webhook'] as const;

export const orders = sqliteTable('orders', {
  id: text('id').primaryKey().$defaultFn(() => sql`lower(hex(randomblob(16)))`),
  /** 토스 orderId로 그대로 쓰는 외부 노출 주문번호 (SNB-YYYYMMDD-XXXXXX). */
  orderNo: text('order_no').notNull().unique(),
  type: text('type', { enum: orderTypeEnum }).notNull().default('session'),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone').notNull(),
  customerEmail: text('customer_email').notNull(),
  /** 상품가(VAT 별도) + VAT = 합계. 서버가 pricing SSOT에서 계산해 저장한다. */
  itemAmount: integer('item_amount').notNull(),
  vatAmount: integer('vat_amount').notNull(),
  totalAmount: integer('total_amount').notNull(),
  status: text('status', { enum: orderStatusEnum }).notNull().default('pending'),
  /** 예약 확인·셀프 취소 링크 토큰 (계정 없는 게스트의 인증 수단 — contracts signToken 패턴). */
  manageToken: text('manage_token').notNull().unique(),
  /** 마지막 알림 발송 실패 사유. 성공 시 비움 (contracts notificationError 패턴). */
  notificationError: text('notification_error'),
  /**
   * 결제창에서 승인이 안 난 사유. 승인 성공 경로(confirm)는 절대 여기 쓰지 않는다.
   *
   * 토스는 결제가 거절되면 `failUrl`로 `?code=&message=`를 붙여 돌려보내고, 그 경로는
   * confirm 라우트에 도달하지 않는다 — 즉 실패 사유가 우리 쪽에는 한 글자도 남지 않았다.
   * 2026-09-19에 한 후원자가 3분 동안 세 번 시도하고 떠났는데(FND-20260919-784A01D6·
   * 4D2ED6A4·05D892DD, 각 2만원) 왜 실패했는지 확인할 방법이 없었다. 토스 대시보드가
   * 유일한 기록이고 우리 로그·DB·메일 어디에도 없었다.
   *
   * 덮어쓰기다 — 재시도하면 마지막 사유만 남는다. 시도 이력이 필요하면 그때 별도 테이블을
   * 만든다(지금은 주문 자체가 시도마다 새로 생기므로 주문 행이 곧 시도 이력이다).
   */
  paymentFailCode: text('payment_fail_code'),
  /** 토스가 준 원문 메시지. 화면에는 쓰지 않는다(우리 문구로 옮겨 보여준다). */
  paymentFailMessage: text('payment_fail_message'),
  paymentFailedAt: integer('payment_failed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const payments = sqliteTable('payments', {
  id: text('id').primaryKey().$defaultFn(() => sql`lower(hex(randomblob(16)))`),
  orderId: text('order_id').notNull().references(() => orders.id),
  /** 토스 paymentKey. unique가 이중 승인 기록을 DB 층에서 차단한다. */
  paymentKey: text('payment_key').notNull().unique(),
  method: text('method'),
  approvedAt: integer('approved_at', { mode: 'timestamp' }),
  receiptUrl: text('receipt_url'),
  /**
   * 토스 응답 원본 JSON — 분쟁·대사(reconciliation) 근거. 응답 본문을 통째로 싣는다.
   *
   * 최상위에는 구매자 개인정보 필드가 없지만(`customerName`·`customerEmail`·
   * `customerMobilePhone`은 Payment 객체의 최상위 필드가 아니다), 결제수단별 하위 객체에는
   * 실린다 — `virtualAccount`의 구매자명·입금자명·계좌번호·환불계좌 예금주,
   * `mobilePhone`의 휴대폰 번호. 그래서 전자상거래법 5년이 지나면 비운다
   * (`purgeExpiredPaymentRawResponses`, 무엇이 들어 있는지는 그 주석이 자세히 적는다).
   */
  rawResponse: text('raw_response'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const refunds = sqliteTable('refunds', {
  id: text('id').primaryKey().$defaultFn(() => sql`lower(hex(randomblob(16)))`),
  paymentId: text('payment_id').notNull().references(() => payments.id),
  amount: integer('amount').notNull(),
  reason: text('reason').notNull(),
  requestedBy: text('requested_by', { enum: refundRequesterEnum }).notNull(),
  tossTransactionKey: text('toss_transaction_key'),
  status: text('status', { enum: refundStatusEnum }).notNull().default('done'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const bookings = sqliteTable('bookings', {
  id: text('id').primaryKey().$defaultFn(() => sql`lower(hex(randomblob(16)))`),
  orderId: text('order_id').notNull().references(() => orders.id),
  /** lib/booking/products.ts SESSION_PRODUCTS의 id. */
  productId: text('product_id').notNull(),
  /** 서비스 그룹 (recording | voice-acting | wedding-song | cover-video). */
  serviceType: text('service_type').notNull(),
  startAt: integer('start_at', { mode: 'timestamp' }).notNull(),
  endAt: integer('end_at', { mode: 'timestamp' }).notNull(),
  durationHours: integer('duration_hours').notNull(),
  status: text('status', { enum: bookingStatusEnum }).notNull().default('pending'),
  /** 확정 시 생성한 구글 캘린더 이벤트 id. 취소 시 삭제에 쓴다. */
  gcalEventId: text('gcal_event_id'),
  /** 캘린더 이벤트 생성/삭제 실패 사유 — 결제는 성공했으므로 실패를 삼키되 기록한다. */
  gcalError: text('gcal_error'),
  customerNote: text('customer_note'),
  cancelledAt: integer('cancelled_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const workOrderStatusEnum = ['pending', 'received', 'in_progress', 'delivered', 'cancelled'] as const;

/**
 * 믹싱·마스터링 주문형 결제(Phase 2)의 작업 단위. bookings(슬롯 예약)와 달리 시작·종료
 * 시각이 없다 — 파일을 받아 착수하는 작업이라 상태 전이(접수→착수→납품)로만 진행을 표현한다.
 * 한 orders 행은 세션이면 bookings 1건, 믹싱이면 work_orders 1건을 갖는다(둘 다는 없음).
 */
export const workOrders = sqliteTable('work_orders', {
  id: text('id').primaryKey().$defaultFn(() => sql`lower(hex(randomblob(16)))`),
  orderId: text('order_id').notNull().references(() => orders.id),
  /** lib/booking/mixing-products.ts MIXING_PRODUCTS의 id. */
  productId: text('product_id').notNull(),
  /** 'mixing' | 'mastering'. */
  serviceType: text('service_type').notNull(),
  songCount: integer('song_count').notNull(),
  vocalTuning: integer('vocal_tuning', { mode: 'boolean' }).notNull().default(false),
  status: text('status', { enum: workOrderStatusEnum }).notNull().default('pending'),
  customerNote: text('customer_note'),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  deliveredAt: integer('delivered_at', { mode: 'timestamp' }),
  cancelledAt: integer('cancelled_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const availabilityBlocks = sqliteTable('availability_blocks', {
  id: text('id').primaryKey().$defaultFn(() => sql`lower(hex(randomblob(16)))`),
  startAt: integer('start_at', { mode: 'timestamp' }).notNull(),
  endAt: integer('end_at', { mode: 'timestamp' }).notNull(),
  memo: text('memo'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

/**
 * 토스 웹훅 멱등 기록. eventKey가 PK라 같은 이벤트의 두 번째 INSERT는 실패하고,
 * 그 실패가 "이미 처리했다"는 신호다 (처리보다 기록을 먼저 한다).
 */
export const webhookEvents = sqliteTable('webhook_events', {
  eventKey: text('event_key').primaryKey(),
  payload: text('payload').notNull(),
  processedAt: integer('processed_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const ordersRelations = relations(orders, ({ many, one }) => ({
  payments: many(payments),
  bookings: many(bookings),
  fundingPledge: one(fundingPledges, { fields: [orders.id], references: [fundingPledges.orderId] }),
  workOrders: many(workOrders),
  subscriptionPayment: one(subscriptionPayments, { fields: [orders.id], references: [subscriptionPayments.orderId] }),
}));
export const paymentsRelations = relations(payments, ({ one, many }) => ({
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
  refunds: many(refunds),
}));
export const refundsRelations = relations(refunds, ({ one }) => ({
  payment: one(payments, { fields: [refunds.paymentId], references: [payments.id] }),
}));
export const bookingsRelations = relations(bookings, ({ one }) => ({
  order: one(orders, { fields: [bookings.orderId], references: [orders.id] }),
}));
export const workOrdersRelations = relations(workOrders, ({ one }) => ({
  order: one(orders, { fields: [workOrders.orderId], references: [orders.id] }),
}));

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type Refund = typeof refunds.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
export type WorkOrder = typeof workOrders.$inferSelect;
export type NewWorkOrder = typeof workOrders.$inferInsert;
export type AvailabilityBlock = typeof availabilityBlocks.$inferSelect;

// ─── 펀딩 (리워드형 크라우드펀딩) ─────────────────────────────────────────────
// 프로젝트·리워드의 정본은 content/funding/<slug>.md다. 이 테이블은 후원 1건 = 주문 1건의
// 부속 정보(리워드 스냅샷·배송·발송)만 담는다. 돈은 orders/payments/refunds가 SSOT.

export const fundingPaymentMethodEnum = ['toss', 'bank_transfer'] as const;
export const fulfillmentStatusEnum = ['none', 'preparing', 'shipped', 'delivered'] as const;
export const fundingEntrySourceEnum = ['online', 'manual'] as const;

export const fundingPledges = sqliteTable('funding_pledges', {
  id: text('id').primaryKey().$defaultFn(() => sql`lower(hex(randomblob(16)))`),
  orderId: text('order_id').notNull().unique().references(() => orders.id),
  projectSlug: text('project_slug').notNull(),
  /** 후원 시점의 리워드 스냅샷 — 파일이 바뀌어도 기록은 그대로다. */
  rewardId: text('reward_id').notNull(),
  rewardTitle: text('reward_title').notNull(),
  unitAmount: integer('unit_amount').notNull(),
  quantity: integer('quantity').notNull(),
  additionalAmount: integer('additional_amount').notNull().default(0),
  paymentMethod: text('payment_method', { enum: fundingPaymentMethodEnum }).notNull(),
  /** 결제 대기 만료. 토스 +15분, 무통장 +12시간. 지나면 재고 계산에서 빠지고 lazy로 expired 처리. */
  holdExpiresAt: integer('hold_expires_at', { mode: 'timestamp' }).notNull(),
  paidAt: integer('paid_at', { mode: 'timestamp' }),
  /**
   * 디지털 리워드를 **처음 내려받은 시각**. 약관 제8조 2항이 "내려받기가 시작된 뒤에는
   * 청약철회가 제한됩니다"라고 고지하는데(전자상거래법 제17조 2항 5호), 그 판정 근거가
   * 서버에 없어 고지만 있고 구현이 없는 상태였다 — 1.8GB 원본을 받고 전액 환불이 됐다.
   *
   * 값이 있으면 셀프 취소를 막는다(lib/funding/policy.ts assessSelfCancel). 처음 한 번만
   * 쓰고 이후 접근에는 덮어쓰지 않는다 — "시작된 시점"이 판정 기준이다.
   */
  downloadedAt: integer('downloaded_at', { mode: 'timestamp' }),
  supporterMessage: text('supporter_message'),
  displayNamePublic: integer('display_name_public', { mode: 'boolean' }).notNull().default(false),
  shippingName: text('shipping_name'),
  shippingPhone: text('shipping_phone'),
  shippingPostcode: text('shipping_postcode'),
  shippingAddress1: text('shipping_address1'),
  shippingAddress2: text('shipping_address2'),
  shippingMemo: text('shipping_memo'),
  fulfillmentStatus: text('fulfillment_status', { enum: fulfillmentStatusEnum }).notNull().default('none'),
  trackingCompany: text('tracking_company'),
  trackingNumber: text('tracking_number'),
  /**
   * 발송 상태를 마지막으로 바꾼 주체 — `'admin'` 또는 `'creator:<creatorId>'`.
   *
   * `admin_memo`에 적지 않는다. `admin_memo`는 배송지·응원 메시지와 함께 `retention.ts`의
   * 파기 대상이라(리워드 전달 후 1년, 법정 보존 5년 뒤), 거기 적으면 감사 기록이 개인정보와
   * 같은 시점에 사라진다. 이 값은 후원자의 개인정보가 아니라 운영자·개설자 쪽 행위자
   * 식별자라 같은 파기 사유가 적용되지 않으므로 별도 컬럼에 남겨 파기 대상에서 제외한다.
   */
  fulfillmentUpdatedBy: text('fulfillment_updated_by'),
  entrySource: text('entry_source', { enum: fundingEntrySourceEnum }).notNull().default('online'),
  /**
   * 약관·처리방침 동의 시각과 동의한 판본. 지금까지는 동의 사실이 행에 남지 않아, 분쟁이 나면
   * "그때 무엇에 동의했는가"를 git 이력으로 손수 대조해야 했다.
   *
   * nullable로 두는 이유: 관리자 수기 등록(entry_source='manual')처럼 온라인 동의 절차를
   * 거치지 않은 행이 있고, 그런 행을 빈 문자열로 채우면 "동의했는데 값이 비었다"와
   * "동의 절차가 없었다"를 구분할 수 없다. 온라인 후원(createFundingPledge)은 항상 채운다.
   */
  termsAgreedAt: integer('terms_agreed_at', { mode: 'timestamp' }),
  termsVersion: text('terms_version'),
  /**
   * 리워드 전달 완료 시각. 약관 제13조가 약속한 '리워드 전달 완료 후 1년 파기'의 기산점이라,
   * 이 값이 없으면 그 파기 의무를 이행할 수단 자체가 없다.
   * fulfillment_status가 'delivered'로 바뀌는 경로(pages/api/admin/funding/pledges/[id].ts)가
   * COALESCE로 첫 전달 시각을 채우고, 'delivered'에서 되돌리면 NULL로 되돌린다.
   */
  deliveredAt: integer('delivered_at', { mode: 'timestamp' }),
  /** 무통장 후원자의 셀프 취소 요청 시각. 운영자가 계좌 환불 후 orders를 refunded로 바꾼다. */
  refundRequestedAt: integer('refund_requested_at', { mode: 'timestamp' }),
  adminMemo: text('admin_memo'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const fundingPledgesRelations = relations(fundingPledges, ({ one }) => ({
  order: one(orders, { fields: [fundingPledges.orderId], references: [orders.id] }),
}));

export type FundingPledge = typeof fundingPledges.$inferSelect;
export type NewFundingPledge = typeof fundingPledges.$inferInsert;

// ─── 펀딩 셀프 개설 (아티스트가 직접 신청·등록) ────────────────────────────────
// 1차 스펙은 "프로젝트 정본 = content/funding/<slug>.md"였다. 그 설계는 편집자가 운영자
// 한 명이라는 전제 위에 서 있었고, 개설 주체가 아티스트로 바뀌면서 그 전제가 깨졌다.
// 아래 테이블이 새 정본이며, md는 진행 중 프로젝트가 끝날 때까지만 공존한다(스펙 D5).
// 읽을 때는 항상 md가 먼저다 — lib/funding/repository.ts.

export const fundingCreatorTaxTypeEnum = ['withholding', 'invoice'] as const;

export const fundingCreators = sqliteTable('funding_creators', {
  id: text('id').primaryKey().$defaultFn(() => sql`lower(hex(randomblob(16)))`),
  /** 로그인 식별자. 저장 전에 소문자로 정규화한다(lib/funding/creatorToken.ts). */
  email: text('email').notNull().unique(),
  /** 공개되는 이름 — 팀·아티스트 이름. */
  name: text('name').notNull(),
  /** 운영자 연락용. 공개하지 않는다. */
  contactName: text('contact_name'),
  phone: text('phone'),
  /** 공개 소개. 개설자 구획(2차)이 채운다 — 비어 있을 수 있다. */
  bio: text('bio'),
  /** http(s) 링크 배열의 JSON 문자열. 개설자 구획(2차)이 채운다 — 비어 있을 수 있다. */
  links: text('links'),
  /**
   * 정산 시 세금 처리. 승인 전에는 비어 있다 — 반려될 신청서에 계좌·주민번호 성격의
   * 정보를 미리 받지 않는다(스펙 §6.2).
   */
  taxType: text('tax_type', { enum: fundingCreatorTaxTypeEnum }),
  /**
   * 정산 계좌 한 벌 — 은행명·계좌번호·예금주를 **하나의 암호문으로** 담는다
   * (`lib/funding/payoutAccountCrypto.ts`가 JSON 봉투로 싸서 `encryptField`에 넘긴다).
   *
   * **세 값을 한 컬럼에 묶은 이유.** 셋은 언제나 함께 저장되고(`savePayoutSection`이 한 번에
   * 덮어쓴다) 함께 쓰인다(셋이 다 있어야 이체가 된다). 컬럼을 셋으로 나누면 키 회전이
   * 중간에 멈췄을 때 "은행명만 새 키"인 행이 생기고, 조회가 셋 중 몇 개만 열리는 상태를
   * 화면과 정산 게이트가 각각 해석해야 한다. 한 봉투면 상태가 둘뿐이다 — 열리거나, 안 열리거나.
   *
   * **은행명·예금주까지 암호화하는 이유.** 계좌번호만 잠그면 유출된 행에 거래 은행이 그대로
   * 남는다(예금주는 `name`·`contact_name`이 이미 평문이라 추가 손실이 적지만, 은행은 이
   * 행에서만 나오는 정보다). 반대로 셋을 다 잠가서 불편해지는 것은 "키가 없으면 은행·예금주도
   * 못 본다"인데, 그 상태에서는 계좌번호도 못 읽어 어차피 이체를 못 한다 — 업무 영향이 같다.
   */
  payoutAccountEnc: text('payout_account_enc'),
  /**
   * 계좌번호 뒤 4자리 — **평문이다.** 주민등록번호와 일부러 다르게 판단했다.
   *
   * 주민등록번호는 어느 조각도 무해하지 않아(앞 6자리가 생년월일, 뒤 7자리가 고유식별정보)
   * 표시용 컬럼을 두지 않았다. 계좌 뒤 4자리는 그 자체로 계좌를 특정하지도, 이체를 받지도
   * 못하는 확인용 조각이고, 이미 정산 안내 메일 본문에 평문으로 나간다
   * (`lib/funding/payoutEmail.ts`) — DB에서만 감추는 것은 방어가 아니라 불편이다.
   *
   * 그 불편이 구체적으로 무엇인가: 개설자 편집 화면과 정산 미리보기는 "계좌가 등록됐는가"와
   * "뒤 4자리"만 본다. 이 컬럼이 없으면 그 화면들이 매번 복호화를 해야 하고, 키가 없거나
   * 회전 중이면 개설자가 자기 계좌의 등록 여부조차 확인하지 못한다.
   */
  payoutAccountLast4: text('payout_account_last4'),
  /**
   * @deprecated 평문 계좌 컬럼. **읽지도 쓰지도 마라** — 위 두 컬럼이 정본이다.
   *
   * 남겨 둔 이유는 배포 순서다. 이 저장소는 마이그레이션을 먼저 적용하고 코드를 나중에
   * 배포하는데(CLAUDE.md), 컬럼을 지우면 그 사이에 도는 옛 코드가 없는 컬럼을 읽어
   * 개설자 화면과 정산 미리보기가 깨진다. 운영 DB에 `funding_creators`가 0행이라 지켜야 할
   * 값이 없으므로 마이그레이션이 세 컬럼을 NULL로 비우고, 코드는 더 이상 이 이름들을
   * 참조하지 않는다(`lib/funding/payoutPlaintextColumns.test.ts`가 그것을 고정한다).
   * 이 판을 배포한 뒤 별도 마이그레이션으로 지우면 된다.
   */
  payoutBankName: text('payout_bank_name'),
  /** @deprecated `payoutAccountEnc`로 대체됐다. 위 주석 참고. */
  payoutAccount: text('payout_account'),
  /** @deprecated `payoutAccountEnc`로 대체됐다. 위 주석 참고. */
  payoutHolder: text('payout_holder'),
  /**
   * 주민등록번호 — **암호화한 문자열만** 들어간다(`lib/crypto/fieldCrypto.ts`,
   * 새로 쓰는 것은 `v2:<keyId>:<iv>:<tag>:<ct>`, 이미 저장된 `v1:<iv>:<tag>:<ct>`도 읽는다). 평문 컬럼도, 생년월일만 떼어 둔 표시용 컬럼도 만들지 않는다 —
   * 일부를 평문으로 두면 암호화의 의미가 준다. 화면은 등록 여부만 안다.
   *
   * 근거는 대통령령인 소득세법 시행령 제147조의7제1항제1호 가목(지급명세서의 "납세번호
   * (주민등록번호로 갈음하는 경우에는 주민등록번호)")이고, 그래서 `taxType === 'withholding'`인
   * 개설자에게만 받는다 — 개인정보 보호법 제24조의2제1항제1호는 법률·대통령령 등에
   * 구체적인 근거가 있을 때만 주민등록번호 처리를 허용하고, 그 열거에 부령(서식)은 없다. 사업자로 바꾸면 근거가 사라지므로
   * `savePayoutSection`이 이 값을 지운다 — **다만 이미 원천징수해 기록한 정산이 있으면
   * 지우지 않는다.** 그때는 이미 지급한 소득의 지급명세서 제출 의무가 근거로 남는다.
   */
  residentNumberEnc: text('resident_number_enc'),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

/**
 * 매직링크 토큰.
 *
 * **원문은 저장하지 않는다.** 이 테이블을 읽을 수 있는 쪽이 곧바로 남의 계정으로 들어갈 수
 * 있으면 저장의 의미가 없다. 원문은 메일에만 실리고 우리는 sha256만 갖는다.
 */
export const fundingCreatorTokens = sqliteTable('funding_creator_tokens', {
  tokenHash: text('token_hash').primaryKey(),
  creatorId: text('creator_id').notNull().references(() => fundingCreators.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  /** 소진 시각. 값이 있으면 다시 쓸 수 없다 — 메일이 전달·보관되는 경로를 감안한 1회용. */
  usedAt: integer('used_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

/** 심사 상태. 공개 여부(status)와는 다른 축이다 — 승인된 뒤에야 status가 의미를 갖는다. */
export const fundingReviewStatusEnum = ['draft', 'submitted', 'changes_requested', 'approved', 'rejected'] as const;
/** 공개 상태. md frontmatter의 status와 같은 값 집합이다(lib/funding/shape.ts). */
export const fundingProjectStatusEnum = ['auto', 'draft', 'closed'] as const;

export const fundingProjects = sqliteTable('funding_projects', {
  id: text('id').primaryKey().$defaultFn(() => sql`lower(hex(randomblob(16)))`),
  /**
   * 공개 주소이자 후원 행(funding_pledges.project_slug)이 문자열로 참조하는 키.
   * 승인 시 확정하고 그 뒤에는 바꾸지 않는다 — 바꾸면 진행 중 모금액이 공개적으로 0원이
   * 되고 기존 후원자가 관리 페이지에서 프로젝트를 찾지 못한다(CLAUDE.md).
   */
  slug: text('slug').notNull().unique(),
  creatorId: text('creator_id').notNull().references(() => fundingCreators.id),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  /** 마크다운 본문. 렌더는 MarkdownRenderer가 하되 개설자 모드로 숏코드를 벗긴다(2차). */
  content: text('content').notNull(),
  coverUrl: text('cover_url').notNull(),
  ogImageUrl: text('og_image_url'),
  heroImageUrl: text('hero_image_url'),
  goalAmount: integer('goal_amount').notNull(),
  startAt: integer('start_at', { mode: 'timestamp' }).notNull(),
  endAt: integer('end_at', { mode: 'timestamp' }).notNull(),
  reviewStatus: text('review_status', { enum: fundingReviewStatusEnum }).notNull().default('draft'),
  /**
   * 승인 전에는 항상 'draft'다 — 심사를 통과하지 않은 프로젝트가 공개 경로에 나타나는 일이
   * 없도록 두 축이 모두 잠겨 있어야 한다.
   */
  status: text('status', { enum: fundingProjectStatusEnum }).notNull().default('draft'),
  hidden: integer('hidden', { mode: 'boolean' }).notNull().default(false),
  /** 운영자 → 개설자 메시지. 보완 요청·반려 사유. */
  reviewNote: text('review_note'),
  submittedAt: integer('submitted_at', { mode: 'timestamp' }),
  approvedAt: integer('approved_at', { mode: 'timestamp' }),
  rejectedAt: integer('rejected_at', { mode: 'timestamp' }),
  /** 개설자가 동의한 개설자 약관 판본과 시각. 후원자 쪽 terms_version과 같은 취지의 증거다. */
  creatorTermsVersion: text('creator_terms_version'),
  creatorTermsAgreedAt: integer('creator_terms_agreed_at', { mode: 'timestamp' }),
  /**
   * 운영자 전용 메모. `review_note`와 달리 개설자에게 **어떤 경로로도 보이지 않는다**.
   *
   * 3차까지는 `review_note` 한 칸을 네 가지가 공유했고(보완 요청 사유·반려 사유·보관 사유·
   * set_review_note) 그 전부가 개설자 화면 두 곳에 렌더됐다 — 운영자가 내부 기록이라 믿고
   * 적은 문장이 개설자에게 즉시 보였다.
   */
  internalNote: text('internal_note'),
  /**
   * 개설자가 **승인된 뒤에** 내용을 고친 마지막 시각.
   *
   * `updated_at`으로는 알 수 없다 — 관리자 쓰기(`set_review_note` 등)도 그 값을 갱신하므로
   * 운영자가 메모만 달아도 "개설자가 고쳤다"로 보인다. 개설자의 승인 후 저장에서만 찍는다.
   */
  creatorEditedAt: integer('creator_edited_at', { mode: 'timestamp' }),
  /** 사이트맵 lastmod (YYYY-MM-DD). 공개 필드가 바뀔 때만 갱신한다 — 파일 mtime을 쓰지 않는 것과 같은 이유. */
  lastmod: text('lastmod'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const fundingRewards = sqliteTable(
  'funding_rewards',
  {
    id: text('id').primaryKey().$defaultFn(() => sql`lower(hex(randomblob(16)))`),
    projectId: text('project_id').notNull().references(() => fundingProjects.id, { onDelete: 'cascade' }),
    /**
     * md의 rewards[].id와 같은 것. 후원 행(funding_pledges.reward_id)이 이 문자열을 참조하고,
     * 재고 집계 조건이 `fp.reward_id = <이 값>`이다. 승인 뒤 바꾸면 그 순간 기존 후원이
     * 안 세어져 한정 100개짜리가 200개 팔린다(CLAUDE.md).
     */
    rewardId: text('reward_id').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    /** VAT 포함가. */
    amount: integer('amount').notNull(),
    /** null = 무제한. */
    totalQuantity: integer('total_quantity'),
    requiresShipping: integer('requires_shipping', { mode: 'boolean' }).notNull().default(false),
    estimatedDelivery: text('estimated_delivery').notNull(),
    imageUrl: text('image_url'),
    /** [{label, key}] JSON. key는 R2 객체 키이지 주소가 아니다. 1차에서는 운영자만 채운다. */
    downloads: text('downloads'),
    sortOrder: integer('sort_order').notNull().default(0),
    /**
     * 승인 시각. **null이 아니면 rewardId·amount·totalQuantity 유무를 바꿀 수 없고 행을
     * 지울 수도 없다** — 운영자에게도 예외가 없다. md 시절 이 규칙을 지키던 것은
     * content/funding.baseline.json이었고, 정본이 옮겨 온 만큼 자물쇠도 함께 옮긴다.
     * 가격을 바꿔야 하면 기존 행을 두고 새 rewardId로 티어를 추가한다.
     */
    lockedAt: integer('locked_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  },
  (t) => ({
    projectRewardUnique: uniqueIndex('funding_rewards_project_reward_unique').on(t.projectId, t.rewardId),
  }),
);

export const fundingProjectPayoutStatusEnum = ['pending', 'paid'] as const;

/**
 * 프로젝트 정산. artist_payouts와 같은 꼴이다 — 기록 시점의 숫자를 고정해, 나중에 환불이
 * 더 들어와도 이미 지급한 금액이 뒤늦게 달라지지 않게 한다.
 */
export const fundingProjectPayouts = sqliteTable('funding_project_payouts', {
  id: text('id').primaryKey().$defaultFn(() => sql`lower(hex(randomblob(16)))`),
  projectId: text('project_id').notNull().unique().references(() => fundingProjects.id),
  grossAmount: integer('gross_amount').notNull(),
  refundAmount: integer('refund_amount').notNull(),
  supplyAmount: integer('supply_amount').notNull(),
  /**
   * 플랫폼 수수료. 상품마다 계산 축이 다르다 —
   * 아티스트 정산(공급가 기준): feeAmount = supply − share.
   * 펀딩 정산(결제액 기준): feeAmount = platformFee + paymentFee(둘 다 netGross 기준),
   * supply는 장부용 부가세 제외 표시값일 뿐이라 supply − share와 값이 다르다.
   * 기록해 두지 않으면 세금계산서·장부에서 역산해야 한다.
   */
  feeAmount: integer('fee_amount').notNull(),
  /**
   * feeAmount의 항목별 내역. 합계만 남기면 플랫폼 수수료(스튜디오 매출 — 부가세 대상이고
   * 개설자에게 세금계산서를 발행한다)와 결제 수수료(토스로 통과하는 몫)를 기록에서 가를 수
   * 없고, 요율이 바뀐 뒤에는 역산도 안 된다. 이 표의 존재 이유가 "기록 시점의 숫자를
   * 고정"하는 것이므로 항목도 그때 함께 고정한다.
   */
  platformFeeAmount: integer('platform_fee_amount').notNull().default(0),
  paymentFeeAmount: integer('payment_fee_amount').notNull().default(0),
  shareAmount: integer('share_amount').notNull(),
  withholdingAmount: integer('withholding_amount').notNull(),
  netAmount: integer('net_amount').notNull(),
  backerCount: integer('backer_count').notNull(),
  status: text('status', { enum: fundingProjectPayoutStatusEnum }).notNull().default('pending'),
  paidAt: integer('paid_at', { mode: 'timestamp' }),
  memo: text('memo'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const fundingProjectsRelations = relations(fundingProjects, ({ one, many }) => ({
  creator: one(fundingCreators, { fields: [fundingProjects.creatorId], references: [fundingCreators.id] }),
  rewards: many(fundingRewards),
}));

export const fundingRewardsRelations = relations(fundingRewards, ({ one }) => ({
  project: one(fundingProjects, { fields: [fundingRewards.projectId], references: [fundingProjects.id] }),
}));

export type FundingCreator = typeof fundingCreators.$inferSelect;
export type NewFundingCreator = typeof fundingCreators.$inferInsert;
export type FundingCreatorToken = typeof fundingCreatorTokens.$inferSelect;
export type FundingProjectRow = typeof fundingProjects.$inferSelect;
export type NewFundingProjectRow = typeof fundingProjects.$inferInsert;
export type FundingRewardRow = typeof fundingRewards.$inferSelect;
export type NewFundingRewardRow = typeof fundingRewards.$inferInsert;
export type FundingProjectPayout = typeof fundingProjectPayouts.$inferSelect;

/**
 * 요청 제한 카운터. 서버리스는 인스턴스가 여러 개라 프로세스 메모리로는 제한이 새기
 * 때문에, 이미 붙어 있는 Turso를 공유 저장소로 쓴다(관리자 로그인은 빈도가 매우 낮아
 * 전용 Redis를 둘 만한 부하가 아니다).
 */
export const rateLimits = sqliteTable('rate_limits', {
  /** 제한 대상 식별자 — 예: `admin_login:ip:1.2.3.4` */
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  /** 현재 창이 끝나는 시각 (epoch seconds). 지나면 카운터를 새로 시작한다. */
  expiresAt: integer('expires_at').notNull(),
});

export type RateLimit = typeof rateLimits.$inferSelect;

/**
 * Instagram·Threads 장기 액세스 토큰.
 *
 * 두 API 모두 영구 토큰이 없다 — 60일 토큰을 refresh로 무제한 연장할 수 있을 뿐이고, 만료된
 * 뒤에는 연장이 안 된다. 갱신은 Vercel Cron(api/cron/social-refresh)이 주간으로 하는데,
 * 갱신된 토큰을 Vercel 환경 변수에 되쓰면 다음 배포 전까지 함수가 옛 값을 보므로 환경 변수는
 * 저장소로 못 쓴다. 이미 붙어 있는 Turso가 런타임에 읽고 쓸 수 있는 유일한 공유 저장소다.
 * 로컬 CLI(scripts/social)도 같은 행을 읽는다.
 */
export const socialTokens = sqliteTable('social_tokens', {
  /** 'ig' | 'threads' */
  platform: text('platform').primaryKey(),
  accessToken: text('access_token').notNull(),
  /** 만료 시각 (epoch seconds). refresh 응답의 expires_in으로 계산한다. */
  expiresAt: integer('expires_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export type SocialToken = typeof socialTokens.$inferSelect;

export type Contract = typeof contracts.$inferSelect;
export type NewContract = typeof contracts.$inferInsert;
export type Signature = typeof signatures.$inferSelect;
export type NewSignature = typeof signatures.$inferInsert;
export type ContractClause = typeof contractClauses.$inferSelect;
export type NewContractClause = typeof contractClauses.$inferInsert;
export type ContractAttachment = typeof contractAttachments.$inferSelect;
export type NewContractAttachment = typeof contractAttachments.$inferInsert;

// ─── 구독 자동결제 (Phase 3: 빌링키 정기결제) ─────────────────────────────────
// 연습실 월 이용료·프로듀싱 레슨 월정액. 회차마다 orders 1건 + payments 1건을 남겨
// 기존 관리자·웹훅·환불 도구가 그대로 붙는다(구독 전용 정산 경로를 새로 만들지 않는다).

/**
 * 'artist-support'는 아티스트 구독(Patreon형 월 후원, 스펙 docs/superpowers/specs/2026-09-08-artist-support-design.md).
 * 후원자는 스튜디오 놀의 멤버십을 사고(계약 상대는 스튜디오), 아티스트에게는 스튜디오가 월 1회
 * 지급한다. 연습실·레슨과 같은 빌링 엔진(빌링키·회차·cron·환불)을 그대로 타며, 다른 점은
 * 금액이 상품 고정가가 아니라 후원자가 고른 등급(tierId)에서 온다는 것과 artistSlug·표시명이 붙는 것뿐이다.
 */
export const subscriptionKindEnum = ['practice-room', 'lesson', 'artist-support'] as const;
export const subscriptionStatusEnum = [
  'pending_card', // 생성됨, 카드 등록 전 (첫 결제까지 성공해야 active)
  'active',
  'past_due', // 회차 결제 실패, 재시도 대기
  'paused', // 청구 정지. 사유는 pausedReason이 가른다(재시도 한도 소진 / 운영자 정지)
  'cancelled', // 해지 예약. endsAt까지는 이용 가능
  'ended',
] as const;
/**
 * `paused`가 **왜** paused인가.
 *
 * 하나의 `paused`에 성질이 정반대인 둘이 들어 있었다. `payment_failed`는 카드가 계속
 * 거절돼 시스템이 세운 것이고(`chargeCycle`의 재시도 한도 소진 분기), `operator`는 카드가
 * 멀쩡한 정상 구독의 청구만 운영자가 멈춰 둔 것이다(`pauseSubscription`). 값이 같으니
 * 방치 판정(`closeDormantSubscriptions`)도 관리자 화면도 둘을 구분하지 못했다.
 */
export const subscriptionPausedReasonEnum = ['payment_failed', 'operator'] as const;
export const subscriptionPaymentStatusEnum = ['pending', 'paid', 'failed'] as const;
/**
 * 카드 등록 링크의 용도.
 *
 * 'initial'은 발급 직후 첫 달치를 즉시 결제하지만, 'change'(카드 교체)는 결제하지 않고
 * 키만 갈아 끼운다. 같은 등록 페이지·같은 토큰 구조를 쓰기 때문에, 어느 쪽인지 서버가
 * 알지 못하면 카드만 바꾸려던 고객에게 한 달치가 더 청구된다.
 */
export const subscriptionSetupModeEnum = ['initial', 'change'] as const;

export const subscriptions = sqliteTable('subscriptions', {
  id: text('id').primaryKey().$defaultFn(() => sql`lower(hex(randomblob(16)))`),
  kind: text('kind', { enum: subscriptionKindEnum }).notNull(),
  /** 연습실만 채워진다 — 임대차 계약이 청구 근거이자 금액·결제일의 출처다. */
  contractId: text('contract_id').references(() => contracts.id),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone').notNull(),
  customerEmail: text('customer_email').notNull(),
  /**
   * 토스 빌링의 고객 식별자. 구독마다 고유하고 예측 불가여야 한다는 토스 규격이라
   * `sub_` + uuid로 만든다(구독 id를 그대로 쓰지 않는 이유 — URL에 노출되는 값이다).
   */
  customerKey: text('customer_key').notNull().unique(),
  /** 월 상품가(VAT 별도) + VAT = 청구액. 생성 시점 pricing SSOT에서 계산해 고정한다. */
  itemAmount: integer('item_amount').notNull(),
  vatAmount: integer('vat_amount').notNull(),
  totalAmount: integer('total_amount').notNull(),
  /** 1~31. 연습실은 계약서 paymentDay. 그 달에 없는 날이면 말일에 청구(계약 제2조 ①). */
  billingDay: integer('billing_day').notNull(),
  status: text('status', { enum: subscriptionStatusEnum }).notNull().default('pending_card'),
  /**
   * `status = 'paused'`일 때 그 정지가 어디서 왔는지. 다른 상태에서는 NULL이다.
   *
   * **NULL은 "사유를 모른다"이지 "정지가 아니다"가 아니다.** 이 컬럼이 생기기 전에 정지된
   * 행에는 값이 없고, 그 행이 어느 쪽이었는지는 되살릴 방법이 없다(전이 이력을 남기는 표가
   * 없다). 읽는 쪽은 NULL을 `operator`와 **같은 쪽으로 다뤄야 한다** — 틀렸을 때의 대가가
   * 한쪽으로만 크기 때문이다. 운영자 정지를 결제 실패로 착각하면 살아 있는 구독이 경고 없이
   * `ended`가 되어 되돌릴 길이 없고(`resumeSubscription`은 `paused`만 받는다), 반대로
   * 착각하면 이미 죽은 구독에 대한 경보가 한 줄 더 뜰 뿐이다.
   *
   * 채우는 곳은 `lib/billing/service.ts`의 두 자리뿐이고(`chargeCycle`의 재시도 한도 소진,
   * `pauseSubscription`), `active`로 돌아가는 전이가 비운다.
   */
  pausedReason: text('paused_reason', { enum: subscriptionPausedReasonEnum }),
  /**
   * 현재 유효한 카드. billing_keys가 subscriptions를 참조하므로 여기서 FK를 걸면
   * 순환 참조가 된다 — 값은 billing_keys.id이고 무결성은 서비스 계층이 지킨다.
   */
  billingKeyId: text('billing_key_id'),
  nextBillingAt: integer('next_billing_at', { mode: 'timestamp' }),
  currentPeriodStart: integer('current_period_start', { mode: 'timestamp' }),
  currentPeriodEnd: integer('current_period_end', { mode: 'timestamp' }),
  /** 카드 등록 링크 토큰. 1회성(발급 성공 시 비운다) + 7일 만료 — 결제수단을 다루는 링크라 상시 토큰으로 두지 않는다. */
  setupToken: text('setup_token').unique(),
  setupTokenExpiresAt: integer('setup_token_expires_at', { mode: 'timestamp' }),
  setupMode: text('setup_mode', { enum: subscriptionSetupModeEnum }).notNull().default('initial'),
  /** 고객 조회·해지 링크 토큰 (orders.manageToken과 같은 성질의 상시 토큰). */
  manageToken: text('manage_token').notNull().unique(),
  // ── 아티스트 구독(kind='artist-support')에서만 채워진다 ──
  /** data/artists/index.ts의 slug. 아티스트 페이지 후원자 명단·정산 집계의 키. */
  artistSlug: text('artist_slug'),
  /** data/pricing.ts ARTIST_SUPPORT_TIERS의 id. 금액은 생성 시점에 itemAmount 등으로 고정되므로 표시·통계용. */
  tierId: text('tier_id'),
  /** 후원자 명단에 실을 이름. displayConsent가 참일 때만 공개한다. */
  displayName: text('display_name'),
  displayConsent: integer('display_consent', { mode: 'boolean' }).notNull().default(false),
  cancelledAt: integer('cancelled_at', { mode: 'timestamp' }),
  cancelReason: text('cancel_reason'),
  /** 해지 예정일 = 이미 결제한 기간의 끝. 이 시각이 지나면 ended로 넘어간다. */
  endsAt: integer('ends_at', { mode: 'timestamp' }),
  notificationError: text('notification_error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const billingKeys = sqliteTable('billing_keys', {
  id: text('id').primaryKey().$defaultFn(() => sql`lower(hex(randomblob(16)))`),
  subscriptionId: text('subscription_id').notNull().references(() => subscriptions.id),
  /** 토스 빌링키. 서버 밖으로 나가지 않는다(로그·메일 금지, 스펙 §9). */
  billingKey: text('billing_key').notNull().unique(),
  cardCompany: text('card_company'),
  cardNumberMasked: text('card_number_masked'),
  cardType: text('card_type'),
  issuedAt: integer('issued_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  /** 카드 교체·해지로 더는 쓰지 않는 키. 행을 지우지 않는 이유는 과거 회차의 결제 수단 근거이기 때문. */
  revokedAt: integer('revoked_at', { mode: 'timestamp' }),
  /**
   * 빌링키 발급 응답 원본 JSON. **빌링키 문자열 자체**와 카드 정보(발급사·마스킹 번호·종류)가
   * 들어 있다. 이름·생년월일·사업자등록번호는 없다 — `customerIdentityNumber`는 요청에만
   * 있는 값이고 응답에 되돌아오지 않으며, 우리 발급 요청은 `authKey`·`customerKey`뿐이다.
   * `customerKey`는 난수라 개인정보가 아니다(`lib/billing/token.ts`).
   *
   * 대금이 오간 기록이 아니라 결제수단 자격증명이라 5년 보존 대상이 아니다 — 쓸 수 없게 된
   * 순간 비운다(`purgeUnusableBillingKeyRawResponses`).
   */
  rawResponse: text('raw_response'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

/**
 * 회차 결제 시도 1건. (subscriptionId, cycleYm, attempt) 유니크가 같은 달의 같은 시도를
 * DB 층에서 막고, attempt가 토스 멱등키에도 들어간다 — 재시도가 최초 실패 응답을
 * replay하면 영영 결제되지 않기 때문이다(토스는 같은 멱등키에 최초 응답을 재사용한다).
 */
export const subscriptionPayments = sqliteTable(
  'subscription_payments',
  {
    id: text('id').primaryKey().$defaultFn(() => sql`lower(hex(randomblob(16)))`),
    subscriptionId: text('subscription_id').notNull().references(() => subscriptions.id),
    orderId: text('order_id').notNull().references(() => orders.id),
    /** 청구 대상 월 'YYYY-MM' (KST 기준). */
    cycleYm: text('cycle_ym').notNull(),
    attempt: integer('attempt').notNull(),
    amount: integer('amount').notNull(),
    status: text('status', { enum: subscriptionPaymentStatusEnum }).notNull().default('pending'),
    tossCode: text('toss_code'),
    tossMessage: text('toss_message'),
    paymentKey: text('payment_key'),
    attemptedAt: integer('attempted_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    paidAt: integer('paid_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  },
  (t) => ({
    cycleAttemptUnique: uniqueIndex('subscription_payments_cycle_attempt_unique').on(
      t.subscriptionId,
      t.cycleYm,
      t.attempt,
    ),
  }),
);

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  contract: one(contracts, { fields: [subscriptions.contractId], references: [contracts.id] }),
  billingKeys: many(billingKeys),
  subscriptionPayments: many(subscriptionPayments),
}));
export const billingKeysRelations = relations(billingKeys, ({ one }) => ({
  subscription: one(subscriptions, { fields: [billingKeys.subscriptionId], references: [subscriptions.id] }),
}));
export const subscriptionPaymentsRelations = relations(subscriptionPayments, ({ one }) => ({
  subscription: one(subscriptions, { fields: [subscriptionPayments.subscriptionId], references: [subscriptions.id] }),
  order: one(orders, { fields: [subscriptionPayments.orderId], references: [orders.id] }),
}));

// ─── 아티스트 구독 정산 ───────────────────────────────────────────────────────
// 월 단위·아티스트별 지급 기록. 금액은 subscription_payments·refunds에서 계산해 **기록 시점에
// 고정**한다 — 나중에 환불이 더 들어와도 이미 지급한 달의 숫자는 바뀌지 않아야 한다.
// 계산식은 lib/artistSupport/payout.ts(스펙 §10).

export const artistPayoutStatusEnum = ['pending', 'paid'] as const;

export const artistPayouts = sqliteTable(
  'artist_payouts',
  {
    id: text('id').primaryKey().$defaultFn(() => sql`lower(hex(randomblob(16)))`),
    artistSlug: text('artist_slug').notNull(),
    /** 'YYYY-MM' (KST). subscription_payments.cycle_ym과 같은 기준. */
    period: text('period').notNull(),
    /** 그 달 결제 완료 회차 합계(VAT 포함). */
    grossAmount: integer('gross_amount').notNull(),
    /** 그 회차들에 대한 환불 합계. */
    refundAmount: integer('refund_amount').notNull(),
    /** gross − refund − VAT. */
    supplyAmount: integer('supply_amount').notNull(),
    /** supply × 지급률. */
    shareAmount: integer('share_amount').notNull(),
    /** 원천징수(사업소득 3.3%). 세금계산서 아티스트는 0. */
    withholdingAmount: integer('withholding_amount').notNull(),
    /** 실제 이체액 = share − withholding. */
    netAmount: integer('net_amount').notNull(),
    subscriberCount: integer('subscriber_count').notNull(),
    status: text('status', { enum: artistPayoutStatusEnum }).notNull().default('pending'),
    paidAt: integer('paid_at', { mode: 'timestamp' }),
    memo: text('memo'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  },
  (t) => ({
    // 한 아티스트의 한 달은 한 번만 정산한다 — 두 번 기록되면 두 번 지급된다.
    artistPeriodUnique: uniqueIndex('artist_payouts_artist_period_unique').on(t.artistSlug, t.period),
  }),
);

export type ArtistPayout = typeof artistPayouts.$inferSelect;
export type NewArtistPayout = typeof artistPayouts.$inferInsert;

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type BillingKey = typeof billingKeys.$inferSelect;
export type NewBillingKey = typeof billingKeys.$inferInsert;
export type SubscriptionPayment = typeof subscriptionPayments.$inferSelect;
export type NewSubscriptionPayment = typeof subscriptionPayments.$inferInsert;

/**
 * 보도자료 메일의 수신거부.
 *
 * 주소가 아니라 sha256(주소 + 솔트)의 앞 32자를 담는다. 솔트는 운영자 맥에만 있어
 * 이 테이블만으로는 누구인지 알 수 없고, 우리는 우리 명단에서 맞추므로 잃는 기능이
 * 없다. 기자·평론가 명단을 클라우드에 두지 않기 위한 선택이다.
 *
 * email_hash가 UNIQUE인 것과 삽입이 ON CONFLICT DO NOTHING인 것은 한 쌍이다 —
 * campaign_slug·created_at은 **처음 거부한 시점**이라 나중 값으로 덮으면
 * "언제부터 거부했는가"를 잃는다.
 */
export const pressOptoutSourceEnum = ['one-click', 'page'] as const;

export const pressOptouts = sqliteTable('press_optouts', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => sql`lower(hex(randomblob(16)))`),
  emailHash: text('email_hash').notNull().unique(),
  campaignSlug: text('campaign_slug').notNull(),
  source: text('source', { enum: pressOptoutSourceEnum }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// ─── 고유식별정보 접속기록 ────────────────────────────────────────────────────
/**
 * 「개인정보의 안전성 확보조치 기준」 제8조①이 요구하는 접속기록.
 *
 * 개인정보 보호법 제29조 + 시행령 제30조①5호가 접속기록의 보관·점검을 의무로 두고,
 * 위 고시 제8조①이 기간을 정한다 — 일반은 1년 이상, **고유식별정보를 처리하는
 * 개인정보처리시스템은 2년 이상.** 개설자의 주민등록번호(`funding_creators.
 * resident_number_enc`)가 고유식별정보이므로 이 표는 2년 기준이다
 * (`lib/privacy/accessLog.ts`의 `PRIVACY_ACCESS_LOG_RETENTION_YEARS`).
 *
 * 전에는 조회 사실이 라우트의 `console.warn` 한 줄뿐이었다. Vercel 런타임 로그는 며칠
 * 뒤 사라지고 Log Drain도 없으니 2년은커녕 한 달도 남지 않았고, 수행자도 적히지 않았다.
 *
 * **열람한 값 자체는 절대 담지 않는다.** 무엇을 열었는지(`action` + `targetId`)까지다.
 * 접속기록이 새면 필드 암호화가 통째로 무의미해진다 — 이 표는 감사 대상이지 사본이 아니다.
 */
export const privacyAccessActionEnum = [
  /** 관리자 화면의 주민등록번호 조회 버튼 (pages/api/admin/funding/projects/[id]/resident-number.ts). */
  'funding_resident_number_view',
  /**
   * 정산 기록 직전의 복호화 점검 (lib/funding/payout.ts의 residentNumberReadable).
   * 평문을 화면에 내보내지는 않지만 **복호화는 실제로 일어난다** — 고시가 말하는
   * 처리이므로 조회 버튼과 같은 무게로 남긴다.
   */
  'funding_resident_number_decrypt_check',
  /**
   * 정산 계좌 조회 (pages/api/admin/funding/projects/[id]/payout-account.ts).
   * 계좌번호는 고유식별정보가 아니지만 **같은 개인정보처리시스템**이라 이 표에 함께
   * 남는다. 표 전체가 2년 기준을 따르므로 계좌 조회 기록도 2년 보관된다.
   */
  'funding_payout_account_view',
  /**
   * 정산 기록 직전의 계좌 복호화 점검 (lib/funding/payout.ts의 payoutAccountReadable).
   * 값을 화면에 내보내지는 않지만 복호화는 실제로 일어난다 — 조회 버튼과 같은 무게로 남긴다.
   */
  'funding_payout_account_decrypt_check',
  /**
   * 관리자 펀딩 주문 CSV 내려받기 (pages/api/admin/funding/export.ts).
   * 25열 중 11열이 개인정보(이름·연락처·이메일·배송지 6열·응원 메시지)이고 건수 상한이
   * 없어 **한 번에 프로젝트 전체가 파일로 빠져나간다.** 한 건을 여는 조회보다 노출 범위가
   * 큰데 기록이 없었다. 대상은 프로젝트 slug(전체 내려받기는 `all`).
   */
  'funding_pledge_export',
  /**
   * 관리자 매출장부 CSV 내려받기 (pages/api/admin/orders/export.ts).
   * 기간 안에 승인된 결제 전부이므로 서비스 구분 없이 이름·연락처·이메일이 실린다.
   * 대상은 기간(`YYYY-MM-DD_YYYY-MM-DD`) — 이 다운로드가 가리키는 것은 한 사람이 아니다.
   */
  'sales_ledger_export',
  /**
   * 관리자 아티스트 후원자 연락처 CSV 내려받기
   * (pages/api/admin/artists/[slug]/supporters-export.ts). 이름·이메일이 실린다.
   * 대상은 아티스트 slug.
   */
  'artist_supporter_export',
  /**
   * 개설자의 배송 목록 CSV 내려받기
   * (pages/api/funding/creator/projects/[id]/shipping.csv.ts).
   * 관리자가 아니라 **개설자**가 후원자의 배송지·연락처를 통째로 받아 가는 경로라 수행자가
   * `creator:<creatorId>`다(`privacyCreatorActor`). 관리자 경로와 달리 사람이 특정된다.
   */
  'funding_creator_shipping_export',
  /**
   * 관리자 계약서 PDF 내려받기 (pages/api/contracts/[id]/pdf.ts).
   * 성명·생년월일·주소·서명 이미지가 한 파일에 담긴다. CSV는 아니지만 개인정보가 파일로
   * 빠져나가는 같은 동작이다. 대상은 계약 id.
   *
   * 이용자가 **자기** 계약서를 받는 경로(pages/api/contracts/[id]/download.ts)는 여기
   * 없다 — 접속기록은 개인정보취급자의 접속을 남기는 것이고, 정보주체 본인의 열람은
   * 그 대상이 아니다.
   */
  'contract_pdf_download',
] as const;

/**
 * 조회의 결과. 실패도 반드시 남긴다 — 열지 못한 시도의 흔적이 없으면 "누가 무엇을
 * 열려고 했는가"를 사후에 재구성할 수 없다.
 *
 * 인증 실패(401)는 여기 없다. 세션이 없으면 수행자를 특정할 수 없고 대상 id도 아직
 * 읽기 전이라, 남겨 봐야 "누군가 눌렀다"가 전부이면서 외부에서 마음대로 늘릴 수 있는
 * 행이 된다. 인증을 통과한 뒤의 시도만 기록한다.
 */
export const privacyAccessResultEnum = [
  'success',
  /** 대상에 등록된 값이 없었다(404). 복호화는 일어나지 않았다. */
  'not_found',
  /** 암호문은 있는데 열지 못했다. 사유 코드는 서버 로그의 FieldCryptoError.code에 있다. */
  'decrypt_failed',
  /** 그 밖의 실패(DB 장애 등). */
  'error',
] as const;

export const privacyAccessLogs = sqliteTable(
  'privacy_access_logs',
  {
    id: text('id').primaryKey().$defaultFn(() => sql`lower(hex(randomblob(16)))`),
    /**
     * 수행자.
     *
     * **이 저장소에는 관리자 개인을 가리키는 식별자가 없다.** 관리자 인증은
     * `lib/contracts/admin-auth.ts`의 단일 비밀번호(`ADMIN_PASSWORD`) 하나뿐이고,
     * `authenticateAdminApi`는 `{ ok: true }`만 돌려준다 — 계정도, 사용자 id도, 이름도
     * 없다. 그래서 관리자 경로의 이 값은 고정 문자열 `admin`이다(`PRIVACY_ACTOR_ADMIN`).
     * 여러 사람이 같은 비밀번호를 쓰면 이 기록으로는 누구인지 가릴 수 없다는 뜻이며,
     * 그것을 아는 척하지 않으려고 컬럼을 비워 두는 대신 사실대로 한 값을 적는다.
     * 관리자 계정이 사람별로 갈리면 그때 그 식별자를 여기에 넣는다.
     */
    actor: text('actor').notNull(),
    action: text('action', { enum: privacyAccessActionEnum }).notNull(),
    /** 무엇에 대한 조회였는지 — 펀딩 프로젝트 id. 값이 아니라 대상만 적는다. */
    targetId: text('target_id').notNull(),
    result: text('result', { enum: privacyAccessResultEnum }).notNull(),
    /**
     * 내보낸 **건수**. 파일로 빠져나가는 다운로드에만 채운다.
     *
     * 한 건을 여는 조회(주민등록번호·계좌)는 `action`과 `targetId`만으로 범위가 정해지지만,
     * 목록 다운로드는 같은 대상에 대해서도 그날 몇 사람분이 나갔는지가 매번 다르다. 사후에
     * "무엇이 얼마나 나갔는가"를 재구성하려면 이 숫자가 있어야 한다.
     *
     * **건수뿐이다 — 내보낸 값은 한 글자도 담지 않는다.** 이 표를 사본으로 만들지 않는다는
     * 규칙은 여기에도 그대로 걸린다. 한 건 조회에는 값이 없으므로 null이다.
     */
    rowCount: integer('row_count'),
    /** `lib/contracts/client-ip.ts`의 getClientIp. 얻지 못하면 null이다(모르는 것을 지어내지 않는다). */
    ip: text('ip'),
    at: integer('at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  },
  (t) => ({
    // 2년 경과분 삭제(cron/purge-funding)와 기간별 열람이 전부 at 기준이다.
    atIdx: index('privacy_access_logs_at_idx').on(t.at),
    targetIdx: index('privacy_access_logs_target_idx').on(t.targetId),
  }),
);

export type PrivacyAccessLog = typeof privacyAccessLogs.$inferSelect;
export type NewPrivacyAccessLog = typeof privacyAccessLogs.$inferInsert;
