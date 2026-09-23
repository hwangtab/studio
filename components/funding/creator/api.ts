import type { RewardInput } from '../../../lib/funding/creatorValidation';

/**
 * 개설자 편집 화면이 Task 7 API 네 개를 부르는 자리를 한 곳에 모은다.
 *
 * 전부 `fetch(url, { method: 'POST' })`다 — 같은 출처라 Origin 검사(`isAllowedContactRequestOrigin`)를
 * 통과한다. 응답은 `{ ok: true, ... }` 또는 `{ ok: false, message }` 한 벌이라 여기서
 * 공통으로 판정한다. **실패 메시지는 서버가 준 한국어를 그대로 돌려준다** — 화면은 그
 * 문자열을 다시 쓰지 않는다.
 */
export type ApiResult<T = Record<string, never>> = { ok: true } & T | { ok: false; message: string };

const FALLBACK_MESSAGE = '연결에 실패했습니다. 잠시 후 다시 시도해 주세요.';

async function post<T = Record<string, never>>(url: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.ok !== true) {
      return { ok: false, message: (data && typeof data.message === 'string' && data.message) || FALLBACK_MESSAGE };
    }
    return data as ApiResult<T>;
  } catch {
    return { ok: false, message: FALLBACK_MESSAGE };
  }
}

export const saveBasicSection = (projectId: string, value: unknown) =>
  post(`/api/funding/creator/projects/${encodeURIComponent(projectId)}`, { section: 'basic', value });

export const saveStorySection = (projectId: string, value: unknown) =>
  post(`/api/funding/creator/projects/${encodeURIComponent(projectId)}`, { section: 'story', value });

export const saveCreatorSection = (projectId: string, value: unknown) =>
  post(`/api/funding/creator/projects/${encodeURIComponent(projectId)}`, { section: 'creator', value });

export const savePayoutSection = (projectId: string, value: unknown) =>
  post(`/api/funding/creator/projects/${encodeURIComponent(projectId)}`, { section: 'payout', value });

export const createReward = (projectId: string, value: RewardInput) =>
  post(`/api/funding/creator/projects/${encodeURIComponent(projectId)}/rewards`, { mode: 'create', value });

export const updateReward = (projectId: string, value: RewardInput, previousRewardId: string) =>
  post(`/api/funding/creator/projects/${encodeURIComponent(projectId)}/rewards`, {
    mode: 'update', value, previousRewardId,
  });

export const deleteReward = (projectId: string, rewardId: string) =>
  post(`/api/funding/creator/projects/${encodeURIComponent(projectId)}/rewards`, { mode: 'delete', rewardId });

export const saveFulfillment = (
  projectId: string,
  value: { pledgeId: string; fulfillmentStatus: string; trackingCompany?: string; trackingNumber?: string },
) => post(`/api/funding/creator/projects/${encodeURIComponent(projectId)}/fulfillment`, value);

export const submitProject = (projectId: string, agreedTermsVersion?: string) =>
  post(`/api/funding/creator/projects/${encodeURIComponent(projectId)}/submit`, { agreedTermsVersion });

export const withdrawProject = (projectId: string) =>
  post(`/api/funding/creator/projects/${encodeURIComponent(projectId)}/withdraw`, {});

export const createProject = () => post<{ id: string }>('/api/funding/creator/projects', {});

export const logoutCreator = () => post('/api/funding/creator/logout', {});
