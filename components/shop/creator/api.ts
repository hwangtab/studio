import type { CreatorProductDetail } from '../../../lib/shop/creatorProductWrite';

/**
 * 아티스트 상점 콘솔이 상품 API를 부르는 자리. 응답은 `{ ok: true, ... }` 또는 `{ ok: false, message }` 한 벌이고,
 * 실패 메시지는 서버가 준 한국어를 그대로 돌려준다(화면은 다시 쓰지 않는다).
 */
export type ApiResult<T = object> = ({ ok: true } & T) | { ok: false; message: string };

const FALLBACK = '연결에 실패했어요. 잠시 후 다시 시도해 주세요.';

async function request<T = object>(method: 'POST' | 'PUT', url: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.ok !== true) {
      return { ok: false, message: (data && typeof data.message === 'string' && data.message) || FALLBACK };
    }
    return data as ApiResult<T>;
  } catch {
    return { ok: false, message: FALLBACK };
  }
}

const base = '/api/funding/creator/shop/products';

export const createShopProduct = () => request<{ id: string }>('POST', base, {});

export const saveShopProduct = (id: string, value: unknown) =>
  request<{ product: CreatorProductDetail }>('PUT', `${base}/${encodeURIComponent(id)}`, { value });

export const shopProductAction = (id: string, action: 'submit' | 'withdraw' | 'publish' | 'unpublish') =>
  request<{ product: CreatorProductDetail }>('POST', `${base}/${encodeURIComponent(id)}`, { action });
