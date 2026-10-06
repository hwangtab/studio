import type { NextApiRequest, NextApiResponse } from 'next';

import { SABBAHA_SLUNG_AUDIO } from '../../../../../data/press/sabbahaSlungAudio';
import { PRESS_HOST } from '../../../../../lib/press/host';
import { presignPressAudio } from '../../../../../lib/press/audio';
import { LISTENING_ROOMS, isRoomTokenValid, roomCookieName } from '../../../../../lib/press/listeningRoom';

/**
 * 감상실 음원의 재생 주소를 다시 내준다. 페이지가 처음 그릴 때 주소를 함께 싣고(getServerSideProps),
 * 이 경로는 **주소가 만료된 뒤** 플레이어가 같은 자리에서 이어 듣기 위해 부른다.
 * 입장 쿠키가 없으면 401 — 주소의 존재도 알리지 않는다.
 */
const ROOM_AUDIO = { 'sabbaha-slung': SABBAHA_SLUNG_AUDIO } as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.headers.host === PRESS_HOST) return res.status(404).end();
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }

  const roomId = String(req.query.room ?? '');
  if (!Object.prototype.hasOwnProperty.call(ROOM_AUDIO, roomId)) return res.status(404).end();
  const room = LISTENING_ROOMS[roomId as keyof typeof ROOM_AUDIO];
  if (!isRoomTokenValid(room, req.cookies[roomCookieName(room)])) return res.status(401).json({ ok: false });

  try {
    const tracks = ROOM_AUDIO[roomId as keyof typeof ROOM_AUDIO];
    const { urls, validUntil } = await presignPressAudio(tracks.map((t) => t.pathname));
    return res.status(200).json({ ok: true, urls, validUntil });
  } catch (error) {
    console.error('[press/audio] 재생 주소를 만들지 못했다', error);
    return res.status(503).json({ ok: false });
  }
}
