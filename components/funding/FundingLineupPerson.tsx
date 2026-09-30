import ResponsiveImage from '../ResponsiveImage';

interface LineupPerson {
  name: string;
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
 */
const LINEUP_PEOPLE: Record<string, LineupPerson> = {
  'mok-jareugi-yangchaae': {
    name: '양차애',
    bio: '사랑노래를 짓고 부릅니다. 잘 패배하는 사람이 되는 것이 꿈입니다.',
    photo: '/images/funding/mok-jareugi/lineup/yangchaae-20260930.webp',
  },
  'mok-jareugi-dj-duo': {
    name: 'DJ스탑원 x DJ괄',
    bio: '두 사람이 번갈아 판을 올리는 b2b 세트입니다.',
    photo: '/images/funding/mok-jareugi/lineup/dj-stopone-20260930.webp',
    photoSecondary: '/images/funding/mok-jareugi/lineup/dj-gwal-20260930.webp',
  },
  'mok-jareugi-sabbaha': {
    name: '사바하',
    bio: '2013년 솔로 프로젝트로 출발해 2023년 듀오가 된 둠드론 밴드입니다.',
    photo: '/images/funding/mok-jareugi/lineup/sabbaha-20260930.webp',
  },
  'mok-jareugi-collins': {
    name: '달 위의 콜린스',
    bio: '홍대 클럽빵을 거점으로 공연해 온 팀입니다.',
    photo: '/images/funding/mok-jareugi/lineup/collins-on-the-moon-20260930.webp',
  },
  'mok-jareugi-parkjihwi': {
    name: '박지휘',
    bio: '프리포크 싱어송라이터입니다.',
    photo: '/images/funding/mok-jareugi/lineup/parkjihwi-20260930.webp',
  },
  'mok-jareugi-next': {
    name: '최양다음 NEXT',
    bio: '독학으로 음악을 익힌 싱어송라이터입니다.',
    photo: '/images/funding/mok-jareugi/lineup/next-20260930.webp',
  },
  'mok-jareugi-van-kiden': {
    name: 'VAN KIDEN',
    bio: '랩과 싱잉을 오가는 뮤지션입니다.',
    photo: '/images/funding/mok-jareugi/lineup/van-kiden-20260930.webp',
  },
};

export default function FundingLineupPerson({ id }: { id: string }) {
  const person = LINEUP_PEOPLE[id];
  if (!person) return null;

  return (
    <div className="my-3 flex items-start gap-4 rounded-xl bg-white/80 p-4 dark:bg-gray-900/50">
      <div className="relative h-16 w-16 shrink-0 sm:h-20 sm:w-20">
        <div className="absolute inset-0 overflow-hidden rounded-full">
          <ResponsiveImage
            src={person.photo}
            alt={`${person.name} 프로필 사진`}
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
      <div className="min-w-0">
        <p className="break-keep text-lg font-bold leading-snug text-gray-900 dark:text-white">{person.name}</p>
        <p className="mt-1 break-keep text-sm leading-relaxed text-gray-600 dark:text-gray-300">{person.bio}</p>
      </div>
    </div>
  );
}
