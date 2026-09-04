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
  sendContractNotifications,
  terminateContract,
  updateDraftContract,
} from '../../../lib/contracts/service';
import { describeRoomConflict } from '../../../lib/contracts/conflict';
import { checkAction, getEffectiveStatus, type ContractAction } from '../../../lib/contracts/status';
import { validateCreateContractPayload } from '../../../lib/contracts/validation';

const MUTABLE_ACTIONS = ['send', 'resend', 'resend-signed', 'cancel', 'update', 'terminate'] as const;
type MutableAction = (typeof MUTABLE_ACTIONS)[number];

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
    return res.status(500).json({ ok: false, message: '계약을 불러오지 못했습니다.' });
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
         * finalizeSignedContract를 그대로 다시 부른다. PDF 생성·업로드부터 다시 하므로
         * "메일은 나갔는데 PDF가 없다" 같은 부분 실패도 함께 복구되고, 결과는 다시
         * notificationError에 기록돼 성공 여부가 화면에 드러난다.
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
        return res.status(200).json({ ok: true, contract: serializeContractForAdmin(terminated) });
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
        // 상태가 이미 바뀌었거나, 방금 발송해 쿨다운 중이다. 둘 다 "다시 누르지 마세요"라
        // 같은 안내로 충분하다.
        return res.status(409).json({
          ok: false,
          message: '방금 처리된 요청입니다. 잠시 후 상태를 확인해 주세요.',
        });
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
