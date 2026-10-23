import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { kstDateString } from '../../../../lib/booking/kst';
import { addDays, isRealDate, parsePaymentInput } from '../../../../lib/lessons/rules';
import {
  deleteLessonPayment, endEnrollment, getEnrollmentDetail, recordLessonPayment, rescheduleSession, setSessionStatus, updateEnrollmentNote,
  type SessionTarget,
} from '../../../../lib/lessons/service';

const TARGETS: readonly string[] = ['scheduled', 'done', 'absent', 'studio_cancelled'];
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * 수강 한 건의 조작 — 회차 상태·일정 변경·수납 기록/삭제·중도 종료·메모. 한 엔드포인트에 `action`으로 가른다(예약·공연 관리자 API와 같은 모양).
 * 회차·수납은 **이 수강의 것**인지 확인한 뒤에만 건드린다. 개인정보를 받지 않아 접속기록 대상이 아니다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }
  const id = typeof req.query.id === 'string' ? req.query.id : '';
  const b = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as Record<string, unknown>;
  const today = kstDateString(new Date());

  try {
    const detail = await getEnrollmentDetail(id);
    if (!detail) return res.status(404).json({ ok: false, message: '수강 등록을 찾을 수 없어요.' });
    const ownsSession = (sessionId: unknown) => typeof sessionId === 'string' && detail.sessions.some((s) => s.id === sessionId);

    switch (b.action) {
      case 'session_status': {
        if (!ownsSession(b.sessionId) || typeof b.status !== 'string' || !TARGETS.includes(b.status)) return res.status(400).json({ ok: false, message: '요청이 올바르지 않아요.' });
        const r = await setSessionStatus({
          sessionId: b.sessionId as string, status: b.status as SessionTarget,
          topic: typeof b.topic === 'string' ? b.topic : undefined, homework: typeof b.homework === 'string' ? b.homework : undefined,
        });
        return r.ok ? res.status(200).json({ ok: true, warnings: r.warnings }) : res.status(409).json({ ok: false, message: r.message });
      }
      case 'reschedule': {
        if (!ownsSession(b.sessionId) || !isRealDate(b.date) || typeof b.time !== 'string' || !TIME_RE.test(b.time)) return res.status(400).json({ ok: false, message: '날짜와 시각을 확인해 주세요.' });
        // 오타(2062년·0050년)가 블록을 엉뚱한 해에 거는 것을 막는다 — 오늘부터 2년 안만.
        if ((b.date as string) < today || (b.date as string) > addDays(today, 730)) return res.status(400).json({ ok: false, message: '일정은 오늘부터 2년 안의 날짜로만 옮길 수 있어요.' });
        const r = await rescheduleSession({ sessionId: b.sessionId as string, date: b.date, time: b.time });
        return r.ok ? res.status(200).json({ ok: true }) : res.status(409).json({ ok: false, message: r.message });
      }
      case 'payment_add': {
        const parsed = parsePaymentInput(b, today);
        if (!parsed.ok) return res.status(400).json({ ok: false, message: parsed.message });
        const paymentId = await recordLessonPayment(id, parsed.value, auth.actor);
        return paymentId ? res.status(201).json({ ok: true, id: paymentId }) : res.status(404).json({ ok: false, message: '수강 등록을 찾을 수 없어요.' });
      }
      case 'payment_delete': {
        if (typeof b.paymentId !== 'string' || !detail.payments.some((p) => p.id === b.paymentId)) return res.status(404).json({ ok: false, message: '수납 기록을 찾을 수 없어요.' });
        const deleted = await deleteLessonPayment(b.paymentId, auth.actor);
        return deleted ? res.status(200).json({ ok: true }) : res.status(404).json({ ok: false, message: '이미 지운 기록이에요.' });
      }
      case 'end': {
        const reason = typeof b.reason === 'string' ? b.reason.trim() : '';
        if (reason.length < 2) return res.status(400).json({ ok: false, message: '중도 종료 사유를 적어 주세요.' });
        const r = await endEnrollment({ enrollmentId: id, reason, endedOn: today });
        return r.ok ? res.status(200).json({ ok: true }) : res.status(409).json({ ok: false, message: r.message });
      }
      case 'note': {
        await updateEnrollmentNote(id, typeof b.note === 'string' ? b.note : '');
        return res.status(200).json({ ok: true });
      }
      default:
        return res.status(400).json({ ok: false, message: '알 수 없는 작업이에요.' });
    }
  } catch (error: unknown) {
    console.error('[API/admin/lessons/[id]] 실패:', error instanceof Error ? error.message : String(error));
    return res.status(500).json({ ok: false, message: '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
  }
}
