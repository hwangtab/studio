import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Resend 수신 웹훅(svix 서명) 검증.
 *
 * 서명이 없거나 틀린 요청을 통과시키면 아무나 이 엔드포인트로 가짜 이벤트를 보내
 * 임의 메일을 수신함으로 흘려보낼 수 있으므로, 검증 실패는 전부 거부한다.
 * svix 스펙: HMAC-SHA256(`${id}.${timestamp}.${payload}`), 키는 `whsec_` 뒤 base64.
 * `svix-signature` 헤더는 공백으로 구분된 `v1,<base64>` 목록이며 키 롤테이션 중에는
 * 여러 개가 올 수 있어 하나라도 일치하면 유효하다.
 */

const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

export type SvixVerifyFailure =
    | 'INVALID_SECRET'
    | 'INVALID_TIMESTAMP'
    | 'TIMESTAMP_OUT_OF_TOLERANCE'
    | 'NO_MATCHING_SIGNATURE';

export type SvixVerifyResult = { ok: true } | { ok: false; reason: SvixVerifyFailure };

interface SvixVerifyInput {
    /** 파싱 전 원문 바디. 파싱 후 재직렬화하면 서명이 어긋난다. */
    payload: string;
    svixId: string;
    svixTimestamp: string;
    svixSignature: string;
    secret: string;
    /** 테스트에서 시간을 고정할 때만 주입 */
    nowSeconds?: number;
}

export function verifySvixSignature(input: SvixVerifyInput): SvixVerifyResult {
    const secretPart = input.secret.startsWith('whsec_') ? input.secret.slice(6) : input.secret;
    const key = Buffer.from(secretPart, 'base64');
    if (key.length === 0) {
        return { ok: false, reason: 'INVALID_SECRET' };
    }

    const timestamp = Number(input.svixTimestamp);
    if (!Number.isInteger(timestamp) || timestamp <= 0) {
        return { ok: false, reason: 'INVALID_TIMESTAMP' };
    }

    const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > SIGNATURE_TOLERANCE_SECONDS) {
        return { ok: false, reason: 'TIMESTAMP_OUT_OF_TOLERANCE' };
    }

    const expected = createHmac('sha256', key)
        .update(`${input.svixId}.${input.svixTimestamp}.${input.payload}`)
        .digest();

    for (const candidate of input.svixSignature.split(/\s+/)) {
        const [version, signature] = candidate.split(',');
        if (version !== 'v1' || !signature) {
            continue;
        }
        const candidateBuffer = Buffer.from(signature, 'base64');
        if (candidateBuffer.length === expected.length && timingSafeEqual(candidateBuffer, expected)) {
            return { ok: true };
        }
    }

    return { ok: false, reason: 'NO_MATCHING_SIGNATURE' };
}

export interface ParsedEmailAddress {
    /** 표시 이름. 없으면 주소가 곧 이름이다. */
    displayName: string;
    address: string;
}

/**
 * `"홍길동" <hong@example.com>` / `hong@example.com` 두 형태를 모두 받는다.
 * 포워딩 메일의 From 표시 이름과 Reply-To를 만들 때 쓰므로, 헤더 인젝션이
 * 되지 않도록 제어문자·꺾쇠·따옴표는 이름에서 제거한다.
 */
export function parseEmailAddress(raw: string): ParsedEmailAddress {
    const match = raw.match(/^\s*(?:"?([^"<]*)"?\s*)?<([^<>\s]+@[^<>\s]+)>\s*$/);
    if (match) {
        const name = (match[1] ?? '')
            // eslint-disable-next-line no-control-regex
            .replace(/[\u0000-\u001f<>"]/g, '')
            .trim()
            .slice(0, 80);
        const address = match[2].trim();
        return { displayName: name || address, address };
    }
    const address = raw.trim();
    return { displayName: address, address };
}

/** 수신자 목록에 전용 주소가 포함되는지 (대소문자 무시) */
export function includesAlias(recipients: Array<string | null | undefined>, alias: string): boolean {
    const normalizedAlias = alias.toLowerCase();
    return recipients.some(
        (recipient) => recipient != null && parseEmailAddress(recipient).address.toLowerCase() === normalizedAlias,
    );
}
