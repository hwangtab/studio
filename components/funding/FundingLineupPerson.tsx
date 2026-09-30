import { ExternalLink } from '../../lib/lucide-icons';
import ResponsiveImage from '../ResponsiveImage';
import BaseCard from '../ui/BaseCard';

interface NamedLink {
  label: string;
  /** 없으면 그냥 글자로만 보인다 — 공식 계정을 못 찾은 사람도 있다(2026-09-30 확인). */
  sns?: string;
}

interface LineupPerson {
  /** 이름을 링크 하나로 표시할 때. 사람이 둘(듀오)이면 대신 people을 쓴다. */
  name?: string;
  sns?: string;
  /** b2b 세트처럼 이름 줄에 사람이 둘 이상이고 각자 다른 SNS로 가야 할 때. */
  people?: NamedLink[];
  bio: string;
  photo: string;
  /** b2b 세트 등 두 사람이 한 슬롯을 쓸 때. photo 위 오른쪽 아래에 작게 겹쳐 그린다. */
  photoSecondary?: string;
}

/**
 * `%%funding-lineup:<id>%%`로 불러오는 출연진 카드.
 *
 * pine-nut 공연 페이지(사진 원형 + 이름 + 소개를 한 줄에)를 본떴다 — 마크다운 본문은
 * `disableParsingRawHTML`이라 raw HTML로 카드를 짤 수 없어(운영자 지적 2026-09-30: "사진과
 * 소개 따로 하면 안 돼, pine-nut 프로젝트가 잘 되어 있어"), 이미 있는 숏코드 체계(마크다운
 * 렌더러가 `%%이름%%` / `%%이름:인자%%`를 실제 컴포넌트로 바꿔 끼우는 장치, 예:
 * `%%price:mixing-level1%%`)로 만든다.
 *
 * 데이터는 이 파일 안에 둔다 — 지금은 mok-jareugi 7명뿐이지만, 다음 펀딩 프로젝트도 같은
 * 표에 `<slug>-<사람>` 키로 추가하면 재사용된다.
 *
 * 카드 재질은 `BaseCard variant="glass"` — 옆 리워드 카드들과 같은 유리 재질을 써야
 * 나란히 놓였을 때 이 카드만 평평해 보이지 않는다(운영자 지적 2026-09-30, 손으로 만든
 * 박스로 한 번 냈다가 다시 고쳤다).
 *
 * SNS 링크는 공연 라인업을 공지한 페이스북 게시물(2026-09-30, 운영자가 링크 전달)에 실린
 * 것만 쓴다 — 실제로 열어서 각 계정이 200으로 응답하는 것을 확인함. 카드 전체를 링크로
 * 감싸면 듀오(사람 둘, SNS 둘)를 표현할 수 없어 이름 부분만 각자 링크로 낸다.
 */
const LINEUP_PEOPLE: Record<string, LineupPerson> = {
  'mok-jareugi-yangchaae': {
    name: '양차애',
    sns: 'https://www.instagram.com/carbabyis/',
    bio: '사랑노래를 짓고 부릅니다. 잘 패배하는 사람이 되는 것이 꿈입니다.',
    photo: '/images/funding/mok-jareugi/lineup/yangchaae-20260930.webp',
  },
  'mok-jareugi-dj-duo': {
    people: [
      { label: 'DJ스탑원', sns: 'https://www.instagram.com/djstopone/' },
      // 본명 김우향. `instagram.com/gwalgwal`은 과거 조사 때 동명이인으로 잘못 짚었던
      // 적이 있는 계정이다 — rottenmogwa가 맞는 계정이다(2026-09-30 라인업 공지에서 재확인).
      { label: 'DJ괄', sns: 'https://www.instagram.com/rottenmogwa/' },
    ],
    bio: '두 사람이 번갈아 판을 올리는 b2b 세트입니다.',
    photo: '/images/funding/mok-jareugi/lineup/dj-stopone-20260930.webp',
    photoSecondary: '/images/funding/mok-jareugi/lineup/dj-gwal-20260930.webp',
  },
  'mok-jareugi-sabbaha': {
    name: '사바하',
    sns: 'https://www.instagram.com/sabbaha_kr/',
    bio: '2013년 솔로 프로젝트로 출발해 2023년 듀오가 된 둠드론 밴드입니다.',
    photo: '/images/funding/mok-jareugi/lineup/sabbaha-20260930.webp',
  },
  'mok-jareugi-collins': {
    name: '달 위의 콜린스',
    sns: 'https://www.instagram.com/c011ins_0n_the_m00n/',
    bio: '홍대 클럽빵을 거점으로 공연해 온 팀입니다.',
    photo: '/images/funding/mok-jareugi/lineup/collins-on-the-moon-20260930.webp',
  },
  'mok-jareugi-parkjihwi': {
    name: '박지휘',
    sns: 'https://www.instagram.com/sickbaby109/',
    bio: '프리포크 싱어송라이터입니다.',
    photo: '/images/funding/mok-jareugi/lineup/parkjihwi-20260930.webp',
  },
  'mok-jareugi-next': {
    name: '최양다음 NEXT',
    // 인스타그램 계정은 라인업 공지에 없었다 — 있는 페이스북 프로필로 연결한다.
    sns: 'https://www.facebook.com/profile.php?id=61571311203395',
    bio: '독학으로 음악을 익힌 싱어송라이터입니다.',
    photo: '/images/funding/mok-jareugi/lineup/next-20260930.webp',
  },
  'mok-jareugi-van-kiden': {
    name: 'VAN KIDEN',
    sns: 'https://www.instagram.com/van_kiden/',
    bio: '랩과 싱잉을 오가는 뮤지션입니다.',
    photo: '/images/funding/mok-jareugi/lineup/van-kiden-20260930.webp',
  },
};

const nameLinkClass =
  'break-keep font-bold leading-snug text-gray-900 dark:text-white hover:underline underline-offset-4 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70';

const NameLink = ({ label, sns }: NamedLink) => {
  if (!sns) return <span className="break-keep font-bold leading-snug text-gray-900 dark:text-white">{label}</span>;
  return (
    <a href={sns} target="_blank" rel="noopener noreferrer nofollow" className={nameLinkClass}>
      {label}
      <ExternalLink className="ml-1 inline-block h-3.5 w-3.5 align-baseline text-gray-400 dark:text-gray-500" aria-hidden />
    </a>
  );
};

export default function FundingLineupPerson({ id }: { id: string }) {
  const person = LINEUP_PEOPLE[id];
  if (!person) return null;

  return (
    // 나머지 펀딩 카드(RewardCard 등)와 같은 유리 재질(BaseCard variant="glass")을 쓴다.
    // 손으로 만든 bg-white/80 박스로는 스펙큘러 하이라이트·hover 리프트가 안 붙어 옆
    // 리워드 카드들과 나란히 두면 이 카드만 평평해 보였다(운영자 지적 2026-09-30).
    <BaseCard variant="glass" className="my-3 flex items-start gap-4 p-4">
      <div className="relative h-16 w-16 shrink-0 sm:h-20 sm:w-20">
        <div className="absolute inset-0 overflow-hidden rounded-full">
          <ResponsiveImage
            src={person.photo}
            alt={person.name ? `${person.name} 프로필 사진` : '프로필 사진'}
            fill
            sizes="80px"
            className="object-cover"
          />
        </div>
        {person.photoSecondary && (
          <div className="absolute bottom-0 right-0 h-9 w-9 overflow-hidden rounded-full ring-2 ring-white dark:ring-gray-900 sm:h-11 sm:w-11">
            <ResponsiveImage src={person.photoSecondary} alt="" fill sizes="44px" className="object-cover" />
          </div>
        )}
      </div>
      <div className="min-w-0 text-lg">
        <p>
          {person.people ? (
            person.people.map((p, i) => (
              <span key={p.label}>
                {i > 0 && <span className="text-gray-900 dark:text-white"> x </span>}
                <NameLink {...p} />
              </span>
            ))
          ) : (
            <NameLink label={person.name ?? ''} sns={person.sns} />
          )}
        </p>
        <p className="mt-1 break-keep text-sm leading-relaxed text-gray-600 dark:text-gray-300">{person.bio}</p>
      </div>
    </BaseCard>
  );
}
