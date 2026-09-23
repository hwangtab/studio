import type { NextApiRequest, NextApiResponse } from 'next';

import { FieldCryptoError, FIELD_CRYPTO_KEY_ENV } from '../../../../../../lib/crypto/fieldCrypto';
import { authenticateAdminApi } from '../../../../../../lib/contracts/admin-auth';
import { loadFundingResidentNumber } from '../../../../../../lib/funding/residentNumber';

/**
 * GET — 개설자의 주민등록번호를 **응답으로만** 내보낸다.
 *
 * 계좌 조회(`payout-account.ts`)와 같은 모양이고 같은 이유다: props에 담으면
 * `__NEXT_DATA__`로 페이지 소스에 박히므로, 운영자가 버튼을 누른 그 순간에만 가져와
 * 화면 state에만 둔다. 다른 점은 **계좌와 합치지 않았다**는 것 하나다 — 계좌는 이체할
 * 때마다, 이 번호는 지급명세서를 낼 때만 연다. 합치면 계좌만 보려던 조회에서도 번호가
 * 복호화돼 응답에 실리고, 열람 기록도 둘을 구분하지 못한다.
 *
 * 조회 사실을 서버 로그에 남기되 **값은 적지 않는다.** 로그가 새면 DB 암호화가 무의미해진다.
 */

/** 복호화 실패 → 운영자가 해야 할 일. 사유마다 다르므로 문구를 가른다. */
const CRYPTO_ERROR_MESSAGE: Record<FieldCryptoError['code'], string> = {
  missing_key: `이 환경에 복호화 키(${FIELD_CRYPTO_KEY_ENV})가 없습니다. 값은 그대로 있습니다 — 배포 환경 변수에 키를 등록한 뒤 다시 시도해 주세요.`,
  invalid_key: `복호화 키(${FIELD_CRYPTO_KEY_ENV})의 형식이 맞지 않습니다(base64 32바이트여야 합니다). 값은 그대로 있습니다 — 환경 변수를 고친 뒤 다시 시도해 주세요.`,
  malformed: '저장된 값이 암호화 형식이 아닙니다. 개설자에게 주민등록번호를 다시 등록해 달라고 요청해 주세요.',
  unsupported_version: '저장된 값의 암호화 판본을 이 배포가 모릅니다. 배포 판본을 확인해 주세요 — 값을 지우거나 덮어쓰지 마세요.',
  key_mismatch: `이 값은 지금 이 배포의 키(${FIELD_CRYPTO_KEY_ENV})가 아니라 다른 키로 저장됐습니다. 값은 손상되지 않았습니다 — 저장 당시의 키를 되돌리거나, 키 회전이 중간에 멈춘 것이라면 scripts/rotate-field-key.mjs를 이어서 돌리면 열립니다. 값을 지우거나 덮어쓰지 마세요.`,
  auth_failed: `복호화에 실패했습니다. 키(${FIELD_CRYPTO_KEY_ENV})가 저장 당시와 다르거나 값이 손상됐습니다. 키가 다른 경우는 보통 위의 key_mismatch로 갈리므로(저장 형식 v2는 키 식별자를 함께 싣습니다), 이 코드는 **판본 v1로 저장된 옛 값**이거나 값 자체가 손상된 경우입니다. 다른 개설자의 번호가 정상적으로 열리면 값 손상, 전부 안 열리면 키가 바뀐 것입니다 — 키가 바뀐 경우 옛 키를 되돌려야 하고, 되돌릴 수 없으면 개설자에게 다시 등록을 요청해야 합니다.`,
};

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

  try {
    const residentNumber = await loadFundingResidentNumber(id);
    if (!residentNumber) {
      return res.status(404).json({
        ok: false,
        message: '등록된 주민등록번호가 없습니다. 원천징수 대상이면 개설자에게 등록을 요청해 주세요.',
      });
    }
    console.warn(`[funding] 주민등록번호 조회 (projectId=${id}, at=${new Date().toISOString()})`);
    return res.status(200).json({ ok: true, residentNumber });
  } catch (error: unknown) {
    if (error instanceof FieldCryptoError) {
      // 코드만 남긴다 — FieldCryptoError의 메시지에는 값이 들어 있지 않지만, 로그에 적을
      // 이유도 없다.
      console.error(`[funding] 주민등록번호 복호화 실패 (projectId=${id}, code=${error.code})`);
      return res.status(500).json({ ok: false, code: error.code, message: CRYPTO_ERROR_MESSAGE[error.code] });
    }
    console.error(`[funding] 주민등록번호 조회 실패 (projectId=${id}):`, error);
    return res.status(500).json({ ok: false, message: '주민등록번호를 읽지 못했습니다.' });
  }
}
