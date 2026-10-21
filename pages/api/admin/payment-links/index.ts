import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { blockConflictsBody, findBlockConflicts } from '../../../../lib/booking/blockConflicts';
import { closePaymentLink, createPaymentLink, validatePaymentLinkInput } from '../../../../lib/payments/paymentLinks';
import { sql } from 'drizzle-orm';

import { getDb } from '../../../../db/client';
import { BUSINESS_LINE_LABELS, parseBusinessLine } from '../../../../lib/ops/businessLine';
import { loadPaymentLinkLines, saveLineAssignment } from '../../../../lib/ops/businessLineStore';
import { safeDbErrorSummary } from '../../../../lib/payments/dbErrorSummary';

/**
 * 관리자 결제 링크 — POST `create`(새 링크, 즉시 열린다) · `close`(닫기, 되돌릴 수 없다), PATCH(매출 분야 바꾸기). 규칙은 lib/payments/paymentLinks.ts.
 * 금액은 VAT 포함 총액이다. 발급한 링크의 금액을 고치는 액션은 없다(틀렸으면 닫고 새로 만든다).
 *
 * 분야 변경은 이미 받은 결제에도 소급된다(매출은 링크의 분야로 센다 — businessLineStore.ts). 제작·믹싱 계약 링크는 녹음·제작으로 고정이라 거절한다.
 * 바꾼 사람·시각은 분야 지정 표의 `created_by`·`created_at`(마지막으로 정한 사람·시각)에 남고, 바꾸기 전 값은 서버 로그에 남긴다 —
 * 링크 메모는 예약 목록·캘린더 일정에 그대로 실리므로 이력을 거기에 붙이지 않는다.
 */
const changeLinkLine = async (req: NextApiRequest, res: NextApiResponse, actor: string) => {
  const b = ((typeof req.body === 'object' && req.body) || {}) as Record<string, unknown>;
  const slug = typeof b.slug === 'string' ? b.slug : '';
  const line = parseBusinessLine(b.businessLine);
  if (!slug || !line) return res.status(400).json({ ok: false, message: '링크와 분야를 다시 골라 주세요.' });
  let exists = false;
  try {
    exists = (await getDb().all<{ slug: string }>(sql`SELECT slug FROM payment_links WHERE slug = ${slug}`)).length > 0;
  } catch (error) {
    console.error('[api/admin/payment-links] 링크 조회 실패:', safeDbErrorSummary(error));
    return res.status(500).json({ ok: false, message: '링크를 찾지 못했어요. 결제 링크 표(마이그레이션 0060)를 확인해 주세요.' });
  }
  if (!exists) return res.status(404).json({ ok: false, message: '없는 링크예요(옛 파일 링크는 분야를 바꿀 수 없어요).' });
  const current = (await loadPaymentLinkLines([slug])).get(slug);
  if (current?.fixed) {
    return res.status(409).json({ ok: false, message: '제작·믹싱 계약의 결제 링크라 분야가 녹음·제작으로 고정돼 있어요(계약 대금은 녹음·제작 매출입니다).' });
  }
  const before = current?.line ?? 'recording';
  if (!(await saveLineAssignment('payment_link', slug, line, actor))) {
    return res.status(503).json({ ok: false, message: '분야를 저장하지 못했어요(마이그레이션 0084 적용 전이거나 조회 오류).' });
  }
  console.warn(`[api/admin/payment-links] 분야 변경 ${slug}: ${BUSINESS_LINE_LABELS[before]}→${BUSINESS_LINE_LABELS[line]} (${actor})`);
  return res.status(200).json({ ok: true, line, lineLabel: BUSINESS_LINE_LABELS[line], before });
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  if (req.method === 'PATCH') return changeLinkLine(req, res, auth.actor);
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, PATCH');
    return res.status(405).json({ ok: false });
  }

  const b = ((typeof req.body === 'object' && req.body) || {}) as Record<string, unknown>;
  if (b.action === 'create') {
    const input = validatePaymentLinkInput(b);
    if (!input.ok) return res.status(400).json({ ok: false, message: input.message });
    // 매출 분야(선택, lib/ops/businessLine.ts). 비우면 녹음·제작으로 센다.
    const businessLine = b.businessLine === undefined || b.businessLine === null || b.businessLine === '' ? null : parseBusinessLine(b.businessLine);
    if (businessLine === null && !(b.businessLine === undefined || b.businessLine === null || b.businessLine === '')) {
      return res.status(400).json({ ok: false, message: '분야를 다시 골라 주세요.' });
    }
    try {
      /**
       * 이용 시간대를 막는 링크는 이미 잡힌 예약과 겹치는지 먼저 본다 — 겹친 채 블록을 만들면 그 예약은 남은 채 시간만 "휴무"가 된다
       * (`/api/admin/blocks`와 같은 409 `conflicts` + `force` 규약). 링크 주문은 예약 행이 없어 이 검사만이 이중 예약을 알려 준다.
       */
      if (input.value.blockSlot && input.value.sessionAt !== null && input.value.sessionHours !== null && b.force !== true) {
        const conflicts = await findBlockConflicts({
          startAt: new Date(input.value.sessionAt * 1000),
          endAt: new Date((input.value.sessionAt + input.value.sessionHours * 3600) * 1000),
          roomNumber: null,
        });
        if (conflicts.length > 0) return res.status(409).json(blockConflictsBody(conflicts));
      }
      const { slug, blockId } = await createPaymentLink(input.value);
      // 분야는 따로 둔 표(마이그레이션 0084)에 적는다 — 실패해도 링크는 열려 있고, 녹음·제작으로 센다고 알린다.
      const lineSaved = businessLine === null || (await saveLineAssignment('payment_link', slug, businessLine, auth.actor));
      return res.status(201).json({
        ok: true, slug, path: `/ko/pay/${slug}`, blocked: blockId !== null,
        ...(lineSaved ? {} : { warning: '링크는 만들었지만 매출 분야는 저장하지 못했어요(마이그레이션 0084 적용 전). 녹음·제작으로 셉니다.' }),
      });
    } catch (error) {
      console.error('[api/admin/payment-links] 생성 실패(마이그레이션 0060 적용 여부 확인)', error instanceof Error ? error.name : 'unknown');
      return res.status(500).json({ ok: false, message: '링크를 만들지 못했어요. 결제 링크 표(마이그레이션 0060)가 적용됐는지 확인해 주세요.' });
    }
  }
  if (b.action === 'close') {
    const slug = typeof b.slug === 'string' ? b.slug : '';
    const { closed, blockReleased } = await closePaymentLink(slug);
    return closed ? res.status(200).json({ ok: true, blockReleased }) : res.status(409).json({ ok: false, message: '이미 닫혔거나 없는 링크예요.' });
  }
  return res.status(400).json({ ok: false, message: '알 수 없는 작업이에요.' });
}
