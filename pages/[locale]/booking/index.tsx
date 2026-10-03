import Head from 'next/head';
import Link from 'next/link';
import { ArrowRight } from '@/lib/lucide-icons';

import BaseCard from '../../../components/ui/BaseCard';
import { Section } from '../../../components/ui/Section';
import { Button } from '../../../components/ui/Button';
import SectionHeading from '../../../components/ui/SectionHeading';
import { getSiteConfig } from '../../../data/siteConfig';
import { withI18nServerProps } from '../../../lib/getStatic';
import { BOOKING_HUB_INQUIRY_LINKS, buildBookingHub, type BookingHubGroup } from '../../../lib/booking/hub';
import { nextShowtimeOf } from '../../../lib/shows/availability';
import { formatWon, SALE_STATE_LABELS } from '../../../lib/shows/copy';
import { listPublicShows } from '../../../lib/shows/queries';
import { trackMicroEvent } from '../../../utils/analytics';

/** 허브에 싣는 공연 한 줄 — 상세와 같은 조회(listPublicShows)에서 필요한 값만 추린다. */
type HubShow = { slug: string; title: string; label: string; venueName: string; lowPrice: number | null; stateLabel: string; open: boolean };
type BookingHubProps = { groups: BookingHubGroup[]; shows: HubShow[] };

const track = (ctaId: string) =>
  trackMicroEvent('micro_click_booking_entry', { locale: 'ko', component: 'BookingHub', cta_id: ctaId });

/**
 * /ko/booking — 온라인 예약·결제 통합 랜딩(2026-10-02).
 *
 * 그 전엔 /ko/booking이 404였고, 고객에게 "여기서 예약하세요"를 보내려면 서비스마다 다른 주소를
 * 골라 보내야 했다. 이 페이지가 한 주소로 모든 온라인 예약·주문 입구를 모은다. 상품·가격은 위저드와
 * 같은 정본(lib/booking/hub.ts)에서 읽는다.
 *
 * 다른 /ko/booking/* 와 같이 noindex다 — 검색 진입점이 아니라 링크를 직접 보내는 용도다.
 * 하위 예약 페이지는 이 페이지를 거치지 않고도 열린다(?product= 링크는 그대로 유효).
 */
export default function BookingHubPage({ groups, shows }: BookingHubProps) {
  const kakaoUrl = getSiteConfig('ko').contact.kakaoUrl;

  return (
    <>
      <Head>
        <title>온라인 예약·결제 | 스튜디오 놀</title>
        <meta
          name="description"
          content="스튜디오 놀의 녹음·성우·축가·커버 영상·연습실 시간제 예약과 믹싱·마스터링 주문을 한 곳에서 시작합니다."
        />
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <Section variant="default" spacing="tight">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="typo-page-title">온라인 예약·결제</h1>
          <p className="mt-4 typo-card-body text-gray-700 dark:text-gray-300">
            하고 싶은 일을 고르면 날짜와 시간 선택부터 결제까지 이어집니다. 결제가 끝나면 확정 메일로 예약
            확인·취소 링크를 보내드립니다.
          </p>
          <p className="mt-2 typo-card-meta">
            취소·환불 기준은{' '}
            <Link href="/ko/terms#refund" prefetch={false} className="underline underline-offset-4">
              이용약관
            </Link>
            에서 확인하실 수 있습니다.
          </p>
        </div>
      </Section>

      {shows.length > 0 && (
        <Section id="shows" variant="alternate" spacing="tight" className="scroll-mt-24">
          <div className="mx-auto max-w-4xl">
            <SectionHeading
              title="공연 티켓"
              subtitle="스튜디오 놀이 여는 공연입니다. 사전 예매는 온라인에서 받고, 티켓(QR)은 메일로 보내 드립니다."
              as="h2"
            />
            <ul className="grid gap-4 md:grid-cols-2">
              {shows.map((show) => (
                <li key={show.slug}>
                  <BaseCard className="flex h-full flex-col p-5">
                    <h3 className="typo-card-title text-gray-900 dark:text-white">{show.title}</h3>
                    <p className="mt-1 typo-card-body text-gray-700 dark:text-gray-300">
                      {show.label} · {show.venueName}
                    </p>
                    <p className="mt-2 flex-1 tabular-nums">
                      {show.lowPrice !== null && (
                        <span className="text-xl font-bold text-gray-900 dark:text-white">{formatWon(show.lowPrice)}</span>
                      )}{' '}
                      <span className="text-sm text-gray-600 dark:text-gray-400">{show.stateLabel}</span>
                    </p>
                    <Button asChild variant="solid" shape="block" className="mt-4">
                      <Link
                        href={`/ko/shows/${show.slug}`}
                        prefetch={false}
                        onClick={() => track(`booking_hub_show_${show.slug}`)}
                      >
                        {show.open ? '예매하기' : '공연 안내 보기'}
                        <ArrowRight size={16} aria-hidden="true" />
                      </Link>
                    </Button>
                  </BaseCard>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-right">
              <Link
                href="/ko/shows"
                prefetch={false}
                className="inline-flex items-center gap-1 font-semibold text-primary hover:underline dark:text-primary-lighter"
              >
                공연 전체 보기 <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </p>
          </div>
        </Section>
      )}

      {groups.map((group, index) => (
        <Section
          key={group.id}
          id={group.id}
          variant={(index + (shows.length > 0 ? 1 : 0)) % 2 === 0 ? 'alternate' : 'default'}
          spacing="tight"
          className="scroll-mt-24"
        >
          <div className="mx-auto max-w-4xl">
            <SectionHeading title={group.title} subtitle={group.description} as="h2" />
            <p className="mb-4 text-right typo-card-meta">{group.priceNote}</p>
            <ul className="grid gap-4 md:grid-cols-2">
              {group.entries.map((entry) => (
                <li key={entry.productId}>
                  <BaseCard className="flex h-full flex-col p-5">
                    <h3 className="typo-card-title text-gray-900 dark:text-white">{entry.name}</h3>
                    <p className="mt-1 tabular-nums">
                      <span className="text-xl font-bold text-gray-900 dark:text-white">{entry.price}</span>{' '}
                      <span className="text-sm text-gray-600 dark:text-gray-400">{entry.unit}</span>
                    </p>
                    <p className="mt-2 flex-1 typo-card-body text-gray-700 dark:text-gray-300">{entry.detail}</p>
                    {/* 핸들러는 자식 <Link>에 붙인다 — Button asChild는 자식 props가 이긴다. */}
                    <Button asChild variant="solid" shape="block" className="mt-4">
                      <Link
                        href={entry.href}
                        prefetch={false}
                        onClick={() => track(`booking_hub_${entry.productId}`)}
                      >
                        {group.id === 'mixing-mastering' ? '주문하기' : '예약하기'}
                        <ArrowRight size={16} aria-hidden="true" />
                      </Link>
                    </Button>
                  </BaseCard>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      ))}

      <Section variant={(groups.length + (shows.length > 0 ? 1 : 0)) % 2 === 0 ? 'alternate' : 'default'} spacing="tight">
        <div className="mx-auto max-w-4xl">
          <SectionHeading
            title="온라인 결제가 없는 의뢰"
            subtitle="상담한 뒤 진행합니다. 카카오톡으로 먼저 문의해 주세요."
            as="h2"
          />
          <ul className="grid gap-4 md:grid-cols-2">
            {BOOKING_HUB_INQUIRY_LINKS.map((item) => (
              <li key={item.href}>
                <BaseCard className="flex h-full flex-col p-5">
                  <h3 className="typo-card-title text-gray-900 dark:text-white">{item.label}</h3>
                  <p className="mt-1 flex-1 typo-card-body text-gray-700 dark:text-gray-300">{item.description}</p>
                  <Link
                    href={item.href}
                    prefetch={false}
                    className="mt-3 inline-flex items-center gap-1 font-semibold text-primary hover:underline dark:text-primary-lighter"
                  >
                    자세히 보기 <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </BaseCard>
              </li>
            ))}
          </ul>
          {/* 카카오톡 목적지 링크 — CLAUDE.md 카카오 CTA 배색 규칙(옐로 고정). */}
          <p className="mt-8 text-center">
            <Button asChild variant="kakao" shape="block" size="lg">
              <a
                href={kakaoUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track('booking_hub_kakao')}
              >
                카카오톡으로 문의하기
              </a>
            </Button>
          </p>
        </div>
      </Section>
    </>
  );
}

export const getServerSideProps = withI18nServerProps<BookingHubProps>(async ({ params }) => {
  if (params?.locale !== 'ko') return { redirect: { destination: '/ko', permanent: false } };
  return { props: { groups: buildBookingHub(), shows: await loadHubShows() } };
});

/**
 * 예매할 수 있는 공연(다가오는 공연)만 싣는다. 이 랜딩은 공연 때문에 느려지거나 깨지면 안 되므로
 * 조회가 실패하면 섹션만 빼고 나머지는 그대로 연다 — 빌드·CI에는 DB가 없다.
 */
async function loadHubShows(): Promise<HubShow[]> {
  try {
    const now = new Date();
    const nowSec = Math.floor(now.getTime() / 1000);
    const { upcoming } = await listPublicShows(now);
    return upcoming.map((show) => {
      const next = nextShowtimeOf(show, nowSec);
      const prices = show.ticketTypes.map((t) => t.price);
      return {
        slug: show.slug,
        title: show.title,
        label: next?.label ?? '',
        venueName: show.venueName,
        lowPrice: prices.length ? Math.min(...prices) : null,
        stateLabel: next ? SALE_STATE_LABELS[next.saleState] : '',
        open: next?.saleState === 'open',
      };
    });
  } catch (error) {
    console.error('[booking-hub] 공연 조회 실패 — 공연 섹션 없이 연다:', error);
    return [];
  }
}

// 디자인 판 — 같은 디렉터리의 다른 예약 페이지와 맞춘다(lib/designEdition.ts).
BookingHubPage.designEdition = 'v2';
