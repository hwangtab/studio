import { useCallback, useEffect, useRef, useState } from 'react';

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
  'keep-singing-for-palestine': Array.from({ length: 14 }, (_, i) => ({
    src: `${KSFP_DIR}/${String(i + 1).padStart(2, '0')}-20260930.webp`,
    alt: `9월 19일 서십자각터 거리집회 현장 사진 ${i + 1}`,
  })),
};

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
      <ul className="not-prose my-6 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3 sm:gap-3">
        {photos.map((photo, i) => (
          <li key={photo.src} className="m-0 p-0">
            <button
              type="button"
              onClick={() => setOpenIndex(i)}
              aria-label={`${photo.alt} 크게 보기`}
              className="group relative block aspect-[3/2] w-full overflow-hidden rounded-xl bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:bg-gray-800 dark:focus-visible:ring-primary-lighter/70"
            >
              <ResponsiveImage
                src={photo.src}
                alt=""
                fill
                sizes="(min-width: 640px) 33vw, 50vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
            </button>
          </li>
        ))}
      </ul>
      {openIndex !== null && (
        <Lightbox photos={photos} index={openIndex} onIndex={setOpenIndex} onClose={() => setOpenIndex(null)} />
      )}
    </>
  );
}
