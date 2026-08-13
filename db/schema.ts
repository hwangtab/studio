import { relations, sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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

export type Contract = typeof contracts.$inferSelect;
export type NewContract = typeof contracts.$inferInsert;
export type Signature = typeof signatures.$inferSelect;
export type NewSignature = typeof signatures.$inferInsert;
export type ContractClause = typeof contractClauses.$inferSelect;
export type NewContractClause = typeof contractClauses.$inferInsert;
export type ContractAttachment = typeof contractAttachments.$inferSelect;
export type NewContractAttachment = typeof contractAttachments.$inferInsert;
