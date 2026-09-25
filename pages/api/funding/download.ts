import type { NextApiRequest, NextApiResponse } from 'next';
import { sql } from 'drizzle-orm';

import { getDb } from '../../../db/client';
import { getClientIp } from '../../../lib/contracts/client-ip';
import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { isTokenMatch } from '../../../lib/booking/token';
import { findFundingOrderByOrderNo } from '../../../lib/funding/service';
import { getFundingProjectAsync } from '../../../lib/funding/repository';
import { isLiveFundingOrderStatus, liveFundingOrderStatusList } from '../../../lib/funding/refundable';
import { alertMissingDownloadObject } from '../../../lib/funding/downloadAlert';
import { fundingDownloadObjectExists, presignFundingDownload } from '../../../lib/funding/r2';

/**
 * 디지털 리워드 내려받기 — **최초 접근을 기록하는** 경로.
 *
 * 왜 직접 링크를 주지 않는가: 약관 제8조 2항이 "내려받기가 시작된 뒤에는 청약철회가
 * 제한됩니다"(전자상거래법 제17조 2항 5호)라고 고지하는데, 그 판정 근거가 서버에 없었다.
 * 고지만 있고 구현이 없어서, 1.8GB 원본을 전부 받고도 전액 환불이 그대로 됐다.
 *
 * 여기서 `downloaded_at`을 남기면 `assessSelfCancel`이 그 뒤의 셀프 취소를 막는다.
 *
 * **이제 접근 제어 수단이기도 하다.** 예전에는 저장소의 공개 주소로 302를 보냈고, 그
 * 주소가 확정 메일과 후원 확인 페이지에 그대로 실려 나갔다 — 후원자가 게이트를 건너뛰고
 * 직접 받으면 `downloaded_at`이 안 찍혀 **파일을 전부 받은 뒤 전액 셀프 환불**이 됐고,
 * 티어 간 파일명을 바꿔 상위 음질을 가져갈 수도 있었다. 지금 밖으로 나가는 값은 객체
 * 키뿐이고, 실제 주소는 여기서 서명해 만든다(lib/funding/r2.ts).
 *
 * 전제: 버킷의 공개 접근이 꺼져 있어야 한다. 켜져 있으면 서명을 떼고 같은 객체를 받을 수
 * 있어 이 경로가 다시 기록 장치로만 남는다.
 *
 * **POST만 받는다.** GET이면 메일 본문의 주소를 여는 것만으로 기록이 남는데, 그 주소를
 * 여는 것이 사람이라는 보장이 없다 — 회사 메일의 링크 검사기(Safe Links·Proofpoint)나
 * 카카오톡·슬랙의 미리보기 봇이 배달 시점에 한 번 긁는다. 그러면 후원자는 파일을 받은
 * 적이 없는데 "내려받은 뒤에는 청약철회가 제한됩니다"를 보게 되고, 셀프 취소를 잃는다.
 * 고지한 조건("내려받기가 시작된 뒤")과 판정 조건("이 주소에 GET이 한 번 닿음")이 다르면
 * 그 기록은 환불을 거절할 근거가 못 된다.
 *
 * 그래서 메일에는 이 주소를 싣지 않고 후원 확인 페이지로 보낸다. 내려받기는 그 페이지와
 * 확정 화면의 버튼(form POST)에서만 시작된다 — 사람이 누른 것만 기록에 남는다.
 */

const NOT_FOUND = { ok: false, message: '펀딩 내역을 찾을 수 없습니다.' } as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: '내려받기는 펀딩 확인 페이지의 버튼으로 시작해 주세요.' });

  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`funding_download:ip:${ip}`, 60, 3600)))
    return res.status(429).json({ ok: false, message: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });

  // 폼 전송이라 본문으로 온다. 쿼리는 보지 않는다 — 받으면 GET과 같은 구멍이 우회로로 남는다.
  const { orderNo, token, file } = (req.body ?? {}) as Record<string, unknown>;
  if (typeof orderNo !== 'string' || typeof token !== 'string' || typeof file !== 'string' || !orderNo || !token)
    return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않습니다.' });

  const order = await findFundingOrderByOrderNo(orderNo);
  // 주문 부재와 토큰 불일치를 같은 404로 — 다르게 답하면 주문의 존재를 떠볼 수 있다.
  if (!order || !isTokenMatch(order.manageToken, token)) return res.status(404).json(NOT_FOUND);
  const pledge = order.fundingPledge;
  if (!pledge) return res.status(404).json(NOT_FOUND);

  // 환불·취소된 건에는 내려주지 않는다. 화면 쪽 판정과 같은 집합을 쓴다.
  if (!isLiveFundingOrderStatus(order.status))
    return res.status(409).json({ ok: false, message: '결제가 살아 있는 펀딩만 내려받을 수 있습니다.' });

  const project = await getFundingProjectAsync(pledge.projectSlug);
  const reward = project?.rewards.find((r) => r.id === pledge.rewardId);
  // `file`은 **이 후원자의 리워드가 주는 키**와 일치해야 한다. 목록에 없는 값을 넘겨
  // 다른 티어의 파일이나 버킷의 다른 객체에 서명을 받아 내지 못하게 한다.
  const target = reward?.downloads.find((d) => d.key === file);
  if (!target) return res.status(404).json(NOT_FOUND);

  /**
   * 최초 1회만 기록한다. `downloaded_at IS NULL`을 WHERE에 넣어 DB가 판정하게 하므로,
   * 같은 사람이 동시에 두 파일을 눌러도 먼저 도착한 쪽의 시각만 남는다. 판정 기준은
   * "언제 시작했는가"이지 "마지막으로 언제 받았는가"가 아니다.
   */
  /**
   * 서명을 **먼저** 받는다. 발급이 실패하면(자격증명 누락 등) 기록을 남기지 않아야 한다 —
   * 파일을 못 받았는데 `downloaded_at`만 찍히면 후원자가 셀프 취소까지 잃는다.
   */
  let signedUrl: string;
  try {
    signedUrl = await presignFundingDownload(target.key);
  } catch (error) {
    console.error('[funding-download] 서명 주소 발급 실패', { orderNo: order.orderNo, key: target.key, error });
    return res.status(503).json({ ok: false, message: '지금은 내려받을 수 없습니다. 잠시 후 다시 시도해 주세요.' });
  }

  /**
   * 서명이 성공했다고 파일이 있는 것은 아니다 — `client.sign`은 순수 계산이라 키 오타·파일
   * 교체·삭제 상태에서도 그럴듯한 주소를 만든다. 그대로 302를 보내면 후원자는 R2의
   * `NoSuchKey` XML을 받는데 `downloaded_at`은 이미 찍혀 있어, 한 바이트도 못 받은 채
   * "음원을 내려받은 뒤에는 청약철회가 제한됩니다"를 보게 된다. 되돌리는 경로는 관리자
   * `clear_download_record` 하나뿐이다. 그래서 기록 전에 서명된 HEAD로 한 번 물어본다.
   */
  let objectExists: boolean;
  try {
    objectExists = await fundingDownloadObjectExists(target.key);
  } catch (error) {
    // "없다"가 아니라 "모르겠다" — 헛경보를 보내지 않고 재시도를 안내한다.
    console.error('[funding-download] 객체 확인 실패', { orderNo: order.orderNo, key: target.key, error });
    return res.status(503).json({ ok: false, message: '지금은 내려받을 수 없습니다. 잠시 후 다시 시도해 주세요.' });
  }
  if (!objectExists) {
    await alertMissingDownloadObject({ key: target.key, orderNo: order.orderNo });
    return res.status(503).json({ ok: false, message: '파일을 준비하지 못했습니다. 운영자에게 알렸습니다.' });
  }

  /**
   * 최초 1회만 기록하고, **그 순간 주문이 아직 살아 있는지도 같은 문장에서 본다.**
   *
   * 위 `isLiveFundingOrderStatus` 검사는 읽기 시점 판정이라 그 뒤에 벌어진 일을 모른다.
   * 셀프 취소와 내려받기는 후원 확인 화면에 나란히 있으므로 순서가 이렇게 잡힐 수 있다:
   * 내려받기가 `paid`를 읽음 → 취소가 주문을 선점(그 시점 `downloaded_at`은 NULL이라
   * cancel.ts의 가드도 통과한다) → 토스 전액 취소 → 내려받기가 기록하고 서명 주소를
   * 내준다. 돈은 돌아가고 파일은 나가는, H1과 같은 결과다. 서명·객체 확인(R2 왕복)이
   * 읽기와 쓰기 사이에 있어 그 창은 짧지 않다.
   *
   * COALESCE로 첫 시각을 보존한다 — 판정 기준은 "언제 시작했는가"이지 "마지막으로 언제
   * 받았는가"가 아니다. 그래서 두 번째 내려받기도 rowsAffected 1을 받고(같은 값으로 다시
   * 쓴다) 정상 통과하며, 0행은 **주문이 살아 있지 않다**는 뜻 하나뿐이다.
   * 상태 목록은 화면·취소와 같은 정본을 쓴다(lib/funding/refundable.ts).
   */
  const recorded = await getDb().run(sql`
    UPDATE funding_pledges
    SET downloaded_at = COALESCE(downloaded_at, unixepoch()), updated_at = unixepoch()
    WHERE id = ${pledge.id}
      AND EXISTS (SELECT 1 FROM orders WHERE id = ${order.id} AND status IN (${liveFundingOrderStatusList()}))
  `);
  if (Number(recorded.rowsAffected) === 0) {
    console.error('[funding-download] 기록 직전에 주문이 살아 있지 않게 됐다 — 서명 주소를 내주지 않는다', {
      orderNo: order.orderNo, key: target.key,
    });
    return res.status(409).json({ ok: false, message: '이미 취소된 후원입니다. 내려받을 수 없습니다.' });
  }

  res.redirect(302, signedUrl);
}
