/**
 * 앱 아이콘·로고 정사각 자산을 브랜드 마크에서 생성한다.
 *
 * 왜 필요한가:
 *  - public/icons/icon-*.png 가 스튜디오 콘솔 실사진이었다. 48px로 줄면 뭔지 알 수 없고,
 *    maskable로도 같은 파일을 써서 안드로이드 마스크가 가장자리를 잘랐다.
 *  - public/logo512.png·logo192.png 는 CRA 스캐폴드의 React 로고가 그대로 남아 있었다.
 *    이 둘은 JSON-LD Organization/LocalBusiness.logo, Article publisher, RSS 채널 이미지,
 *    깨진 이미지 폴백에 쓰인다 — 구글 지식 패널에 React 원자가 나갈 수 있는 상태였다.
 *
 * 소재: public/logo/logo.png (3350×862 고해상 워드마크)에서 노란 "NOL" 마크만 잘라 쓴다.
 * 워드마크 전체(studio NOL)는 종횡비 3.9:1이라 정사각에서 가는 띠가 되고 48px에서 판독 불가.
 * NOL 마크는 정사각에 가깝고 48px에서도 또렷하다. 배경은 tailwind.config의 kakao-ink
 * (#191600) — 사이트가 옐로 위 텍스트에 쓰는 브랜드 다크라 노란 마크 대비가 약 16:1.
 *
 * 원본(logo.png)이 바뀌면 다시 돌린다. prebuild에는 넣지 않는다 — 원본이 바뀔 때만 손으로
 * 돌리고 산출물을 commit한다(CLAUDE.md "한 번 쓰고 말 일에 빌드 훅 금지").
 *
 *   node scripts/generate-app-icons.mjs
 */
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'public/logo/logo.png');
const BG = '#191600'; // tailwind kakao-ink

/** 소재 이미지에서 노란(NOL) 픽셀의 경계상자를 찾는다. R·G 높고 B 낮고 불투명. */
const findYellowBounds = async (src) => {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width, minY = info.height, maxX = -1, maxY = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a > 128 && r > 180 && g > 140 && b < 120 && r - b > 100) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error('노란 마크를 찾지 못했습니다 — 소재 이미지를 확인하세요.');
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
};

const renderIcon = async (mark, size, ratio, outPath) => {
  const box = Math.round(size * ratio);
  const resized = await sharp(mark)
    .resize({ width: box, height: box, fit: 'inside', kernel: 'lanczos3' })
    .png()
    .toBuffer();
  const m = await sharp(resized).metadata();
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([
      { input: resized, left: Math.round((size - m.width) / 2), top: Math.round((size - m.height) / 2) },
    ])
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log(`  ${path.relative(ROOT, outPath)}  (마크 ${m.width}×${m.height} / ${size})`);
};

const main = async () => {
  const bounds = await findYellowBounds(SOURCE);
  console.log('NOL 경계상자:', bounds);
  const mark = await sharp(SOURCE).extract(bounds).png().toBuffer();

  // any(72%)·maskable(56%: 마스크 세이프존 중앙 80% 원 안쪽) 두 형식.
  const ANY = 0.72;
  const MASKABLE = 0.56;

  console.log('앱 아이콘(PWA):');
  await renderIcon(mark, 512, ANY, path.join(ROOT, 'public/icons/icon-512.png'));
  await renderIcon(mark, 192, ANY, path.join(ROOT, 'public/icons/icon-192.png'));
  await renderIcon(mark, 512, MASKABLE, path.join(ROOT, 'public/icons/icon-512-maskable.png'));
  await renderIcon(mark, 192, MASKABLE, path.join(ROOT, 'public/icons/icon-192-maskable.png'));

  // 스키마·RSS·폴백에 쓰이는 정사각 로고. any 형식과 같은 여백으로 통일.
  console.log('브랜드 로고(스키마·RSS·폴백):');
  await renderIcon(mark, 512, ANY, path.join(ROOT, 'public/logo512.png'));
  await renderIcon(mark, 192, ANY, path.join(ROOT, 'public/logo192.png'));

  console.log('완료.');
};

main().catch((error) => {
  console.error('아이콘 생성 실패:', error);
  process.exit(1);
});
