#!/usr/bin/env node
/**
 * 사바하 《SLUNG》 비공개 감상실(/press/sabbaha-slung)의 음원을 올리고 파형을 만든다.
 *
 *   node --env-file=.env.local scripts/press/build-sabbaha-slung.mjs --src <mp3 폴더> [--dry-run]
 *
 * 하는 일 (ffmpeg 필요):
 *  1. 받은 mp3를 **재인코딩 없이**(-c copy) 다시 감싸 메타데이터를 앨범 기준으로 고친다.
 *     받은 파일은 번호가 앨범 순서와 다르다(02 갈, 03 싸후르, 07 야마 … — 작업 순서로 보인다).
 *     앨범 순서는 펀딩 페이지 수록곡 표(부클릿 뒷면)이고, 길이가 13곡 모두 그 표와 맞는다.
 *  2. 파형용 피크를 계산한다 — 8kHz 모노로 풀어 PEAK_BARS 구간 RMS → 곡마다 상위 2% 지점을 1로.
 *     (components/funding/FundingAudioPlayer.tsx의 미리듣기와 같은 방식)
 *  3. Vercel Blob에 **private**으로 올린다. 이 저장소는 계약서 PDF가 든 private 저장소라 public을
 *     섞을 수 없고, 섞을 이유도 없다 — 발매 전 음원이다. 재생은 비밀번호를 통과한 사람에게만
 *     만료되는 서명 주소로 나간다(lib/press/audio.ts). 경로에 무작위 접미사가 붙는다.
 *
 * 산출물: data/press/sabbahaSlungAudio.ts(생성물 — 손으로 고치지 않는다).
 * 음원을 바꾸면 이 스크립트를 다시 돌리고, 옛 Blob은 `--prune`으로 지운다.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { del, list, put } from '@vercel/blob';

const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const SRC = argValue('--src');
const DRY_RUN = args.includes('--dry-run');
const PRUNE = args.includes('--prune');
if (!SRC) {
  console.error('사용법: node --env-file=.env.local scripts/press/build-sabbaha-slung.mjs --src <mp3 폴더> [--dry-run] [--prune]');
  process.exit(1);
}

const PREFIX = 'press/sabbaha-slung/';
const PEAK_BARS = 160;

/**
 * 앨범 순서. `file`은 받은 파일 이름에 들어 있는 한글 작업 제목이다(번호는 보지 않는다).
 * `seconds`는 펀딩 페이지 수록곡 표의 길이 — 파일이 바뀌어 다른 곡이 끼면 여기서 멈춘다.
 */
const TRACKS = [
  { id: 'kalpa', title: 'Kalpa', file: '칼파', disc: 1, seconds: 627 },
  { id: 'yama', title: 'Yama', file: '야마', disc: 1, seconds: 260 },
  { id: 'kal', title: '喝', file: '갈', disc: 1, seconds: 8 },
  { id: 'warlock', title: 'Warlock', file: '윌락', disc: 1, seconds: 337 },
  { id: 'debt-shroud', title: 'Debt Shroud', file: '데트슈라이드', disc: 1, seconds: 393 },
  { id: 'apprentices-work', title: "Apprentice's Work", file: '어프렌티스', disc: 1, seconds: 367 },
  { id: 'dopaminethirster', title: 'Dopaminethirster', file: '도파민', disc: 1, seconds: 329 },
  { id: 'xthaua', title: 'Xthaua', file: '싸후르', disc: 1, seconds: 32 },
  { id: 'altar', title: 'The Altar of The Holy Elitism', file: '알타', disc: 2, seconds: 880 },
  { id: 'seance', title: 'Séance', file: '교령회', disc: 2, seconds: 845 },
  { id: 'triocracy', title: 'Triocracy', file: '트라이', disc: 2, seconds: 725 },
  { id: 'ossuary', title: 'Ossuary', file: '오소리', disc: 2, seconds: 491 },
  { id: 'stone', title: 'Stone', file: '스톤', disc: 2, seconds: 581 },
];

const files = readdirSync(SRC).filter((f) => f.toLowerCase().endsWith('.mp3'));
// macOS 파일 이름은 NFD로 올 수 있어 비교 전에 NFC로 맞춘다.
const findSource = (word) => {
  const hits = files.filter((f) => f.normalize('NFC').replace(/\.mp3$/i, '').endsWith(`- ${word}`));
  if (hits.length !== 1) throw new Error(`"${word}" 파일을 하나로 특정하지 못했다: ${JSON.stringify(hits)}`);
  return path.join(SRC, hits[0]);
};

const probeSeconds = (file) =>
  Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim());

const computePeaks = (file) => {
  const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', '8000', '-f', 'f32le', '-'], {
    maxBuffer: 1024 * 1024 * 512,
  });
  const samples = new Float32Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 4));
  const per = Math.max(1, Math.floor(samples.length / PEAK_BARS));
  const rms = [];
  for (let b = 0; b < PEAK_BARS; b += 1) {
    let sum = 0;
    let n = 0;
    for (let i = b * per; i < Math.min(samples.length, (b + 1) * per); i += 1) {
      sum += samples[i] * samples[i];
      n += 1;
    }
    rms.push(n ? Math.sqrt(sum / n) : 0);
  }
  const sorted = [...rms].sort((a, b) => a - b);
  const ref = sorted[Math.floor(sorted.length * 0.98)] || 1;
  return rms.map((v) => Math.round(Math.min(1, v / ref) * 100) / 100);
};

const work = mkdtempSync(path.join(tmpdir(), 'sabbaha-press-'));
const out = [];
try {
  for (const [index, track] of TRACKS.entries()) {
    const number = index + 1;
    const source = findSource(track.file);
    const seconds = probeSeconds(source);
    if (Math.abs(seconds - track.seconds) > 1.5) {
      throw new Error(`${track.title}: 길이 ${seconds.toFixed(1)}초가 수록곡 표(${track.seconds}초)와 다르다 — 다른 곡이 끼었는지 확인`);
    }

    const tagged = path.join(work, `${String(number).padStart(2, '0')}-${track.id}.mp3`);
    execFileSync('ffmpeg', [
      '-v', 'error', '-y', '-i', source,
      '-map', '0:a', '-c', 'copy', '-map_metadata', '-1', '-id3v2_version', '3',
      '-metadata', `title=${track.title}`,
      '-metadata', 'artist=Sabbaha',
      '-metadata', 'album_artist=Sabbaha',
      '-metadata', 'album=SLUNG',
      '-metadata', `track=${number}/13`,
      '-metadata', `disc=${track.disc}/2`,
      tagged,
    ]);

    const peaks = computePeaks(tagged);
    let pathname = `${PREFIX}${path.basename(tagged)}`;
    if (!DRY_RUN) {
      const blob = await put(pathname, readFileSync(tagged), {
        access: 'private',
        contentType: 'audio/mpeg',
        addRandomSuffix: true,
      });
      pathname = blob.pathname;
    }
    console.log(`${String(number).padStart(2, ' ')}. ${track.title} — ${seconds.toFixed(1)}초 → ${pathname}`);
    out.push({ id: track.id, number, disc: track.disc, title: track.title, pathname, durationSeconds: Math.round(seconds * 10) / 10, peaks });
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

if (DRY_RUN) {
  console.log('--dry-run: 업로드·파일 쓰기 없음');
  process.exit(0);
}

const body = `/**
 * 생성물 — scripts/press/build-sabbaha-slung.mjs가 쓴다. 손으로 고치지 않는다.
 *
 * pathname은 Vercel Blob(private) 경로다. 그대로는 열리지 않고, 비밀번호를 통과한 요청에만
 * lib/press/audio.ts가 만료되는 서명 주소를 만들어 준다.
 * peaks는 ${PEAK_BARS}구간 RMS를 곡마다 상위 2% 지점이 1이 되게 맞춘 값이다.
 */
export interface PressTrackAudio {
  id: string;
  number: number;
  disc: 1 | 2;
  title: string;
  pathname: string;
  durationSeconds: number;
  peaks: readonly number[];
}

export const SABBAHA_SLUNG_AUDIO: readonly PressTrackAudio[] = ${JSON.stringify(out, null, 2)
  .replace(/"peaks": \[\s*([^\]]*?)\s*\]/gs, (_, inner) => `"peaks": [${inner.replace(/\s+/g, '')}]`)};
`;
writeFileSync(path.join(process.cwd(), 'data/press/sabbahaSlungAudio.ts'), body);
console.log('data/press/sabbahaSlungAudio.ts 갱신');

if (PRUNE) {
  const keep = new Set(out.map((t) => t.pathname));
  const { blobs } = await list({ prefix: PREFIX });
  const stale = blobs.filter((b) => !keep.has(b.pathname));
  if (stale.length) await del(stale.map((b) => b.url));
  console.log(`옛 음원 ${stale.length}개 삭제`);
}
