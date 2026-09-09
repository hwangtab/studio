import { relations, sql } from 'drizzle-orm';
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

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
  /** 토스 응답 원본 JSON — 분쟁·대사(reconciliation) 근거. */
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
  entrySource: text('entry_source', { enum: fundingEntrySourceEnum }).notNull().default('online'),
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

export const subscriptionKindEnum = ['practice-room', 'lesson'] as const;
export const subscriptionStatusEnum = [
  'pending_card', // 생성됨, 카드 등록 전 (첫 결제까지 성공해야 active)
  'active',
  'past_due', // 회차 결제 실패, 재시도 대기
  'paused', // 재시도 한도 소진 — 카드 재등록 전까지 청구하지 않는다
  'cancelled', // 해지 예약. endsAt까지는 이용 가능
  'ended',
] as const;
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

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type BillingKey = typeof billingKeys.$inferSelect;
export type NewBillingKey = typeof billingKeys.$inferInsert;
export type SubscriptionPayment = typeof subscriptionPayments.$inferSelect;
export type NewSubscriptionPayment = typeof subscriptionPayments.$inferInsert;
