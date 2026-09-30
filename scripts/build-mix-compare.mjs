#!/usr/bin/env node
/**
 * 홈의 "믹싱 전 · 후" 비교 음원을 만든다 (components/audio/MixComparePlayer.tsx).
 *
 *   node scripts/build-mix-compare.mjs --before <믹싱 전.mp3> --after <비교 대상.mp3> \
 *        --offset <초> --duration <초> --tag <YYYYMMDD> [--variant excerpt --start <초>]
 *
 * `--variant excerpt`는 곡의 일부(--start부터 --duration초)만 잘라 별도 파일·별도 데이터 파일
 * (`data/mixComparePeaks.excerpt.ts`)로 만든다. 다른 페이지(발매·주문)에 넣는 30초 발췌본이다.
 * **음량은 발췌 구간 안에서 다시 맞춘다** — 전체 곡 기준으로 맞춘 음량은 구간마다 어긋난다.
 * 앞뒤에 짧은 페이드를 걸어 어디서 잘려도 뚝 끊기지 않게 한다(두 파일에 같게).
 *
 * 하는 일 (ffmpeg 필요):
 *  1. **시간을 맞춘다.** `--offset`은 before가 after보다 늦게 시작하는 만큼(초)이다. before의 앞을 그만큼
 *     잘라 두 파일의 같은 시각이 같은 소리가 되게 한다. A/B를 누를 때 재생 위치를 그대로 넘기기 때문에,
 *     어긋나 있으면 "믹싱이 바뀐 것"이 아니라 "다른 구간"을 듣게 된다.
 *     offset은 이 스크립트가 재지 않는다 — 대역 통과 파형 상호상관으로 따로 재서 넘긴다
 *     (2026-09-30 물결: 1.3035초, 구간별 편차 ±1ms).
 *  2. **음량을 맞춘다 — 평균과 큰 부분의 중간 지점에서.** (a) 통합 라우드니스(LUFS)를 재서 큰 쪽을 작은 쪽에
 *     맞춰 내린다. 올리지 않는다 — 올리면 피크가 넘친다. (b) 그것만으로는 부족하다: 다이내믹이 넓은 쪽은 평균이
 *     같아도 **큰 순간이 더 크게** 들린다(2026-09-30 물결: 3초 단위 상위 5%가 1.5dB, 순간 최고는 3~7dB 더 컸다).
 *     그래서 (a) 뒤에 3초 단위 음량(EBU R128 short-term)의 상위 5% 지점 차이를 재서 **그 절반만큼 믹싱 전을 더
 *     낮춘다.** 평균과 큰 부분의 어긋남을 반씩 나눠 어느 한쪽에도 크게 유리하지 않게 한다. 이 비교가 보여주려는
 *     것은 믹싱이지 음량이 아니다 — 음량이 다르면 사람은 큰 쪽을 "더 좋다"고 듣는다.
 *  3. 같은 설정(128kbps CBR, 메타데이터 없음)으로 mp3를 만든다.
 *  4. 파형용 피크를 계산한다(같은 스케일 — 두 파형의 모양 차이가 실제 다이내믹 차이다).
 *
 * 산출물: public/audio/mix-compare-{before,after}-<tag>.mp3, data/mixComparePeaks.ts(생성물 — 손으로 고치지 않는다).
 * `/audio/**`도 브라우저가 오래 캐시하므로 음원을 바꾸면 `--tag`를 새 날짜로 준다.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, all) => (cur.startsWith('--') ? [...acc, [cur.slice(2), all[i + 1]]] : acc), []),
);
for (const k of ['before', 'after', 'offset', 'duration', 'tag']) {
  if (!args[k]) { console.error(`--${k} 필요`); process.exit(2); }
}
const variant = args.variant || 'full';
if (variant !== 'full' && !args.start) { console.error('--variant 발췌는 --start 필요'); process.exit(2); }
const start = variant === 'full' ? 0 : Number(args.start);
const offset = Number(args.offset);
const duration = Number(args.duration);
const fadeIn = variant === 'full' ? 0 : 0.25;
const fadeOut = variant === 'full' ? 0 : 0.8;
const fileTag = variant === 'full' ? args.tag : `${args.tag}-${variant}`;
const BINS = 120;
const root = process.cwd();
const tmp = mkdtempSync(path.join(os.tmpdir(), 'mixcmp-'));

const ff = (a) => execFileSync('ffmpeg', ['-y', '-v', 'error', ...a], { stdio: ['ignore', 'inherit', 'inherit'] });

const fades = () => [
  ...(fadeIn ? [`afade=t=in:d=${fadeIn}`] : []),
  ...(fadeOut ? [`afade=t=out:st=${(duration - fadeOut).toFixed(3)}:d=${fadeOut}`] : []),
].join(',');
const cut = (input, from, out) =>
  ff(['-ss', String(from), '-t', String(duration), '-i', input, '-map', '0:a', '-ac', '2', '-ar', '44100',
    ...(fades() ? ['-af', fades()] : []), '-c:a', 'pcm_s16le', out]);

const lufs = (wav) => {
  const r = spawnSync('ffmpeg', ['-nostats', '-i', wav, '-af', 'loudnorm=I=-20:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /"input_i"\s*:\s*"(-?[\d.]+)"/.exec(r.stderr);
  if (!m) throw new Error('라우드니스를 읽지 못했습니다');
  return Number(m[1]);
};

const beforeWav = path.join(tmp, 'before.wav');
const afterWav = path.join(tmp, 'after.wav');
cut(args.before, offset + start, beforeWav); // 믹싱 전이 늦게 시작하는 만큼(offset) 뒤에서 자른다
cut(args.after, start, afterWav);

// 3초 단위 음량(short-term)의 상위 5% 지점 — 게인을 적용한 신호 기준.
const shortTermP95 = (wav, gainDb) => {
  const r = spawnSync('ffmpeg', ['-nostats', '-loglevel', 'verbose', '-i', wav, '-af', `volume=${gainDb.toFixed(3)}dB,ebur128`, '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  const values = [...r.stderr.matchAll(/M:\s*(-?[\d.]+)\s+S:\s*(-?[\d.]+)/g)].map((m) => Number(m[2])).filter((v) => v > -60);
  if (values.length < 20) throw new Error('short-term 음량을 읽지 못했습니다');
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length * 0.95)];
};

const lb = lufs(beforeWav);
const la = lufs(afterWav);
const target = Math.min(lb, la);
const lufsGainBefore = target - lb; // ≤ 0
const gainAfter = target - la; // ≤ 0
const loudBefore = shortTermP95(beforeWav, lufsGainBefore);
const loudAfter = shortTermP95(afterWav, gainAfter);
// 큰 부분이 얼마나 더 큰가(양수 = before가 크다). 그 절반만큼 before를 더 내린다. 반대면(after가 크면) 손대지 않는다.
const extraTrim = Math.max(0, (loudBefore - loudAfter) / 2);
const gainBefore = lufsGainBefore - extraTrim;
console.log(`LUFS before ${lb} / after ${la} → 통합 맞춤 목표 ${target}`);
console.log(`3초 단위 상위 5%: before ${loudBefore.toFixed(2)} / after ${loudAfter.toFixed(2)} LUFS (차이 ${(loudBefore - loudAfter).toFixed(2)} dB) → before를 ${extraTrim.toFixed(2)} dB 더 내린다`);
console.log(`최종 게인: before ${gainBefore.toFixed(2)} dB, after ${gainAfter.toFixed(2)} dB`);

const out = {};
for (const [name, wav, gain] of [['before', beforeWav, gainBefore], ['after', afterWav, gainAfter]]) {
  const mp3 = path.join(root, 'public/audio', `mix-compare-${name}-${fileTag}.mp3`);
  ff(['-i', wav, '-af', `volume=${gain.toFixed(3)}dB`, '-map_metadata', '-1', '-c:a', 'libmp3lame', '-b:a', '128k', mp3]);
  // 파형: 게인이 적용된 신호의 구간별 RMS(모노).
  const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', wav, '-af', `volume=${gain.toFixed(3)}dB`, '-ac', '1', '-ar', '8000', '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  const samples = new Float32Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 4));
  const per = Math.floor(samples.length / BINS);
  out[name] = Array.from({ length: BINS }, (_, b) => {
    let sum = 0;
    for (let i = b * per; i < (b + 1) * per; i += 1) sum += samples[i] * samples[i];
    return Math.sqrt(sum / per);
  });
  console.log('wrote', path.relative(root, mp3));
}
// 두 파형을 같은 스케일로 정규화한다 — 모양 차이가 곧 다이내믹 차이다. 기준은 최댓값이 아니라 상위 1%
// 지점이다: 한 곳의 순간 피크가 기준이 되면 나머지 전체가 눌려 작게 보인다(물결의 믹싱 전은 한 구간이
// 다른 곳의 1.7배였고, 최댓값 기준이면 믹싱 후 파형 전체가 60% 높이로 눌렸다). 넘는 값은 1로 자른다.
const sorted = [...out.before, ...out.after].sort((x, y) => x - y);
const peak = sorted[Math.floor(sorted.length * 0.99)];
const norm = (arr) => arr.map((v) => Math.round(Math.min(1, v / peak) * 1000) / 1000);

const prefix = variant === 'full' ? 'MIX_COMPARE' : `MIX_COMPARE_${variant.toUpperCase()}`;
const dataFile = variant === 'full' ? 'data/mixComparePeaks.ts' : `data/mixComparePeaks.${variant}.ts`;
const ts = `/**
 * 생성물 — scripts/build-mix-compare.mjs가 쓴다. 손으로 고치지 않는다.
 * 두 파형은 같은 스케일이다(음량을 맞춘 뒤의 구간별 RMS, 상위 1% 지점이 1).
 */
export const ${prefix}_TAG = '${fileTag}';
export const ${prefix}_DURATION_SECONDS = ${duration};
export const ${prefix}_PEAKS = {
  before: ${JSON.stringify(norm(out.before))},
  after: ${JSON.stringify(norm(out.after))},
} as const;
`;
writeFileSync(path.join(root, dataFile), ts);
console.log('wrote', dataFile);
rmSync(tmp, { recursive: true, force: true });
