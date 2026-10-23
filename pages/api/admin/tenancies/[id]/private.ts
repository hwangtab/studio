import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../../../db/client';
import { FieldCryptoError } from '../../../../../lib/crypto/fieldCrypto';
import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';
import { recordAdminPrivacyAccess, type PrivacyAccessResult } from '../../../../../lib/privacy/accessLog';
import { openPrivate } from '../../../../../lib/tenancy/privateData';

/**
 * GET — 월 입주자의 연락처·비상연락처·이메일·사업자번호·성별을 **응답으로만** 내보낸다(props·HTML에 싣지 않는다).
 * 열람 사실은 접속기록(`tenancy_private_view`)에 남기되 값은 적지 않는다. 실패도 남긴다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false });
  }
  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!id) return res.status(400).json({ ok: false, message: '잘못된 요청입니다.' });
  const log = (result: PrivacyAccessResult) =>
    recordAdminPrivacyAccess(req, auth.actor, 'tenancy_private_view', id, result).catch((error: unknown) => {
      console.error('[privacy] 접속기록 호출 실패 — 조회는 계속됩니다', error);
    });
  try {
    const row = await getDb().query.roomTenancies.findFirst({ where: (c, { eq }) => eq(c.id, id), columns: { privateEnc: true, contractId: true } });
    if (!row) {
      await log('not_found');
      return res.status(404).json({ ok: false, message: '입주 기록을 찾을 수 없어요.' });
    }
    const data = openPrivate(row.privateEnc);
    // 입주 기록에 연락처가 없고 전자계약이 연결돼 있으면 계약서의 번호를 함께 돌려준다 — 화면이 문자·전화 연결과 "계약서 번호로 채우기"에 쓴다.
    let contractPhone: string | null = null;
    if (!data.phone && row.contractId) {
      try {
        const contract = await getDb().query.contracts.findFirst({ where: (c, { eq }) => eq(c.id, row.contractId as string), columns: { customerPhone: true } });
        contractPhone = contract?.customerPhone && contract.customerPhone.trim() !== '' ? contract.customerPhone : null;
      } catch {
        contractPhone = null;
      }
    }
    await log('success');
    return res.status(200).json({ ok: true, private: data, contractPhone });
  } catch (error) {
    if (error instanceof FieldCryptoError) {
      await log('decrypt_failed');
      console.error(`[tenancy] 개인정보 복호화 실패 (id=${id}, code=${error.code})`);
      return res.status(500).json({ ok: false, code: error.code, message: '복호화하지 못했어요. 암호화 키를 확인해 주세요.' });
    }
    await log('error');
    console.error(`[tenancy] 개인정보 조회 실패 (id=${id})`);
    return res.status(500).json({ ok: false, message: '읽지 못했어요.' });
  }
}
