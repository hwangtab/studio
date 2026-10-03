import Image from 'next/image';

import ImageHero, { HERO_SCRIM_STRONG } from '../common/ImageHero';
import { Button } from '../ui/Button';
import FAQSection from '../ui/FAQSection';
import { Section } from '../ui/Section';
import SectionHeading from '../ui/SectionHeading';
import { formatWon, SHOW_CONTACT_PHONE } from '../../lib/shows/copy';
import { showFaqItems } from '../../lib/shows/faq';
import type { PublicShow } from '../../lib/shows/queries';
import { descriptionParagraphs } from '../../lib/shows/structured';
import ShowBookingForm from './ShowBookingForm';
import ShowFacts from './ShowFacts';
import ShowLineup from './ShowLineup';
import ShowMobileCta from './ShowMobileCta';

/**
 * 공연 상세 합성 — 펀딩의 ProjectDetailView에 대응한다. 히어로는 사이트 공용 ImageHero(포스터를 배경
 * 사진으로, STRONG 스크림), 본문은 Section + v2 SectionHeading("01 소개 · 02 출연 · 03 예매"), 오른쪽은
 * 핵심 정보 패널(ShowFacts, 데스크톱 sticky). 공연이 바뀌어도 이 파일은 그대로다 — 모든 값은 PublicShow에서 온다.
 */
export const showCtaLabel = (show: PublicShow): { label: string; bookable: boolean } => {
  const prices = show.ticketTypes.map((t) => t.price);
  const lowPrice = prices.length ? Math.min(...prices) : null;
  const bookable = !show.cancelled && show.showtimes.some((s) => s.saleState === 'open');
  if (bookable) return { label: `티켓 예매하기${lowPrice !== null ? ` · ${formatWon(lowPrice)}` : ''}`, bookable };
  return { label: show.cancelled ? '취소된 공연입니다' : '지금은 예매할 수 없습니다', bookable };
};

export default function ShowDetailView({ show }: { show: PublicShow }) {
  const { label: ctaLabel, bookable } = showCtaLabel(show);
  const paragraphs = descriptionParagraphs(show.description);
  const faq = showFaqItems();

  return (
    <>
      {/*
        포스터를 두 번 쓴다 — 배경(스크림 아래, 분위기)과 전경(작은 카드, 실제 포스터). 펀딩 목록이
        진행 중 프로젝트의 커버를 배경으로 쓰는 것과 같은 수법이다. 글씨 자리 대비는 STRONG 스크림이
        지킨다(ProjectDetailView 주석의 실측과 같은 근거 — 포스터가 밝은 공연이 오면 다시 잴 것).
      */}
      <ImageHero
        locale="ko"
        priority
        overlayGradient={HERO_SCRIM_STRONG}
        backgroundImage={show.coverImage ?? '/images/og-recording15.webp'}
        imageAlt=""
        aboveTitle={
          <div className="flex flex-col items-center gap-4">
            {show.coverImage && (
              <div className="relative aspect-[3/4] w-36 overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/20 md:w-44">
                <Image src={show.coverImage} alt={`${show.title} 포스터`} fill priority sizes="176px" className="object-cover" />
              </div>
            )}
            <p className="text-sm font-semibold tracking-wide text-gray-200 drop-shadow">{show.presenterName} 주최</p>
          </div>
        }
        title={show.title}
        subtitle={
          <>
            {show.subtitle && <span className="block">{show.subtitle}</span>}
            <span className="mt-6 flex flex-wrap justify-center gap-2 text-base">
              {show.showtimes.slice(0, 2).map((st) => (
                <span key={st.id} className="inline-block rounded-full border border-white/40 bg-black/30 px-4 py-1.5 text-sm">
                  {st.label}
                </span>
              ))}
              {show.showtimes.length > 2 && (
                <span className="inline-block rounded-full border border-white/40 bg-black/30 px-4 py-1.5 text-sm">외 {show.showtimes.length - 2}회</span>
              )}
              <span className="inline-block rounded-full border border-white/40 bg-black/30 px-4 py-1.5 text-sm">{show.venueName}</span>
            </span>
          </>
        }
        ctaButtons={
          bookable ? (
            // <lg에서는 ShowMobileCta가 상시 떠 있어 같은 버튼이 둘이 된다 — 펀딩 상세와 같은 처리.
            <Button asChild size="lg" className="hidden lg:inline-flex focus-visible:ring-white/80 focus-visible:ring-offset-black/40">
              <a href="#book">{ctaLabel}</a>
            </Button>
          ) : null
        }
      />

      {show.cancelled && (
        <Section spacing="tight">
          <p role="status" className="mx-auto max-w-3xl rounded-xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-100">
            이 공연은 취소되었습니다. 결제하신 분께는 별도로 환불을 안내해 드립니다. 문의 {SHOW_CONTACT_PHONE}
          </p>
        </Section>
      )}

      <Section className="pb-28 pt-16 lg:pb-16">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
          <div className="min-w-0">
            <SectionHeading eyebrow="소개" index="01" title="공연 소개" as="h2" />
            <div className="space-y-5 break-keep text-base leading-8 text-gray-800 dark:text-gray-200 md:text-lg md:leading-9">
              {paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            {show.notices.length > 0 && (
              <ul className="mt-8 space-y-2 break-keep rounded-2xl bg-gray-50 p-5 text-sm leading-7 text-gray-700 dark:bg-gray-800/60 dark:text-gray-300 md:text-base">
                {show.notices.map((n) => (
                  <li key={n} className="flex gap-2">
                    <span aria-hidden="true" className="mt-0.5 text-primary dark:text-primary-lighter">•</span>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            )}

            {show.performers.length > 0 && (
              <div className="mt-16">
                <SectionHeading eyebrow="출연" index="02" title="출연" as="h2" />
                <ShowLineup performers={show.performers} />
              </div>
            )}
          </div>

          {/* <lg에서는 핵심 정보(일시·장소·가격·예매)가 소개보다 먼저 보여야 한다 — 펀딩 상세가 모금 현황을
              패널에서 본문 위로 옮긴 것과 같은 이유(2026-09-28). 데스크톱은 오른쪽 sticky. */}
          <aside className="order-first lg:order-none lg:sticky lg:top-24">
            <ShowFacts show={show} ctaLabel={ctaLabel} bookable={bookable} />
          </aside>
        </div>
      </Section>

      <Section variant="alternate" id="tickets" className="scroll-mt-20">
        <SectionHeading
          eyebrow="예매"
          index="03"
          title="티켓 예매"
          subtitle={bookable ? '온라인 예매는 공연 전날 자정에 마감됩니다. 티켓(QR)은 메일로 보내 드립니다.' : undefined}
          as="h2"
        />
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900 md:p-8">
            <ShowBookingForm show={show} />
          </div>
          <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">문의 {SHOW_CONTACT_PHONE}</p>
        </div>
      </Section>

      <FAQSection items={faq} title="자주 묻는 질문" subtitle="티켓 전달·입장·취소에 관해 자주 묻는 질문입니다." eyebrow="FAQ" index="04" variant="default" />

      {bookable && <ShowMobileCta label={ctaLabel} />}
    </>
  );
}
