import { ExternalLink } from '../../lib/lucide-icons';
import LineupCard from '../common/LineupCard';

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
 * 것만 쓴다 — 실제로 열어서 각 계정이 200으로 응답하는 것을 확인함.
 *
 * 소개 문구는 인스타그램 바이오가 아니라 `~/pine-nut/website/src/lib/concert.ts`의
 * `MOK_LINEUP`에서 그대로 가져온다 — pine-nut이 이미 각자의 웹자료(ggac.kr·indistreet.com
 * 등, 없으면 주최 측이 받은 소개글)로 출처를 밝혀 정리해 둔 것이다. 처음 옮길 때 한 줄로
 * 줄였다가(운영자 지적 2026-09-30: "뮤지션 소개는 최대한 풍부할수록 좋아") 원문 그대로
 * 되살렸다 — 인스타그램 바이오 자체는 짧은 태그라인뿐이라("☭", "I was born in a car" 등)
 * 거기서 더 가져올 내용이 없다. 다음에 라인업이 바뀌면 이 파일이 아니라 pine-nut의
 * concert.ts를 먼저 볼 것 — 정본은 거기다.
 *
 * 사람이 하나면 카드 전체를 `BaseCard`의 `href`로 링크한다(운영자 지적 2026-09-30: "이름
 * 옆 새창 아이콘 말고 카드를 누르면 이동하는 게 낫다") — `BaseCard`가 이미 다른 펀딩 카드와
 * 같은 hover 리프트·press 스케일을 링크에 붙여 준다. 듀오(사람 둘, SNS 둘)는 카드 하나를
 * 한 링크로 감쌀 수 없어 그때만 이름별로 따로 링크한다(아이콘 유지 — 카드 자체가 안
 * 눌리니 "이 글자가 링크다"를 알려줘야 한다).
 */
export const LINEUP_PEOPLE: Record<string, LineupPerson> = {
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
    bio: '두 사람이 번갈아 판을 올리는 b2b 세트. 마을회관 앞마당에 턴테이블이 놓입니다. 노래가 멎은 자리를 비트가 이어받습니다.',
    photo: '/images/funding/mok-jareugi/lineup/dj-stopone-20260930.webp',
    photoSecondary: '/images/funding/mok-jareugi/lineup/dj-gwal-20260930.webp',
  },
  'mok-jareugi-sabbaha': {
    name: '사바하',
    sns: 'https://www.instagram.com/sabbaha_kr/',
    // 출처: ggac.kr/artists/sabbaha (pine-nut concert.ts에 이미 정리돼 있던 소개).
    bio: "2013년 솔로 프로젝트로 출발해 2023년 듀오로 자리잡은 둠드론 밴드. 리더 The Slaughter의 기타·보컬에 2025년 드러머 The Mortician이 합류해 서울·수원을 기반으로 활동합니다. 스스로 '사이비 오컬트 둠드론'이라 부릅니다. 2024년 정규 「THUNDER ROCKS」.",
    photo: '/images/funding/mok-jareugi/lineup/sabbaha-20260930.webp',
  },
  'mok-jareugi-collins': {
    name: '달 위의 콜린스',
    sns: 'https://www.instagram.com/c011ins_0n_the_m00n/',
    // 출처: indistreet.com/ko/artists/dalwiyikolrinseu
    bio: '홍대 클럽빵을 거점으로 공연해온 팀. 2025년 가을 두 달 사이에 싱글 「비둘기의 失樂園」·「PM 7:37」과 EP 「19.8㎡에서의 漂流記」, 앨범 「Thief 86」을 잇달아 냈습니다.',
    photo: '/images/funding/mok-jareugi/lineup/collins-on-the-moon-20260930.webp',
  },
  'mok-jareugi-parkjihwi': {
    name: '박지휘',
    sns: 'https://www.instagram.com/sickbaby109/',
    bio: "프리포크 싱어송라이터. 일러스트레이터 2da(이다)의 그림에서 따온 'sickbaby'라는 이름으로도 불렀습니다. 로파이한 프리포크로 시작해, 근래에는 엘리엇 스미스의 새드코어에 기운 곡을 씁니다.",
    photo: '/images/funding/mok-jareugi/lineup/parkjihwi-20260930.webp',
  },
  'mok-jareugi-next': {
    name: '최양다음 NEXT',
    // 라인업 공지엔 인스타그램 계정이 없어 페이스북 프로필로 연결했었다. 운영자가 실제 인스타그램 계정을 찾아 주어
    // 바꿨다(2026-10-04, 브라우저로 열어 'NEXT 최양다음 CHOIYANGDAEUM' 프로필 확인).
    sns: 'https://www.instagram.com/nextisnexttoyou/',
    // 출처: 본인이 공개한 링크트리 이력서. pine-nut이 이미 4개로 추려 둔 것을 그대로 쓴다
    // (원문엔 더 많은 공연 이력이 있으나 다 넣으면 문장이 아니라 목록이 된다고 판단했다).
    bio: "독학으로 음악을 익힌 싱어송라이터. 아버지 성 '최'와 어머니 성 '양'에 '다음'을 붙인 이름으로, 호주제에 맞선다는 뜻을 담아 지었습니다. 그 이름을 여러 나라 말로 씁니다 — 다음, NEXT, 次, Nächste, 翌. 세월호 10주기 추모, 수요시위, 팔레스타인 연대 집회, 5·18 기념식 같은 자리에서 노래해왔습니다.",
    photo: '/images/funding/mok-jareugi/lineup/next-20260930.webp',
  },
  'mok-jareugi-van-kiden': {
    name: 'VAN KIDEN',
    sns: 'https://www.instagram.com/van_kiden/',
    bio: '랩과 싱잉을 오가는 뮤지션. 2022년 싱글 「LIGHT」로 데뷔했습니다. 느끼는 감정을 그대로 전하고, 스스로에게 부끄럽지 않은 음악을 만들어가려 합니다.',
    photo: '/images/funding/mok-jareugi/lineup/van-kiden-20260930.webp',
  },
  // 9·19 집회(keep-singing-for-palestine) 출연진 — 집회 뒤 후기 개편 때 절이 통째로 빠졌다가
  // 아카이빙을 위해 되살렸다(2026-09-30 운영자 요청). 소개는 삭제 직전 본문 그대로다.
  // SNS 링크는 운영자가 직접 준 목록(2026-09-30)을 따른다.
  'keep-singing-for-palestine-momo': {
    name: '모모',
    sns: 'https://www.instagram.com/momoismothermother/',
    bio: '모모는 예진 안젤라 박과 황슬기의 재즈 듀오입니다. 즉흥과 실험을 밑천으로 삼되, 그 소리가 향하는 곳은 분쟁지역의 평범한 하루와 그 안에 깔린 긴장입니다. 앨범에 실은 〈If this can be tolerated, what can\'t be?〉는 단 한 줄의 가사를 끝없이 되풀이하며 우리의 무감각을 묻습니다.',
    photo: '/images/funding/keep-singing-for-palestine/lineup/momo.webp',
  },
  'keep-singing-for-palestine-lee-seoyoung': {
    name: '이서영',
    sns: 'https://www.instagram.com/leesyoung.kr/',
    bio: '이서영은 숲해설가이면서 노래를 만듭니다. 나무를 설명하는 일과 노래를 만드는 일이 그에게는 같은 일인 듯합니다. 포크에 앰비언트와 일렉트로닉을 섞고, 맑고 서늘한 음색으로 고독과 공존을 노래합니다. 앨범에 실은 〈우리〉는 대학 시절에 쓴 곡을 10년 만에 다시 꺼내 고쳐 쓴 것입니다.',
    photo: '/images/funding/keep-singing-for-palestine/lineup/lee-seoyoung.webp',
  },
  'keep-singing-for-palestine-lee-hyeongju': {
    name: '이형주',
    sns: 'https://www.instagram.com/hyungju1218/',
    bio: '이형주는 핑거스타일 블루스에 포크와 재즈를 섞어 연주합니다. 2017년부터 새 민중음악 선곡집에 참여하며 사회적 폭력이 있는 현장을 찾아다녔고, 2019년 EP 〈아토피〉와 2023년 정규 〈우리는 서로를 간직 하려고〉를 냈습니다.',
    photo: '/images/funding/keep-singing-for-palestine/lineup/lee-hyeongju.webp',
  },
  'keep-singing-for-palestine-namsu': {
    name: '남수',
    sns: 'https://www.instagram.com/namsu_ggu/',
    bio: '남수는 인디와 포크, 블루스와 재즈를 오가며 노래하고, 〈딱따구리 책방〉이라는 문화공간을 꾸립니다. 앨범 네 번째 곡 〈안녕 (먼 곳의 그대에게)〉이 그의 노래입니다. 가사에 "나의 이름을 모르는 그대에게"라는 구절이 있는데, 앨범 제목과 같은 자리에서 나온 말처럼 들립니다. 남수는 이 곡을 두고 "멀리에 있지만 같은 마음과 소망을 품은 우리, 이름을 모르지만 서로의 안녕을 바라는 우리"라고 했습니다.',
    photo: '/images/funding/keep-singing-for-palestine/lineup/namsu.webp',
  },
  'keep-singing-for-palestine-imjeongdeuk': {
    name: '임정득',
    sns: 'https://www.instagram.com/imjeongdeuk/',
    bio: "임정득은 영남대학교 노래패 '예사가락'에서 음악을 시작한 민중가수입니다. 2011년 데뷔 이후 거의 매년 단독 콘서트와 음반을 발표하며, 모든 앨범을 직접 프로듀싱하고 대부분의 수록곡을 작사·작곡합니다. 밀양 송전탑 투쟁, 노동자 고공농성 현장, 세월호 유가족 농성장 등 사회운동 현장의 무대에서 활동해 왔고, 대표곡 〈소금꽃나무〉는 김진숙의 동명 책에서 영감을 받았습니다.",
    photo: '/images/funding/keep-singing-for-palestine/lineup/imjeongdeuk.webp',
  },
  'keep-singing-for-palestine-dj-eve': {
    name: 'DJ 이브',
    // 운영자가 준 링크(2026-09-30) — 개인 계정이 아니라 활동 프로젝트 '저항과 소음' 계정이다.
    sns: 'https://www.instagram.com/noise_for_protest/',
    bio: "DJ 이브(Yves)는 '저항과 소음 Noise For Protest'에서 활동합니다. 저항과 소음은 가자지구 집단학살 종식을 위해 팔레스타인 연대 단체와 DJ들이 모인 프로젝트로, 음악과 춤을 통해 집단학살 반대의 움직임을 가시화합니다. 6월 '팔레스타인을 위한 자긍심, 저항과 소음(Pride Noise for Palestine)'을 비롯해 연대 무대에 꾸준히 서 왔습니다.",
    photo: '/images/funding/keep-singing-for-palestine/lineup/dj-eve.webp',
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
    // 카드 모양은 공연 상세와 공유하는 LineupCard — 사람이 하나면 카드 전체가 SNS 링크,
    // 듀오(사람 둘, SNS 둘)는 카드 하나를 한 링크로 감쌀 수 없어 이름별로 따로 링크한다.
    <LineupCard
      className="my-3"
      photo={person.photo}
      photoSecondary={person.photoSecondary}
      photoAlt={person.name ? `${person.name} 프로필 사진` : '프로필 사진'}
      href={!person.people ? person.sns : undefined}
      bio={person.bio}
      name={
        person.people
          ? person.people.map((p, i) => (
              <span key={p.label}>
                {i > 0 && <span> x </span>}
                <NameLink {...p} />
              </span>
            ))
          : person.name
      }
    />
  );
}
