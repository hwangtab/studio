/**
 * 이용자가 자기 계약서를 다시 받는 경로.
 *
 * 관리자용 PDF 라우트와 나눈 이유는 인증 방식이 다르기 때문이다. 관리자는 세션으로,
 * 이용자는 서명 링크에 실린 토큰으로 자신을 증명한다. 한 라우트에서 두 방식을 받으면
 * 어느 쪽 검사가 빠졌는지 알기 어려워진다.
 *
 * 보관된 PDF가 있으면 그것을 그대로 내려 준다 — 서명 당시 발급한 문서와 같아야 하고,
 * Chromium을 다시 띄우는 비용도 들지 않는다.
 *
 * 토큰만으로는 내려 주지 않는다. 서명할 때는 연락처 뒷자리를 요구하면서 서명본을 받을
 * 때는 요구하지 않으면, 뒷자리 확인이 통째로 우회된다 — 게다가 이 링크는 완료 메일에
 * 영구히 남아 있고 서명 후에도 만료되지 않아서, 메일을 전달받은 사람이나 몇 년 뒤
 * 공용 브라우저 이력에서 URL을 얻은 사람이 성명·생년월일·주소·서명 이미지가 박힌
 * PDF를 그대로 받을 수 있었다. 그래서 POST + 뒷자리로 바꿨다.
 *
 * GET은 남겨 두되 완료 페이지로 보낸다. 이미 발송된 메일에 GET 링크가 들어 있어서,
 * 405를 돌려주면 고객이 몇 년 뒤 그 링크를 눌렀을 때 오류 화면을 보게 된다.
 */
import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../../db/client';
import {
  getDownloadIdentityVerdict,
  recordDownloadIdentityFailure,
  resetDownloadIdentityAttempts,
  checkDownloadRateLimit,
} from '../../../../lib/contracts/admin-rate-limit';
import { IDENTITY_DIGITS, verifyIdentityDigits } from '../../../../lib/contracts/identity';
import { loadOrRenderContractPdf } from '../../../../lib/contracts/pdf-storage';

export const config = { maxDuration: 60 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  const { id, token } = req.query;

  if (typeof id !== 'string' || typeof token !== 'string' || token.trim() === '') {
    return res.status(400).json({ ok: false, message: '잘못된 요청입니다.' });
  }

  // 옛 메일에 실린 GET 링크. 계약 존재 여부를 여기서 조회하지 않는다 —
  // 응답 차이로 토큰의 유효성을 알려 줄 이유가 없다. 완료 페이지가 판정한다.
  if (req.method === 'GET') {
    return res.redirect(
      302,
      `/ko/contracts/${encodeURIComponent(id)}/complete?token=${encodeURIComponent(token)}`,
    );
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  try {
    // 계약 ID와 토큰이 함께 맞아야 한다 — ID만으로는 남의 계약서를 받을 수 없다.
    const contract = await getDb().query.contracts.findFirst({
      where: (contractsTable, { eq, and }) =>
        and(eq(contractsTable.id, id), eq(contractsTable.signToken, token)),
      with: { signatures: true, contractClauses: true, contractAttachments: true },
    });

    if (!contract) {
      return res.status(404).json({ ok: false, message: '계약서를 찾을 수 없습니다.' });
    }

    if (contract.status !== 'signed') {
      return res.status(409).json({
        ok: false,
        message: '서명이 완료된 뒤에 계약서를 받으실 수 있습니다.',
      });
    }

    if (contract.purgedAt) {
      return res.status(409).json({
        ok: false,
        message: '보관 기간이 지나 개인정보가 파기된 계약입니다. 계약서를 다시 발급할 수 없습니다.',
      });
    }

    /**
     * 서명 때와 같은 기준으로 당사자인지 확인한다.
     *
     * 먼저 잠김 여부만 읽어(카운터를 올리지 않는다) 이미 상한을 넘긴 요청을 무거운
     * 대조·렌더 전에 끊는다. 카운터는 뒷자리가 실제로 틀렸을 때만 올린다 — 빈 요청·형식
     * 오류로는 올리지 않아, 링크를 얻은 제3자가 아무것도 안 맞히고 당사자를 잠그지 못한다.
     */
    const attemptVerdict = await getDownloadIdentityVerdict(contract.id);
    if (attemptVerdict === 'locked') {
      return res.status(429).json({
        ok: false,
        message:
          '본인 확인에 너무 여러 번 실패했습니다. 잠시 후 다시 시도하거나 운영자에게 문의해 주세요. (010-4255-7893)',
      });
    }
    if (attemptVerdict === 'throttled') {
      return res.status(429).json({
        ok: false,
        message: '본인 확인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.',
      });
    }

    const identity = verifyIdentityDigits(
      (req.body as { identityDigits?: unknown } | undefined)?.identityDigits,
      contract.customerPhone,
    );
    if (!identity.ok) {
      // 형식이 맞는데 값이 틀린 경우(mismatch)만 대입 시도로 계수한다.
      // 빈 입력·자릿수 오류(malformed)는 세지 않는다 — 세면 빈 요청으로 잠글 수 있다.
      if (identity.reason === 'mismatch') {
        await recordDownloadIdentityFailure(contract.id);
      }
      const message =
        identity.reason === 'unverifiable'
          ? '계약서의 연락처가 올바르지 않아 본인 확인을 할 수 없습니다. 운영자에게 문의해 주세요.'
          : `계약서에 등록된 연락처 뒤 ${IDENTITY_DIGITS}자리를 정확히 입력해 주세요.`;
      return res.status(400).json({ ok: false, message });
    }

    // 확인에 성공했으니 창 카운터를 비운다 — 정상 이용이 예산을 갉아먹지 않게.
    await resetDownloadIdentityAttempts(contract.id);

    // PDF 생성은 Chromium을 띄우는 무거운 작업이라, 토큰을 아는 쪽이 반복 요청하면 부담이 된다.
    const allowed = await checkDownloadRateLimit(contract.id);
    if (!allowed) {
      return res.status(429).json({
        ok: false,
        message: '잠시 후 다시 시도해 주세요.',
      });
    }

    const pdf = await loadOrRenderContractPdf(contract);

    const filename = `${contract.customerName}_음악연습실_이용계약서.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdf.length);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="contract-${contract.id}.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    return res.status(200).send(pdf);
  } catch (error: unknown) {
    console.error('[API/contracts/[id]/download] Failed:', error);
    return res.status(500).json({ ok: false, message: '계약서를 준비하지 못했습니다.' });
  }
}

