import type { NextApiResponse } from 'next';

import { hasAgreedCurrentShopArtistTerms, SHOP_ARTIST_TERMS_REQUIRED_MESSAGE } from './artistTermsAgreement';
import type { ProductWriteCode, ProductWriteResult } from './creatorProductWrite';

/** `ProductWriteResult.code` → HTTP 상태. 아티스트 상품 라우트가 함께 쓴다(한 벌만 둔다). */
const STATUS_BY_CODE: Record<ProductWriteCode, number> = {
  not_found: 404,
  not_editable: 409,
  locked: 409,
  duplicate_slug: 400,
  too_many: 400,
  invalid: 400,
  incomplete: 400,
  no_shop: 403,
  conflict: 409,
};

export const respondProductFailure = (res: NextApiResponse, result: Extract<ProductWriteResult, { ok: false }>) =>
  res.status(STATUS_BY_CODE[result.code]).json({ ok: false, message: result.message });

/**
 * 위탁 약관 게이트 — 현재 판본에 동의하지 않은 아티스트의 쓰기 요청(상품 생성·저장·제출·공개 토글, 상품 사진 업로드, 재고 입력,
 * 발송 처리)을 서버에서 거부한다. 응답을 보냈으면 false. 표가 없는 DB도 미동의(403)다 — `artistTermsAgreement.ts` 머리주석.
 */
export const rejectUnlessShopArtistTermsAgreed = async (res: NextApiResponse, creatorId: string, label: string): Promise<boolean> => {
  try {
    if (await hasAgreedCurrentShopArtistTerms(creatorId)) return true;
  } catch (error: unknown) {
    console.error(`[${label}] 위탁 약관 동의 조회 실패:`, error);
    res.status(500).json({ ok: false, message: '잠시 후 다시 시도해 주세요.' });
    return false;
  }
  res.status(403).json({ ok: false, code: 'terms_not_agreed', message: SHOP_ARTIST_TERMS_REQUIRED_MESSAGE });
  return false;
};
