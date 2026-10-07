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
import { adminUrl, buildEmailLayout, escapeHtml, strong, type EmailLayoutInput } from '../lib/email/layout';

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

const outDir = process.argv[2] ?? '/tmp/email-preview';
mkdirSync(outDir, { recursive: true });
for (const { name, input } of samples) {
  const file = join(outDir, `${name}.html`);
  writeFileSync(file, buildEmailLayout(input));
  console.log(file);
}
