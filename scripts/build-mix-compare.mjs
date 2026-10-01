#!/usr/bin/env node
/**
 * 홈의 "믹싱 전 · 후" 비교 음원을 만든다 (components/audio/MixComparePlayer.tsx).
 *
 *   node scripts/build-mix-compare.mjs --before <믹싱 전.mp3> --after <비교 대상.mp3> \
 *        --offset <초> --duration <초> --tag <YYYYMMDD> [--variant excerpt --start <초>] [--match-to-after on]
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
 *  2. **음량을 맞춘다.** 음량이 다르면 사람은 큰 쪽을 "더 좋다"고 듣는다. 이 비교가 보여주려는 것은 믹싱이지 음량이 아니다.
 *     **`--match-to-after on` — 운영 기준(2026-10-01 운영자 결정).** 믹싱 후는 포트폴리오의 원본 음원을 **음량 그대로**
 *     싣는다(게인 0, 리미터 없음 — 자르기·페이드만). 믹싱 전만 그 통합 라우드니스에 맞춰 올린다. 믹싱 전은 마스터링
 *     전이라 피크가 높아 게인만으로는 못 올리므로, 믹싱 전에만 피크 리미터를 건다(리미터가 깎은 만큼 라우드니스가
 *     떨어지므로 측정→보정을 반복해 최종 통합 라우드니스를 믹싱 후와 맞춘다).
 *     (믹싱 후를 내리거나 -14 LUFS로 둘 다 올리는 방식은 원본을 건드리는 것이라 폐기했다. 옵션 없이 돌리면 큰 쪽을 작은 쪽에
 *     맞춰 내리는 옛 방식이 되는데, 운영에는 쓰지 않는다.)
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

const lb = lufs(beforeWav);
const la = lufs(afterWav);
const matchToAfter = args['match-to-after'] === 'on';
let chain;
let gainAfter = 0;
const mp3Path = (name) => path.join(root, 'public/audio', `mix-compare-${name}-${fileTag}.mp3`);
// 발췌는 256k — 128k로 다시 인코딩하면 원본(이미 128k, 피크 +0.2 dBTP)이 0.5dB 작아지고, 256k면 0.01dB 안쪽이다.
const bitrate = variant === 'full' ? '128k' : '256k';
if (matchToAfter) {
  // 믹싱 후: 원본 그대로(게인 0, 필터 없음). 전체 곡은 원본 mp3를 재인코딩 없이 잘라 쓴다(스트림 복사).
  // 믹싱 전: 믹싱 후 **최종 mp3**의 통합 라우드니스까지 올리고 피크 리미터를 건다 — 인코딩이 라우드니스를 깎으므로
  // 인코딩한 파일을 재서 보정한다.
  const afterMp3 = mp3Path('after');
  if (variant === 'full') ff(['-t', String(duration), '-i', args.after, '-map', '0:a', '-map_metadata', '-1', '-c:a', 'copy', afterMp3]);
  else ff(['-i', afterWav, '-map_metadata', '-1', '-c:a', 'libmp3lame', '-b:a', bitrate, afterMp3]);
  const laFinal = lufs(afterMp3);
  const limiter = 'alimiter=limit=0.95:attack=5:release=60:level=disabled';
  const beforeChain = (g) => `volume=${g.toFixed(3)}dB,${limiter}`;
  const beforeMp3 = mp3Path('before');
  let g = laFinal - lb;
  const nominal = g;
  for (let i = 0; i < 8; i += 1) {
    ff(['-i', beforeWav, '-af', beforeChain(g), '-map_metadata', '-1', '-c:a', 'libmp3lame', '-b:a', bitrate, beforeMp3]);
    const got = lufs(beforeMp3);
    console.log(`  보정 ${i}: 게인 ${g.toFixed(3)} dB → 인코딩 뒤 ${got} LUFS (목표 ${laFinal})`);
    if (Math.abs(got - laFinal) < 0.03) break;
    g += laFinal - got;
  }
  console.log(`LUFS before(원본 신호) ${lb} / after(최종 mp3) ${laFinal} / after(자른 원본) ${la} → 믹싱 전 게인 ${g.toFixed(2)} dB (게인만으로는 ${nominal.toFixed(2)} dB), 믹싱 후는 원본 그대로`);
  chain = (gain, name) => (name === 'before' ? beforeChain(g) : 'anull');
} else {
  const target = Math.min(lb, la);
  gainAfter = target - la; // ≤ 0
  const gainBefore = target - lb;
  console.log(`LUFS before ${lb} / after ${la} → 통합 맞춤 목표 ${target}`);
  chain = (gain, name) => `volume=${(name === 'before' ? gainBefore : gainAfter).toFixed(3)}dB`;
}

const out = {};
for (const [name, wav] of [['before', beforeWav], ['after', afterWav]]) {
  const mp3 = mp3Path(name);
  if (!matchToAfter) ff(['-i', wav, '-af', chain(0, name), '-map_metadata', '-1', '-c:a', 'libmp3lame', '-b:a', '128k', mp3]);
  // 파형: 게인이 적용된 신호의 구간별 RMS(모노).
  const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', wav, '-af', chain(0, name), '-ac', '1', '-ar', '8000', '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
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
