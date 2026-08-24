import { createHash, timingSafeEqual } from 'crypto';
import type { NextApiRequest } from 'next';

/**
 * Vercel Cron 요청인지 확인한다.
 *
 * Vercel Cron은 `Authorization: Bearer ${CRON_SECRET}` 헤더를 붙여 호출한다.
 * 세 크론(gsc-audit·purge-contracts·backup-contracts)이 같은 검사를 각자 복사해
 * 두고 있었고, 셋 다 `===`로 비교했다. 문자열 비교는 첫 불일치 바이트에서 즉시
 * 끝나므로 이론상 앞자리부터 한 바이트씩 맞춰 나갈 수 있다.
 *
 * 원격 타이밍 공격이 현실적으로 성립하기는 어렵지만, 같은 저장소의
 * `isAdminPasswordValid`(lib/contracts/admin-auth.ts)가 이미 SHA-256 고정 길이화 +
 * timingSafeEqual을 쓰고 있어 기준을 맞추는 비용이 사실상 없다.
 *
 * 길이가 다른 값을 timingSafeEqual에 바로 넣으면 예외가 나므로, 양쪽을 SHA-256으로
 * 32바이트에 고정한 뒤 비교한다(문자 단위 루프는 길이 차이가 실행 시간에 드러난다).
 *
 * CRON_SECRET이 없으면 fail-closed — 크론이 조용히 열리는 것보다 조용히 멈추는 편이 낫다.
 * 멈춘 사실은 로그로 남긴다.
 */
export const isCronAuthorized = (req: NextApiRequest, label: string): boolean => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error(`[${label}] CRON_SECRET is not set — 요청을 거부한다.`);
    return false;
  }

  const header = req.headers.authorization;
  if (typeof header !== 'string' || header === '') {
    return false;
  }

  const digest = (value: string): Buffer => createHash('sha256').update(value, 'utf8').digest();
  return timingSafeEqual(digest(`Bearer ${secret}`), digest(header));
};
