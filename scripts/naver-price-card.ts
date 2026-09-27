/**
 * 네이버 스마트플레이스 '가격표 사진' HTML 생성기 — 가격은 data/pricing.ts 상수에서만 읽는다.
 *
 * 왜 있나: 플레이스 가격 탭의 사진은 사이트와 따로 놀아서, 2026-09-27에 보니 폐지된 "6시간 패키지
 * 50만원(약 17% 할인)", 이미 바꾼 "믹싱 Level 1~3" 이름, 사실과 다른 "연습실은 월세 입주 전용"이
 * 그대로 실려 있었다. 원본 파일도 저장소에 없어서 손으로 다시 그려야 했다. 가격이 바뀌면 이걸 다시
 * 돌려 사진을 교체한다.
 *
 *   npx tsx scripts/naver-price-card.ts <출력.html>
 *   → HTML을 브라우저로 폭 1035px·배율 2로 전체 캡처해 PNG로 올린다(스크립트는 렌더러를 물지 않는다).
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  DAY_LOCK_4H_PRICE,
  DAY_LOCK_8H_PRICE,
  DAY_LOCK_SAVINGS,
  formatPriceAmount,
  MASTERING_PACKAGE_PRICE,
  MASTERING_SINGLE_PRICE,
  MIXING_LEVEL1_PRICE,
  MIXING_LEVEL2_PRICE,
  MIXING_LEVEL3_PRICE,
  PRACTICE_ROOM_HOURLY_PRICE_INCL,
  PRACTICE_ROOM_MONTHLY_PRICE,
  RECORDING_HOURLY_PRICE,
  VOCAL_PACKAGE_PRICE,
} from '../data/pricing';

type Row = { name: string; note: string; price: number; unit?: string };
type Group = { icon: string; title: string; sub: string; rows: Row[] };

const GROUPS: Group[] = [
  {
    icon: '🎙️', title: '보컬 녹음', sub: '전담 엔지니어 진행',
    rows: [
      { name: '보컬 녹음 1프로', note: '1곡 · 3시간 기준', price: VOCAL_PACKAGE_PRICE },
      { name: '시간당 레코딩', note: '최소 2시간부터', price: RECORDING_HOURLY_PRICE },
      { name: 'Day Lock 4시간', note: `시간당보다 ${formatPriceAmount(DAY_LOCK_SAVINGS.h4)}원 적게`, price: DAY_LOCK_4H_PRICE },
      { name: 'Day Lock 8시간', note: `시간당보다 ${formatPriceAmount(DAY_LOCK_SAVINGS.h8)}원 적게`, price: DAY_LOCK_8H_PRICE },
    ],
  },
  {
    icon: '🎚️', title: '믹싱', sub: '곡당 / 기본 2회 수정 포함',
    rows: [
      { name: '10트랙 이하', note: '보컬 + 반주 중심', price: MIXING_LEVEL1_PRICE },
      { name: '11~30트랙', note: '풀밴드 · 팝', price: MIXING_LEVEL2_PRICE },
      { name: '31트랙 이상', note: '대편성', price: MIXING_LEVEL3_PRICE },
    ],
  },
  {
    icon: '💿', title: '마스터링', sub: '곡당 / 기본 1회 수정 포함',
    rows: [
      { name: '싱글 마스터링', note: '스트리밍·음원사이트 규격', price: MASTERING_SINGLE_PRICE },
      { name: '4곡 이상 함께', note: 'EP · 정규, 곡당', price: MASTERING_PACKAGE_PRICE },
    ],
  },
  {
    icon: '🎹', title: '음악연습실', sub: '보증금 0원 · 24시간',
    rows: [
      { name: '월 입주', note: '24시간 자유 이용 · 최종가', price: PRACTICE_ROOM_MONTHLY_PRICE, unit: '원 / 월' },
      { name: '시간제', note: '1시간부터 · 무인 · 부가세 포함', price: PRACTICE_ROOM_HOURLY_PRICE_INCL, unit: '원 / 시간' },
    ],
  },
];

const NOTES = [
  '녹음·믹싱·마스터링 가격은 VAT(부가가치세) 별도입니다.',
  '연습실 월 입주는 최종가, 시간제는 부가세 포함 가격입니다.',
  '녹음과 연습실 시간제는 studionol.co.kr에서 바로 예약·결제할 수 있습니다.',
  '정확한 견적은 카카오톡 상담으로 안내드립니다.',
];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const fontUrl = `file://${path.join(process.cwd(), 'public/fonts/Pretendard-Bold.otf')}`;

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
@font-face{font-family:PB;src:url('${fontUrl}')}
*{box-sizing:border-box;margin:0}
body{width:1035px;background:#f3f1fb;font-family:PB,'Apple SD Gothic Neo',sans-serif;color:#1f1f2e;padding:50px 66px}
.card{background:#fff;border-radius:40px;padding:56px 50px 44px;box-shadow:0 20px 60px rgba(90,60,200,.08)}
.logo{text-align:center;font-size:52px;letter-spacing:-1px;color:#1b3a2b}.logo b{color:#f5c800;font-weight:400}
h1{text-align:center;font-size:44px;margin-top:22px}h1 span{color:#6d28d9}
.lead{text-align:center;color:#666;font-size:18px;margin-top:12px;padding-bottom:36px;border-bottom:2px solid #eee}
.g{border:2px solid #ebe8f5;border-radius:26px;padding:30px 34px 14px;margin-top:26px}
.gh{display:flex;gap:16px;align-items:center;margin-bottom:10px}.gh .i{font-size:34px}
.gh h2{font-size:28px}.gh p{color:#6d28d9;font-size:16px;margin-top:4px}
.r{display:flex;justify-content:space-between;align-items:center;padding:18px 0;border-bottom:1px solid #eee}.r:last-child{border:0}
.r .n{font-size:23px}.r .t{color:#777;font-size:15px;margin-top:6px}
.r .p{color:#6d28d9;font-size:32px;white-space:nowrap}.r .p small{font-size:17px;color:#333;margin-left:4px}
.notes{margin-top:30px;padding-top:24px;border-top:2px solid #eee;color:#555;font-size:16px;line-height:1.9}
.notes li{list-style:none}.notes li:before{content:'※ ';color:#6d28d9}
.foot{text-align:center;color:#6d28d9;font-size:18px;margin-top:22px}
</style></head><body><div class="card">
<div class="logo">studio <b>NOL</b></div>
<h1>서비스 <span>가격 안내</span></h1>
<p class="lead">연신내역 도보 5분 · 전문 엔지니어 녹음실</p>
${GROUPS.map((g) => `<section class="g"><div class="gh"><span class="i">${g.icon}</span><div><h2>${esc(g.title)}</h2><p>${esc(g.sub)}</p></div></div>
${g.rows.map((r) => `<div class="r"><div><div class="n">${esc(r.name)}</div><div class="t">${esc(r.note)}</div></div><div class="p">${formatPriceAmount(r.price)}<small>${r.unit ?? '원'}</small></div></div>`).join('\n')}
</section>`).join('\n')}
<ul class="notes">${NOTES.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
<p class="foot">STUDIO NOL · studionol.co.kr</p>
</div></body></html>`;

const out = process.argv[2];
if (!out) throw new Error('출력 경로를 주세요: npx tsx scripts/naver-price-card.ts <출력.html>');
fs.writeFileSync(out, html);
console.log(`written ${out}`);
