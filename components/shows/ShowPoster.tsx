import Image from 'next/image';

import { showCopy, type ShowLocale } from '../../lib/shows/i18n';

/**
 * 포스터 — 본문에서 읽을 수 있는 크기로. 가로·세로 비율이 공연마다 달라 높이를 고정하지 않고 너비에 맞춘다.
 * 누르면 원본을 새 탭에서 연다(작은 글씨까지 볼 수 있게). 글자가 든 이미지라 잘라 쓰지 않는다.
 */
export default function ShowPoster({ src, title, locale = 'ko' }: { src: string; title: string; locale?: ShowLocale }) {
  const copy = showCopy(locale);
  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={copy.posterOpen(title)}
      className="block overflow-hidden rounded-2xl shadow-lg ring-1 ring-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:ring-gray-700 dark:focus-visible:ring-primary-lighter/70 dark:focus-visible:ring-offset-gray-900"
    >
      <Image
        src={src}
        alt={copy.posterAlt(title)}
        width={1200}
        height={1200}
        sizes="(min-width: 1024px) 352px, (min-width: 640px) 420px, 92vw"
        style={{ width: '100%', height: 'auto' }}
        priority
      />
    </a>
  );
}
