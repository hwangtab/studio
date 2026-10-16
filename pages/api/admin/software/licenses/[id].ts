import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';
import { getDb } from '../../../../../db/client';
import { getAnySoftware } from '../../../../../lib/software/catalog';
import { resendSoftwareKeyEmail, sendManualLicenseEmail } from '../../../../../lib/software/email';
import { adminDeactivate, revokeLicense } from '../../../../../lib/software/service';

/**
 * 관리자 — 라이선스 하나에 대한 조치. `action`:
 * - `revoke` 라이선스 취소(새 기기 활성화 차단. 이미 활성화한 기기는 오프라인 파일이라 계속 돈다)
 * - `deactivate` 기기 해제 — `activationId`가 있으면 그 기기만, 없으면 전부(고객이 컴퓨터를 바꿨을 때)
 * - `email_key` 키 메일 다시 보내기 — 결제 주문이면 구매자에게 키·구매 내역 링크, 결제 없는 발급이면 받는 분에게 키와 사용법
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  const b = ((typeof req.body === 'object' && req.body) || {}) as Record<string, unknown>;
  if (!id) return res.status(400).json({ ok: false, message: '잘못된 요청이에요.' });

  if (b.action === 'revoke') {
    const changed = await revokeLicense(id);
    return changed ? res.status(200).json({ ok: true }) : res.status(409).json({ ok: false, message: '이미 취소됐거나 없는 라이선스예요.' });
  }
  if (b.action === 'deactivate') {
    const activationId = typeof b.activationId === 'string' && b.activationId ? b.activationId : undefined;
    const count = await adminDeactivate(id, activationId);
    return res.status(200).json({ ok: true, count });
  }
  if (b.action === 'email_key') {
    const license = await getDb().query.softwareLicenses.findFirst({ where: (t, { eq }) => eq(t.id, id) });
    if (!license || license.status !== 'active') return res.status(409).json({ ok: false, message: '사용 중인 라이선스에만 보낼 수 있어요.' });
    const r = license.orderNo
      ? await resendSoftwareKeyEmail(license.orderNo)
      : await sendManualLicenseEmail({
          licenseKey: license.licenseKey, email: license.email, customerName: license.customerName,
          productTitle: getAnySoftware(license.productSlug)?.title ?? license.productSlug, maxActivations: license.maxActivations,
        });
    return r.ok ? res.status(200).json({ ok: true }) : res.status(502).json({ ok: false, message: r.message ?? '메일을 보내지 못했어요.' });
  }
  return res.status(400).json({ ok: false, message: '잘못된 요청이에요.' });
}
