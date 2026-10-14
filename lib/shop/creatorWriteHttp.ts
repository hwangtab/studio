import type { NextApiResponse } from 'next';

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
