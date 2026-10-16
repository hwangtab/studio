import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit } from '../../../../lib/booking/rate-limit';
import { getClientIp } from '../../../../lib/contracts/client-ip';
import { fundingDownloadObjectExists, presignFundingDownload } from '../../../../lib/funding/r2';
import { getPublishedSoftware } from '../../../../lib/software/catalog';

/**
 * 설치 파일 내려받기 — `/api/software/download/<slug>/<version>/<platform>` → 10분짜리 R2 서명 주소로 302.
 *
 * 체험판과 정식판이 같은 설치 파일이라 **인증이 없다**(누구나 받는다). 그래도 공개 버킷을 따로 열지 않고 펀딩·상점이 쓰는 비공개
 * 버킷을 서명 주소로 쓴다 — 새 저장소·도메인 없이, R2는 내려받기 전송료가 없다. 키는 카탈로그(`data/software/catalog.ts`)에서만
 * 읽는다(요청으로 받은 경로를 키로 쓰지 않는다). 객체가 없으면 서명 주소가 R2 오류 XML로 보내므로 먼저 확인한다.
 * 공개 상품만, 레이트리밋은 IP당 시간 60회(설치 파일이 커서 남용 비용이 크다).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).end();

  const parts = Array.isArray(req.query.path) ? req.query.path : [];
  const [slug, version, platform] = parts;
  const product = parts.length === 3 ? getPublishedSoftware(slug) : null;
  const download = product?.releases.find((r) => r.version === version)?.downloads.find((d) => d.platform === platform);
  if (!download) return res.status(404).send('설치 파일을 찾을 수 없어요.');

  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`software_download:ip:${ip}`, 60, 3600))) return res.status(429).send('요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.');

  try {
    if (!(await fundingDownloadObjectExists(download.objectKey))) {
      console.error('[software/download] 카탈로그에 있는데 R2에 없는 설치 파일', { key: download.objectKey });
      return res.status(503).send('설치 파일을 준비하고 있어요. 잠시 후 다시 시도해 주세요.');
    }
    return res.redirect(302, await presignFundingDownload(download.objectKey));
  } catch (error) {
    console.error('[software/download] 서명 주소 발급 실패', { key: download.objectKey, error });
    return res.status(503).send('지금은 내려받을 수 없어요. 잠시 후 다시 시도해 주세요.');
  }
}
