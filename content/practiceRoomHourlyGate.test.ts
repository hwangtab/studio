/** @jest-environment node */
import type { NextApiRequest, NextApiResponse } from 'next';

import { PRACTICE_ROOM_HOURLY_OPEN } from '../data/practiceRoomAvailability';
import { getFaqData } from '../data/faq';
import { getPricingData, PRACTICE_ROOM_HOURLY_PRICE_INCL } from '../data/pricing';
import { locales as LOCALES } from '../lib/i18n';
import { buildBookingHub } from '../lib/booking/hub';
import { getProduct, isProductOpenForOnlineSale } from '../lib/booking/products';
import { PRICE_FACTS } from '../lib/llms/priceFacts';
import { scaleQuestionFor } from '../lib/quote/estimate';
import llmsHandler from '../pages/api/llms';
import { generatePracticeRoomMonthlyRentSchema } from '../utils/schema/commerce';
import { generateDefaultSchema } from '../utils/schema/business';

/**
 * 연습실 시간제 판매 스위치(PRACTICE_ROOM_HOURLY_OPEN) 가드. 설계: docs/design-practice-room-hourly-sunset-2026-10.md
 *
 * 스위치가 꺼져 있으면 고객이 보는 면(예약·허브·가격표·FAQ·견적·llms.txt·JSON-LD)에 시간제가 하나도 남지 않아야 한다.
 * 예약만 닫고 카피·스키마가 남으면 죽은 링크가 되고 AI가 계속 "시간당 6,600원"을 말한다.
 * 스위치를 다시 켜면(true) 같은 면들이 시간제를 보여야 한다 — 되돌릴 수 있다는 약속의 증거다.
 */
const PRICE_TEXT = new RegExp(`${PRACTICE_ROOM_HOURLY_PRICE_INCL.toLocaleString('en-US')}|${PRACTICE_ROOM_HOURLY_PRICE_INCL}`);

const callLlms = async (): Promise<string> => {
  let body = '';
  const res = {
    setHeader() {},
    status() { return this; },
    send(payload: unknown) { body = String(payload); return this; },
    end(payload?: unknown) { body = payload === undefined ? '' : String(payload); return this; },
  } as unknown as NextApiResponse;
  await llmsHandler({ method: 'GET', query: {}, headers: {} } as unknown as NextApiRequest, res);
  return body;
};

describe('연습실 시간제 판매 스위치', () => {
  it('상품 정의와 가격 상수는 닫혀도 남는다 — 되돌리기·관리자 수기 예약용', () => {
    expect(getProduct('practice-room-hourly')).toBeDefined();
    expect(PRACTICE_ROOM_HOURLY_PRICE_INCL).toBe(6600);
  });

  it('온라인 판매 판정이 스위치를 따른다', () => {
    const product = getProduct('practice-room-hourly')!;
    expect(isProductOpenForOnlineSale(product)).toBe(PRACTICE_ROOM_HOURLY_OPEN);
    // 다른 상품은 스위치와 무관하게 열려 있다.
    expect(isProductOpenForOnlineSale(getProduct('recording-pro')!)).toBe(true);
  });

  it('예약 허브의 연습실 시간제 카드가 스위치를 따른다', () => {
    const ids = buildBookingHub().map((g) => g.id);
    expect(ids.includes('practice-room')).toBe(PRACTICE_ROOM_HOURLY_OPEN);
  });

  it('견적 도구의 연습실 선택지가 스위치를 따른다', () => {
    const choices = scaleQuestionFor('practice')?.choices.map((c) => c.id) ?? [];
    expect(choices.includes('hourly')).toBe(PRACTICE_ROOM_HOURLY_OPEN);
    expect(choices).toContain('monthly');
  });

  it('가격표 오퍼·FAQ·JSON-LD가 7개 로케일 모두 스위치를 따른다', () => {
    for (const locale of LOCALES) {
      const offerIds = getPricingData(locale).practiceRoomOffers.map((o) => o.id);
      expect(offerIds.includes('practice-room-hourly')).toBe(PRACTICE_ROOM_HOURLY_OPEN);
      expect(offerIds).toContain('practice-room-monthly');

      const faqText = JSON.stringify(getFaqData(locale));
      expect(PRICE_TEXT.test(faqText)).toBe(PRACTICE_ROOM_HOURLY_OPEN);

      const productSchema = JSON.stringify(generatePracticeRoomMonthlyRentSchema('https://studionol.co.kr/ko/practice-room', locale));
      expect(productSchema.includes('practice-room-hourly')).toBe(PRACTICE_ROOM_HOURLY_OPEN);
      expect(productSchema.includes('ReserveAction')).toBe(PRACTICE_ROOM_HOURLY_OPEN);

      const defaultSchema = JSON.stringify(generateDefaultSchema('https://studionol.co.kr', locale));
      expect(defaultSchema.includes('"HUR"')).toBe(PRACTICE_ROOM_HOURLY_OPEN);
    }
  });

  it('llms.txt 가격 줄·본문이 스위치를 따른다', async () => {
    expect(PRICE_FACTS.some((f) => f.includes('Practice Room Hourly'))).toBe(PRACTICE_ROOM_HOURLY_OPEN);
    const llms = await callLlms();
    expect(llms.includes('Practice Room Hourly')).toBe(PRACTICE_ROOM_HOURLY_OPEN);
    expect(llms.includes('/ko/booking/practice-room')).toBe(PRACTICE_ROOM_HOURLY_OPEN);
    expect(PRICE_TEXT.test(llms.split('\n').filter((l) => /practice|연습실|练习/i.test(l)).join('\n'))).toBe(PRACTICE_ROOM_HOURLY_OPEN);
    // 월세는 닫혀도 남는다.
    expect(llms).toContain('Practice Room Monthly Residency');
  });
});
