import type { NextApiRequest, NextApiResponse } from 'next';
import { waitUntil } from '@vercel/functions';

import { getDb } from '../../../db/client';
import { authenticateAdminApi } from '../../../lib/contracts/admin-auth';
import {
  serializeAttachment,
  serializeClause,
  serializeContractForAdmin,
  serializeSignature,
} from '../../../lib/contracts/serialize';
import {
  cancelContract,
  deleteContract,
  findRoomConflict,
  markContractSent,
  RESEND_COOLDOWN_MS,
  sendContractNotifications,
  terminateContract,
  updateDraftContract,
} from '../../../lib/contracts/service';
import { cancelSubscriptionsOfContract } from '../../../lib/billing/service';
import { recordAdminPrivacyAccess } from '../../../lib/privacy/accessLog';
import { describeRoomConflict } from '../../../lib/contracts/conflict';
import { checkAction, getEffectiveStatus, getStatusLabel, type ContractAction } from '../../../lib/contracts/status';
import { validateCreateContractPayload } from '../../../lib/contracts/validation';

const MUTABLE_ACTIONS = ['send', 'resend', 'resend-signed', 'cancel', 'update', 'terminate'] as const;
type MutableAction = (typeof MUTABLE_ACTIONS)[number];

/**
 * 발송 UPDATE가 0행일 때 원인을 다시 읽는다. 읽기 자체가 실패하면 원인을 단정하지 않는다.
 */
const explainSendRejection = async (id: string, action: 'send' | 'resend'): Promise<string> => {
  const fallback = '계약 상태가 바뀌어 발송하지 못했습니다. 새로고침 후 확인해 주세요.';
  try {
    const current = await getDb().query.contracts.findFirst({
      where: (contractsTable, { eq }) => eq(contractsTable.id, id),
    });
    if (!current) return '계약을 찾을 수 없습니다.';
    if (current.purgedAt) {
      return '보관 기간이 지나 개인정보가 파기된 계약은 다시 보낼 수 없습니다. 필요하면 새 계약을 만들어 주세요.';
    }
    const allowedStatuses = action === 'send' ? ['draft'] : ['sent', 'expired', 'cancelled'];
    if (!allowedStatuses.includes(current.status)) {
      return `계약 상태가 '${getStatusLabel(current.status)}'(으)로 바뀌어 발송하지 않았습니다. 새로고침 후 확인해 주세요.`;
    }
    if (current.sentAt && Date.now() - current.sentAt.getTime() < RESEND_COOLDOWN_MS) {
      return '방금 발송했습니다. 같은 링크가 연달아 바뀌지 않도록 잠시 후 다시 시도해 주세요.';
    }
    const conflict = await findRoomConflict({
      roomNumber: current.roomNumber,
      startDate: current.startDate,
      endDate: current.endDate,
      excludeContractId: id,
    });
    if (conflict) return describeRoomConflict(conflict);
    return fallback;
  } catch (error: unknown) {
    console.error('[API/contracts/[id]] Failed to explain send rejection:', error);
    return fallback;
  }
};

const isMutableAction = (value: unknown): value is MutableAction =>
  typeof value === 'string' && (MUTABLE_ACTIONS as readonly string[]).includes(value);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }

  const { id } = req.query;
  if (typeof id !== 'string') {
    return res.status(400).json({ ok: false, message: '잘못된 계약 ID입니다.' });
  }

  /**
   * 조회 실패와 "없음"을 구분한다.
   *
   * 예전에는 쿼리 오류를 catch해 null로 뭉갰고, 그러면 Turso 타임아웃 같은 장애가
   * 관리자 화면에 "계약을 찾을 수 없습니다"로 나왔다. 계약이 사라진 줄 알고 다시
   * 만들거나 고객에게 잘못 안내할 수 있는 오분류다. 같은 상황을 [id]/pdf.ts는
   * 이미 500으로 처리하고 있어 두 라우트가 서로 달랐다.
   */
  let contract;
  try {
    contract = await getDb().query.contracts.findFirst({
      where: (contractsTable, { eq }) => eq(contractsTable.id, id),
      with: { signatures: true, contractClauses: true, contractAttachments: true },
    });
  } catch (error: unknown) {
    console.error('[API/contracts/[id]] Query failed:', error);
    if (req.method === 'GET') {
      await recordAdminPrivacyAccess(req, auth.actor, 'contract_view', id, 'error').catch((logError: unknown) =>
        console.error('[privacy] 접속기록 호출 실패', logError),
      );
    }
    return res.status(500).json({ ok: false, message: '계약을 불러오지 못했습니다.' });
  }

  if (req.method === 'GET') {
    // 개인정보를 여는 조회라 남긴다(처리방침 19항). 기록 실패는 조회를 막지 않는다.
    await recordAdminPrivacyAccess(req, auth.actor, 'contract_view', id, contract ? 'success' : 'not_found').catch(
      (error: unknown) => console.error('[privacy] 접속기록 호출 실패 — 조회는 계속됩니다', error),
    );
  }

  if (!contract) {
    return res.status(404).json({ ok: false, message: '계약을 찾을 수 없습니다.' });
  }

  // 만료 기한이 지났다면 DB 반영 여부와 무관하게 만료된 것으로 취급한다.
  const effectiveStatus = getEffectiveStatus(contract);

  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      contract: serializeContractForAdmin(contract),
      signatures: contract.signatures.map(serializeSignature),
      clauses: contract.contractClauses.map(serializeClause),
      attachments: contract.contractAttachments.map(serializeAttachment),
    });
  }

  if (req.method === 'PATCH') {
    if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
      return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않습니다.' });
    }

    const { action } = req.body as Record<string, unknown>;
    if (!isMutableAction(action)) {
      return res.status(400).json({
        ok: false,
        message: `action은 ${MUTABLE_ACTIONS.join(', ')} 중 하나여야 합니다.`,
      });
    }

    const allowed = checkAction(effectiveStatus, action as ContractAction);
    if (!allowed.ok) {
      return res.status(409).json({ ok: false, message: allowed.message });
    }

    // 개인정보가 파기된 계약은 이름·본문·서명이 표식으로 덮여 있어 다시 보낼 문서가 없다.
    // markContractSent도 조건으로 막지만, 거기서 0행이 되면 원인을 알 수 없는 문구가 나갔다.
    if (contract.purgedAt && (action === 'send' || action === 'resend' || action === 'resend-signed')) {
      return res.status(409).json({
        ok: false,
        message: '보관 기간이 지나 개인정보가 파기된 계약은 다시 보낼 수 없습니다. 필요하면 새 계약을 만들어 주세요.',
      });
    }

    try {
      if (action === 'update') {
        const validation = validateCreateContractPayload(req.body as Record<string, unknown>);
        if (!validation.ok) {
          return res.status(400).json({ ok: false, errors: validation.errors });
        }

        const conflict = await findRoomConflict({
          roomNumber: validation.data.roomNumber,
          startDate: new Date(validation.data.startDate),
          endDate: new Date(validation.data.endDate),
          excludeContractId: id,
        });

        if (conflict) {
          return res.status(409).json({ ok: false, message: describeRoomConflict(conflict) });
        }

        const updated = await updateDraftContract(id, validation.data);
        if (!updated) {
          // 읽은 뒤 상태가 바뀌었다(동시 발송·서명 등). 확정된 문서를 고치지 않는다.
          return res.status(409).json({
            ok: false,
            message: '계약 상태가 바뀌어 수정할 수 없습니다. 새로고침 후 확인해 주세요.',
          });
        }
        return res.status(200).json({ ok: true, contract: serializeContractForAdmin(updated) });
      }

      if (action === 'resend-signed') {
        /**
         * 서명 완료 메일·PDF 재발송. 상태도 토큰도 건드리지 않는다 — 확정된 문서의
         * 접근 경로가 바뀌면 고객 메일함에 남은 기존 링크가 죽는다.
         *
         * finalizeSignedContract를 그대로 다시 부른다. 보관본(pdfUrl)이 있으면 그 PDF를 그대로
         * 첨부하고(서명 당시 문서를 덮어쓰지 않는다), 없을 때만 새로 만들어 올리므로 "메일은
         * 나갔는데 PDF가 없다" 같은 부분 실패도 함께 복구된다. 결과는 다시 notificationError에
         * 기록돼 성공 여부가 화면에 드러난다.
         */
        // 동적 import — finalize는 PDF 생성을 위해 puppeteer/chromium 체인을 끌어온다.
        // 최상위에서 부르면 이 라우트의 모든 요청이 그 무게를 지고(콜드스타트), 테스트
        // 러너도 ESM 파싱에서 막힌다. 실제로 재발송할 때만 불러온다.
        const { finalizeSignedContract } = await import('../../../lib/contracts/finalize');
        waitUntil(finalizeSignedContract(id));
        return res.status(200).json({
          ok: true,
          contract: serializeContractForAdmin(contract),
          message: '완료 메일을 다시 보내는 중입니다. 잠시 후 새로고침해 결과를 확인해 주세요.',
        });
      }

      if (action === 'terminate') {
        /**
         * 이용 종료. 계약 문서(본문·서명·지문)는 건드리지 않고 "언제, 왜 끝났는지"만 남긴다.
         *
         * 사유는 나중에 이 방이 왜 비었는지를 설명하는 유일한 기록이라 반드시 받는다.
         * 위약금 청구(제5조 ③)나 분쟁이 생기면 중도 퇴실인지 정상 만료인지가 쟁점이 된다.
         */
        const { reason } = req.body as Record<string, unknown>;
        if (typeof reason !== 'string' || reason.trim() === '') {
          return res.status(400).json({ ok: false, message: '종료 사유를 입력해 주세요.' });
        }
        if (reason.length > 500) {
          return res.status(400).json({ ok: false, message: '종료 사유가 너무 깁니다.' });
        }

        const terminated = await terminateContract(id, { reason: reason.trim() });
        if (!terminated) {
          return res.status(409).json({
            ok: false,
            message: '계약 상태가 바뀌어 종료 처리할 수 없습니다. 새로고침 후 확인해 주세요.',
          });
        }
        // 연결된 구독도 해지한다. 실패해도 종료는 이미 확정이라 응답으로 알려 사람이 마무리하게 한다.
        let cancelledSubscriptionIds: string[] = [];
        const warnings: string[] = [];
        try {
          const outcome = await cancelSubscriptionsOfContract(id, `계약 종료: ${reason.trim()}`, new Date());
          cancelledSubscriptionIds = outcome.cancelledIds;
          if (outcome.failed.length > 0) {
            warnings.push(
              `계약은 종료됐지만 연결된 구독 ${outcome.failed.length}건을 해지하지 못했습니다. 구독 화면에서 직접 해지해 주세요.`,
            );
          }
          if (outcome.notificationFailures.length > 0) {
            warnings.push(
              `해지한 구독 ${outcome.notificationFailures.length}건의 해지 안내 메일·운영자 알림이 실패했습니다. 고객에게 해지 사실을 직접 알려 주세요.`,
            );
          }
        } catch (error: unknown) {
          console.error('[contracts] Failed to cancel subscriptions of terminated contract:', error);
          warnings.push('계약은 종료됐지만 연결된 구독 해지에 실패했습니다. 구독 화면에서 직접 해지해 주세요.');
        }
        return res.status(200).json({
          ok: true,
          contract: serializeContractForAdmin(terminated),
          cancelledSubscriptions: cancelledSubscriptionIds.length,
          cancelledSubscriptionIds,
          ...(warnings.length > 0 ? { warning: warnings.join(' ') } : {}),
        });
      }

      if (action === 'cancel') {
        const cancelled = await cancelContract(id);
        if (!cancelled) {
          return res.status(409).json({
            ok: false,
            message: '계약 상태가 바뀌어 취소할 수 없습니다. 새로고침 후 확인해 주세요.',
          });
        }
        return res.status(200).json({ ok: true, contract: serializeContractForAdmin(cancelled) });
      }

      // 발송 직전에 다시 확인한다. 작성해 둔 사이에 같은 호실의 다른 계약이 확정됐을 수
      // 있고, 그대로 보내면 두 고객이 같은 방을 배정받는다.
      const conflict = await findRoomConflict({
        roomNumber: contract.roomNumber,
        startDate: contract.startDate,
        endDate: contract.endDate,
        excludeContractId: id,
      });

      if (conflict) {
        return res.status(409).json({ ok: false, message: describeRoomConflict(conflict) });
      }

      // send | resend — 허용 상태를 조건에 걸어 동시 요청이 두 번 발송되지 않게 한다.
      const result = await markContractSent(id, {
        allowedStatuses: action === 'send' ? ['draft'] : ['sent', 'expired', 'cancelled'],
      });

      if (!result) {
        // UPDATE가 0행이었다. 조건이 여럿이라(허용 상태·쿨다운·파기·호실 점유) 원인을 다시 읽어
        // 그에 맞는 안내를 준다 — 예전엔 전부 "방금 처리된 요청"이라, 호실이 막혀 보낼 수 없는
        // 계약을 운영자가 몇 번이고 다시 눌렀다.
        return res.status(409).json({ ok: false, message: await explainSendRejection(id, action) });
      }

      waitUntil(sendContractNotifications(result.contract, result.signUrl));

      return res.status(200).json({ ok: true, contract: serializeContractForAdmin(result.contract) });
    } catch (error: unknown) {
      console.error(`[API/contracts/[id]] Action "${action}" failed:`, error);
      return res.status(500).json({ ok: false, message: '요청을 처리하지 못했습니다.' });
    }
  }

  if (req.method === 'DELETE') {
    const allowed = checkAction(effectiveStatus, 'delete');
    if (!allowed.ok) {
      return res.status(409).json({ ok: false, message: allowed.message });
    }

    try {
      const removed = await deleteContract(id);
      if (!removed) {
        // 읽은 뒤 상태가 바뀌었다. 서명이 끝난 계약은 지우지 않는다 — 서명·동의 이력이
        // 유일한 증거다.
        return res.status(409).json({
          ok: false,
          message: '계약 상태가 바뀌어 삭제할 수 없습니다. 새로고침 후 확인해 주세요.',
        });
      }
      return res.status(200).json({ ok: true });
    } catch (error: unknown) {
      console.error('[API/contracts/[id]] Failed to delete contract:', error);
      return res.status(500).json({ ok: false, message: '계약 삭제에 실패했습니다.' });
    }
  }

  res.setHeader('Allow', 'GET, PATCH, DELETE');
  return res.status(405).json({ ok: false, message: 'Method not allowed' });
}
