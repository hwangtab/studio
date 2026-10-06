import { SHOW_DEFINITIONS } from '../../data/shows';
import { formatShowtimeLabel } from './format';
import type { ShowLocale } from './i18n';
import type { ManageOrderView, PublicShow } from './queries';
import type { ShowTranslation } from './seed';

/**
 * 공연 내용을 화면 언어로 — DB는 한국어 한 벌이고, 영어는 공연 정의(`data/shows/<slug>.ts`의 `en`)에 있다.
 * 페이지 getServerSideProps가 조회 직후 부른다(클라이언트로는 이미 바뀐 값이 내려간다).
 *
 * 번역이 없는 칸은 한국어 그대로 둔다 — 빈 칸을 내는 것보다 낫다. 지도 검색은 한국어 주소라야 잡혀서
 * 원래 장소명·주소를 `mapSource`에 남긴다.
 */
const translationOf = (slug: string): ShowTranslation | undefined =>
  SHOW_DEFINITIONS.find((d) => d.slug === slug)?.en;

export function localizeShow(show: PublicShow, locale: ShowLocale): PublicShow {
  if (locale === 'ko') return show;
  const en = translationOf(show.slug);
  const showtimes = show.showtimes.map((st) => ({ ...st, label: formatShowtimeLabel(st.startsAt, 'en') }));
  if (!en) return { ...show, showtimes };
  return {
    ...show,
    title: en.title,
    subtitle: en.subtitle ?? show.subtitle,
    presenterName: en.presenterName,
    performers: show.performers.map((p, i) => ({
      ...p,
      name: en.performers[i]?.name ?? p.name,
      bio: en.performers[i]?.bio ?? p.bio,
    })),
    ageRating: en.ageRating,
    venueName: en.venueName,
    venueAddress: en.venueAddress,
    mapSource: { venueName: show.venueName, venueAddress: show.venueAddress },
    description: en.description,
    scheduleNote: en.scheduleNote ?? show.scheduleNote,
    onSitePriceNote: en.onSitePriceNote ?? show.onSitePriceNote,
    notices: en.notices ?? show.notices,
    ticketTypes: show.ticketTypes.map((t) => ({
      ...t,
      name: en.ticketTypeNames?.[t.name] ?? t.name,
      zoneLabel: en.zoneLabels?.[t.zoneLabel] ?? t.zoneLabel,
    })),
    showtimes,
  };
}

/** 내 티켓 화면의 공연 정보·티켓 이름. 주문 내역(금액·상태)은 그대로다. */
export function localizeManageOrder(order: ManageOrderView, locale: ShowLocale): ManageOrderView {
  if (locale === 'ko') return order;
  const en = translationOf(order.showSlug);
  const showtimeLabel = formatShowtimeLabel(order.showtimeStartsAt, 'en');
  if (!en) return { ...order, showtimeLabel };
  return {
    ...order,
    showTitle: en.title,
    venueName: en.venueName,
    venueAddress: en.venueAddress,
    showtimeLabel,
    tickets: order.tickets.map((t) => ({ ...t, ticketTypeName: en.ticketTypeNames?.[t.ticketTypeName] ?? t.ticketTypeName })),
  };
}

/** 메일 등 slug만 아는 곳에서 — 영어 제목·장소·티켓 이름. 번역이 없으면 null. */
export function showTranslationFor(slug: string): ShowTranslation | null {
  return translationOf(slug) ?? null;
}
