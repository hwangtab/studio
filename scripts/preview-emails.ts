/**
 * 메일 미리보기 — 샘플 입력으로 HTML 파일을 쓴다. 새 메일을 만들면 `samples`에 항목을 추가한다.
 *
 *   npx tsx scripts/preview-emails.ts [outDir]          # 기본 outDir: /tmp/email-preview
 *
 * 스크린샷(크롬 헤드리스):
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
 *     --window-size=700,1000 --screenshot=<png> file://<outDir>/<name>.html
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { emptyDraft } from '../lib/shows/organizer/draft';
import { buildOperatorMail, buildReviewMail, type ShowMailContext } from '../lib/shows/organizer/email';
import { adminUrl, buildEmailLayout, escapeHtml, strong, type EmailLayoutInput } from '../lib/email/layout';
import {
  buildShopDecisionLayout, buildShopEditedLayout, buildShopSubmissionLayout, type ShopMailProduct,
} from '../lib/shop/reviewEmail';

const samples: { name: string; input: EmailLayoutInput }[] = [
  {
    name: 'customer',
    input: {
      preheader: '계약 조건을 확인하고 서명해 주세요.',
      heading: '계약서 서명을 요청드립니다',
      paragraphs: [
        `${escapeHtml('홍길동')}님, 안녕하세요. 스튜디오 놀입니다.`,
        `아래 계약 조건을 확인하신 뒤 ${strong('계약서 서명하기')}를 눌러 서명을 완료해 주세요.`,
      ],
      rows: [
        { label: '계약명', value: '믹싱 10트랙 이하' },
        { label: '계약 금액', value: '1,500,000원', emphasis: true },
        { label: '연락처', value: '010-1234-5678', href: 'tel:01012345678' },
      ],
      cta: { label: '계약서 서명하기', url: adminUrl('/ko/contracts/abc/sign?token=sample') },
      notices: ['이 링크는 <strong>7일간</strong> 유효합니다.', '서명 화면에서 연락처 뒤 4자리를 입력하게 됩니다.'],
    },
  },
  {
    name: 'operator',
    input: {
      audience: 'operator',
      preheader: '홍길동 · 녹음 · 10/12 14:00',
      heading: '새 예약이 들어왔습니다',
      paragraphs: ['결제가 완료된 예약입니다.'],
      rows: [
        { label: '고객', value: '홍길동' },
        { label: '연락처', value: '010-1234-5678', href: 'tel:01012345678' },
        { label: '일시', value: '10/12(월) 14:00 ~ 17:00' },
        { label: '결제 금액', value: '180,000원', emphasis: true },
      ],
      cta: { label: '관리자에서 보기', url: adminUrl('/admin/bookings/1') },
    },
  },
  {
    name: 'urgent',
    input: {
      audience: 'operator',
      noticeTone: 'alert',
      heading: '결제 확인에 실패했습니다',
      rows: [
        { label: '주문번호', value: 'ORD-20261007-001' },
        { label: '금액', value: '50,000원', emphasis: true },
      ],
      cta: { label: '관리자에서 보기', url: adminUrl('/admin/orders/1') },
      notices: ['토스 승인은 났지만 DB 기록이 없습니다. <strong>고객에게 연락 전 확인</strong>해 주세요.'],
    },
  },
];

// 상점 상품 심사 메일(lib/shop/reviewEmail.ts) — 사용자 입력은 escape되는지 눈으로 본다.
const shopProduct: ShopMailProduct = { id: 'abc123', title: '첫 앨범 <CD>', slug: 'first-album', creatorName: '홍길동 & 밴드', creatorEmail: 'artist@example.com' };
samples.push(
  { name: 'shop-submitted', input: buildShopSubmissionLayout(shopProduct) },
  { name: 'shop-approved', input: buildShopDecisionLayout(shopProduct, 'approve', null, shopProduct.slug) },
  { name: 'shop-changes', input: buildShopDecisionLayout(shopProduct, 'request_changes', '사진을 한 장 더 올려 주세요.\n제목 <b>확인</b>', shopProduct.slug) },
  { name: 'shop-rejected', input: buildShopDecisionLayout(shopProduct, 'reject', '위탁 계약 범위 밖의 상품이에요.', shopProduct.slug) },
  { name: 'shop-edited', input: buildShopEditedLayout(shopProduct) },
);

const showCtx: ShowMailContext = {
  submissionId: 'sample-sub',
  draft: {
    ...emptyDraft(),
    title: '가을밤 어쿠스틱 콘서트',
    presenterName: '밴드 하늘',
    showtimes: ['2026-11-21T19:00'],
    capacity: 40,
    ticketTypes: [{ name: '일반', price: 15000 }, { name: '학생', price: 10000 }],
  },
  reviewNote: '포스터 해상도가 낮아요.\n더 큰 이미지로 바꿔 주세요.',
  creatorName: '김주최',
  creatorEmail: 'org@example.com',
  slug: 'autumn-night',
};
const htmlSamples: { name: string; html: string }[] = [
  { name: 'show-operator-submitted', html: buildOperatorMail('submitted', showCtx).html },
  { name: 'show-approved', html: buildReviewMail('approved', showCtx).html },
  { name: 'show-changes-requested', html: buildReviewMail('changes_requested', showCtx).html },
  { name: 'show-rejected', html: buildReviewMail('rejected', showCtx).html },
];

const outDir = process.argv[2] ?? '/tmp/email-preview';
mkdirSync(outDir, { recursive: true });
for (const { name, input } of samples) {
  const file = join(outDir, `${name}.html`);
  writeFileSync(file, buildEmailLayout(input));
  console.log(file);
}
for (const { name, html } of htmlSamples) {
  const file = join(outDir, `${name}.html`);
  writeFileSync(file, html);
  console.log(file);
}
