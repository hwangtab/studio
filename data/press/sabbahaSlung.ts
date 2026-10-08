/**
 * 사바하 《SLUNG》 비공개 감상실(pages/[locale]/press/sabbaha-slung.tsx)의 문안 — 한국어·영어.
 *
 * 출처는 사바하가 직접 낸 글이다: sabbaha.kr(/profile·/slung·/discography·/shows·/contact), 밴드캠프
 * (yahoyahodan.bandcamp.com), 펀딩 페이지(content/funding/sabbaha-slung.md). 2026-10-06에 읽었다.
 * - 따옴표 안의 가사·곡 소개는 sabbaha.kr/slung의 부클릿 원문 그대로다 — 다듬지 않는다.
 * - 한국어 곡 소개의 영어 번역은 밴드가 낸 것이 없어 우리가 옮겼다. 화면에 "our translation"으로 밝힌다.
 * - 바뀌는 숫자(공연 횟수)는 기준 날짜를 함께 적는다.
 * - 잼스탬프는 Zsthyger가 운영하는 회사다(운영자 확인 2026-10-08) — sabbaha.kr 크레딧에는 없지만 함께한 곳에 넣는다.
 * - 출처끼리 어긋나는 것: 발매 시기(사이트 "2026년 10월 예정" vs 펀딩 "2027년 초") — 펀딩 일정(12월 인쇄)을 따랐다.
 *
 * 이 파일은 공개 저장소에 있다. 음원은 비밀이지만 소개 문안은 이미 공개된 정보만 둔다.
 */

export type Lang = 'ko' | 'en';
export type Localized = Readonly<Record<Lang, string>>;

export interface TrackNote {
  text: Localized;
  subtitle?: Localized;
  /** 부클릿 트랙 목록의 "(Instrument)" 표기를 따른다. */
  instrumental?: boolean;
  /** 가사에 욕설이 있다 — 방송 매체 참고. */
  explicit?: boolean;
  /** 원문 그대로(줄바꿈 \n). 영어 화면에서만 translation을 함께 보인다. */
  quote?: { original: string; translation?: string; source: Localized };
}

const BOOKLET_LYRIC = (title: string): Localized => ({ ko: `〈${title}〉 가사`, en: `from the lyrics of “${title}”` });
const BOOKLET_NOTE: Localized = { ko: '부클릿 곡 소개', en: 'booklet note (our translation)' };

export const SLUNG_PRESS = {
  ui: {
    privateBadge: { ko: '비공개', en: 'Private' },
    coverAlt: {
      ko: '《SLUNG》 앞표지 — 검은 물 위에 두 팔을 벌리고 누운 사람의 몸이 흰 물보라로 번져 있다',
      en: 'SLUNG front cover — a body lying arms outstretched on black water, dissolving into white spray',
    },
    embargo: {
      ko: '발매 전 음원입니다. 이 페이지에서만 들어 주시고, 녹음하거나 다른 곳에 올리지 말아 주세요.',
      en: 'These recordings are unreleased. Please listen on this page only, and do not record, share or upload them.',
    },
    shortcuts: { ko: '스페이스바로 재생·정지, ← → 키로 10초씩 옮겨 갑니다.', en: 'Space to play or pause, ← → to move 10 seconds.' },
    explicit: { ko: '욕설 포함', en: 'Explicit' },
    footer: { ko: '이 페이지는 스튜디오 놀이 운영합니다.', en: 'This page is hosted by Studio NOL.' },
    metaDescription: {
      ko: '사바하 정규 2집 《SLUNG》 — 평론가·매체를 위한 비공개 감상 페이지',
      en: 'SABBAHA — SLUNG. A private advance-listening page for critics and media.',
    },
  },

  gate: {
    lead: {
      ko: '사바하 정규 2집 《SLUNG》을 발매 전에 들으실 수 있는 비공개 페이지입니다. 링크와 함께 받으신 비밀번호를 입력해 주세요.',
      en: 'This private page lets you hear SLUNG, the second full-length album by Sabbaha, before its release. Please enter the password that came with your invitation.',
    },
    passwordLabel: { ko: '비밀번호', en: 'Password' },
    submit: { ko: '들어가기', en: 'Enter' },
    errorPassword: {
      ko: '비밀번호가 맞지 않습니다. 받으신 메일의 비밀번호를 다시 확인해 주세요.',
      en: 'That password is not correct. Please check the one in your invitation.',
    },
    errorLimit: {
      ko: '여러 번 틀렸습니다. 15분 뒤에 다시 입력해 주세요.',
      en: 'Too many attempts. Please try again in 15 minutes.',
    },
    help: { ko: '비밀번호를 받지 못하셨다면 이 주소로 연락 주세요.', en: 'Did not receive a password? Write to' },
  },

  hero: {
    kicker: { ko: '정규 2집 · 발매 전 감상', en: 'Second full-length · Advance listening' },
    statement: {
      ko: '생명과 죽음이 뒤섞인 혼돈의 늪에서 건져낸 소리들.',
      en: 'Sounds dredged up from a chaotic swamp where life and death are mixed together.',
    },
    statementBy: { ko: '사바하의 앨범 소개', en: 'Sabbaha, on the album (our translation)' },
    facts: [
      { ko: 'CD 2장', en: '2 CDs' },
      { ko: '13곡', en: '13 tracks' },
      { ko: '1시간 37분 55초', en: '1:37:55' },
      { ko: '2027년 초 발매', en: 'Out early 2027' },
    ],
  },

  album: {
    eyebrow: { ko: '앨범', en: 'The album' },
    title: { ko: '《SLUNG》', en: 'SLUNG' },
    paragraphs: [
      {
        ko: '《SLUNG》은 사바하의 두 번째 정규 앨범입니다. CD 두 장에 13곡, 1시간 37분 55초가 담겼고, 2027년 초 CD로 나옵니다. 2024년 1집 《THUNDER ROCKS》는 The Slaughter가 혼자 만든 앨범이었습니다. 드럼도 프로그래밍으로 짰습니다. 《SLUNG》은 드러머 The Mortician이 합류한 뒤 두 사람이 함께 녹음한 첫 정규 앨범입니다.',
        en: 'SLUNG is Sabbaha’s second full-length album: thirteen tracks across two CDs, running 1:37:55, out on CD in early 2027. The 2024 debut THUNDER ROCKS was a one-man record — The Slaughter played everything and programmed the drums. SLUNG is the first full-length the band has recorded as a duo, with drummer The Mortician.',
      },
      {
        ko: '첫 번째 CD는 노래하는 곡들입니다. 불교에서 헤아릴 수 없이 긴 시간을 뜻하는 겁(劫)을 제목으로 삼은 〈Kalpa〉로 열고, 죽음을 죽이는 야만타카를 다룬 〈Yama〉를 지나면, 8초짜리 일갈 〈喝〉이 그 명상을 끊습니다. 그다음부터는 지금 사람들의 이야기입니다. 은행 일곱 곳과 보험사 아홉 곳에서 거절당한 빚(〈Debt Shroud〉), 사회에 받아들여지지 못한 사람(〈Apprentice’s Work〉), 도파민에 목마른 삶(〈Dopaminethirster〉). 그 사이에 앰프 앞에 무릎 꿇고 퍼즈의 신을 섬기라고 외치는 〈Warlock〉이 있습니다.',
        en: 'The first CD is the sung half. It opens with “Kalpa,” named for the Buddhist aeon too long to count, passes through “Yama,” a hymn to Yamantaka, the slayer of death — and then “喝,” an eight-second shout, breaks the meditation. From there the record turns to people now: a debt turned away by seven banks and nine insurers (“Debt Shroud”), someone society will not let in (“Apprentice’s Work”), a life that thirsts for dopamine (“Dopaminethirster”). In between, “Warlock” kneels before the amplifier and calls on the listener to worship the fuzz god.',
      },
      {
        ko: '두 번째 CD는 8분에서 15분에 이르는 긴 곡 다섯 곡, 58분 42초입니다. 엘리트주의의 제단, 교령회, 세 권력, 납골당, 돌. 가사 대신 부클릿에 실린 짧은 곡 소개가 곡의 방향을 가리킵니다. 앨범은 “성자필멸(盛者必滅)”, 성한 것은 반드시 쇠한다는 한 줄을 단 〈Stone〉으로 끝납니다.',
        en: 'The second CD holds five long pieces, eight to fifteen minutes each and 58:42 in total: an altar to elitism, a séance, the three branches of power, an ossuary, a stone. Instead of lyrics, short notes in the booklet point each one in its direction. The album closes with “Stone,” whose note is four characters: 盛者必滅 — whatever flourishes must fall.',
      },
      {
        ko: '여러 곡에 앞선 모습이 있습니다. 〈Debt Shroud〉·〈Apprentice’s Work〉·〈Dopaminethirster〉·〈Stone〉은 《THUNDER ROCKS》에 먼저 실렸던 곡이고, 〈Kalpa〉와 〈Yama〉는 2025년 11월 한정판 싱글 《KALPA + YAMA》로, 〈The Altar of The Holy Elitism〉과 〈Triocracy〉는 부틀렉 연작 《The Secret Arts of Fuzz Worship》에 먼저 나왔습니다. 《SLUNG》은 2023년부터 무대에서 다듬어 온 곡들을 듀오 편성으로 한데 모은 기록이기도 합니다.',
        en: 'Many of these songs have earlier lives. “Debt Shroud,” “Apprentice’s Work,” “Dopaminethirster” and “Stone” first appeared on THUNDER ROCKS; “Kalpa” and “Yama” on the limited single KALPA + YAMA in November 2025; “The Altar of The Holy Elitism” and “Triocracy” on the bootleg series The Secret Arts of Fuzz Worship. SLUNG gathers material worked on stage since 2023 into its duo form.',
      },
      {
        ko: '녹음과 믹싱, 프로듀싱은 ACME Studio의 Zsthyger가 맡았고, 〈Debt Shroud〉에서는 기타도 한 대 더했습니다. 믹싱과 마스터링은 스튜디오 놀이 했습니다. 사바하는 이 앨범을 부클릿, 브라우저 던전 게임 《초저주파》, 공연 영상과 함께 하나의 세계로 내놓습니다.',
        en: 'The album was recorded, mixed and produced by Zsthyger at ACME Studio, who also adds a guitar to “Debt Shroud”; mixing and mastering are by Studio NOL. Sabbaha present the record as one world together with its booklet, a browser dungeon game called 초저주파 (“Infrasound”) and their live visuals.',
      },
    ] as readonly Localized[],
  },

  trackNotes: {
    eyebrow: { ko: '곡 소개', en: 'Track by track' },
    title: { ko: '열세 곡', en: 'Thirteen tracks' },
    lead: {
      ko: '인용은 부클릿 원문입니다.',
      en: 'Quotations are from the booklet. The Korean notes have no official English version; translations are ours.',
    },
  },

  tracks: {
    kalpa: {
      text: {
        ko: '앨범을 여는 곡. 겁(劫), 불교에서 헤아릴 수 없이 긴 시간을 뜻하는 말입니다. 가사는 옛 인도 문자 싯담으로 적은 산스크리트로 시작해 한국어로 이어집니다. 2025년 11월 한정판 싱글 《KALPA + YAMA》로 먼저 선보였습니다.',
        en: 'The opener. A kalpa is the Buddhist aeon, a span of time beyond counting. The lyrics begin in Sanskrit written in Siddham, an old Indian script, then turn to Korean. First issued on the limited single KALPA + YAMA in November 2025.',
      },
      quote: {
        original: '영원에서 빌려온\n단 한 찰나를\n살며…살며…\n\n마치 무한을 소유한 듯\n오만하게 노래하는구나…',
        translation: 'Living, living\none single instant\nborrowed from eternity…\n\nas if you owned the infinite\nyou sing so arrogantly…',
        source: { ko: '〈Kalpa〉 가사', en: 'from the lyrics of “Kalpa” (our translation)' },
      },
    },
    yama: {
      instrumental: true,
      text: {
        ko: '죽음의 신 야마, 그리고 그 죽음을 꺾는 문수보살의 분노한 모습 야만타카(대위덕명왕). 곡 소개는 야만타카의 진언으로 끝납니다.',
        en: 'Yama, the god of death, and Yamantaka, the wrathful form of the bodhisattva Manjushri who defeats him. The booklet note ends with Yamantaka’s mantra.',
      },
      quote: {
        original: '죽음을 죽이는 자\n문수보살의 현현\n이원론을 박살내는 지혜\n그리고 분노\n\n첫 번째 죽음인 야마는 야만타카에 굴복한다.',
        translation: 'The one who kills death,\nmanifestation of Manjushri,\nwisdom that smashes dualism,\nand wrath.\n\nYama, the first death, yields to Yamantaka.',
        source: BOOKLET_NOTE,
      },
    },
    kal: {
      instrumental: true,
      subtitle: { ko: '갈', en: '“Kal” — the shout' },
      text: {
        ko: '8초. 선승이 깨달음을 재촉하며 내지르는 일갈(喝)입니다. 사바하는 이것을 ‘갈’로 읽고, 앞선 두 곡의 명상을 끊는 소리로 둡니다.',
        en: 'Eight seconds. 喝 is the shout a Zen master hurls at a student to break them open. Sabbaha read it as “kal” and place it where it snaps the meditation of the first two tracks.',
      },
      quote: { original: '갈喝.', source: { ko: '부클릿 원문', en: 'booklet' } },
    },
    warlock: {
      text: {
        ko: '앰프와 이펙터를 섬기는 찬가. 위저드도 소서러도 아닌, 자기보다 거대한 소리의 힘을 빌려 노래하는 자가 워록입니다.',
        en: 'A hymn to the amplifier and the fuzz pedal. The warlock here is neither trained wizard nor born sorcerer, but one who borrows the power of a sound far larger than himself.',
      },
      quote: {
        original: 'Kneel before the sunn altar\nRise up my child\n\nWorship the fuzz god\nWarlocks of the tower',
        source: BOOKLET_LYRIC('Warlock'),
      },
    },
    'debt-shroud': {
      explicit: true,
      text: {
        ko: '갚을 수 없는 빚이 수의처럼 덮어 오는 노래. 1집에 먼저 실렸던 곡입니다. 프로듀서 Zsthyger가 기타를 한 대 더했습니다. 가사 마지막 줄에 욕설이 있습니다.',
        en: 'A debt that can never be paid off, settling over you like a shroud. The song first appeared on THUNDER ROCKS; producer Zsthyger adds a second guitar here. The last line of the lyric is profane.',
      },
      quote: {
        original: 'Can’t get along\nAnd Can’t get a loan\nDenied by seven banks\nAnd nine insurances',
        source: BOOKLET_LYRIC('Debt Shroud'),
      },
    },
    'apprentices-work': {
      text: {
        ko: '세상이 반기지 않는 것을 계속 만드는 사람, 사회에 녹아들지 못하는 사람의 노래. 1집에 먼저 실렸던 곡입니다.',
        en: 'For the one who keeps making things the world does not want, and so never quite fits in. First heard on THUNDER ROCKS.',
      },
      quote: {
        original: 'You don’t possess\nThe social acceptance\nThe one who’s fallen\nFrom the race for existence',
        source: BOOKLET_LYRIC('Apprentice’s Work'),
      },
    },
    dopaminethirster: {
      text: {
        ko: '아무것에도 집중하지 못한 채 도파민을 갈구하는 뇌, 그것마저 운명으로 주어졌다는 깨달음. 1집에 먼저 실렸던 곡입니다.',
        en: 'A brain that cannot hold its focus and craves dopamine like a zombie — and the realisation that this, too, is a fate handed down. First heard on THUNDER ROCKS.',
      },
      quote: {
        original: 'Dopaminethirster\nSatiated with your suffer',
        source: BOOKLET_LYRIC('Dopaminethirster'),
      },
    },
    xthaua: {
      instrumental: true,
      text: {
        ko: '첫 번째 CD를 닫는 32초. 제목은 로그라이크 게임 〈Dungeon Crawl Stone Soup〉의 고대 용 ‘Xtahua’에서 왔습니다. 이름을 잘못 읽은 것이 그대로 공연의 구호 “싸! 후! 아!”가 됐고, 부클릿에는 한마디만 적혀 있습니다.',
        en: 'Thirty-two seconds to close the first CD. The title comes from Xtahua, an ancient dragon in the roguelike Dungeon Crawl Stone Soup. A misreading of the name became a live chant — “Ssa! Hu! A!” — which sounds like the Korean for “Fight!”, the single word printed in the booklet.',
      },
      quote: { original: '싸워!', translation: 'Fight!', source: { ko: '부클릿 원문', en: 'booklet' } },
    },
    altar: {
      instrumental: true,
      text: {
        ko: '15분 가까운 곡. 곡 소개는 사바하가 아니라 엘리트주의자의 목소리로 쓴 설교입니다. 앞선 판본이 부틀렉 《The Secret Arts of Fuzz Worship Vol. II》에 있습니다.',
        en: 'Nearly fifteen minutes. The booklet note is a sermon written in the voice of the elite, not the band’s. An earlier version appears on the bootleg The Secret Arts of Fuzz Worship Vol. II.',
      },
      quote: {
        original: '능력은 신성함이며, 주님이 주신 은총이다.\n주님의 은총으로 세상을 빚어나가는 것은 우리의 사명이다.\n그대는 도전하지말라.',
        translation: 'Ability is holiness, a grace bestowed by the Lord.\nTo shape the world by the Lord’s grace is our mission.\nThou shalt not challenge.',
        source: BOOKLET_NOTE,
      },
    },
    seance: {
      instrumental: true,
      text: {
        ko: '죽은 이를 불러내는 교령회. 곡 소개는 무아와 즉흥으로 시작합니다.',
        en: 'A séance, the rite of calling up the dead. The note begins with selflessness and improvisation.',
      },
      quote: {
        original: '무아와 즉흥, 혼돈.\n신의 이름, 구원의 갈구 그리고 성복축.',
        translation: 'No-self and improvisation, chaos.\nThe name of god, a thirst for salvation, and benediction.',
        source: BOOKLET_NOTE,
      },
    },
    triocracy: {
      instrumental: true,
      text: {
        ko: '셋이 다스리는 체제. 입법·행정·사법을 라틴어 비슷하게 부른 세 단어가 곡 소개의 전부입니다. 라이브 판본이 부틀렉 《The Secret Arts of Fuzz Worship Vol. II》에 있습니다.',
        en: 'Rule by three. The whole booklet entry is three mock-Latin words for the legislative, executive and judicial powers. A live version appears on The Secret Arts of Fuzz Worship Vol. II.',
      },
      quote: { original: 'Legislatus,\nExecutor,\nJudicatus,', source: { ko: '부클릿 원문', en: 'booklet' } },
    },
    ossuary: {
      instrumental: true,
      text: {
        ko: '뼈를 모아 두는 납골당. 2024년 15분짜리 싱글 〈Prelude to Ossuary〉가 이 곡으로 가는 길을 미리 열었습니다.',
        en: 'An ossuary, where the bones are kept. The fifteen-minute 2024 single “Prelude to Ossuary” paved the way to it.',
      },
      quote: {
        original: '모든 것을 앗아간다던 죽음마저 채 빼앗지 못한 것들이 있다.',
        translation: 'There are things that even death, which they said takes everything, could not quite take away.',
        source: BOOKLET_NOTE,
      },
    },
    stone: {
      instrumental: true,
      text: {
        ko: '앨범의 마지막 곡이자 가장 오래된 곡. 2023년 작업 중이던 데모부터 1집, 부틀렉을 거쳐 여기에 왔습니다.',
        en: 'The last track and the oldest song on the album. It has travelled from a 2023 work-in-progress demo through THUNDER ROCKS and the bootlegs to arrive here.',
      },
      quote: {
        original: '성자필멸(盛者必滅).',
        translation: 'Whatever flourishes must fall.',
        source: BOOKLET_NOTE,
      },
    },
  } as Readonly<Record<string, TrackNote>>,

  artist: {
    eyebrow: { ko: '아티스트', en: 'The artist' },
    title: { ko: '사바하', en: 'Sabbaha' },
    paragraphs: [
      {
        ko: '사바하는 서울과 수원을 기반으로 활동하는 듀오입니다. The Slaughter가 기타와 보컬, 퍼커션, 신시사이저를, The Mortician이 드럼과 서브보컬, 퍼커션을 맡습니다. 드론메탈과 슬러지 둠, 즉흥연주를 오가는 자기 음악을 둘은 ‘사이비 오컬트 둠드론’이라고 부릅니다. 2023년 The Slaughter 혼자 시작했고, 2025년 The Mortician이 들어와 지금의 편성이 됐습니다.',
        en: 'Sabbaha is a duo based in Seoul and Suwon, South Korea. The Slaughter plays guitar and sings, adding percussion and synthesizer; The Mortician plays drums and percussion and sings backing vocals. Moving between drone metal, sludge doom and improvisation, they call what they do “pseudo-occult doom drone.” The Slaughter started the project alone in 2023; The Mortician joined in 2025.',
      },
      {
        ko: '이름은 범어 ‘스바하(svāhā)’ — 불교 진언 끝에 붙는 “이루어지게 하소서” — 와 마녀들의 연회를 가리키는 영어 ‘Sabbath’를 합친 말입니다. 로고는 끝과 끝이 이어지지 않는 원 세 개입니다. 삼보로도, 삼태극으로도, 666으로도 읽히는 이 배치를 사바하는 불완전과 벗어남의 표시라고 설명합니다.',
        en: 'The name joins the Sanskrit svāhā — “let it be done,” the word that closes Buddhist mantras — to the English Sabbath, the witches’ feast. The logo is three circles whose ends never meet. It can be read as the Triratna, the Samtaegeuk or 666; the band describes the open gaps as a mark of imperfection and departure.',
      },
      {
        ko: '공연은 두 부분으로 나뉩니다. 앞부분은 둠드론입니다. 유령의 모습을 한 사바하가 큰 음량과 긴 드론으로 절대자의 위압과 권위를 흉내 냅니다. 우러러서가 아니라 건조하게 그려 보이는 것이고, 알아듣기 어렵게 뭉갠 목소리로 그 뜻을 비틀어 조롱합니다. 뒷부분은 둠메탈입니다. 유령의 탈을 벗고 사람으로 돌아온 순간 다시 21세기 서울의 고통에 붙들리고, 그 고통을 대지의 드럼과 하늘의 퍼즈 기타, 사람의 목소리로 연주합니다.',
        en: 'Their shows come in two parts. First, doom drone: dressed as ghosts, Sabbaha imitate the crushing authority of the Absolute with sheer volume and long drones — not out of reverence but as a dry portrayal, mocking that will by smearing it through an unintelligible voice. Then, doom metal: the ghostly disguise comes off, and back in human form they are caught once more in the pain of twenty-first-century Seoul — played out by drums as the earth, fuzz guitar as the heavens and the voice as the human between them.',
      },
      {
        ko: '2023년 12월 31일 첫 무대 뒤로 2026년 10월까지 85번 공연했습니다. 신촌 딥퍼플, 망원 클럽 샤프, 수원 D.O.T., 부산 클럽 리얼라이즈, 대구 클럽 헤비 같은 무대에 섰고, 서울 프린지 페스티벌과 제주 강정 피스앤뮤직캠프에도 나갔습니다. 2024년부터는 멕시코 출신 둠 음악가 Nahua와 함께 둠·익스트림 공연 시리즈 〈저주파 CURSEWAVE+LOWFREQUENCY〉를 열며 서울의 둠·스토너·슬러지 씬을 넓혀 왔고, 2026년에는 한일 헤비 밴드를 모은 〈ABYSS MASS FEST〉를 꾸렸습니다. 11월 1일에는 도쿄 하타가야 Club Heavy Sick에서 첫 해외 공연을 합니다.',
        en: 'Since their first show on 31 December 2023 they have played 85 times (as of October 2026) — at Club Deep Purple in Sinchon, Club Sharp in Mangwon, D.O.T. in Suwon, Club Realize in Busan and Club Heavy in Daegu, as well as Seoul Fringe Festival and the Gangjeong Peace & Music Camp on Jeju. Since 2024 they have co-run CURSEWAVE+LOWFREQUENCY (저주파), a doom and extreme-music series, with the Mexican-born, Seoul-based doom musician Nahua, aiming to build Seoul’s doom, stoner and sludge scene; in 2026 the pair curated ABYSS MASS FEST, bringing Korean and Japanese heavy bands together. On 1 November 2026 Sabbaha play their first show abroad, at Club Heavy Sick in Hatagaya, Tokyo.',
      },
    ] as readonly Localized[],
    facts: [
      { label: { ko: '멤버', en: 'Members' }, value: { ko: 'The Slaughter — 기타·보컬·퍼커션·신시사이저\nThe Mortician — 드럼·서브보컬·퍼커션', en: 'The Slaughter — guitar, vocals, percussion, synthesizer\nThe Mortician — drums, backing vocals, percussion' } },
      { label: { ko: '활동 지역', en: 'Based in' }, value: { ko: '서울·수원', en: 'Seoul and Suwon, South Korea' } },
      { label: { ko: '장르', en: 'Genre' }, value: { ko: '둠메탈·드론메탈·슬러지 둠·즉흥\n스스로 부르는 이름은 ‘사이비 오컬트 둠드론’', en: 'Doom metal, drone metal, sludge, improvisation\nIn their own words: “pseudo-occult doom drone”' } },
      { label: { ko: '공연', en: 'Live' }, value: { ko: '2023년 12월 31일 첫 무대\n85회(2026년 10월 기준)\n2026년 11월 1일 도쿄 첫 해외 공연', en: 'First show 31 December 2023\n85 shows as of October 2026\nFirst overseas show: Tokyo, 1 November 2026' } },
      { label: { ko: '디스코그래피', en: 'Discography' }, value: { ko: '《THUNDER ROCKS》 정규 1집(2024)\n〈Prelude to Ossuary〉 싱글(2024)\n《The Secret Arts of Fuzz Worship》 부틀렉 Vol. I(2025)·Vol. II(2026)\n《KALPA + YAMA》 한정판 싱글(2025)\n《SLUNG》 정규 2집(2027)', en: 'THUNDER ROCKS, LP (2024)\n“Prelude to Ossuary,” single (2024)\nThe Secret Arts of Fuzz Worship, bootlegs Vol. I (2025), Vol. II (2026)\nKALPA + YAMA, limited single (2025)\nSLUNG, LP (2027)' } },
      { label: { ko: '레이블', en: 'Label' }, value: { ko: '야호야호단', en: 'Yahoyahodan (Seoul)' } },
    ],
  },

  credits: {
    eyebrow: { ko: '크레딧', en: 'Credits' },
    title: { ko: '함께 만든 사람들', en: 'Who made it' },
    rows: [
      { role: { ko: '기타·보컬·퍼커션·신시사이저', en: 'Guitar, vocals, percussion, synthesizer' }, name: { ko: 'The Slaughter', en: 'The Slaughter' } },
      { role: { ko: '드럼·서브보컬·퍼커션', en: 'Drums, backing vocals, percussion' }, name: { ko: 'The Mortician', en: 'The Mortician' } },
      { role: { ko: '녹음·믹싱·프로듀싱', en: 'Recording, mixing, production' }, name: { ko: 'Zsthyger, ACME Studio', en: 'Zsthyger, ACME Studio' } },
      { role: { ko: '〈Debt Shroud〉 기타', en: 'Guitar on “Debt Shroud”' }, name: { ko: 'Zsthyger', en: 'Zsthyger' } },
      { role: { ko: '믹싱·마스터링', en: 'Mixing, mastering' }, name: { ko: '스튜디오 놀', en: 'Studio NOL' } },
      { role: { ko: '그래픽 디자인', en: 'Graphic design' }, name: { ko: '김정현', en: 'Kim Junghyun' } },
    ],
    note: {
      ko: '야호야호단, 잼스탬프, 경기아트콜렉티브협동조합이 함께했습니다.',
      en: 'With Yahoyahodan, Jamstamp and the Gyeonggi Art Collective Cooperative.',
    },
  },

  photos: [
    {
      src: '/images/funding/sabbaha-slung/album-front-20260928.webp',
      alt: { ko: '《SLUNG》 앞표지', en: 'SLUNG front cover' },
      caption: { ko: '앨범 표지', en: 'Album cover' },
    },
    {
      src: '/images/funding/sabbaha-slung/band-live-20260929.webp',
      alt: {
        ko: '무대 위의 사바하 — 흰 천을 뒤집어쓴 The Slaughter가 기타를 메고 서 있고, 뒤에서 검은 두건을 쓴 The Mortician이 두 팔을 들어 스틱을 치켜들고 있다',
        en: 'Sabbaha on stage — The Slaughter, shrouded in white cloth, with a guitar; behind him The Mortician, hooded in black, raises both drumsticks',
      },
      caption: { ko: '공연 사진', en: 'Live' },
    },
    {
      src: '/images/funding/sabbaha-slung/band-bw-20260929.webp',
      alt: {
        ko: '흑백으로 찍은 사바하의 공연 — 긴 털로 온몸을 덮은 The Slaughter가 기타를 치고, 뒤로 드럼 세트가 보인다',
        en: 'Sabbaha live in black and white — The Slaughter, covered head to toe in long hair, plays guitar in front of the drum kit',
      },
      caption: { ko: '공연 사진(흑백)', en: 'Live (black and white)' },
    },
  ],

  assets: {
    eyebrow: { ko: '보도용 이미지', en: 'Press images' },
    title: { ko: '표지와 사진', en: 'Cover and photos' },
    lead: { ko: '앨범을 다루는 기사에 쓰셔도 됩니다.', en: 'You are welcome to use these with coverage of the album.' },
    download: { ko: '받기', en: 'Download' },
  },

  contact: {
    eyebrow: { ko: '문의', en: 'Contact' },
    title: { ko: '인터뷰와 자료 요청', en: 'Interviews and requests' },
    lead: {
      ko: '인터뷰는 사바하에게 직접, 이 페이지와 음원·이미지에 관한 것은 스튜디오 놀로 연락 주세요.',
      en: 'For interviews, contact Sabbaha directly. For anything about this page, the audio or the images, write to Studio NOL.',
    },
    band: { label: { ko: '사바하 — 인터뷰·공연', en: 'Sabbaha — interviews, booking' }, email: 'sabbaha.doom@gmail.com' },
    email: 'hello@studionol.co.kr',
    studioLabel: { ko: '스튜디오 놀 — 감상 페이지·자료', en: 'Studio NOL — this page, audio, images' },
  },

  links: [
    { label: 'sabbaha.kr', href: 'https://sabbaha.kr/' },
    { label: { ko: '《SLUNG》 앨범 페이지 · 부클릿', en: 'SLUNG album page and booklet' }, href: 'https://sabbaha.kr/slung/' },
    { label: 'Bandcamp', href: 'https://yahoyahodan.bandcamp.com/' },
    { label: 'Instagram', href: 'https://www.instagram.com/sabbaha_kr/' },
    { label: 'YouTube', href: 'https://www.youtube.com/@Sabbaha_doom' },
  ] as ReadonlyArray<{ label: string | Localized; href: string }>,
} as const;
