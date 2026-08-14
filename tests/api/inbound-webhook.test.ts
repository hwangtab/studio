/** @jest-environment node */

import { createHmac, randomBytes } from 'crypto';

import {
    includesAlias,
    parseEmailAddress,
    verifySvixSignature,
} from '../../lib/email/inboundWebhook';

const SECRET_KEY = randomBytes(24);
const SECRET = `whsec_${SECRET_KEY.toString('base64')}`;
const NOW = 1_800_000_000;

const sign = (payload: string, id: string, timestamp: number, key: Buffer = SECRET_KEY): string =>
    `v1,${createHmac('sha256', key).update(`${id}.${timestamp}.${payload}`).digest('base64')}`;

describe('verifySvixSignature', () => {
    const payload = JSON.stringify({ type: 'email.received', data: { email_id: 'abc' } });

    it('올바른 서명을 통과시킨다', () => {
        const result = verifySvixSignature({
            payload,
            svixId: 'msg_1',
            svixTimestamp: String(NOW),
            svixSignature: sign(payload, 'msg_1', NOW),
            secret: SECRET,
            nowSeconds: NOW,
        });
        expect(result).toEqual({ ok: true });
    });

    it('변조된 바디를 거부한다', () => {
        const result = verifySvixSignature({
            payload: payload.replace('abc', 'evil'),
            svixId: 'msg_1',
            svixTimestamp: String(NOW),
            svixSignature: sign(payload, 'msg_1', NOW),
            secret: SECRET,
            nowSeconds: NOW,
        });
        expect(result).toEqual({ ok: false, reason: 'NO_MATCHING_SIGNATURE' });
    });

    it('허용 범위를 벗어난 타임스탬프를 거부한다 (리플레이 방지)', () => {
        const stale = NOW - 6 * 60;
        const result = verifySvixSignature({
            payload,
            svixId: 'msg_1',
            svixTimestamp: String(stale),
            svixSignature: sign(payload, 'msg_1', stale),
            secret: SECRET,
            nowSeconds: NOW,
        });
        expect(result).toEqual({ ok: false, reason: 'TIMESTAMP_OUT_OF_TOLERANCE' });
    });

    it('키 롤테이션으로 서명이 여러 개일 때 하나만 맞아도 통과시킨다', () => {
        const otherKey = randomBytes(24);
        const combined = `${sign(payload, 'msg_1', NOW, otherKey)} ${sign(payload, 'msg_1', NOW)}`;
        const result = verifySvixSignature({
            payload,
            svixId: 'msg_1',
            svixTimestamp: String(NOW),
            svixSignature: combined,
            secret: SECRET,
            nowSeconds: NOW,
        });
        expect(result).toEqual({ ok: true });
    });

    it('숫자가 아닌 타임스탬프를 거부한다', () => {
        const result = verifySvixSignature({
            payload,
            svixId: 'msg_1',
            svixTimestamp: 'not-a-number',
            svixSignature: sign(payload, 'msg_1', NOW),
            secret: SECRET,
            nowSeconds: NOW,
        });
        expect(result).toEqual({ ok: false, reason: 'INVALID_TIMESTAMP' });
    });
});

describe('parseEmailAddress', () => {
    it('이름 있는 주소를 분해한다', () => {
        expect(parseEmailAddress('홍길동 <hong@example.com>')).toEqual({
            displayName: '홍길동',
            address: 'hong@example.com',
        });
    });

    it('따옴표로 감싼 이름을 처리한다', () => {
        expect(parseEmailAddress('"Kim, Studio" <kim@example.com>')).toEqual({
            displayName: 'Kim, Studio',
            address: 'kim@example.com',
        });
    });

    it('이름 없는 주소는 주소를 이름으로 쓴다', () => {
        expect(parseEmailAddress('bare@example.com')).toEqual({
            displayName: 'bare@example.com',
            address: 'bare@example.com',
        });
    });

    it('이름에 든 제어문자를 제거한다 (헤더 인젝션 방지)', () => {
        const parsed = parseEmailAddress('Evil\r\nBcc: x@y.z <evil@example.com>');
        expect(parsed.address).toBe('evil@example.com');
        expect(parsed.displayName).not.toMatch(/[\r\n]/);
    });
});

describe('includesAlias', () => {
    it('대소문자를 무시하고 매칭한다', () => {
        expect(includesAlias(['Hello@StudioNOL.co.kr'], 'hello@studionol.co.kr')).toBe(true);
    });

    it('이름 붙은 수신자 표기도 매칭한다', () => {
        expect(includesAlias(['Studio NOL <hello@studionol.co.kr>'], 'hello@studionol.co.kr')).toBe(true);
    });

    it('다른 주소만 있으면 거부한다', () => {
        expect(includesAlias(['noreply@studionol.co.kr', null, undefined], 'hello@studionol.co.kr')).toBe(false);
    });
});
