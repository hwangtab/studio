import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit } from '../../../../../lib/booking/rate-limit';
import { getClientIp } from '../../../../../lib/contracts/client-ip';
import { PRESS_HOST } from '../../../../../lib/press/host';
import {
  LISTENING_ROOMS,
  buildRoomCookie,
  isRoomPasswordMatch,
  issueRoomToken,
  type ListeningRoomId,
} from '../../../../../lib/press/listeningRoom';

/**
 * 감상실 비밀번호 입력. 폼 POST를 받아 **303으로 페이지에 되돌려 보낸다** — 자바스크립트 없이도
 * 들어올 수 있게(메일 앱 안 브라우저 등). 맞으면 입장 쿠키를 세우고, 틀리면 `?e=1`을 붙인다.
 *
 * 비밀번호 하나를 여러 매체가 함께 쓰므로 대입을 막는 장치는 IP당 횟수 제한뿐이다.
 */
const LOCALE_RE = /^(ko|en|zh|es|vi|th|uz)$/;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.headers.host === PRESS_HOST) return res.status(404).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const roomId = String(req.query.room ?? '');
  const room = Object.prototype.hasOwnProperty.call(LISTENING_ROOMS, roomId)
    ? LISTENING_ROOMS[roomId as ListeningRoomId]
    : null;
  if (!room) return res.status(404).end();

  const body = (req.body ?? {}) as Record<string, unknown>;
  const locale = typeof body.locale === 'string' && LOCALE_RE.test(body.locale) ? body.locale : 'ko';
  const back = `/${locale}/press/${room.id}`;

  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`press_room:${room.id}:ip:${ip}`, 10, 15 * 60))) {
    return res.redirect(303, `${back}?e=limit`);
  }

  const password = typeof body.password === 'string' ? body.password : '';
  if (!isRoomPasswordMatch(room, password)) return res.redirect(303, `${back}?e=1`);

  res.setHeader('Set-Cookie', buildRoomCookie(room, issueRoomToken(room)));
  return res.redirect(303, back);
}
