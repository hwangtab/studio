import ImageHero, { HERO_SCRIM_STRONG } from '../common/ImageHero';
import MobileStickyCta from '../common/MobileStickyCta';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';
import { Panel } from '../ui/Panel';
import FAQSection from '../ui/FAQSection';
import { Section } from '../ui/Section';
import SectionHeading from '../ui/SectionHeading';
import { formatWon, SHOW_CONTACT_PHONE, SHOW_HERO_IMAGE } from '../../lib/shows/copy';
import { showFaqItems } from '../../lib/shows/faq';
import type { PublicShow } from '../../lib/shows/queries';
import { descriptionBlocks } from '../../lib/shows/structured';
import ShowBookingForm from './ShowBookingForm';
import ShowFacts from './ShowFacts';
import ShowLineup from './ShowLineup';
import ShowPoster from './ShowPoster';
import ShowVenueMap from './ShowVenueMap';

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
  const blocks = descriptionBlocks(show.description);
  const faq = showFaqItems();
  // 섹션 번호는 실제로 그려지는 순서대로 — 출연진이 없는 공연도 번호가 건너뛰지 않는다.
  let sectionNo = 0;
  const nextIndex = (): string => String(++sectionNo).padStart(2, '0');

  return (
    <>
      {/*
        히어로 배경은 포스터다 — 펀딩 상세와 같은 방식(선명한 배경 + 확대 애니메이션 + HERO_SCRIM_STRONG)으로 나온다.
        히어로 안에 작은 포스터 카드를 또 두지 않고, 읽을 수 있는 크기의 포스터는 아래 본문(ShowPoster)에 둔다.
        포스터가 없으면 SHOW_HERO_IMAGE로 떨어진다.
      */}
      <ImageHero
        locale="ko"
        priority
        backgroundImage={show.coverImage ?? SHOW_HERO_IMAGE}
        overlayGradient={HERO_SCRIM_STRONG}
        imageAlt=""
        aboveTitle={<p className="text-sm font-semibold tracking-wide text-gray-200 drop-shadow">{show.presenterName} 주최</p>}
        title={show.title}
        subtitle={
          <>
            {show.subtitle && <span className="block">{show.subtitle}</span>}
            <span className="mt-6 flex flex-wrap justify-center gap-2 text-base">
              {/* 히어로 안이라 Badge 기본(12px)보다 한 단 크게 — tone은 Badge가 소유한다. */}
              {show.showtimes.slice(0, 2).map((st) => (
                <Badge key={st.id} tone="onImage" size="md" className="px-4 py-1.5 text-sm font-medium">
                  {st.label}
                </Badge>
              ))}
              {show.showtimes.length > 2 && (
                <Badge tone="onImage" size="md" className="px-4 py-1.5 text-sm font-medium">외 {show.showtimes.length - 2}회</Badge>
              )}
              <Badge tone="onImage" size="md" className="px-4 py-1.5 text-sm font-medium">{show.venueName}</Badge>
            </span>
          </>
        }
        ctaButtons={
          bookable ? (
            // <lg에서는 MobileStickyCta가 상시 떠 있어 같은 버튼이 둘이 된다 — 펀딩 상세와 같은 처리.
            <Button asChild size="lg" className="hidden lg:inline-flex focus-visible:ring-white/80 focus-visible:ring-offset-black/40">
              <a href="#book">{ctaLabel}</a>
            </Button>
          ) : null
        }
      />

      {show.cancelled && (
        <Section spacing="tight">
          <Notice tone="warning" role="status" className="mx-auto max-w-3xl">
            이 공연은 취소되었습니다. 결제하신 분께는 별도로 환불을 안내해 드립니다. 문의 {SHOW_CONTACT_PHONE}
          </Notice>
        </Section>
      )}

      <Section className="pb-28 pt-16 lg:pb-16">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
          <div className="min-w-0">
            <SectionHeading eyebrow="소개" index={nextIndex()} title="공연 소개" as="h2" />
            <div className="space-y-5 break-keep text-base leading-8 text-gray-800 dark:text-gray-200 md:text-lg md:leading-9">
              {blocks.map((b) =>
                b.type === 'h' ? (
                  <h3 key={b.text} className="typo-card-title !mt-12 text-gray-900 dark:text-white">
                    {b.text}
                  </h3>
                ) : b.type === 'quote' ? (
                  <blockquote key={b.text} className="border-l-4 border-primary/40 pl-5 text-gray-700 dark:border-primary-lighter/50 dark:text-gray-300">
                    {b.text.split('\n').map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </blockquote>
                ) : (
                  <p key={b.text}>{b.text}</p>
                ),
              )}
            </div>
            {show.notices.length > 0 && (
              <Panel variant="inset" padding="default" className="mt-8">
                <ul className="space-y-2 break-keep text-sm leading-7 md:text-base">
                  {show.notices.map((n) => (
                    <li key={n} className="flex gap-2">
                      <span aria-hidden="true" className="mt-0.5 text-primary dark:text-primary-lighter">•</span>
                      <span>{n}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            {show.performers.length > 0 && (
              <div className="mt-16">
                <SectionHeading eyebrow="출연" index={nextIndex()} title="출연" as="h2" />
                <ShowLineup performers={show.performers} />
              </div>
            )}

            <div className="mt-16">
              <SectionHeading eyebrow="장소" index={nextIndex()} title="오시는 길" as="h2" />
              <ShowVenueMap show={show} />
            </div>
          </div>

          {/* <lg에서는 핵심 정보(일시·장소·가격·예매)가 소개보다 먼저 보여야 한다 — 펀딩 상세가 모금 현황을
              패널에서 본문 위로 옮긴 것과 같은 이유(2026-09-28). 포스터가 맨 위, 그 아래 핵심 정보. 데스크톱은 오른쪽 sticky. */}
          <aside className="order-first mx-auto w-full max-w-sm space-y-6 lg:sticky lg:top-24 lg:order-none lg:mx-0 lg:max-w-none">
            {show.coverImage && <ShowPoster src={show.coverImage} title={show.title} />}
            <ShowFacts show={show} ctaLabel={ctaLabel} bookable={bookable} />
          </aside>
        </div>
      </Section>

      <Section variant="alternate" id="tickets" className="scroll-mt-20">
        <SectionHeading
          eyebrow="예매"
          index={nextIndex()}
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

      <FAQSection items={faq} title="자주 묻는 질문" subtitle="티켓 전달·입장·취소에 관해 자주 묻는 질문입니다." eyebrow="FAQ" index={nextIndex()} variant="default" />

      {/* 예매 폼이나 핵심 정보 패널의 예매 버튼이 보이는 동안은 숨는다. */}
      <MobileStickyCta href="#book" label={ctaLabel} visible={bookable} hideWhenInView={['#book', '[data-hide-mobile-cta]']} />
    </>
  );
}
