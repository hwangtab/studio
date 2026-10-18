import { randomUUID } from 'node:crypto';

import { and, eq, exists, inArray, isNull, lte, or, sql } from 'drizzle-orm';

import { getDb } from '../../../db/client';
import {
  productionContracts,
  productionContractSigners,
  type ProductionContract,
  type ProductionContractSigner,
  type ProductionContractStatus,
} from '../../../db/schema';
import { resetIdentityAttempts } from '../admin-rate-limit';
import { computeExpiresAt } from '../status';
import { hashTemplate } from '../template-snapshot';
import { generateSignToken } from '../token';
import { parseStoredClauses, PRODUCTION_REQUIRED_CLAUSES } from './clauses';
import {
  sendProductionGuardianSignRequestEmail,
  sendProductionOperatorNotification,
  sendProductionSignRequestEmail,
} from './email';
import { computeProductionFingerprint } from './integrity';
import { buildProductionSignUrl, productionSignerRateLimitKey } from './links';
import { buildFinalizeStatement } from './sign-transaction';
import { buildProductionContent, readProductionTemplate } from './template';
import { canonicalTermsJson, parseStoredTerms } from './terms';
import type { ProductionContractPayload } from './validation';

/**
 * 제작 계약의 상태를 바꾸는 쓰기. 연습실 service.ts와 같은 규칙을 따른다:
 *
 * - 허용 상태를 UPDATE 조건에 건다. 호출부가 먼저 확인해도 읽기와 쓰기 사이 틈이 있어, 조건이 없으면 동시
 *   요청으로 서명된 계약의 본문까지 바뀐다(문서 위조).
 * - 조건이 맞지 않으면 null/false를 돌려 호출부가 409로 거절하게 한다.
 * - 여러 행을 함께 쓰면 batch(트랜잭션)로 묶어 반쪽 상태를 남기지 않는다.
 */

/** 운영자 서명자 행의 이름·연락 이메일. 계약서 서명란·지문에 이 값이 들어간다. */
const OPERATOR_SIGNER = { name: '스튜디오 놀 대표 황경하', email: 'hello@studionol.co.kr' } as const;

/** 발송 버튼 연타·동시 요청 방어. 연습실 markContractSent와 같은 값. */
const RESEND_COOLDOWN_MS = 10_000;

/** 만료 기한이 지난 발송 건을 expired로 내린다(lazy — 목록·서명 화면 접근 시). 실패해도 주 흐름은 막지 않는다. */
export const expireOverdueProductionContracts = async (now: Date = new Date()): Promise<number> => {
  try {
    const result = await getDb()
      .update(productionContracts)
      .set({ status: 'expired', updatedAt: now })
      .where(
        and(
          eq(productionContracts.status, 'sent'),
          lte(productionContracts.expiresAt, now),
          // 서명자가 모두 서명한 계약은 성립을 기다리는 중이다 — 만료로 내리지 않는다.
          exists(
            getDb()
              .select({ ok: sql`1` })
              .from(productionContractSigners)
              .where(
                and(eq(productionContractSigners.contractId, productionContracts.id), eq(productionContractSigners.status, 'pending')),
              ),
          ),
        ),
      );
    return result.rowsAffected ?? 0;
  } catch (error: unknown) {
    console.error('[contracts/production/service] Failed to expire overdue contracts:', error);
    return 0;
  }
};

/** 초안 본문 — 서명자 정보는 비어 있고, 계약일은 서명 때 다시 정해진다. */
const buildDraftContent = (data: ProductionContractPayload, template: string): string =>
  buildProductionContent(
    {
      clientName: data.clientName,
      clientStageName: data.clientStageName,
      clientPhone: data.clientPhone,
      guardian: data.guardian,
      kind: data.kind,
      terms: data.terms,
      contractDate: new Date().toISOString(),
    },
    template,
  );

const guardianRow = (contractId: string, guardian: NonNullable<ProductionContractPayload['guardian']>) => ({
  contractId,
  role: 'guardian' as const,
  name: guardian.name,
  email: guardian.email,
  phone: guardian.phone,
  relation: guardian.relation,
});

/**
 * 초안을 만든다. 메일은 보내지 않는다(발송은 별도 행위이고, 그것이 곧 운영자 서명이다).
 *
 * 서명 토큰은 발송할 때 처음 만든다. 연습실은 초안에도 토큰이 있어 관리자 화면에 링크가 보였지만, 아직
 * 운영자가 서명하지 않은 문서의 서명 링크는 존재할 이유가 없다.
 */
export const createProductionContract = async (data: ProductionContractPayload): Promise<ProductionContract> => {
  const template = readProductionTemplate(data.kind);
  const contractId = randomUUID();
  const now = new Date();

  await getDb().batch([
    getDb()
      .insert(productionContracts)
      .values({
        id: contractId,
        kind: data.kind,
        status: 'draft',
        title: data.title,
        clientName: data.clientName,
        clientStageName: data.clientStageName,
        clientEmail: data.clientEmail,
        clientPhone: data.clientPhone,
        termsJson: canonicalTermsJson(data.terms),
        totalAmount: data.terms.amount.total,
        clausesJson: JSON.stringify(PRODUCTION_REQUIRED_CLAUSES),
        template,
        templateHash: hashTemplate(template),
        content: buildDraftContent(data, template),
        createdAt: now,
        updatedAt: now,
      }),
    getDb()
      .insert(productionContractSigners)
      .values([
        { contractId, role: 'operator', name: OPERATOR_SIGNER.name, email: OPERATOR_SIGNER.email },
        { contractId, role: 'client', name: data.clientName, email: data.clientEmail },
        ...(data.guardian ? [guardianRow(contractId, data.guardian)] : []),
      ]),
  ]);

  const contract = await getDb().query.productionContracts.findFirst({
    where: eq(productionContracts.id, contractId),
  });
  if (!contract) throw new Error('제작 계약을 만들었지만 다시 읽지 못했습니다.');
  return contract;
};

/**
 * 초안을 고친다. 템플릿도 지금 판본으로 다시 떠서 본문·사본을 맞춘다 — 초안을 고치는 시점에 운영자가
 * 보는 미리보기가 곧 보낼 문서여야 한다.
 */
export const updateDraftProductionContract = async (
  contractId: string,
  data: ProductionContractPayload,
): Promise<ProductionContract | null> => {
  // 초안에서는 종류를 바꿀 수 있다(싱글 → EP 등) — 그 종류의 계약서 문안을 다시 뜬다.
  const template = readProductionTemplate(data.kind);
  const now = new Date();
  const stillDraft = and(eq(productionContracts.id, contractId), eq(productionContracts.status, 'draft'));
  const draftIds = getDb().select({ id: productionContracts.id }).from(productionContracts).where(stillDraft);

  const [updatedRows] = await getDb().batch([
    getDb()
      .update(productionContracts)
      .set({
        kind: data.kind,
        title: data.title,
        clientName: data.clientName,
        clientStageName: data.clientStageName,
        clientEmail: data.clientEmail,
        clientPhone: data.clientPhone,
        termsJson: canonicalTermsJson(data.terms),
        totalAmount: data.terms.amount.total,
        // 동의 항목도 지금 목록으로 다시 뜬다. 아직 아무도 서명하지 않은 문서다.
        clausesJson: JSON.stringify(PRODUCTION_REQUIRED_CLAUSES),
        template,
        templateHash: hashTemplate(template),
        content: buildDraftContent(data, template),
        updatedAt: now,
      })
      .where(stillDraft)
      .returning(),
    // 서명자 행의 이름·이메일이 서명란과 지문에 들어간다. 계약과 같은 조건("아직 초안")에 건다.
    getDb()
      .update(productionContractSigners)
      .set({ name: data.clientName, email: data.clientEmail, updatedAt: now })
      .where(
        and(
          eq(productionContractSigners.contractId, contractId),
          eq(productionContractSigners.role, 'client'),
          inArray(productionContractSigners.contractId, draftIds),
        ),
      ),
    // 법정대리인은 지우고 다시 넣는다(없앴거나 바꿨을 수 있다). 둘 다 "아직 초안"에 건다 — 발송된 계약의 서명자를
    // 바꾸면 서명 링크를 받은 사람과 계약서의 대리인이 갈린다.
    getDb()
      .delete(productionContractSigners)
      .where(
        and(
          eq(productionContractSigners.contractId, contractId),
          eq(productionContractSigners.role, 'guardian'),
          inArray(productionContractSigners.contractId, draftIds),
        ),
      ),
    ...(data.guardian
      ? [
          getDb().run(sql`
            INSERT INTO production_contract_signers (id, contract_id, role, name, email, phone, relation)
            SELECT lower(hex(randomblob(16))), ${contractId}, 'guardian', ${data.guardian.name}, ${data.guardian.email},
                   ${data.guardian.phone}, ${data.guardian.relation}
            WHERE EXISTS (SELECT 1 FROM production_contracts WHERE id = ${contractId} AND status = 'draft')
          `),
        ]
      : []),
  ]);

  return updatedRows[0] ?? null;
};

export type ExternalSignerRole = 'client' | 'guardian';

export interface SendProductionResult {
  contract: ProductionContract;
  /** 이번 발송으로 새 링크가 나간 서명자(아직 서명하지 않은 의뢰인·법정대리인)별 서명 주소. */
  signUrls: Partial<Record<ExternalSignerRole, string>>;
}

/**
 * 발송한다 — **운영자가 서명하는 행위이기도 하다.** draft → sent(첫 발송), sent·expired → sent(재발송).
 *
 * 두 단계로 나눈다.
 *
 * 1. 계약 행을 조건부로 sent로 바꾼다(허용 상태 + 쿨다운 + 파기 전). 이 UPDATE 하나가 "이번 발송은 내 것"이라는
 *    판정이다. 같은 초에 들어온 두 번째 요청은 쿨다운에 걸려 0행이 되고, 그러면 아무것도 더 쓰지 않는다.
 * 2. 판정을 얻은 요청만 아직 서명하지 않은 의뢰인·법정대리인에게 **각자 다른** 토큰을 새로 발급하고(옛 링크
 *    즉시 무효), 운영자 서명이 아직이면 기록한다. 이미 서명한 사람의 토큰은 그대로 둔다 — 완료·진행 페이지가
 *    그 토큰으로 열린다.
 *
 * 2를 1과 한 batch에 넣고 "계약이 방금 sent가 됐는가"를 조건으로 걸 수도 있지만, 그 조건을 SQL로 쓰면
 * 같은 초의 연타를 구별하지 못한다. 2가 실패하면 계약은 sent인데 링크가 옛것으로 남는다 — 재발송으로
 * 고쳐지고, 서명 API는 운영자 서명이 없는 계약의 서명을 받지 않는다.
 */
export const sendProductionContract = async (
  contractId: string,
  options: {
    allowedStatuses: readonly ProductionContractStatus[];
    adminActor: string;
    ipAddress: string | null;
    userAgent: string;
  },
): Promise<SendProductionResult | null> => {
  const now = new Date();
  const cooldownBoundary = new Date(now.getTime() - RESEND_COOLDOWN_MS);

  const [claimed] = await getDb()
    .update(productionContracts)
    .set({ status: 'sent', sentAt: now, expiresAt: computeExpiresAt(now), updatedAt: now })
    .where(
      and(
        eq(productionContracts.id, contractId),
        inArray(productionContracts.status, [...options.allowedStatuses]),
        or(isNull(productionContracts.sentAt), lte(productionContracts.sentAt, cooldownBoundary)),
        isNull(productionContracts.purgedAt),
      ),
    )
    .returning();

  if (!claimed) return null;

  const tokens: Record<ExternalSignerRole, string> = { client: generateSignToken(), guardian: generateSignToken() };
  const rotate = (role: ExternalSignerRole) =>
    getDb()
      .update(productionContractSigners)
      .set({
        signToken: tokens[role],
        // 새 링크의 열람 기록은 처음부터 센다(연습실 markContractSent와 같은 이유 — 옛 링크를 메일 스캐너가
        // 먼저 연 기록이 "최초 열람"으로 남으면 서명자의 열람이 아니게 된다).
        firstViewedAt: null,
        firstViewedIp: null,
        lastViewedAt: null,
        viewCount: 0,
        updatedAt: now,
      })
      .where(
        and(
          eq(productionContractSigners.contractId, contractId),
          eq(productionContractSigners.role, role),
          eq(productionContractSigners.status, 'pending'),
        ),
      )
      .returning({ role: productionContractSigners.role });

  const [clientRows, guardianRows] = await getDb().batch([
    rotate('client'),
    rotate('guardian'),
    // 운영자 서명은 첫 발송 때 한 번만 남는다. 재발송은 같은 문서를 다시 보내는 것이라 서명을 다시 받지 않는다.
    getDb()
      .update(productionContractSigners)
      .set({
        status: 'signed',
        signedAt: now,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        adminActor: options.adminActor,
        updatedAt: now,
      })
      .where(
        and(
          eq(productionContractSigners.contractId, contractId),
          eq(productionContractSigners.role, 'operator'),
          eq(productionContractSigners.status, 'pending'),
        ),
      ),
  ]);

  // 잠긴 링크를 푸는 유일한 수단이 재발송이다(연습실과 같다). 새 토큰이 나가므로 옛 시도를 이어 셀 이유도 없다.
  await Promise.all(
    (['client', 'guardian'] as const).map((role) => resetIdentityAttempts(productionSignerRateLimitKey(contractId, role))),
  );

  const signUrls: SendProductionResult['signUrls'] = {};
  if (clientRows.length > 0) signUrls.client = buildProductionSignUrl(contractId, tokens.client);
  if (guardianRows.length > 0) signUrls.guardian = buildProductionSignUrl(contractId, tokens.guardian);
  return { contract: claimed, signUrls };
};

/** 알림 결과를 계약에 남긴다 — 메일은 응답 뒤에 나가므로 실패가 화면에 드러날 길이 이것뿐이다. */
export const recordProductionNotificationResult = async (contractId: string, error: string | null): Promise<void> => {
  try {
    await getDb()
      .update(productionContracts)
      .set({ notificationError: error, notifiedAt: new Date() })
      .where(eq(productionContracts.id, contractId));
  } catch (dbError: unknown) {
    console.error('[contracts/production/service] Failed to record notification result:', dbError);
  }
};

/** 서명 요청 메일(새 링크가 나간 의뢰인·법정대리인) + 운영자 알림. 실패는 계약에 기록한다. */
export const sendProductionSignRequestNotifications = async (
  contract: ProductionContract,
  signUrls: SendProductionResult['signUrls'],
): Promise<void> => {
  try {
    const terms = parseStoredTerms(contract.termsJson);
    const guardian = signUrls.guardian
      ? await getDb().query.productionContractSigners.findFirst({
          where: and(eq(productionContractSigners.contractId, contract.id), eq(productionContractSigners.role, 'guardian')),
        })
      : undefined;
    const [clientResult, guardianResult, operatorResult] = await Promise.all([
      signUrls.client ? sendProductionSignRequestEmail(contract, terms, signUrls.client) : null,
      signUrls.guardian && guardian
        ? sendProductionGuardianSignRequestEmail(contract, terms, guardian, signUrls.guardian)
        : null,
      sendProductionOperatorNotification(contract, terms, false),
    ]);

    const problems = [
      clientResult && !clientResult.ok ? `서명 요청 메일 발송 실패 (${clientResult.errorCode ?? 'UNKNOWN'})` : null,
      guardianResult && !guardianResult.ok ? `법정대리인 서명 요청 메일 발송 실패 (${guardianResult.errorCode ?? 'UNKNOWN'})` : null,
      operatorResult.ok ? null : `운영자 알림 메일 발송 실패 (${operatorResult.errorCode ?? 'UNKNOWN'})`,
    ].filter((problem): problem is string => problem !== null);

    if (problems.length > 0) console.error('[contracts/production/service] Notification failed:', problems);
    await recordProductionNotificationResult(contract.id, problems.length > 0 ? problems.join(' / ') : null);
  } catch (error: unknown) {
    console.error('[contracts/production/service] Failed to send sign request emails:', error);
    await recordProductionNotificationResult(contract.id, '서명 요청 메일 발송 중 오류가 발생했습니다.');
  }
};

export const cancelProductionContract = async (contractId: string): Promise<ProductionContract | null> => {
  const [contract] = await getDb()
    .update(productionContracts)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(
      and(
        eq(productionContracts.id, contractId),
        inArray(productionContracts.status, ['draft', 'sent', 'expired'] satisfies ProductionContractStatus[]),
      ),
    )
    .returning();
  return contract ?? null;
};

/**
 * 지운다. 서명이 끝난 계약은 어떤 경로로도 지워지면 안 된다 — 계약 행을 조건부로 먼저 지우고, 성공했을 때만
 * 서명자 행을 정리한다(순서를 뒤집으면 계약은 남고 서명 기록만 사라질 수 있다).
 */
export const deleteProductionContract = async (contractId: string): Promise<boolean> => {
  const [deleted] = await getDb()
    .delete(productionContracts)
    .where(
      and(
        eq(productionContracts.id, contractId),
        inArray(productionContracts.status, ['draft', 'cancelled'] satisfies ProductionContractStatus[]),
      ),
    )
    .returning({ id: productionContracts.id });

  if (!deleted) return false;
  // SQLite의 CASCADE는 PRAGMA에 달려 있어 명시적으로 지운다(연습실과 같다).
  await getDb().delete(productionContractSigners).where(eq(productionContractSigners.contractId, contractId));
  return true;
};

/**
 * 계약을 끝낸다 — 최종 인도로 정상 종결(completed) 또는 중도 해지(terminated).
 *
 * 문서(본문·서명·지문)는 건드리지 않고 끝난 사실과 날짜만 적는다. 그 날짜가 개인정보 보관 기간의 기산점이라
 * 운영자가 실제 날짜를 넣을 수 있게 한다(뒤늦게 기록하는 경우). 해지는 사유를 반드시 받는다 — 환불 정산과
 * 분쟁에서 누구의 사정으로 끝났는지가 쟁점이 된다.
 */
export const closeProductionContract = async (
  contractId: string,
  outcome: { kind: 'completed'; at: Date } | { kind: 'terminated'; at: Date; reason: string },
): Promise<ProductionContract | null> => {
  const now = new Date();
  const [contract] = await getDb()
    .update(productionContracts)
    .set(
      outcome.kind === 'completed'
        ? { status: 'completed', completedAt: outcome.at, updatedAt: now }
        : { status: 'terminated', terminatedAt: outcome.at, terminationReason: outcome.reason, updatedAt: now },
    )
    .where(and(eq(productionContracts.id, contractId), eq(productionContracts.status, 'signed')))
    .returning();
  return contract ?? null;
};

/**
 * 서명 순간에 서명자가 채운 값으로 본문을 완성한다(연습실 buildSignedContractContent와 같은 원리).
 *
 * **계약에 저장된 템플릿 사본으로** 만든다. 서명자가 화면에서 읽은 본문과 서명에 묶이는 본문이 같은 판본이어야
 * 한다. 계약일도 이때 확정된다.
 */
export const buildSignedProductionContent = (
  contract: ProductionContract,
  signers: readonly ProductionContractSigner[],
  signedAt: Date,
): string => {
  const guardian = signers.find((signer) => signer.role === 'guardian');
  return buildProductionContent(
    {
      clientName: contract.clientName,
      clientStageName: contract.clientStageName,
      clientPhone: contract.clientPhone,
      clientBirthdate: contract.clientBirthdate,
      clientAddress: contract.clientAddress,
      guardian: guardian ? { name: guardian.name, relation: guardian.relation, phone: guardian.phone } : null,
      kind: contract.kind,
      terms: parseStoredTerms(contract.termsJson),
      contractDate: signedAt.toISOString(),
    },
    contract.template,
  );
};

/**
 * 모두 서명했으면 계약을 성립시킨다. 성립시켰으면 true(이 요청이 체결 메일·PDF를 맡는다).
 *
 * 서명 요청마다 서명 쓰기 뒤에 부른다. 상태를 **다시 읽어** 본문을 완성하고 지문을 계산한다 — 의뢰인과
 * 법정대리인이 동시에 서명하면 각 요청이 처음 읽은 상태에는 상대 서명이 없기 때문이다. 둘 다 여기까지 오면
 * 같은 상태로 같은 지문을 만들고, 조건부 UPDATE가 먼저 온 하나만 받는다.
 */
export const finalizeProductionContractIfComplete = async (contractId: string, now: Date = new Date()): Promise<boolean> => {
  const contract = await getDb().query.productionContracts.findFirst({
    where: eq(productionContracts.id, contractId),
    with: { signers: true },
  });
  if (
    !contract ||
    (contract.status !== 'sent' && contract.status !== 'expired') ||
    contract.signers.some((signer) => signer.status === 'pending')
  ) {
    return false;
  }

  const content = buildSignedProductionContent(contract, contract.signers, now);
  const contentHash = computeProductionFingerprint({
    contract: { ...contract, content },
    clauses: parseStoredClauses(contract.clausesJson),
    signers: contract.signers,
    signedAt: now,
  });
  const result = await buildFinalizeStatement(getDb(), { contractId, now, content, contentHash });
  return (result.rowsAffected ?? 0) > 0;
};
