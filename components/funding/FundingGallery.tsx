import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

import { ChevronLeft, ChevronRight, X } from '../../lib/lucide-icons';
import { lockBodyScroll, unlockBodyScroll } from '../../utils/scrollLock';
import { useFocusTrapDialog } from '../../utils/useFocusTrapDialog';
import ResponsiveImage from '../ResponsiveImage';

interface GalleryPhoto {
  src: string;
  alt: string;
}

const KSFP_DIR = '/images/funding/keep-singing-for-palestine/gallery';

/**
 * `%%funding-gallery:<id>%%`로 불러오는 현장 사진 격자 + 라이트박스.
 *
 * 마크다운 본문은 raw HTML을 못 써서(`disableParsingRawHTML`) 격자는 숏코드 컴포넌트로 만든다
 * (`FundingLineupPerson`과 같은 이유). 사진은 전부 3:2라 칸을 3:2로 고정해 자르지 않는다.
 * 그림을 바꾸면 파일명(날짜)도 바꿀 것 — /images/**는 immutable 캐시다.
 */
const GALLERIES: Record<string, GalleryPhoto[]> = {
  // 파일 번호는 촬영 시각의 역순이다(01이 가장 늦은 밤). 낮에서 밤으로 흐르도록 뒤에서부터 세되,
  // 첫 큰 타일은 운영자가 고른 13번 사진이라 13·14번만 맞바꿨다(2026-09-30).
  'keep-singing-for-palestine': [13, 14, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((n, i) => ({
    src: `${KSFP_DIR}/${String(n).padStart(2, '0')}-20260930.webp`,
    alt: `9월 19일 서십자각터 거리집회 현장 사진 ${i + 1}`,
  })),
};

/**
 * 모자이크 배치. 사진은 전부 3:2라 크기만 다르게 앉히고 object-cover로 채운다(라이트박스는 원본 전체).
 * 데스크톱은 6열 × 행 높이 W/9이고 [열 시작, 행 시작, 열 폭, 행 높이]를 명시한다 —
 * 자동 배치에 맡기면 큰 타일 옆에 빈칸이 생긴다. 2×2는 3:2, 4×4는 3:2, 3×3은 3:2에 가깝다.
 * 모바일은 4열 × 행 높이 W/6, 순서대로 흘려 넣는다(mobile 클래스).
 */
type Tile = { d: [number, number, number, number]; m: string };
const SM = 'col-span-2 row-span-2';
const BIG = 'col-span-4 row-span-4';
const WIDE = 'col-span-4 row-span-3';
const MOSAIC: Tile[] = [
  { d: [1, 1, 4, 4], m: BIG },
  { d: [5, 1, 2, 2], m: SM },
  { d: [5, 3, 2, 2], m: SM },
  { d: [1, 5, 2, 2], m: SM },
  { d: [3, 5, 2, 2], m: SM },
  { d: [5, 5, 2, 2], m: SM },
  { d: [1, 7, 2, 2], m: SM },
  { d: [1, 9, 2, 2], m: WIDE },
  { d: [3, 7, 4, 4], m: BIG },
  { d: [1, 11, 2, 2], m: SM },
  { d: [3, 11, 2, 2], m: SM },
  { d: [5, 11, 2, 2], m: WIDE },
  { d: [1, 13, 3, 3], m: SM },
  { d: [4, 13, 3, 3], m: SM },
];

const iconButtonClass =
  'flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black';

function Lightbox({
  photos,
  index,
  onIndex,
  onClose,
}: {
  photos: GalleryPhoto[];
  index: number;
  onIndex: (next: number) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchStartX = useRef<number | null>(null);
  const count = photos.length;

  useFocusTrapDialog({ isOpen: true, containerRef: dialogRef, onClose, initialFocusRef: closeRef });

  useEffect(() => {
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, []);

  const go = useCallback((delta: number) => onIndex((index + delta + count) % count), [index, count, onIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [go]);

  // 앞뒤 사진을 미리 받아 넘길 때 빈 화면이 안 보이게 한다.
  useEffect(() => {
    [index - 1, index + 1].forEach((i) => {
      const photo = photos[(i + count) % count];
      if (photo) new window.Image().src = photo.src;
    });
  }, [index, photos, count]);

  const photo = photos[index];

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="현장 사진 크게 보기"
      className="fixed inset-0 z-[70] flex flex-col bg-black/90"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        touchStartX.current = null;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <p className="text-sm tabular-nums" aria-live="polite">
          {index + 1} / {count}
        </p>
        <button ref={closeRef} type="button" onClick={onClose} className={iconButtonClass} aria-label="닫기">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <div
        className="relative mx-auto flex min-h-0 w-full max-w-6xl flex-1 items-center justify-center px-4 pb-6"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <button
          type="button"
          onClick={() => go(-1)}
          className={`${iconButtonClass} absolute left-2 top-1/2 z-10 -translate-y-1/2 bg-black/40 sm:left-4`}
          aria-label="이전 사진"
        >
          <ChevronLeft className="h-6 w-6" aria-hidden />
        </button>
        {/* 3:2 원본을 화면 안에 통째로 담는다 — 가로/세로 어느 쪽이 먼저 차도 안 잘린다. */}
        <div
          className="relative w-full"
          style={{ aspectRatio: '3 / 2', maxHeight: '100%', maxWidth: 'min(100%, calc((100dvh - 8rem) * 1.5))' }}
        >
          <ResponsiveImage
            key={photo.src}
            src={photo.src}
            alt={photo.alt}
            fill
            sizes="(min-width: 1152px) 1152px, 100vw"
            className="object-contain"
            priority
          />
        </div>
        <button
          type="button"
          onClick={() => go(1)}
          className={`${iconButtonClass} absolute right-2 top-1/2 z-10 -translate-y-1/2 bg-black/40 sm:right-4`}
          aria-label="다음 사진"
        >
          <ChevronRight className="h-6 w-6" aria-hidden />
        </button>
      </div>
    </div>
  );
}

export default function FundingGallery({ id }: { id: string }) {
  const photos = GALLERIES[id];
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  if (!photos) return null;

  return (
    <>
      <div className="my-6 [container-type:inline-size]">
        <ul className="not-prose grid list-none grid-flow-dense grid-cols-4 gap-2 p-0 [grid-auto-rows:calc(100cqw/6)] sm:grid-cols-6 sm:gap-3 sm:[grid-auto-rows:calc(100cqw/9)]">
          {photos.map((photo, i) => {
            const tile = MOSAIC[i % MOSAIC.length];
            const [c, r, cs, rs] = tile.d;
            return (
              <li
                key={photo.src}
                className={`m-0 p-0 ${tile.m} sm:[grid-column:var(--c)] sm:[grid-row:var(--r)]`}
                style={{ '--c': `${c} / span ${cs}`, '--r': `${r} / span ${rs}` } as CSSProperties}
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(i)}
                  aria-label={`${photo.alt} 크게 보기`}
                  className="group relative block h-full w-full overflow-hidden rounded-xl bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:bg-gray-800 dark:focus-visible:ring-primary-lighter/70"
                >
                  <ResponsiveImage
                    src={photo.src}
                    alt=""
                    fill
                    sizes={cs >= 4 ? '(min-width: 1024px) 700px, 100vw' : '(min-width: 640px) 33vw, 50vw'}
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {openIndex !== null && (
        <Lightbox photos={photos} index={openIndex} onIndex={setOpenIndex} onClose={() => setOpenIndex(null)} />
      )}
    </>
  );
}
