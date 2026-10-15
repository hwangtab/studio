/** @jest-environment node */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { FUNDING_WITHHOLDING_PERCENT, SHOP_ARTIST_SHARE_PERCENT } from '../data/pricing';
import { getSiteConfig, studioOperator } from '../data/siteConfig';
import { POLICY_COPY_BY_LOCALE } from '../data/privacyPolicy';
import {
  ARTIST_SHIPPING_MASK_AFTER_DELIVERED_DAYS,
  ARTIST_SHIPPING_MASK_AFTER_SHIPPED_DAYS,
  SHOP_ARTIST_TERMS_VERSION,
} from '../lib/shop/artistTerms';
import { SHOP_STUDIO_COURIER } from '../lib/shop/shipper';
import {
  assertShopArtistTermsBaselineUpdateAllowed,
  serializeShopArtistTerms,
  SHOP_ARTIST_TERMS_VERSION_PATTERN,
  type ShopArtistTermsBaseline,
} from './shopArtistTermsHash';

/**
 * 상점 아티스트 위탁 약관 판본 게이트 — 약관 내용이 바뀌었는데 `SHOP_ARTIST_TERMS_VERSION`이 그대로면 실패한다.
 * `content/showOrganizerTerms.baseline.test.ts`(공연 주최자 약관 게이트)를 본떴다.
 */

const BASELINE_PATH = path.join(process.cwd(), 'content/shop-artist-terms.baseline.json');

const sha256 = (text: string): string => crypto.createHash('sha256').update(text, 'utf8').digest('hex');

const HOW_TO_UPDATE = [
  '갱신 절차:',
  '  1. lib/shop/artistTerms.ts의 SHOP_ARTIST_TERMS_VERSION을 올린다 (shop-artist-terms-YYYY-MM-DD,',
  '     같은 날 두 번째 개정이면 -r2 / -r3 접미사).',
  '  2. UPDATE_SHOP_ARTIST_TERMS_BASELINE=1 npx jest content/shopArtistTerms.baseline.test.ts 로 기준선을 다시 쓴다.',
  '     ①을 빠뜨리고 ②만 실행하면 갱신 경로가 스스로 거부한다(assertShopArtistTermsBaselineUpdateAllowed).',
  '  3. 바뀐 판본과 content/shop-artist-terms.baseline.json을 같은 커밋에 넣고, 무엇이 바뀌었는지 적는다.',
  '',
  '판본이 바뀌면 모든 아티스트가 콘솔에서 다시 동의해야 한다(옛 판본 동의 기록은 shop_artist_terms_agreements에',
  '그대로 남는다). 옛 판본의 본문은 git 이력으로만 남으므로, 커밋 메시지에 "어느 조항이 어떻게 바뀌었는지"를 남길 것.',
].join('\n');

const readBaseline = (): ShopArtistTermsBaseline | null =>
  fs.existsSync(BASELINE_PATH) ? (JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) as ShopArtistTermsBaseline) : null;

/** 조항 하나 — 제목 줄(`\n제N조 (`)로 자른다. 본문 속 "제5조에 따라" 같은 참조에 걸리지 않게. */
const section = (serialized: string, from: string, to?: string): string => {
  const after = serialized.split(from)[1] ?? '';
  return to ? (after.split(to)[0] ?? '') : after;
};

describe('상점 아티스트 위탁 약관 판본 게이트', () => {
  const serialized = serializeShopArtistTerms();
  const hash = sha256(serialized);

  if (process.env.UPDATE_SHOP_ARTIST_TERMS_BASELINE === '1') {
    it('기준선을 갱신한다 (UPDATE_SHOP_ARTIST_TERMS_BASELINE=1)', () => {
      assertShopArtistTermsBaselineUpdateAllowed(readBaseline(), { version: SHOP_ARTIST_TERMS_VERSION, hash }, process.env.ALLOW_BASELINE_CREATE === '1');
      const payload: ShopArtistTermsBaseline = {
        note: '상점 아티스트가 개설자 콘솔에서 동의하는 위탁 약관(SHOP_ARTIST_TERMS_SECTIONS)의 내용 해시. 내용이 바뀌면 SHOP_ARTIST_TERMS_VERSION을 먼저 올린 뒤 UPDATE_SHOP_ARTIST_TERMS_BASELINE=1 로 갱신할 것.',
        version: SHOP_ARTIST_TERMS_VERSION,
        hash,
        covers: [
          'lib/shop/artistTerms.ts — SHOP_ARTIST_TERMS_SECTIONS, 받는 분 정보 가림 기간',
          'data/pricing.ts · lib/shop/shipper.ts · data/siteConfig.ts — 본문에 보간되는 정산 비율·원천징수율·스튜디오 택배사·당사자 표시',
        ],
      };
      fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(payload, null, 1)}\n`);
      expect(readBaseline()).toMatchObject({ version: SHOP_ARTIST_TERMS_VERSION, hash });
    });
    return;
  }

  const baseline = readBaseline();

  it('기준선 파일이 있다', () => {
    expect(baseline).not.toBeNull();
  });

  it('약관 내용이 바뀌었으면 SHOP_ARTIST_TERMS_VERSION도 함께 바뀌어 있다', () => {
    expect(
      !baseline || baseline.hash === hash || baseline.version !== SHOP_ARTIST_TERMS_VERSION
        ? ''
        : [
            '상점 아티스트 위탁 약관의 내용이 바뀌었는데 SHOP_ARTIST_TERMS_VERSION이 그대로다.',
            `  현재 판본: ${SHOP_ARTIST_TERMS_VERSION}`,
            `  기준선 해시: ${baseline.hash}`,
            `  현재   해시: ${hash}`,
            '',
            '왜 위험한가: shop_artist_terms_agreements.terms_version은 "그때 이 내용에 동의했다"는 증거다.',
            '내용이 바뀌었는데 문자열이 같으면, 서로 다른 문서에 동의한 아티스트들이 같은 판본을 갖게 되고,',
            '콘솔도 바뀐 약관에 다시 동의를 받지 않는다.',
            '',
            HOW_TO_UPDATE,
          ].join('\n'),
    ).toBe('');
  });

  it('내용이 바뀌고 버전도 올렸다면 기준선도 함께 갱신돼 있다', () => {
    expect(
      baseline?.hash === hash
        ? ''
        : [`기준선이 오래됐다 — 내용 해시가 다르다 (기준선 ${baseline?.hash.slice(0, 12)}… vs 현재 ${hash.slice(0, 12)}…).`, HOW_TO_UPDATE].join('\n'),
    ).toBe('');
  });

  it('내용이 그대로면 기준선 판본도 현재 판본과 같다', () => {
    expect(
      !baseline || baseline.hash !== hash || baseline.version === SHOP_ARTIST_TERMS_VERSION
        ? ''
        : [`내용은 그대로인데 기준선 판본(${baseline.version})이 현재 판본(${SHOP_ARTIST_TERMS_VERSION})과 다르다.`, '판본만 올렸다면 기준선도 함께 갱신할 것.', HOW_TO_UPDATE].join('\n'),
    ).toBe('');
  });

  it('판본 문자열은 날짜 형식을 지킨다', () => {
    expect(SHOP_ARTIST_TERMS_VERSION).toMatch(SHOP_ARTIST_TERMS_VERSION_PATTERN);
    for (const ok of ['shop-artist-terms-2026-10-14-r2', 'shop-artist-terms-2026-10-14-r10']) {
      expect(ok).toMatch(SHOP_ARTIST_TERMS_VERSION_PATTERN);
    }
    for (const bad of ['shop-artist-terms-2026-10-14-r0', 'shop-artist-terms-2026-10-14-r1', 'shop-artist-terms-2026-10-14-r01', 'shop-artist-terms-2026-10-4']) {
      expect(bad).not.toMatch(SHOP_ARTIST_TERMS_VERSION_PATTERN);
    }
  });

  it('직렬화 대상에 10개 조항이 모두 들어간다', () => {
    for (const heading of [
      '제1조 (목적과 당사자)',
      '제2조 (판매자)',
      '제3조 (상품 등록과 심사)',
      '제4조 (승인 뒤에 바꿀 수 있는 것과 없는 것)',
      '제5조 (발송 주체)',
      '제6조 (맡긴 상품)',
      '제7조 (정산)',
      '제8조 (판매 중지와 계약의 해지)',
      '제9조 (개인정보 처리의 위탁)',
      '제10조 (약관의 변경)',
    ]) {
      expect(serialized).toContain(heading);
    }
  });

  it('직렬화 대상에 보간 상수가 따로 실린다', () => {
    expect(serialized).toContain(`SHOP_ARTIST_SHARE_PERCENT=${SHOP_ARTIST_SHARE_PERCENT}`);
    expect(serialized).toContain(`FUNDING_WITHHOLDING_PERCENT=${FUNDING_WITHHOLDING_PERCENT}`);
    expect(serialized).toContain(`SHOP_STUDIO_COURIER=${SHOP_STUDIO_COURIER}`);
    expect(serialized).toContain(`ARTIST_SHIPPING_MASK_AFTER_DELIVERED_DAYS=${ARTIST_SHIPPING_MASK_AFTER_DELIVERED_DAYS}`);
    expect(serialized).toContain(`ARTIST_SHIPPING_MASK_AFTER_SHIPPED_DAYS=${ARTIST_SHIPPING_MASK_AFTER_SHIPPED_DAYS}`);
  });

  it('1조가 당사자(상호·대표·사업자등록번호)를 siteConfig에서 말한다', () => {
    const site = getSiteConfig('ko');
    const first = section(serialized, '\n제1조 (', '\n제2조 (');
    expect(first).toContain(site.name);
    expect(first).toContain(`대표 ${studioOperator.name}`);
    expect(first).toContain(site.businessRegistrationNumber);
  });

  it('2조가 판매자는 스튜디오이고 결제·청약철회·환불·고객 응대를 스튜디오가 한다고 말한다', () => {
    const seller = section(serialized, '\n제2조 (', '\n제3조 (');
    expect(seller).toContain('판매자는 스튜디오입니다');
    for (const w of ['결제', '청약철회', '환불', '고객 응대']) expect(seller).toContain(w);
  });

  it('7조가 상수에서 보간한 정산 비율·원천징수율을 말하고, 구체 정산 주기를 지어내지 않는다', () => {
    const payout = section(serialized, '\n제7조 (', '\n제8조 (');
    expect(payout).toContain(`판매가(부가가치세 포함, 배송비 제외)의 ${SHOP_ARTIST_SHARE_PERCENT}%`);
    expect(payout).toContain(`원천징수 ${FUNDING_WITHHOLDING_PERCENT}%`);
    expect(payout).toContain('배송비는 전액 아티스트의 몫에 더합니다');
    expect(payout).toContain('환불된 판매는 정산에서 뺍니다');
    expect(payout).toContain('정산 시기와 방법은 스튜디오가 아티스트에게 따로 알립니다');
    // 운영자가 정하지 않은 주기·지급일을 적지 않는다.
    expect(payout).not.toMatch(/매월|영업일|\d+일 이내|익월/);
  });

  it('6조는 소유권만 정하고 분실·파손·회수는 협의로 열어 둔다', () => {
    const consigned = section(serialized, '\n제6조 (', '\n제7조 (');
    expect(consigned).toContain('판매되기 전까지 아티스트에게 있습니다');
    expect(consigned).toContain('협의하여 정합니다');
  });

  it('9조가 개인정보 보호법 제26조·시행령 제28조의 위탁 문서 항목을 모두 담는다', () => {
    const delegation = section(serialized, '\n제9조 (', '\n제10조 (');
    // 위탁 업무의 목적과 범위 · 목적 외 처리 금지 · 재위탁 제한 · 안전성 확보 조치 · 관리·감독 · 손해배상 책임
    expect(delegation).toContain('상품 발송과 배송 문의 응대 업무를 아티스트에게 위탁');
    expect(delegation).toContain('다른 목적으로 이용하거나 제3자에게 제공하지 않습니다');
    expect(delegation).toContain('다시 위탁하지 않습니다');
    expect(delegation).toContain('안전성 확보에 필요한 기술적·관리적 조치');
    expect(delegation).toContain('개인정보 열람 기록');
    expect(delegation).toContain('손해를 배상할 책임');
    // 사고 통지 · 파기(업무를 마친 뒤 · 계약이 끝나면)
    expect(delegation).toContain('지체 없이 스튜디오에 알리고');
    expect(delegation).toContain('지체 없이 파기합니다');
    expect(delegation).toContain('이 계약이 끝나면');
    expect(delegation).toContain(`${ARTIST_SHIPPING_MASK_AFTER_DELIVERED_DAYS}일`);
    expect(delegation).toContain(`${ARTIST_SHIPPING_MASK_AFTER_SHIPPED_DAYS}일`);
  });

  it('9조의 제공 항목이 처리방침 4항이 알린 항목과 같다(처리방침이 "위탁 계약으로 정한다"고 약속한 그 계약)', () => {
    const delegation = section(serialized, '\n제9조 (', '\n제10조 (');
    const fourth = POLICY_COPY_BY_LOCALE.ko.sections.find((s) => s.heading.startsWith('4.'));
    expect(fourth?.body).toContain('스튜디오는 이를 위탁 계약으로 정합니다');
    const items = '받는 분 이름·연락처·우편번호·주소·상세주소·배송 메모와 주문번호·상품명·옵션·수량·한정판 번호·발송 예정일';
    expect(fourth?.body).toContain(items);
    expect(delegation).toContain('받는 분의 이름·연락처·우편번호·주소·상세주소·배송 메모, 주문번호·상품명·옵션·수량·한정판 번호·발송 예정일');
    expect(fourth?.body).toContain('주문자의 이메일 주소, 결제 금액과 결제수단은 아티스트에게 제공하지 않습니다');
    expect(delegation).toContain('주문자의 이메일 주소, 결제 금액과 결제수단은 제공하지 않습니다');
    expect(fourth?.body).toContain(`배송이 완료된 날부터 ${ARTIST_SHIPPING_MASK_AFTER_DELIVERED_DAYS}일(배송 완료가 표시되지 않으면 발송한 날부터 ${ARTIST_SHIPPING_MASK_AFTER_SHIPPED_DAYS}일)`);
  });

  it('10조가 판본이 바뀌면 다시 동의를 받는다고 말한다', () => {
    expect(section(serialized, '\n제10조 (', '\n##')).toContain('동의를 다시 받습니다');
  });

  it('정산 비율이 바뀌면 본문 경로로도 상수 블록 경로로도 해시가 달라진다', () => {
    const viaBody = serialized.replace(`배송비 제외)의 ${SHOP_ARTIST_SHARE_PERCENT}%`, '배송비 제외)의 50%');
    expect(viaBody).not.toBe(serialized);
    expect(sha256(viaBody)).not.toBe(hash);
    const viaConstants = serialized.replace(`SHOP_ARTIST_SHARE_PERCENT=${SHOP_ARTIST_SHARE_PERCENT}`, 'SHOP_ARTIST_SHARE_PERCENT=50');
    expect(viaConstants).not.toBe(serialized);
    expect(sha256(viaConstants)).not.toBe(hash);
  });

  it('조항 본문이 한 글자만 바뀌어도 해시가 달라진다', () => {
    const tampered = serialized.replace('지체 없이 파기합니다', '적절한 때에 파기합니다');
    expect(tampered).not.toBe(serialized);
    expect(sha256(tampered)).not.toBe(hash);
  });
});

describe('assertShopArtistTermsBaselineUpdateAllowed — 갱신 경로 우회 차단', () => {
  const existing = { version: 'shop-artist-terms-2026-10-14', hash: 'a'.repeat(64) };

  it('내용이 바뀌었는데 판본이 그대로면 기준선을 쓰지 못하게 막는다', () => {
    expect(() => assertShopArtistTermsBaselineUpdateAllowed(existing, { version: existing.version, hash: 'b'.repeat(64) }))
      .toThrow(/SHOP_ARTIST_TERMS_VERSION이 그대로다/);
  });

  it('판본을 올렸으면 통과시킨다', () => {
    expect(() => assertShopArtistTermsBaselineUpdateAllowed(existing, { version: 'shop-artist-terms-2026-10-14-r2', hash: 'b'.repeat(64) })).not.toThrow();
  });

  it('내용이 그대로면(판본만 손봄) 통과시킨다', () => {
    expect(() => assertShopArtistTermsBaselineUpdateAllowed(existing, { version: existing.version, hash: existing.hash })).not.toThrow();
  });

  it('최초 생성은 allowCreate=true를 명시했을 때만 통과시킨다', () => {
    expect(() => assertShopArtistTermsBaselineUpdateAllowed(null, { version: existing.version, hash: 'b'.repeat(64) }, true)).not.toThrow();
    expect(() => assertShopArtistTermsBaselineUpdateAllowed(null, { version: existing.version, hash: 'b'.repeat(64) }))
      .toThrow(/ALLOW_BASELINE_CREATE=1/);
  });

  it('파일 삭제 우회 거부 메시지는 git 복구를 안내한다', () => {
    expect(() => assertShopArtistTermsBaselineUpdateAllowed(null, { version: existing.version, hash: 'b'.repeat(64) }))
      .toThrow(/git checkout/);
  });
});
