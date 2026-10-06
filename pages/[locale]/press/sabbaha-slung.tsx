/* eslint-disable @next/next/no-html-link-for-pages --
 * 언어 전환·외부 이동은 문서 이동으로 둔다. 감상실은 사이트 껍데기(헤더·푸터)를 두르지 않는
 * 독립 화면이라(components/Layout.tsx isPressRoom) 클라이언트 전환으로 얻을 것이 없다.
 */
import { Marcellus } from 'next/font/google';
import Head from 'next/head';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { AlbumPlayerProvider, useAlbumPlayer } from '../../../components/press/AlbumPlayerContext';
import { MiniBar, PlayerDeck, Tracklist, formatTime } from '../../../components/press/AlbumPlayer';
import type { AlbumPlayerLabels } from '../../../components/press/AlbumPlayer';
import ResponsiveImage from '../../../components/ResponsiveImage';
import { Badge } from '../../../components/ui/Badge';
import { SABBAHA_SLUNG_AUDIO } from '../../../data/press/sabbahaSlungAudio';
import { SLUNG_PRESS, type Lang, type Localized } from '../../../data/press/sabbahaSlung';
import { ArrowRight, Download, ExternalLink, Lock, Mail, Play, Pause } from '../../../lib/lucide-icons';
import { withI18nServerProps } from '../../../lib/getStatic';
import { presignPressAudio } from '../../../lib/press/audio';
import { LISTENING_ROOMS, isRoomTokenValid, roomCookieName } from '../../../lib/press/listeningRoom';

/**
 * 사바하 《SLUNG》 비공개 감상실 — 평론가·매체에 보내는 발매 전 음원과 앨범·아티스트 소개.
 *
 * 비밀번호를 통과해야(입장 쿠키, lib/press/listeningRoom.ts) 본문과 음원 주소가 HTML에 실린다.
 * 통과 전에는 서버가 비밀번호 화면만 그린다 — 가려 두는 것이 아니라 아예 보내지 않는다.
 * 색인 금지(메타 + X-Robots-Tag), 캐시 금지(쿠키에 따라 내용이 갈린다).
 *
 * 한국어(/ko)와 영어(/en)를 낸다. 다른 로케일로 들어오면 영어로 돌린다 — 해외 매체에는
 * 영어가 공용어이고, 그 로케일 번역을 따로 두지 않는다.
 */

const display = Marcellus({ weight: '400', subsets: ['latin'], display: 'swap', variable: '--font-press-display' });

/** 컴포넌트는 이 문자열만 쓴다 — listeningRoom.ts(node:crypto)는 getServerSideProps 안에서만 불러야 클라이언트 번들에서 빠진다. */
const ROOM_ID = 'sabbaha-slung' as const;
const PATH = '/press/sabbaha-slung';
const COVER = '/images/funding/sabbaha-slung/album-front-20260928.webp';

type Props =
  | { lang: Lang; authed: false; error: 'password' | 'limit' | null }
  | { lang: Lang; authed: true; urls: string[]; validUntil: number; audioError: boolean };

const t = (value: Localized, lang: Lang): string => value[lang];

const PLAYER_LABELS: Record<Lang, AlbumPlayerLabels> = {
  ko: {
    nowPlaying: '재생 중',
    play: '재생',
    pause: '일시정지',
    prev: '이전 곡',
    next: '다음 곡',
    position: '재생 위치',
    disc: (n) => `CD ${n}`,
    failed: '음원을 불러오지 못했습니다. 잠시 뒤 다시 눌러 주세요. 계속 안 되면 페이지를 새로 고쳐 주세요.',
    loading: '음원을 받는 중입니다…',
    playTrack: (title) => `${title} 재생`,
    instrumental: '연주곡',
  },
  en: {
    nowPlaying: 'Now playing',
    play: 'play',
    pause: 'pause',
    prev: 'Previous track',
    next: 'Next track',
    position: 'playback position',
    disc: (n) => `CD ${n}`,
    failed: 'The audio could not be loaded. Please try again in a moment, or reload the page.',
    loading: 'Loading audio…',
    playTrack: (title) => `Play ${title}`,
    instrumental: 'Instrumental',
  },
};

const PAGE_CSS = `
.press-room { font-feature-settings: 'tnum' 0; }
.press-room :is(h1, h2, h3, h4) { color: inherit; }
/* 한글은 자간을 크게 벌리면 글자가 흩어져 읽힌다 — 라틴 대문자용 넓은 자간을 한국어 화면에서 좁힌다. */
.press-room[lang='ko'] .press-eyebrow { letter-spacing: 0.04em; }
.press-wordmark { font-size: 3.75rem; line-height: 1; letter-spacing: 0.06em; }
.press-wordmark-gate { font-size: 3rem; line-height: 1.1; letter-spacing: 0.08em; }
@media (min-width: 768px) { .press-wordmark { font-size: 6rem; } .press-wordmark-gate { font-size: 3.75rem; } }
.press-display { font-family: var(--font-press-display), 'Times New Roman', 'AppleMyungjo', 'Nanum Myeongjo', 'Batang', serif; font-weight: 400; letter-spacing: 0.02em; }
@keyframes press-eq { 0%, 100% { height: 30%; } 50% { height: 100%; } }
.animate-press-eq { animation: press-eq 0.9s ease-in-out infinite; height: 60%; }
`;

/** 로고 — 이어지지 않은 원 세 개(사바하의 표식, 《SLUNG》 CD 판면에도 있다). */
function ThreeCircles({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 60" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2.2">
      <circle cx="32" cy="16" r="13" />
      <circle cx="17" cy="42" r="13" />
      <circle cx="47" cy="42" r="13" />
    </svg>
  );
}

function LangSwitch({ lang }: { lang: Lang }) {
  const item = (code: Lang, label: string) => (
    <a
      href={`/${code}${PATH}`}
      hrefLang={code}
      lang={code}
      aria-current={lang === code ? 'true' : undefined}
      className={`rounded-full px-3 py-1 text-sm font-semibold transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${lang === code ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}
    >
      {label}
    </a>
  );
  return (
    <nav aria-label={lang === 'ko' ? '언어' : 'Language'} className="flex items-center gap-1 rounded-full bg-white/[0.08] p-1 ring-1 ring-white/10">
      {item('ko', '한국어')}
      {item('en', 'EN')}
    </nav>
  );
}

function TopBar({ lang }: { lang: Lang }) {
  return (
    <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 pt-5 md:px-8 md:pt-7">
      <div className="flex items-center gap-3 text-white">
        <ThreeCircles className="h-7 w-7" />
        <span className="press-display text-lg tracking-[0.18em]">SABBAHA</span>
        <Badge tone="onImage" icon={<Lock size={11} aria-hidden="true" />} className="hidden sm:inline-flex">
          {t(SLUNG_PRESS.ui.privateBadge, lang)}
        </Badge>
      </div>
      <LangSwitch lang={lang} />
    </header>
  );
}

/* ───────────────────────── 비밀번호 화면 ───────────────────────── */

function Gate({ lang, error }: { lang: Lang; error: 'password' | 'limit' | null }) {
  const gate = SLUNG_PRESS.gate;
  return (
    <div className="relative flex min-h-[100svh] flex-col overflow-hidden bg-black text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-35 [&_img]:scale-110 [&_img]:blur-2xl">
        <ResponsiveImage src={COVER} alt="" fill sizes="100vw" className="object-cover" containerClassName="relative block h-full w-full" priority />
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-black/70 to-black" />
      <TopBar lang={lang} />
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16">
        <ThreeCircles className="h-12 w-12 text-white/80" />
        <h1 className="press-display press-wordmark-gate mt-6">SLUNG</h1>
        <p className="press-display mt-1 text-xl tracking-[0.3em] text-white/75">SABBAHA</p>
        <p className="mt-6 break-keep leading-relaxed text-white/75">{t(gate.lead, lang)}</p>

        <form method="post" action={`/api/press/room/${ROOM_ID}/enter`} className="mt-8">
          <input type="hidden" name="locale" value={lang} />
          <label htmlFor="press-password" className="block text-sm font-medium text-white/80">
            {t(gate.passwordLabel, lang)}
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="press-password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              autoFocus
              aria-invalid={error === 'password' ? true : undefined}
              aria-describedby={error ? 'press-password-error' : undefined}
              className="min-w-0 flex-1 rounded-xl border border-white/20 bg-white/[0.06] px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
            />
            <button
              type="submit"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-black transition-colors duration-fast hover:bg-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              {t(gate.submit, lang)}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
          {error && (
            <p id="press-password-error" role="alert" className="mt-3 text-sm text-red-300">
              {t(error === 'limit' ? gate.errorLimit : gate.errorPassword, lang)}
            </p>
          )}
        </form>

        <p className="mt-10 break-keep text-sm leading-relaxed text-white/50">
          {t(gate.help, lang)}{' '}
          <a href={`mailto:${SLUNG_PRESS.contact.email}`} className="underline decoration-white/30 underline-offset-4 hover:text-white">
            {SLUNG_PRESS.contact.email}
          </a>
        </p>
      </main>
    </div>
  );
}

/* ───────────────────────── 감상실 ───────────────────────── */

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-8 border-t border-white/10 py-14 md:py-20">
      <p className="press-eyebrow text-xs font-semibold uppercase tracking-[0.3em] text-white/45">{eyebrow}</p>
      <h2 id={`${id}-title`} className="press-display mt-3 break-keep text-3xl leading-tight md:text-4xl">{title}</h2>
      <div className="mt-8">{children}</div>
    </section>
  );
}

function Prose({ paragraphs, lang }: { paragraphs: readonly Localized[]; lang: Lang }) {
  return (
    <div className="max-w-3xl space-y-5 break-keep text-[17px] leading-[1.85] text-white/80">
      {paragraphs.map((p, i) => <p key={i}>{t(p, lang)}</p>)}
    </div>
  );
}

/** 곡 소개 옆의 작은 재생 버튼 — 큰 플레이어와 같은 상태를 쓴다. */
function TrackPlayToggle({ index, label }: { index: number; label: string }) {
  const { index: current, playing, playTrack, toggle } = useAlbumPlayer();
  const isCurrent = current === index;
  return (
    <button
      type="button"
      onClick={() => (isCurrent ? toggle() : playTrack(index, 0))}
      aria-label={label}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1 transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${isCurrent && playing ? 'bg-white text-black ring-white' : 'text-white ring-white/30 hover:bg-white/10'}`}
    >
      {isCurrent && playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" className="translate-x-px" />}
    </button>
  );
}

/**
 * 스페이스 = 재생/정지, ←/→ = 10초.
 * 스페이스는 버튼·링크에 초점이 있으면 그 요소의 기본 동작(누르기)에 맡긴다. 화살표는 버튼이 쓰지 않으므로
 * 재생 버튼을 누른 직후(초점이 버튼에 있다)에도 움직여야 한다 — 입력칸(재생 위치 슬라이더 포함)만 비켜 간다.
 */
function KeyboardShortcuts() {
  const { toggle, seek, readTime } = useAlbumPlayer();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const inField = Boolean(target?.closest?.('input, textarea, select, [contenteditable="true"]'));
      if (inField) return;
      if (e.code === 'Space') {
        if (target?.closest?.('button, a')) return;
        e.preventDefault();
        toggle();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        seek(Math.max(0, readTime() + (e.key === 'ArrowLeft' ? -10 : 10)));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, seek, readTime]);
  return null;
}

function Room({ lang, audioError }: { lang: Lang; audioError: boolean }) {
  const labels = PLAYER_LABELS[lang];
  const copy = SLUNG_PRESS;
  const deckRef = useRef<HTMLDivElement>(null);
  const [deckOffscreen, setDeckOffscreen] = useState(false);

  useEffect(() => {
    const el = deckRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([entry]) => setDeckOffscreen(!entry.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const instrumentalIds = new Set(Object.entries(copy.tracks).filter(([, v]) => v.instrumental).map(([id]) => id));

  return (
    <div className="relative min-h-screen bg-black pb-28 text-white">
      <KeyboardShortcuts />
      {/* 머리 — 표지를 흐려 깐 위에 앨범 이름 */}
      <div className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-30 [&_img]:scale-110 [&_img]:blur-2xl">
          <ResponsiveImage src={COVER} alt="" fill sizes="100vw" className="object-cover" containerClassName="relative block h-full w-full" priority />
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-black/70 to-black" />
        <TopBar lang={lang} />

        <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-12 md:px-8 md:pb-14 md:pt-20">
          <p className="press-eyebrow text-xs font-semibold uppercase tracking-[0.3em] text-white/55">{t(copy.hero.kicker, lang)}</p>
          <h1 className="press-display press-wordmark mt-4">SLUNG</h1>
          <p className="press-display mt-3 text-2xl tracking-[0.32em] text-white/80 md:text-3xl">SABBAHA</p>
          <blockquote className="mt-8 max-w-2xl break-keep text-lg leading-relaxed text-white/80 md:text-xl">
            <p>“{t(copy.hero.statement, lang)}”</p>
            <footer className="mt-2 text-sm text-white/45">— {t(copy.hero.statementBy, lang)}</footer>
          </blockquote>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/65">
            {copy.hero.facts.map((f, i) => <li key={i}>{t(f, lang)}</li>)}
          </ul>
        </div>
      </div>

      <main className="relative mx-auto max-w-6xl px-4 md:px-8">
        <PlayerDeck
          labels={labels}
          cover={COVER}
          coverAlt={t(copy.ui.coverAlt, lang)}
          artist="Sabbaha"
          album="SLUNG"
          deckRef={deckRef}
        />
        {audioError && (
          <p role="alert" className="mt-4 rounded-xl bg-red-950/60 px-4 py-3 text-sm text-red-200 ring-1 ring-red-400/30">
            {labels.failed}
          </p>
        )}
        <p className="mt-4 break-keep text-sm leading-relaxed text-white/50">{t(copy.ui.embargo, lang)}</p>
        <p className="mt-1 hidden text-xs text-white/35 md:block">{t(copy.ui.shortcuts, lang)}</p>

        <div className="mt-12">
          <Tracklist labels={labels} instrumentalIds={instrumentalIds} />
        </div>

        <Section id="album" eyebrow={t(copy.album.eyebrow, lang)} title={t(copy.album.title, lang)}>
          <Prose paragraphs={copy.album.paragraphs} lang={lang} />
        </Section>

        <Section id="tracks" eyebrow={t(copy.trackNotes.eyebrow, lang)} title={t(copy.trackNotes.title, lang)}>
          <p className="-mt-4 mb-10 max-w-3xl break-keep text-sm text-white/45">{t(copy.trackNotes.lead, lang)}</p>
          <ol className="grid gap-x-12 gap-y-12 md:grid-cols-2">
            {SABBAHA_SLUNG_AUDIO.map((track, i) => {
              const note = copy.tracks[track.id];
              return (
                <li key={track.id} className="flex gap-4">
                  <TrackPlayToggle index={i} label={labels.playTrack(track.title)} />
                  <div className="min-w-0">
                    <p className="press-eyebrow text-xs uppercase tracking-[0.2em] text-white/40">
                      CD {track.disc} · {String(track.number).padStart(2, '0')} · <span className="tabular-nums">{formatTime(track.durationSeconds)}</span>
                      {note.instrumental ? ` · ${labels.instrumental}` : ''}
                      {note.explicit && (
                        <Badge tone="onImage" className="ml-2 align-middle normal-case tracking-normal">{t(copy.ui.explicit, lang)}</Badge>
                      )}
                    </p>
                    <h3 className="press-display mt-1 text-2xl">{track.title}</h3>
                    {note.subtitle && <p className="text-sm text-white/50">{t(note.subtitle, lang)}</p>}
                    <p className="mt-3 break-keep leading-relaxed text-white/75">{t(note.text, lang)}</p>
                    {note.quote && (
                      <blockquote className="mt-4 border-l border-white/25 pl-4 break-keep">
                        <p lang={/[가-힣]/.test(note.quote.original) ? 'ko' : 'en'} className="whitespace-pre-line leading-relaxed text-white/90">{note.quote.original}</p>
                        {note.quote.translation && lang === 'en' && (
                          <p className="mt-2 whitespace-pre-line text-sm italic leading-relaxed text-white/55">{note.quote.translation}</p>
                        )}
                        <footer className="mt-2 text-xs text-white/40">— {t(note.quote.source, lang)}</footer>
                      </blockquote>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </Section>

        <Section id="artist" eyebrow={t(copy.artist.eyebrow, lang)} title={t(copy.artist.title, lang)}>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
            <Prose paragraphs={copy.artist.paragraphs} lang={lang} />
            <figure className="self-start overflow-hidden rounded-2xl ring-1 ring-white/10">
              <ResponsiveImage src={copy.photos[1].src} alt={t(copy.photos[1].alt, lang)} width={1600} height={900} sizes="(min-width: 1024px) 352px, 100vw" className="h-auto w-full" />
            </figure>
          </div>
          <dl className="mt-12 grid gap-px overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/10 sm:grid-cols-2 lg:grid-cols-3">
            {copy.artist.facts.map((f, i) => (
              <div key={i} className="bg-black p-5">
                <dt className="text-xs uppercase tracking-[0.2em] text-white/40">{t(f.label, lang)}</dt>
                <dd className="mt-2 whitespace-pre-line break-keep leading-relaxed text-white/85">{t(f.value, lang)}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section id="credits" eyebrow={t(copy.credits.eyebrow, lang)} title={t(copy.credits.title, lang)}>
          <dl className="grid max-w-3xl gap-x-10 gap-y-4 sm:grid-cols-[minmax(0,14rem)_1fr]">
            {copy.credits.rows.map((row, i) => (
              <div key={i} className="contents">
                <dt className="text-sm text-white/45">{t(row.role, lang)}</dt>
                <dd className="break-keep text-white/85 max-sm:mb-3">{t(row.name, lang)}</dd>
              </div>
            ))}
          </dl>
          {copy.credits.note && <p className="mt-8 max-w-3xl break-keep text-sm leading-relaxed text-white/50">{t(copy.credits.note, lang)}</p>}
        </Section>

        <Section id="assets" eyebrow={t(copy.assets.eyebrow, lang)} title={t(copy.assets.title, lang)}>
          <p className="max-w-3xl break-keep text-white/65">{t(copy.assets.lead, lang)}</p>
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {copy.photos.map((photo) => (
              <li key={photo.src}>
                <figure>
                  <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10">
                    <ResponsiveImage src={photo.src} alt={t(photo.alt, lang)} fill sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw" className="object-cover" />
                  </div>
                  <figcaption className="mt-3 flex items-start justify-between gap-3">
                    <span className="break-keep text-sm text-white/65">{t(photo.caption, lang)}</span>
                    <a
                      href={photo.src}
                      download
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm text-white ring-1 ring-white/25 transition-colors duration-fast hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    >
                      <Download size={14} aria-hidden="true" />
                      {t(copy.assets.download, lang)}
                    </a>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="contact" eyebrow={t(copy.contact.eyebrow, lang)} title={t(copy.contact.title, lang)}>
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <p className="break-keep leading-relaxed text-white/75">{t(copy.contact.lead, lang)}</p>
              <ul className="mt-6 space-y-4">
                {[
                  { label: t(copy.contact.band.label, lang), email: copy.contact.band.email },
                  { label: t(copy.contact.studioLabel, lang), email: copy.contact.email },
                ].map((c) => (
                  <li key={c.email}>
                    <p className="text-sm text-white/45">{c.label}</p>
                    <a
                      href={`mailto:${c.email}?subject=${encodeURIComponent('SABBAHA — SLUNG')}`}
                      className="mt-1 inline-flex items-center gap-2 text-lg text-white underline decoration-white/30 underline-offset-4 transition-colors duration-fast hover:decoration-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                    >
                      <Mail size={18} aria-hidden="true" />
                      {c.email}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <ul className="space-y-3">
              {copy.links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center justify-between gap-4 rounded-xl px-4 py-3 ring-1 ring-white/10 transition-colors duration-fast hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                  >
                    <span>
                      <span className="block text-white/90">{typeof link.label === 'string' ? link.label : t(link.label, lang)}</span>
                      <span className="block text-sm text-white/45">{link.href.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
                    </span>
                    <ExternalLink size={16} aria-hidden="true" className="text-white/40 group-hover:text-white" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      </main>

      <footer className="mx-auto mt-6 flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-white/10 px-4 pt-8 text-xs text-white/40 md:px-8">
        <span className="flex items-center gap-2">
          <ThreeCircles className="h-4 w-4" />
          © Sabbaha
        </span>
        <span>{t(copy.ui.footer, lang)}</span>
      </footer>

      <MiniBar labels={labels} cover={COVER} visible={deckOffscreen} />
    </div>
  );
}

export default function SabbahaSlungPressPage(props: Props) {
  const { lang } = props;
  const title = lang === 'ko' ? '사바하 《SLUNG》 — 비공개 감상' : 'SABBAHA — SLUNG · Private listening';
  const description = t(SLUNG_PRESS.ui.metaDescription, lang);

  return (
    <div className={`press-room ${display.variable} min-h-screen bg-black`} lang={lang}>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="robots" content="noindex, nofollow, noarchive" />
        <meta name="referrer" content="same-origin" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={`https://studionol.co.kr${COVER}`} />
        <meta key="theme-color-light" name="theme-color" content="#000000" />
        <meta key="theme-color-dark" name="theme-color" content="#000000" media="(prefers-color-scheme: dark)" />
      </Head>
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
      {props.authed ? (
        <AlbumPlayerProvider
          tracks={SABBAHA_SLUNG_AUDIO}
          initialUrls={props.urls}
          validUntil={props.validUntil}
          audioEndpoint={`/api/press/room/${ROOM_ID}/audio`}
          storageKey={`press:${ROOM_ID}:position`}
          mediaSession={{ artist: 'Sabbaha', album: 'SLUNG', artwork: COVER }}
        >
          <Room lang={lang} audioError={props.audioError} />
        </AlbumPlayerProvider>
      ) : (
        <Gate lang={lang} error={props.error} />
      )}
    </div>
  );
}

export const getServerSideProps = withI18nServerProps<Props>(async ({ params, req, res, query }) => {
  const locale = String(params?.locale ?? '');
  if (locale !== 'ko' && locale !== 'en') {
    return { redirect: { destination: `/en${PATH}`, permanent: false } };
  }
  const lang: Lang = locale;
  const room = LISTENING_ROOMS[ROOM_ID];
  // 쿠키에 따라 내용이 갈리므로 어떤 캐시에도 두지 않는다. 검색에도 싣지 않는다.
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');

  const cookies = (req as unknown as { cookies?: Record<string, string> }).cookies ?? {};
  if (!isRoomTokenValid(room, cookies[roomCookieName(room)])) {
    const e = typeof query.e === 'string' ? query.e : '';
    return { props: { lang, authed: false, error: e === 'limit' ? 'limit' : e ? 'password' : null } };
  }

  try {
    const { urls, validUntil } = await presignPressAudio(SABBAHA_SLUNG_AUDIO.map((tr) => tr.pathname));
    return { props: { lang, authed: true, urls, validUntil, audioError: false } };
  } catch (error) {
    console.error('[press/sabbaha-slung] 재생 주소를 만들지 못했다', error);
    // 주소 없이도 소개는 읽을 수 있게 그린다. 플레이어는 재생을 누를 때 API로 다시 받아 본다.
    return {
      props: { lang, authed: true, urls: SABBAHA_SLUNG_AUDIO.map(() => ''), validUntil: 0, audioError: true },
    };
  }
});
