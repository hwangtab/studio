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

async function send<T = Record<string, never>>(url: string, init: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, init);
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.ok !== true) {
      return { ok: false, message: (data && typeof data.message === 'string' && data.message) || FALLBACK_MESSAGE };
    }
    return data as ApiResult<T>;
  } catch {
    return { ok: false, message: FALLBACK_MESSAGE };
  }
}

const post = <T = Record<string, never>>(url: string, body: unknown): Promise<ApiResult<T>> =>
  send<T>(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const saveBasicSection = (projectId: string, value: unknown) =>
  post(`/api/funding/creator/projects/${encodeURIComponent(projectId)}`, { section: 'basic', value });

export const saveStorySection = (projectId: string, value: unknown) =>
  post(`/api/funding/creator/projects/${encodeURIComponent(projectId)}`, { section: 'story', value });

export const saveCreatorSection = (projectId: string, value: unknown) =>
  post(`/api/funding/creator/projects/${encodeURIComponent(projectId)}`, { section: 'creator', value });

/**
 * 정산 정보 저장 — 계정 단위라 URL에 프로젝트 id가 없다(`/api/funding/creator/payout`).
 * 응답에 붙을 수 있는 것은 불리언 둘과 안내 문구뿐이다(`lib/funding/creatorProjectWrite.ts`의 `WriteResult`):
 * `residentNumberRetained`(사업자로 바꿨지만 주민등록번호를 남겼다), `businessProfileRetained`(개인으로 바꿨지만
 * 사업자 정보를 남겼다), `businessWarnings`(국세청 조회 결과 안내 — 저장은 됐다). 값이 실려 오는 것이 아니다.
 */
export const savePayoutSection = (value: unknown) =>
  post<{ residentNumberRetained?: true; businessProfileRetained?: true; businessWarnings?: string[] }>(
    '/api/funding/creator/payout',
    { value },
  );

const CERTIFICATE_URL = '/api/funding/creator/payout/certificate';

/** 사업자등록증 사본 업로드 — 원문 바이트를 그대로 보낸다(`ImageUploadField`와 같은 방식). 응답에 키·주소는 없다. */
export const uploadBusinessCertificate = (file: File) =>
  send<{ uploadedAt: string }>(CERTIFICATE_URL, { method: 'POST', body: file });

export const deleteBusinessCertificate = () => send(CERTIFICATE_URL, { method: 'DELETE' });

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

export const saveShopProfile = (value: unknown) =>
  post('/api/funding/creator/shop/profile', { section: 'profile', value });

export const saveShopProfileImage = (url: string) =>
  post('/api/funding/creator/shop/profile', { section: 'image', url });
