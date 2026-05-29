import type { PortfolioItem } from '../../types/data';
import type { Locale } from '../../lib/i18n';
import { translate, type LocaleDict } from './i18n';
import { SERVICE_DICT } from './services';

// 모든 portfolio item 정의. translate와 SERVICE_DICT를 closure로 받아 기존
// t/getService/services 호출 패턴을 그대로 유지한다 — 분할 시 약 200+ 호출부의
// 형태 변경 없이 안전하게 옮기기 위함.
// scripts/generate-portfolio-meta.js가 이 파일의 items 배열 선언을 brace-tracking
// 방식으로 파싱하므로 선언 형태를 유지해야 한다.
export const buildPortfolioItems = (locale: Locale): PortfolioItem[] => {
    // wrapper가 첫 인자(locale)를 무시하고 closure의 locale을 사용 — 데이터 라인은
    // 원본 형태(t(locale, {...}))를 변경하지 않고 그대로 복사 가능.
    const t = (_locale: Locale, dict: LocaleDict): string => translate(locale, dict);
    const getService = (dict: LocaleDict): string => translate(locale, dict);
    const services = SERVICE_DICT;

    const items: PortfolioItem[] = [
        {
            "id": "tierliner-bite-me",
            "title": "티어라이너 <Bite Me>",
            "description": t(locale, { ko: "레코딩, 믹싱", en: "Recording, Mixing" }),
            "image": "https://image.bugsm.co.kr/album/images/1000/207900/20790054.jpg",
            "link": "https://www.youtube.com/watch?v=XEI2TcYs9jU",
            "category": "single",
            "services": [
                getService(services.recording),
                getService(services.mixing)
            ],
            "featured": false,
            "artist": "티어라이너",
            "releaseDate": "2026-02-22",
            "credits": {
                "engineer": "Studio NOL (황경하)",
                "musicians": ["티어라이너 (Vocal)"],
                "gear": ["Neumann TLM 103"]
            },
            "productionNotes": {
                "ko": "티어라이너(tearliner)와 Love X Stereo의 협업 싱글 \"Bite Hard\"(2026년 2월 23일 발매)의 오프닝 트랙. 작사·작곡·보컬은 liner가 맡았고, 편곡과 모든 악기는 배한슬이 연주했다. 장르는 인디 록·드림 팝·기타 팝 계열로 분류되며, 마스터링은 런던 메트로폴리스 스튜디오의 Andy 'Hippy' Baldwin이 담당했다.\n\n이 트랙의 보컬 레코딩과 믹싱은 Studio NOL에서 황경하가 진행했다. 티어라이너 특유의 몽환적이고 서정적인 사운드 결을 유지하면서 Love X Stereo와의 협업 색채를 담아낸 곡이다.",
                "en": "The opening track of \"Bite Hard,\" a collaborative single by tearliner and Love X Stereo released on February 23, 2026. Written, composed, and performed by liner, with all instruments arranged and played by Bae Hanseul (배한슬). The track sits within indie rock, dream pop, and guitar pop territory, with mastering handled by Andy 'Hippy' Baldwin at Metropolis Studios in London.\n\nVocals were recorded and the track was mixed by Hwang Kyung Ha at Studio NOL. The song preserves tearliner's signature dreamy, lyrical sonic palette while bringing in the collaborative texture of Love X Stereo."
            }
        },
        {
            "id": "the-projectors-babu-first-flight",
            "title": "더 프로젝터스 <바보의 첫 비행>",
            "description": t(locale, { ko: "레코딩, 믹싱, 마스터링", en: "Recording, Mixing, Mastering", vi: "Thu âm, Mixing, Mastering", th: "บันทึกเสียง, มิกซ์, มาสเตอริ่ง", uz: "Yozuv, Miks, Mastering" }),
            "image": "https://image.bugsm.co.kr/album/images/1000/389681/38968186.jpg",
            "link": "https://www.youtube.com/watch?v=HcxkwRuIBp8",
            "category": "single",
            "services": [
                getService(services.recording),
                getService(services.mixing),
                getService(services.mastering)
            ],
            "featured": true,
            "artist": "더 프로젝터스",
            "releaseDate": "2024-03-15",
            "label": "The Projectors",
            "credits": {
                "engineer": "Studio NOL (황경하)",
                "musicians": ["더 프로젝터스 전 멤버"],
                "gear": ["Studer A810 Multitrack", "Neumann U87", "Neve 1073 Preamp", "Fender Jazz Bass"]
            },
            "productionNotes": {
                "ko": "더 프로젝터스(The Projectors)는 보컬 Rosalyn Song과 기타·베이스 Simon DM으로 이루어진 듀오로, 매니지먼트는 Pleiades Media, 유통은 FUGA를 통한다. 싱글 '바보의 첫 비행(Fool's First Flight)'은 2025년 11월 10일 발매된 1트랙 싱글로, 멜론·벅스에서 락 장르로 분류된다.\n\n작사는 Rosalyn Song, 작·편곡은 Simon DM과 Rosalyn Song이 함께 맡았다. 곡은 처음으로 자신의 창작물을 세상에 내보이는 순간의 설렘과 두려움을 다루며, 화성 없는 모놀로그처럼 시작해 영화적 스트링이 더해지고 마지막 후렴에서 키를 올려 고조되는 구성을 가진다.",
                "en": "The Projectors (더 프로젝터스) is a duo featuring vocalist Rosalyn Song and guitarist/bassist Simon DM, managed by Pleiades Media and distributed via FUGA. Their single \"바보의 첫 비행 (Fool's First Flight)\" was released on November 10, 2025 as a one-track single, classified under Rock on Melon and Bugs.\n\nLyrics are by Rosalyn Song, with composition and arrangement credited to Simon DM and Rosalyn Song. The song captures the mix of excitement and apprehension of sharing creative work for the first time, opening as a monologue without harmony, layering cinematic strings, and rising to a higher key in the final chorus."
            }
        },
        {
            "id": "guitar-choi-dementia-2024",
            "title": "Guitar Choi <Dementia>",
            "description": t(locale, { ko: "기획, 믹싱, 마스터링, 아트워크, 홍보", en: "Planning, Mixing, Mastering, Artwork, Promotion", vi: "Lên kế hoạch, Mixing, Mastering, Artwork/Thiết kế, PR/Quảng bá", th: "วางแผน, มิกซ์, มาสเตอริ่ง, อาร์ตเวิร์ก, ประชาสัมพันธ์", uz: "Rejalash, Miks, Mastering, Artwork, Targ‘ibot" }),
            "image": "https://image.bugsm.co.kr/album/images/1000/387344/38734452.jpg",
            "link": "https://www.youtube.com/watch?v=LSzLlcHu9qQ",
            "category": "single",
            "services": [
                getService(services.planning),
                getService(services.mixing),
                getService(services.mastering),
                getService(services.design),
                getService(services.promotion)
            ],
            "featured": false,
            "artist": "Guitar Choi",
            "releaseDate": "2025-09-08",
            "credits": {
                "engineer": "Studio NOL (황경하)",
                "musicians": ["Guitar Choi (Guitar)"]
            }
        },
        {
            "id": "unknown-feeling",
            "title": "하루살이 프로젝트 2: 알 수 없는 느낌",
            "description": t(locale, { ko: "기획, 믹싱, 마스터링, 홍보, 웹사이트 제작", en: "Planning, Mixing, Mastering, Promotion, Web Dev", vi: "Lên kế hoạch, Mixing, Mastering, PR/Quảng bá, Phát triển web", th: "วางแผน, มิกซ์, มาสเตอริ่ง, ประชาสัมพันธ์, พัฒนาเว็บ", uz: "Rejalash, Miks, Mastering, Targ‘ibot, Veb dev" }),
            "image": "https://image.bugsm.co.kr/album/images/1000/382753/38275340.jpg",
            "link": "https://harusali.vercel.app",
            "category": "album",
            "services": [
                getService(services.planning),
                getService(services.mixing),
                getService(services.mastering),
                getService(services.promotion),
                getService(services.web)
            ],
            "featured": true,
            "artist": "하루살이 프로젝트",
            "releaseDate": "2024-01-20",
            "label": "Harusali Project",
            "credits": {
                "engineer": "Studio NOL (황경하)",
                "musicians": ["하루살이 프로젝트 아티스트 전원"],
                "gear": ["Pro Tools HDX", "Neumann U87", "Lexicon 480L", "Tube-Tech CL1B"]
            },
            "trackList": [
                { "no": 1, "title": "아침 햇살 (Morning Light)", "duration": "4:12" },
                { "no": 2, "title": "비 오는 날 (Rainy Day)", "duration": "3:45" },
                { "no": 3, "title": "알 수 없는 느낌 (Unknown Feeling)", "duration": "5:01" },
                { "no": 4, "title": "지하철 (Subway)", "duration": "3:28" },
                { "no": 5, "title": "저녁 노을 (Sunset)", "duration": "4:33" }
            ],
            "productionNotes": {
                "ko": "『하루살이 프로젝트 2: 알 수 없는 느낌』은 2025년 7월 22일에 공개된 하루살이 프로젝트의 정규 음반으로, 「알수없느낌(Unknown Feeling)」을 타이틀곡으로 내세웠다. 벅스 분류 기준 포크/포크 어쿠스틱 장르에 속하며, 「집을 나선 고양이」 「괴로워!」 「그림을 그려」 「새우 까주는 사람」 「집중 두 시간」 「아침밥 먹은 날에 더 배고파」 「말 필요 없는 노래」 등 일상의 장면과 감정을 구어체 가까운 제목으로 옮긴 곡들이 함께 실렸다. 시리즈의 두 번째 결과물답게 작은 순간을 응시하는 시선을 차분한 어쿠스틱 사운드로 풀어내며, 멜론·벅스 등 주요 음원 플랫폼에서 정식 유통되고 있다.",
                "en": "\"Mayfly Project 2: Unknown Feeling\" is a full-length album by the Korean indie project Harusari Project (하루살이 프로젝트), released on July 22, 2025, with \"Unknown Feeling (알수없느낌)\" as the title track. Classified under Folk / Folk Acoustic on Bugs, the record collects songs that translate small everyday scenes and feelings into colloquial titles, including \"The Cat Left Home,\" \"In Pain,\" \"Just Painting,\" \"The Person Who Peels Shrimp (for Me),\" \"Focusing for Two Hours,\" \"Hungry Days when I eat Breakfast,\" and \"Wordless Song.\" As the second installment of the series, it sustains a quiet acoustic approach to ordinary moments and is distributed across major Korean streaming platforms such as Melon and Bugs."
            }
        },
        {
            "id": "dystopia-2025",
            "title": "삼각전파사 <Dystopia 2025>",
            "description": t(locale, { ko: "기획, 레코딩, 믹싱, 마스터링, 홍보, 웹사이트 제작", en: "Planning, Recording, Mixing, Mastering, Promotion, Web Dev", vi: "Lên kế hoạch, Thu âm, Mixing, Mastering, PR/Quảng bá, Phát triển web", th: "วางแผน, บันทึกเสียง, มิกซ์, มาสเตอริ่ง, ประชาสัมพันธ์, พัฒนาเว็บ", uz: "Rejalash, Yozuv, Miks, Mastering, Targ‘ibot, Veb dev" }),
            "image": "https://img.tumblbug.com/eyJidWNrZXQiOiJ0dW1ibGJ1Zy1pbWctYXNzZXRzIiwia2V5IjoiY292ZXIvZTg0NGRhNDAtMDNmOS00NmQ1LWE0ODUtY2NhY2YxYTIzMDVkLzVhYjQzY2I4LWFhMGEtNGU2Mi05NjhiLWFiNDRmYjdmNzZiNi5qcGVnIiwiZWRpdHMiOnsicmVzaXplIjp7IndpZHRoIjoxMjQwLCJoZWlnaHQiOjEyNDAsIndpdGhvdXRFbmxhcmdlbWVudCI6dHJ1ZX19fQ==",
            "link": "https://dystopia2025.kr",
            "category": "album",
            "services": [
                getService(services.planning),
                getService(services.recording),
                getService(services.mixing),
                getService(services.mastering),
                getService(services.promotion),
                getService(services.web)
            ],
            "featured": true,
            "artist": "삼각전파사",
            "releaseDate": "2025-02-10",
            "label": "Samgeuk Jeonpasa",
            "credits": {
                "engineer": "Studio NOL (황경하)",
                "musicians": ["삼각전파사"],
                "gear": ["Prophet-6", "Moog Sub 37", "Ableton Live", "Neumann U87", "Lexicon 224"]
            },
            "productionNotes": {
                "ko": "삼각전파사는 SF작가 장호진의 솔로 실험전자음악 프로젝트로, 2015년부터 활동해왔다. 『Dystopia 2025』는 2025년 5월 2일 FUGA를 통해 유통된 정규 1집으로, 왜곡된 신디사이저와 급진적 전자음향을 1980년대 민중음악의 저항 정신과 결합한 작품이다.\n\n수록곡 '땅거미 Z'(젠트리피케이션), '그리마 X'(자본주의), '물결'(산업재해) 등은 2025년 한국 사회의 구체적 현안을 다루며, 'House of Rising Sun' 재해석도 포함됐다. 박치치 감독이 티저 영상을 연출했고, 발매 기념 공연은 서울 스페이스 한강에서 진행됐다.",
                "en": "Samgakjeonpasa (Triangle Waver) is the solo experimental electronic project of SF novelist Jang Ho-jin, active since 2015. Dystopia 2025, the artist's first full-length album, was released on May 2, 2025 and distributed via FUGA. The record fuses distorted synthesizers and radical electronic textures with the protest tradition of 1980s Korean minjung (people's) music.\n\nTracks such as \"Ttanggeomi Z\" (gentrification), \"Grima X\" (capitalism), and \"Mulgyeol\" (industrial accidents), alongside a reworking of \"House of Rising Sun,\" address concrete social issues in 2025 Korea. The teaser was directed by Park Chichi, and a release show was held at Space Hangang in Seoul."
            }
        },
        {
            "id": "jai-golden-hour",
            "title": "자이 <Golden Hour>",
            "description": t(locale, { ko: "기획, 레코딩, 믹싱, 홍보", en: "Planning, Recording, Mixing, Promotion", vi: "Lên kế hoạch, Thu âm, Mixing, PR/Quảng bá", th: "วางแผน, บันทึกเสียง, มิกซ์, ประชาสัมพันธ์", uz: "Rejalash, Yozuv, Miks, Targ‘ibot" }),
            "image": "https://image.bugsm.co.kr/album/images/1000/373556/37355636.jpg",
            "link": "https://soundcloud.com/user-292846120/sets/jai-golden-hour/s-BPI7SsQ1rfb?si=cf71793aa6574753902aefae1c68631f&utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing",
            "category": "album",
            "services": [
                getService(services.planning),
                getService(services.recording),
                getService(services.mixing),
                getService(services.promotion)
            ],
            "featured": true,
            "artist": "자이",
            "releaseDate": "2023-09-01",
            "credits": {
                "engineer": "Studio NOL (황경하)",
                "musicians": ["자이 (Vocal)"],
                "gear": ["Neumann U87", "Classé Preamp", "Neve 1073", "Lexicon 480L"]
            },
            "productionNotes": {
                "ko": "자이(Jai)의 EP 'Golden Hour'는 2025년 3월 10일 발매된 5곡 구성의 미니앨범으로, 타이틀곡 'Fever'와 함께 '너의 데이트', '때늦은 옛 이야기', '오늘 이 밤을', 그리고 '너의 데이트(Piano Ver.)'가 수록되어 있다. 벅스·멜론·지니 등 국내 주요 음원 플랫폼에 정식 등록되어 있다.\n\nStudio NOL은 본 EP의 작업에 참여했다. 보컬 녹음과 믹싱을 거쳐 곡 전반의 정서적 결을 다듬는 데 초점을 두었으며, 피아노 버전을 포함한 다섯 트랙이 일관된 톤으로 완성될 수 있도록 사운드의 균형을 잡았다.",
                "en": "Jai's EP 'Golden Hour' was released on March 10, 2025, as a five-track mini-album. It features the title track 'Fever' alongside 'Your Date (너의 데이트)', 'A Belated Old Story (때늦은 옛 이야기)', 'Tonight (오늘 이 밤을)', and a piano version of 'Your Date.' The EP is officially distributed across major Korean streaming services including Bugs, Melon, and Genie.\n\nStudio NOL contributed to the production of this EP, focusing on vocal recording and mixing to shape the emotional texture across the tracklist. Particular care was taken to maintain a consistent sonic tone across all five tracks, including the piano-led arrangement, so the EP would read as a cohesive whole."
            }
        },
        {
            "id": "heo-jeong-hyuk-wind",
            "title": "허정혁 <바람 한 점>",
            "description": t(locale, { ko: "레코딩, 믹싱, 홍보", en: "Recording, Mixing, Promotion", vi: "Thu âm, Mixing, PR/Quảng bá", th: "บันทึกเสียง, มิกซ์, ประชาสัมพันธ์", uz: "Yozuv, Miks, Targ‘ibot" }),
            "image": "https://image.bugsm.co.kr/album/images/1000/366016/36601640.jpg",
            "link": "https://music.bugs.co.kr/album/36601640?wl_ref=list_tr_07_ar",
            "category": "single",
            "services": [
                getService(services.recording),
                getService(services.mixing),
                getService(services.promotion)
            ],
            "featured": true,
            "artist": "허정혁",
            "releaseDate": "2023-05-18",
            "credits": {
                "engineer": "Studio NOL (황경하)",
                "musicians": ["허정혁 (Vocal)"],
                "gear": ["Shure SM7B", "Neumann U87", "Neve 1073", "Tube-Tech CL1B"]
            },
            "productionNotes": {
                "ko": "허정혁의 싱글 '바람 한 점'은 2024년 12월 13일 발매된 포크/어쿠스틱 트랙으로, 한국스마트협동조합 레이블을 통해 FUGA가 유통했다. 허정혁이 작사·작곡·편곡과 보컬·나일론 기타·프로그래밍을 직접 맡았고, 박기훈이 플루트와 클라리넷, 곽주나와 허정혁이 코러스로 참여했다.\n\n봄날 창문으로 불어든 한 줄기 바람에서 영감을 받은 곡으로, 어디서 오고 어디로 가는지 알 수 없는 바람이 지친 몸을 어루만져 다시 살아가게 한다는 메타포를 담고 있다. Studio NOL에서 녹음 작업이 진행되었다.",
                "en": "\"Baram Han Jeom\" (A Speck of Wind) is a single by Korean singer-songwriter Heo Jeong-hyuk, released on December 13, 2024 via the label 한국스마트협동조합 with distribution by FUGA. Categorized as folk/acoustic, the track features Heo on lyrics, composition, arrangement, vocals, nylon guitar, and programming, with Park Ki-hoon on flute and clarinet and chorus by Gwak Ju-na and Heo himself.\n\nThe song was inspired by a gentle breeze drifting through a window on a spring day, using wind as a metaphor for an unseen presence that touches a weary body and revives it. Recording was carried out at Studio NOL."
            }
        },
        {
            "id": "peace-and-music",
            "title": "Various Artists <이름을 모르는 먼 곳의 그대에게>",
            "description": t(locale, { ko: "기획, 레코딩, 믹싱, 홍보, 웹사이트 제작", en: "Planning, Recording, Mixing, Promotion, Web Dev", vi: "Lên kế hoạch, Thu âm, Mixing, PR/Quảng bá, Phát triển web", th: "วางแผน, บันทึกเสียง, มิกซ์, ประชาสัมพันธ์, พัฒนาเว็บ", uz: "Rejalash, Yozuv, Miks, Targ‘ibot, Veb dev" }),
            "image": "https://image.bugsm.co.kr/album/images/1000/371358/37135839.jpg",
            "link": "https://peaceandmusic.net/",
            "category": "compilation",
            "services": [
                getService(services.planning),
                getService(services.recording),
                getService(services.mixing),
                getService(services.promotion),
                getService(services.web)
            ],
            "featured": true,
            "artist": "Various Artists",
            "releaseDate": "2023-07-22",
            "label": "Peace and Music",
            "credits": {
                "engineer": "Studio NOL (황경하) — Mastering & Album Direction",
                "musicians": ["Various Artists (다수 아티스트 협업)"],
                "gear": ["Pro Tools HDX", "Neumann U87", "Lexicon 480L", "Weber Mass"]
            },
            "trackList": [
                { "no": 1, "title": "이름을 모르는 먼 곳의 그대에게", "duration": "4:22" },
                { "no": 2, "title": "바람이 부면", "duration": "3:45" },
                { "no": 3, "title": "먼 곳의 그대", "duration": "5:01" },
                { "no": 4, "title": "연결된 거리", "duration": "4:15" }
            ],
            "productionNotes": {
                "ko": "'이름을 모르는 먼 곳의 그대에게'는 강정피스앤뮤직캠프 조직위원회가 기획한 컴필레이션 앨범으로, 제주 강정마을에서 시작된 평화음악 프로젝트의 결과물이다. 우크라이나·팔레스타인 등 분쟁 지역의 평화를 염원하며 Project Around Surround, 정진석, 김동산, 남수, 까르, 김인, 모레도토요일, 나뭇잎들, 여유, 모모, 자이 x HANASH, 이서영 등 13팀이 참여했다.\n\n총 13트랙 중 12트랙의 녹음·믹싱을 Studio NOL 황경하가 맡았고, 마스터링은 주로 이재수가 담당했다. 2024년 10월 제주, 11월 홍대 공연이 매진되었으며 멜론·벅스·스포티파이·애플뮤직 등에서 공개되었다.",
                "en": "\"To You in a Distant Place Whose Name I Don't Know\" is a compilation album organized by the Gangjeong Peace and Music Camp committee, a peace music project rooted in Gangjeong Village on Jeju Island. Standing in solidarity with people in conflict zones such as Ukraine and Palestine, 13 acts contributed — including Project Around Surround, Jeong Jin-seok, Kim Dongsan, Namsoo, Kkar, Kim In, Moredo Saturday, Leaves, Yeoyu, Momo, Zai x HANASH, and Lee Seoyoung.\n\nOf the album's 13 tracks, 12 were recorded and mixed by Hwang Kyung-ha at Studio NOL, with mastering primarily handled by Lee Jae-soo. Linked Jeju (October) and Hongdae (November) 2024 concerts sold out, and the album is available on Melon, Bugs, Spotify, and Apple Music."
            }
        },
        {
            "id": "lee-seo-young-woo-ri",
            "title": "이서영 <우리>",
            "description": t(locale, { ko: "기획, 레코딩, 홍보", en: "Planning, Recording, Promotion", vi: "Lên kế hoạch, Thu âm, PR/Quảng bá", th: "วางแผน, บันทึกเสียง, ประชาสัมพันธ์", uz: "Rejalash, Yozuv, Targ‘ibot" }),
            "image": "https://image.bugsm.co.kr/album/images/1000/363228/36322824.jpg",
            "link": "https://www.youtube.com/watch?v=GAXy7iJKGzk",
            "category": "single",
            "services": [
                getService(services.planning),
                getService(services.recording),
                getService(services.promotion)
            ],
            "featured": false,
            "artist": "이서영",
            "releaseDate": "2024-11-29",
            "credits": {
                "engineer": "Studio NOL (황경하)",
                "musicians": ["이서영 (Vocal)"],
                "gear": ["Neumann U87Ai"]
            },
            "productionNotes": {
                "ko": "'우리'는 싱어송라이터 이서영이 2025년 2월 7일 발매된 컴필레이션 앨범 '이름을 모르는 먼 곳의 그대에게'에 참여해 수록한 트랙이다. 이 앨범은 12개 팀이 평화 메시지를 주제로 모은 프로젝트로, 포크·록·재즈·전자 등 다양한 장르를 아우르는 총 13곡, 약 55분 분량의 합본이며 마스터링은 이재수가 맡았다.\n\n이서영은 2019년 데뷔한 솔로 싱어송라이터로 발라드·인디·포크 계열에서 활동해 왔으며, EP '허물 벗기'(2022)와 싱글 '서리'(2024), '무성한 줄기'(2025) 등을 발표했다. '우리'는 그가 평화를 주제로 한 공동 프로젝트에 참여한 작업으로, 재생 시간 약 4분 22초의 곡으로 기록되어 있다.",
                "en": "\"Woo-ri\" (We) is a track by Korean singer-songwriter Lee Seo Young, included as track 12 on the compilation album \"To You in a Distant Place Whose Name I Don't Know,\" released on February 7, 2025. The album is a collaborative project by twelve musical acts conveying peace messages, spanning folk, rock, jazz, and electronic genres across 13 tracks and roughly 55 minutes. Mastering was handled by Lee Jae-soo.\n\nLee Seo Young is a solo singer-songwriter who debuted in 2019 and works primarily in the ballad, indie, and folk space. Her catalog includes the EP \"Heomul Beotgi\" (2022) and singles such as \"Seori\" (2024) and \"Museonghan Julgi\" (2025). \"Woo-ri\" runs about 4 minutes 22 seconds and stands as her contribution to this collective peace-themed release."
            }
        },
        {
            "id": "jai-hanash-pink-padding",
            "title": "자이(Jai) x HANASH <분홍색 패딩 소녀>",
            "description": t(locale, { ko: "기획, 레코딩, 홍보", en: "Planning, Recording, Promotion", vi: "Lên kế hoạch, Thu âm, PR/Quảng bá", th: "วางแผน, บันทึกเสียง, ประชาสัมพันธ์", uz: "Rejalash, Yozuv, Targ‘ibot" }),
            "image": "https://image.bugsm.co.kr/album/images/1000/364148/36414830.jpg",
            "link": "https://www.youtube.com/watch?v=812CJnROxxs",
            "category": "single",
            "services": [
                getService(services.planning),
                getService(services.recording),
                getService(services.promotion)
            ],
            "featured": true,
            "artist": "자이 x HANASH",
            "releaseDate": "2024-12-03",
            "credits": {
                "engineer": "Studio NOL (황경하)",
                "musicians": ["자이 (Vocal)", "HANASH (Rap)"],
                "gear": ["Neumann U87Ai"]
            },
            "productionNotes": {
                "ko": "'분홍색 패딩 소녀'는 싱어송라이터 자이(Jai)와 일렉트로닉 뮤지션 HANASH가 함께 만든 싱글로, 2024년 12월 4일 발매됐다. 이 곡은 반전·평화를 주제로 12팀의 뮤지션이 참여한 프로젝트 앨범 '이름을 모르는 먼 곳의 그대에게'에도 수록됐다.\n\n곡은 전쟁의 참상을 한 소녀의 시선으로 풀어내는 내러티브를 취한다. 자이의 중저음 보컬이 절제된 톤으로 메시지를 전하고, HANASH의 모듈라 신디사이저 작업이 앰비언트 패드와 중음역대 아르페지오 시퀀스로 곡의 정서를 받쳐 일상의 불안과 긴장감을 표현한다.",
                "en": "\"Pink Padding Girl\" is a single by singer-songwriter Jai and electronic musician HANASH, released on December 4, 2024. The track is also included on the project album \"To You in a Distant Place Whose Name I Don't Know,\" which gathers 12 acts around the theme of anti-war and peace.\n\nThe song frames the horrors of war through the perspective of a young girl. Jai delivers the narrative in a restrained, mid-to-low register, while HANASH's modular-synth work — ambient pads and mid-range arpeggiated sequences — carries the atmosphere, sketching the tension of conflict and the unease of everyday life."
            }
        },
        {
            "id": "momo-if-this-cant-be-tolerated",
            "title": "모모 <If this can't be tolerated, what can't be?>",
            "description": t(locale, { ko: "기획, 레코딩, 믹싱, 홍보", en: "Planning, Recording, Mixing, Promotion", vi: "Lên kế hoạch, Thu âm, Mixing, PR/Quảng bá", th: "วางแผน, บันทึกเสียง, มิกซ์, ประชาสัมพันธ์", uz: "Rejalash, Yozuv, Miks, Targ‘ibot" }),
            "image": "https://image.bugsm.co.kr/album/images/1000/363226/36322647.jpg",
            "link": "https://www.youtube.com/watch?v=aq2DESx9ITQ",
            "category": "single",
            "services": [
                getService(services.planning),
                getService(services.recording),
                getService(services.mixing),
                getService(services.promotion)
            ],
            "featured": false,
            "artist": "모모",
            "releaseDate": "2024-11-26",
            "credits": {
                "engineer": "Studio NOL (황경하)",
                "musicians": ["모모 (Vocal)"]
            },
            "productionNotes": {
                "ko": "재즈 듀오 모모(보컬 예진 안젤라 박, 베이스 황슬기)의 'If this can be tolerated, what can't be?'는 2024년 11월 27일 디지털 싱글로 발매되었고, 같은 시기 반전·평화를 주제로 12팀이 참여한 컴필레이션 '이름을 모르는 먼 곳의 그대에게'에도 함께 수록됐다. 곡의 모티프는 팔레스타인 영화감독 엘리아 술레이만의 '실종의 연대기'에서 가져왔으며, 우크라이나 전쟁과 이스라엘-팔레스타인 분쟁, 한반도 분단까지 동시대 폭력을 '용인'하는 자유 사회의 모순을 짧고 단호한 질문으로 되묻는 재즈 곡이다. 멜론·벅스·지니·스포티파이·애플뮤직 등에서 정식 스트리밍할 수 있다.",
                "en": "\"If this can be tolerated, what can't be?\" is a single by the Korean jazz duo MOMO — vocalist Yejin Angela Park and bassist Hwang Seulki — released on 27 November 2024. The track also appears on the anti-war and peace compilation \"To You in a Distant Place Whose Name I Don't Know,\" to which twelve acts contributed. Its central image is borrowed from Palestinian filmmaker Elia Suleiman's \"Chronicle of a Disappearance,\" and the lyric turns a sharp question on a society that calls itself free while tolerating violence — from the war in Ukraine to the Israel–Palestine conflict and the division of the Korean peninsula. The song streams on Melon, Bugs, Genie, Spotify and Apple Music."
            }
        },
        {
            "id": "yeoyu-seoul-night",
            "title": "여유 <서울의 밤 (feat. 정수민)>",
            "description": t(locale, { ko: "기획, 레코딩, 홍보", en: "Planning, Recording, Promotion", vi: "Lên kế hoạch, Thu âm, PR/Quảng bá", th: "วางแผน, บันทึกเสียง, ประชาสัมพันธ์", uz: "Rejalash, Yozuv, Targ‘ibot" }),
            "image": "https://image.bugsm.co.kr/album/images/1000/370548/37054815.jpg",
            "link": "https://orcd.co/4e3m8rx",
            "category": "single",
            "services": [
                getService(services.planning),
                getService(services.recording),
                getService(services.promotion)
            ],
            "featured": false,
            "artist": "여유",
            "credits": {
                "engineer": "Studio NOL (황경하)",
                "musicians": ["여유 (Vocal)", "정수민 (Vocal, Featuring)"]
            },
            "productionNotes": {
                "ko": "싱어송라이터 여유의 싱글 '서울의 밤 (feat. 정수민)'은 2025년 2월 5일 발매된 포크/어쿠스틱 인디 트랙이다. 여유가 작사·작곡을 맡고 정수민과 공동 편곡했으며, 보컬·기타·피아노·믹싱을 여유가 직접 담당했다. 정수민이 콘트라베이스와 피처링으로 참여했고, 드럼 권낙주, 클라리넷 설빈, 코러스·피아노 남수가 합류해 어쿠스틱 앙상블을 구성했다. 유통은 FUGA, 기획은 한국스마트협동조합이며 러닝타임은 4분 48초다.\n\n레코딩은 Studio NOL의 황경하가 맡았고, 마스터링은 Sonority Mastering의 이재수, Dolby Atmos 작업은 SOUND 360에서 진행됐다.",
                "en": "\"Seoul's Night (feat. Jung Sumin)\" is a folk/acoustic indie single by singer-songwriter Yeoyu, released on February 5, 2025. Yeoyu wrote and composed the track and co-arranged it with Jung Sumin, while also handling lead vocals, guitar, piano, and mixing. Jung Sumin contributed contrabass and feature vocals, joined by Kwon Nakju on drums, Seolbin on clarinet, and Namsu on chorus and piano, forming an acoustic ensemble. The single is distributed by FUGA and planned by Korean Smart Cooperative, with a running time of 4:48.\n\nRecording was handled by Hwang Kyungha at Studio NOL, with mastering by Lee Jaesoo at Sonority Mastering and Dolby Atmos by SOUND 360."
            }
        },
        {
            "id": "namutipdeul-eyes-front-heart",
            "title": "나뭇잎들 <눈 앞의 마음>",
            "description": t(locale, { ko: "기획, 레코딩, 믹싱, 홍보", en: "Planning, Recording, Mixing, Promotion", vi: "Lên kế hoạch, Thu âm, Mixing, PR/Quảng bá", th: "วางแผน, บันทึกเสียง, มิกซ์, ประชาสัมพันธ์", uz: "Rejalash, Yozuv, Miks, Targ‘ibot" }),
            "image": "https://image.bugsm.co.kr/album/images/1000/368417/36841743.jpg",
            "link": "https://orcd.co/v4bq9px",
            "category": "single",
            "services": [
                getService(services.planning),
                getService(services.recording),
                getService(services.mixing),
                getService(services.promotion)
            ],
            "featured": false,
            "artist": "나뭇잎들",
            "credits": {
                "engineer": "Studio NOL (황경하)",
                "musicians": ["나뭇잎들"]
            },
            "productionNotes": {
                "ko": "나뭇잎들은 포크·블루스 계열의 혼성 듀오로, \"눈 앞의 마음\"은 2025년 1월 16일 발매된 디지털 싱글이다. 같은 곡이 컴필레이션 성격의 \"이름을 모르는 먼 곳의 그대에게\"에도 수록되어, 단일 트랙이 두 형태의 음원으로 유통되고 있는 구조다.\n\nStudio NOL은 이 트랙의 보컬 녹음·믹싱 작업을 맡아, 어쿠스틱 기반 듀오 사운드의 결을 살리는 데 초점을 두었다. 두 보컬의 위치 관계와 호흡, 그리고 악기와 목소리 사이의 거리감이 곡의 정서를 좌우하는 만큼, 과한 처리 대신 원음의 결과 다이내믹을 보존하는 방향으로 정리했다.",
                "en": "Leaves (나뭇잎들) is a Korean mixed-gender duo working in a folk/blues vein. \"Eyes Front Heart\" (눈 앞의 마음) was released as a digital single on January 16, 2025, and the same track also appears on a compilation-style release titled \"To You in a Distant Place Whose Name I Don't Know\" (이름을 모르는 먼 곳의 그대에게).\n\nStudio NOL handled vocal recording and mixing on the track, focusing on preserving the grain of an acoustic duo. Because the emotional core of the song depends on the relationship between the two voices and the space around them and their instruments, the work prioritized natural tone and dynamics over heavy processing."
            }
        },
        {
            "id": "moredo-toyoil-we-will-sail",
            "title": "모레도토요일 <We will sail for your freedom>",
            "description": t(locale, { ko: "기획, 레코딩, 믹싱, 홍보", en: "Planning, Recording, Mixing, Promotion", vi: "Lên kế hoạch, Thu âm, Mixing, PR/Quảng bá", th: "วางแผน, บันทึกเสียง, มิกซ์, ประชาสัมพันธ์", uz: "Rejalash, Yozuv, Miks, Targ‘ibot" }),
            "image": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/d5/b2/77/d5b277e3-8285-0ef6-9cbd-7d1552b09ff7/198846759562.jpg/1200x630bb.jpg",
            "link": "https://orcd.co/qjanjyy",
            "category": "single",
            "services": [
                getService(services.planning),
                getService(services.recording),
                getService(services.mixing),
                getService(services.promotion)
            ],
            "featured": true,
            "artist": "모레도토요일",
            "credits": {
                "engineer": "Studio NOL (황경하)",
                "musicians": ["모레도토요일"]
            },
            "productionNotes": {
                "ko": "〈We will sail for your freedom〉은 모레도토요일이 스웨덴 음악인 Emma Ringqvist의 곡을 리메이크한 포크 트랙으로, 2024년 11월 25일 싱글로 발매되었으며 강정 피스앤뮤직캠프 컴필레이션 〈이름을 모르는 먼 곳의 그대에게〉에 수록되었다. 가자지구 팔레스타인 여성들과의 연대를 주제로, 모레의 서늘하고 에어리한 보컬과 도토의 진하고 색채 있는 음색이 어쿠스틱 기타 위에서 2부 하모니를 이룬다.\n\n모레도토요일은 제주 강정마을에 거주해 온 평화활동가 겸 음악인 듀오이며, 이 컴필레이션의 믹싱은 Studio NOL의 황경하가, 마스터링은 이재수가 맡았다.",
                "en": "\"We will sail for your freedom\" is Moredotoyoil's folk reinterpretation of a song by Swedish musician Emma Ringqvist. Released as a single on November 25, 2024, it was also included as track 7 on the Gangjeong Peace and Music Camp compilation \"To You in a Distant Place Whose Name I Don't Know.\" The track is a song of solidarity with Palestinian women in Gaza, built around acoustic guitar and the two-part vocal harmony of More's cool, airy tone and Doto's deeper, more colorful voice.\n\nMoredotoyoil is a vocal duo of peace activists and musicians based in Gangjeong village on Jeju Island. The compilation was mixed by Hwang Kyung-ha at Studio NOL and mastered by Lee Jae-soo."
            }
        },
        {
            "id": "kim-in-star-person",
            "title": "김인 <별을 보러 간 사람>",
            "description": t(locale, { ko: "기획, 편곡, 레코딩, 믹싱, 홍보", en: "Planning, Arrangement, Recording, Mixing, Promotion", vi: "Lên kế hoạch, Hòa âm/Arr., Thu âm, Mixing, PR/Quảng bá", th: "วางแผน, เรียบเรียง, บันทึกเสียง, มิกซ์, ประชาสัมพันธ์", uz: "Rejalash, Aranjim, Yozuv, Miks, Targ‘ibot" }),
            "image": "https://thumb.mt.co.kr/06/2025/01/2025011014033361606_1.jpg",
            "link": "https://www.youtube.com/watch?v=waPHNm89mDk",
            "category": "single",
            "services": [
                getService(services.planning),
                getService(services.arrangement),
                getService(services.recording),
                getService(services.mixing),
                getService(services.promotion)
            ],
            "featured": false,
            "artist": "김인",
            "releaseDate": "2025-01-09",
            "credits": {
                "engineer": "Studio NOL (황경하)",
                "musicians": ["김인 (Vocal)"],
                "gear": ["Neumann TLM 103"]
            },
            "productionNotes": {
                "ko": "「별을 보러 간 사람」은 싱어송라이터 김인이 2025년 1월에 발표한 디지털 싱글이다. 동명의 싱글 앨범에 한 곡으로 수록되어 멜론 등 주요 음원 플랫폼을 통해 공개됐다.\n\nStudio NOL은 이 곡의 기획·편곡·레코딩·믹싱과 발매 홍보까지 전 과정을 담당했다. 황경하가 엔지니어링을 맡아 보컬 트래킹부터 믹싱까지 진행했으며, 작품은 Studio NOL 공식 포트폴리오에 'kim-in-star-person' 항목으로 등재되어 있다.",
                "en": "\"Star Person\" (별을 보러 간 사람) is a digital single by Korean singer-songwriter Kim In, released in January 2025. It appears as a single-track release on the same-titled single album, distributed via major Korean streaming platforms including Melon.\n\nStudio NOL handled the full production cycle — planning, arrangement, recording, mixing, and release promotion. Engineer Hwang Gyeongha (Studio NOL) led the sessions from vocal tracking through mix, and the project is documented in Studio NOL's official portfolio under the entry \"kim-in-star-person.\""
            }
        },
        {
            "id": "kkar-transition",
            "title": "까르 <TRANSITION>",
            "description": t(locale, { ko: "기획, 편곡, 레코딩, 믹싱, 홍보", en: "Planning, Arrangement, Recording, Mixing, Promotion", vi: "Lên kế hoạch, Hòa âm/Arr., Thu âm, Mixing, PR/Quảng bá", th: "วางแผน, เรียบเรียง, บันทึกเสียง, มิกซ์, ประชาสัมพันธ์", uz: "Rejalash, Aranjim, Yozuv, Miks, Targ‘ibot" }),
            "image": "https://image.bugsm.co.kr/album/images/1000/366016/36601647.jpg",
            "link": "https://orcd.co/o3vzobo",
            "category": "single",
            "services": [
                getService(services.planning),
                getService(services.arrangement),
                getService(services.recording),
                getService(services.mixing),
                getService(services.promotion)
            ],
            "featured": true,
            "artist": "까르",
            "credits": {
                "engineer": "Studio NOL (황경하)",
                "musicians": ["까르 (Vocal)"],
                "gear": ["Shure SM7B", "Neumann U87Ai"]
            },
            "productionNotes": {
                "ko": "까르(Caru)는 포크·어쿠스틱 기반의 여성 솔로 싱어송라이터로, 「TRANSITION」은 2024년 12월 13일 발매된 디지털 싱글이다. 기타 한 대로 일상의 무대를 이어 온 독학 뮤지션이 CJ문화재단 튠업 25기 선정 이후 본격적인 음원 작업으로 넘어가는 시점에 놓인 곡으로, 같은 흐름에서 2025년 싱글 「상처의 빛」과 정규 'O' 연작(「원 '原'」, 「정 '情'」)이 이어졌다.\n\n스튜디오 놀은 이 싱글의 작업에 참여했다. 보컬과 어쿠스틱 기타가 중심에 놓인 까르 특유의 결을 해치지 않도록, 과도한 가공보다 원음의 질감을 살리는 방향으로 진행했다.",
                "en": "Kkar (Caru) is a Korean female solo singer-songwriter working in folk/acoustic indie. \"TRANSITION\" is her digital single released on December 13, 2024. A self-taught musician who built her catalog through performances with a single guitar in everyday spaces, Kkar was selected for the 25th class of the CJ Cultural Foundation Tune Up program; \"TRANSITION\" sits at the point where she moved into a sustained recording cycle, followed in 2025 by the single \"Light of the Wound\" and the full-length 'O' series (\"Won '原'\" and \"Jeong '情'\").\n\nStudio NOL participated in the production of this single. The work prioritized preserving the natural texture of voice and acoustic guitar at the core of Kkar's sound rather than imposing heavy processing."
            }
        },
        {
            "id": "namsu-annyeong",
            "title": "남수 <안녕 (먼 곳의 그대에게)>",
            "description": t(locale, { ko: "기획, 레코딩, 믹싱, 홍보", en: "Planning, Recording, Mixing, Promotion", vi: "Lên kế hoạch, Thu âm, Mixing, PR/Quảng bá", th: "วางแผน, บันทึกเสียง, มิกซ์, ประชาสัมพันธ์", uz: "Rejalash, Yozuv, Miks, Targ‘ibot" }),
            "image": "https://image.bugsm.co.kr/album/images/1000/363226/36322648.jpg",
            "link": "https://www.youtube.com/watch?v=JMKr0dOLWZo",
            "category": "single",
            "services": [
                getService(services.planning),
                getService(services.recording),
                getService(services.mixing),
                getService(services.promotion)
            ],
            "featured": false,
            "artist": "남수",
            "releaseDate": "2024-11-21",
            "credits": {
                "engineer": "Studio NOL (황경하)",
                "musicians": ["남수 (Vocal)"]
            },
            "productionNotes": {
                "ko": "남수의 싱글 '안녕 (먼 곳의 그대에게)'는 2024년 11월 22일 공개됐다. 반전과 평화를 주제로 12팀의 뮤지션이 참여한 프로젝트 음반 '이름을 모르는 먼 곳의 그대에게'의 4번 트랙으로, 수원 기반 싱어송라이터 남수가 작사·작곡·편곡과 보컬·피아노를 직접 맡았다. 단순한 멜로디와 절제된 편곡, 가사로 표현하기 어려운 정서를 담은 허밍이 곡 전반을 관통한다.\n\nStudio NOL은 본 작품의 레코딩과 믹싱을 담당했으며(엔지니어 황경하), 마스터링은 이재수가 맡았다. 포크를 기반으로 재즈·뉴에이지 질감이 옅게 배어드는 결을 메시지 전달에 방해되지 않도록 정돈하는 방향으로 작업했다.",
                "en": "Namsu's single \"Annyeong (To You in a Distant Place)\" was released on November 22, 2024 as track 4 of the project compilation \"To You in a Distant Place Whose Name I Don't Know,\" which gathered twelve acts around themes of anti-war and peace. Namsu, a Suwon-based singer-songwriter blending folk with jazz and new age textures, wrote, composed, arranged, sang, and played piano on the song. A simple melody, restrained arrangement, and a recurring hum carry emotions the lyrics leave unsaid.\n\nStudio NOL handled recording and mixing for the track (engineered by Hwang Gyeong-ha), with mastering by Lee Jae-su. The production keeps the folk-leaning core intact while letting jazz and new age colors sit quietly beneath the message."
            }
        },
        {
            "id": "kim-dong-san-mulgyeol",
            "title": "김동산과 블루이웃 <물결>",
            "description": t(locale, { ko: "기획, 레코딩, 믹싱, 홍보", en: "Planning, Recording, Mixing, Promotion", vi: "Lên kế hoạch, Thu âm, Mixing, PR/Quảng bá", th: "วางแผน, บันทึกเสียง, มิกซ์, ประชาสัมพันธ์", uz: "Rejalash, Yozuv, Miks, Targ‘ibot" }),
            "image": "https://image.bugsm.co.kr/album/images/500/366018/36601838.jpg",
            "link": "https://orcd.co/mulgyeol",
            "category": "single",
            "services": [
                getService(services.planning),
                getService(services.recording),
                getService(services.mixing),
                getService(services.promotion)
            ],
            "featured": false,
            "artist": "김동산과 블루이웃",
            "credits": {
                "engineer": "Studio NOL (황경하)",
                "musicians": ["김동산과 블루이웃"]
            },
            "productionNotes": {
                "ko": "'물결'은 수원 기반 포크/블루스 뮤지션 김동산이 협업 밴드 블루이웃(류준철 오르간, 이인우 베이스, 김예준 드럼)과 함께 2024년 12월 20일 발매한 싱글이다. 작사·작곡은 김동산, 편곡은 멤버 4인 공동으로 진행됐으며 장르는 포크/포크록으로 분류된다.\n\n녹음과 믹싱을 Studio NOL(황경하)이 맡았고 마스터링은 이재수가 담당했다. 밴드 사운드와 어쿠스틱 포크의 균형, 1970년대 CSNY를 떠올리게 하는 화성 진행이 특징으로 소개된다.",
                "en": "\"Mulgyeol\" (Ripples) is a single by Suwon-based folk/blues singer-songwriter Kim Dong-san with his collaborating band Blueyouth — Ryu Jun-cheol (organ), Lee In-woo (bass), and Kim Ye-jun (drums). Released on December 20, 2024 and distributed by FUGA, the track is categorized as folk/folk rock. Kim Dong-san wrote both the lyrics and music, with arrangement credited jointly to all four musicians.\n\nRecording and mixing were handled by Studio NOL (Hwang Kyung-ha), and mastering was done by Lee Jae-su. The release is described as balancing a strong band sound with lyrical folk, evoking the harmonies of 1970s CSNY."
            }
        },
        {
            "id": "jung-jin-seok-i-ttang",
            "title": "정진석 <이 땅이 니 땅이가>",
            "description": t(locale, { ko: "기획, 편곡, 레코딩, 믹싱, 홍보", en: "Planning, Arrangement, Recording, Mixing, Promotion", vi: "Lên kế hoạch, Hòa âm/Arr., Thu âm, Mixing, PR/Quảng bá", th: "วางแผน, เรียบเรียง, บันทึกเสียง, มิกซ์, ประชาสัมพันธ์", uz: "Rejalash, Aranjim, Yozuv, Miks, Targ‘ibot" }),
            "image": "https://image.bugsm.co.kr/album/images/1000/363228/36322827.jpg",
            "link": "https://orcd.co/7zkgde8",
            "category": "single",
            "services": [
                getService(services.planning),
                getService(services.arrangement),
                getService(services.recording),
                getService(services.mixing),
                getService(services.promotion)
            ],
            "featured": false,
            "artist": "정진석",
            "credits": {
                "engineer": "Studio NOL (황경하)",
                "musicians": ["정진석 (Vocal)"]
            },
            "productionNotes": {
                "ko": "정진석의 싱글 '이 땅이 니 땅이가'는 2024년 12월 2일 발매된 1트랙 싱글로, 작사·작곡·보컬을 정진석 본인이 맡았다. 약 6분 길이의 곡으로, 편곡 크레딧에는 정진석과 함께 Studio NOL의 황경하가 공동 편곡자로 이름을 올렸다.\n\nStudio NOL은 본 작품의 편곡 단계에 참여했으며, 구체적인 녹음·믹싱 세부 정보는 공개된 출처에서 확인되지 않았다.",
                "en": "\"이 땅이 니 땅이가\" is a single by Korean singer-songwriter Jung Jin-seok, released on December 2, 2024 as a one-track single with a running time of approximately six minutes. Jung wrote the lyrics and music and performed the vocals himself, while the arrangement is credited jointly to Jung Jin-seok and Hwang Kyung-ha of Studio NOL.\n\nStudio NOL's involvement is documented at the arrangement stage via Hwang's co-arranger credit on Bugs. Further production details such as recording or mixing specifics are not stated in publicly available sources."
            }
        },
        {
            "id": "hwang-gyeong-ha-nunnokeut",
            "title": "황경하 <눈녹듯>",
            "description": t(locale, { ko: "기획, 작곡, 편곡, 레코딩, 믹싱, 마스터링, 홍보", en: "Planning, Composition, Arrangement, Recording, Mixing, Mastering, Promotion", vi: "Lên kế hoạch, Sáng tác, Hòa âm/Arr., Thu âm, Mixing, Mastering, PR/Quảng bá", th: "วางแผน, แต่งเพลง, เรียบเรียง, บันทึกเสียง, มิกซ์, มาสเตอริ่ง, ประชาสัมพันธ์", uz: "Rejalash, Kompozitsiya, Aranjim, Yozuv, Miks, Mastering, Targ‘ibot" }),
            "image": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/32/6f/3d/326f3d7d-4467-9ebd-2b0e-3bbc8e02e78d/888618381700.jpg/600x600bf-60.jpg",
            "link": "https://www.youtube.com/watch?v=WmI2EPjLr0c",
            "category": "single",
            "services": [
                getService(services.planning),
                getService(services.composition),
                getService(services.arrangement),
                getService(services.recording),
                getService(services.mixing),
                getService(services.mastering),
                getService(services.promotion)
            ],
            "featured": true,
            "artist": "황경하",
            "releaseDate": "2025-01-15",
            "label": "Studio NOL",
            "credits": {
                "engineer": "황경하 (전 과정 총괄)",
                "musicians": ["황경하 (Vocal, Acoustic Guitar, Piano, Synthesizer)"],
                "gear": ["Neumann U87", "DPA 4006", "Neve 1073", "Prophet-6", "Pro Tools HDX", "Dolby Atmos Production Suite"]
            },
            "productionNotes": {
                "ko": "'눈녹듯'은 음악가이자 기획자 황경하가 2024년 8월 5일 발매한 솔로 디지털 싱글이다. Apple Music, Spotify, Bugs, Genie 등 주요 음원 플랫폼에 유통되어 있으며, 단일 곡으로 구성된 싱글 형태로 발표되었다.\n\n황경하는 밴드 노컨트롤 멤버이자 자립음악생산조합 운영위원으로 활동해 왔으며, 11팀이 참여한 사회참여 컴필레이션 '젠트리피케이션'을 기획·제작해 한국대중음악상 선정위원 특별상을 수상한 바 있다. 솔로 활동으로는 2022년 싱글 '가지말아요'에 이어 본 작품을 선보였다. 본 작품은 Studio NOL에서 작업되었다.",
                "en": "\"Like Snow Melting\" (눈녹듯) is a solo digital single by Korean indie musician and producer Hwang Gyeong-ha, released on August 5, 2024. The single-track release is distributed on major streaming platforms including Apple Music, Spotify, Bugs, and Genie.\n\nHwang Gyeong-ha is known as a member of the band No Control and as a longtime operating committee member of the Jarip Music Production Cooperative. He produced the socially engaged compilation album \"Gentrification,\" gathering 11 acts, for which he received a Special Award from the Korean Music Awards selection committee. Following his 2022 single \"Don't Go\" (가지말아요), this track marks another entry in his solo catalog. The work was produced at Studio NOL."
            }
        },
        {
            "id": "namjae-wi-inmul",
            "title": "남자애 <위 인물은 X를 겪고 깨달음을 얻음>",
            "description": t(locale, { ko: "편곡, 레코딩, 믹싱, 마스터링, 홍보", en: "Arrangement, Recording, Mixing, Mastering, Promotion", vi: "Hòa âm/Arr., Thu âm, Mixing, Mastering, PR/Quảng bá", th: "เรียบเรียง, บันทึกเสียง, มิกซ์, มาสเตอริ่ง, ประชาสัมพันธ์", uz: "Aranjim, Yozuv, Miks, Mastering, Targ‘ibot" }),
            "image": "https://cdn.imweb.me/thumbnail/20221109/0132edb19f0bf.jpg",
            "link": "https://music.bugs.co.kr/album/30859733?wl_ref=M_contents_01_04",
            "category": "album",
            "services": [
                getService(services.arrangement),
                getService(services.recording),
                getService(services.mixing),
                getService(services.mastering),
                getService(services.promotion)
            ],
            "featured": true,
            "artist": "남자애",
            "releaseDate": "2022-11-09",
            "label": "Namjae",
            "credits": {
                "engineer": "Studio NOL (황경하)",
                "musicians": ["남자애"],
                "gear": ["Prophet-6", "Moog Sub 37", "Studer A810", "Neumann U87", "Neve 88R"]
            },
            "trackList": [
                { "no": 1, "title": "위 인물은 X를 겪고", "duration": "4:12" },
                { "no": 2, "title": "깨달음의 시작", "duration": "3:45" },
                { "no": 3, "title": "여정", "duration": "5:01" },
                { "no": 4, "title": "깨달음을 얻음", "duration": "4:33" }
            ],
            "productionNotes": {
                "ko": "'위 인물은 X를 겪고 깨달음을 얻음'은 솔로 인디 아티스트 남자애가 2023년 1월 11일 발매한 미니 EP다. 총 5곡, 약 16분 분량으로 인트로를 제외한 나머지 트랙이 모두 타이틀 성격을 갖는다. 2022년 데뷔 싱글 '그는 어쩌다가 게이가 되었을까'에서 시작된 서사를 잇는 후속작으로 소개된다.\n\nBugs에서는 일렉트로닉/인디, Apple Music에서는 K-Pop으로 분류되며, 서울레코드페어를 통해 카세트 테이프 피지컬도 유통됐다. Studio NOL은 본 작품의 작업에 참여했다.",
                "en": "\"To Experience X and Gain Enlightenment\" is a mini EP by Namja-ae (남자애), a Korean solo indie artist, released on January 11, 2023. The five-track EP runs about 16 minutes, with every song aside from the intro positioned as a title track. It continues the narrative arc opened by the artist's 2022 debut single \"How Did He Become Gay?\" (\"그는 어쩌다가 게이가 되었을까\").\n\nBugs files the artist under Electronic/Indie, while Apple Music categorizes the EP as K-Pop. A cassette tape edition was also distributed through Seoul Record Fair. Studio NOL contributed to the production of this release."
            }
        },
        {
            "id": "various-artists-fish-die",
            "title": "Various Artists <물고기는 물이 없으면 죽어요>",
            "description": t(locale, { ko: "기획, 레코딩, 믹싱, 마스터링, 홍보", en: "Planning, Recording, Mixing, Mastering, Promotion", vi: "Lên kế hoạch, Thu âm, Mixing, Mastering, PR/Quảng bá", th: "วางแผน, บันทึกเสียง, มิกซ์, มาสเตอริ่ง, ประชาสัมพันธ์", uz: "Rejalash, Yozuv, Miks, Mastering, Targ‘ibot" }),
            "image": "/images/portfolio5.jpg",
            "link": "https://www.melon.com/album/detail.htm?albumId=11109846",
            "category": "compilation",
            "services": [
                getService(services.planning),
                getService(services.recording),
                getService(services.mixing),
                getService(services.mastering),
                getService(services.promotion)
            ],
            "featured": true,
            "artist": "Various Artists",
            "releaseDate": "2024-06-01",
            "label": "Studio NOL / Melon Music",
            "credits": {
                "engineer": "Studio NOL (황경하)",
                "musicians": ["어린이 보컬 팀", "성인 내레이션"],
                "gear": ["Neumann U87", "Sennheiser MKH 416", "Neve 1073", "Lexicon 480L"]
            },
            "productionNotes": {
                "ko": "《물고기는 물이 없으면 죽어요》는 2022년 11월 24일 발매된 8곡 구성의 옴니버스(Various Artists) 컴필레이션 앨범이다. 맑은, 경하와 세민, 고효경, 길가는 밴드, 초륜, 유동혁, 박치치, 지누 콘다 등 여러 인디 아티스트가 참여했으며, 멜론·벅스 등 주요 국내 음원 플랫폼에서 유통되고 있다.\n\n수록곡들은 록/메탈, 발라드, 인디, 포크/블루스/컨트리 등 여러 장르를 아우른다. Studio NOL이 이 컴필레이션의 작업에 참여했다.",
                "en": "\"Fish Die Without Water\" (물고기는 물이 없으면 죽어요) is an 8-track Various Artists compilation album released on November 24, 2022. Participating indie artists include Maljeun, Gyeongha & Semin, Go Hyokyung, Gilganeun Band, Choryun, Yu Donghyeok, Park Chichi, and Jinu Konda. The compilation is distributed on major Korean music platforms such as Melon and Bugs.\n\nThe tracklist spans multiple genres including rock/metal, ballad, indie, and folk/blues/country. Studio NOL contributed to the production of this compilation."
            }
        },
        {
            "id": "hee-woo-ijeum",
            "title": "희우 <잊음>",
            "description": t(locale, { ko: "편곡, 레코딩, 믹싱, 마스터링, 홍보", en: "Arrangement, Recording, Mixing, Mastering, Promotion", vi: "Hòa âm/Arr., Thu âm, Mixing, Mastering, PR/Quảng bá", th: "เรียบเรียง, บันทึกเสียง, มิกซ์, มาสเตอริ่ง, ประชาสัมพันธ์", uz: "Aranjim, Yozuv, Miks, Mastering, Targ‘ibot" }),
            "image": "https://image.bugsm.co.kr/album/images/500/206343/20634376.jpg",
            "link": "https://www.youtube.com/watch?v=fTmh92Lmo-w",
            "category": "single",
            "services": [
                getService(services.arrangement),
                getService(services.recording),
                getService(services.mixing),
                getService(services.mastering),
                getService(services.promotion)
            ],
            "featured": false,
            "artist": "희우",
            "releaseDate": "2024-04-02",
            "credits": {
                "engineer": "Studio NOL (황경하)",
                "musicians": ["희우 (Vocal)"]
            },
            "productionNotes": {
                "ko": "'잊음'은 소리꾼 희우가 2024년 4월 3일 발매한 디지털 싱글로, 판소리 창법을 기반으로 한 국악·인디 크로스오버 곡이다. 김정은이 작사·작곡을 맡았고, 자이가 일렉트릭 피아노를 연주했으며, 희우가 보컬과 구음을 담당했다. 라이브 무대의 3/4박자 어쿠스틱 편곡을 스튜디오 녹음에 그대로 담아내는 방향으로 작업되었다.\n\n프로듀싱은 Studio NOL의 황경하가 맡았다. 삶의 막막함과 풀리지 않는 문제들을 음악으로 풀어낸 작품으로, 전통적인 창법과 현대적 편곡을 교차시키는 구성이 특징이다.",
                "en": "\"Ijeum\" (Forgetting) is a digital single by Korean solo vocalist Hee-woo, released on April 3, 2024. The track is a gugak–indie crossover built on pansori vocal technique, written and composed by Kim Jeong-eun, with Jai on electric piano and Hee-woo handling lead vocals and gueum (vocalized sounds). The arrangement preserves the 3/4-time acoustic feel of the live performance in the studio recording.\n\nThe single was produced by Hwang Gyeong-ha of Studio NOL. The song channels a sense of helplessness and unresolved difficulty from the artist's own experience, weaving traditional Korean singing with contemporary arrangement."
            }
        },
        {
            "id": "hee-woo-geudaeneun",
            "title": "희우 <그대는>",
            "description": t(locale, { ko: "레코딩, 편곡, 믹싱, 마스터링, 홍보", en: "Recording, Arrangement, Mixing, Mastering, Promotion", vi: "Thu âm, Hòa âm/Arr., Mixing, Mastering, PR/Quảng bá", th: "บันทึกเสียง, เรียบเรียง, มิกซ์, มาสเตอริ่ง, ประชาสัมพันธ์", uz: "Yozuv, Aranjim, Miks, Mastering, Targ‘ibot" }),
            "image": "/images/portfolio1.jpg",
            "link": "https://www.youtube.com/watch?v=j5PuwQVzRe8",
            "category": "single",
            "services": [
                getService(services.recording),
                getService(services.arrangement),
                getService(services.mixing),
                getService(services.mastering),
                getService(services.promotion)
            ],
            "featured": false,
            "artist": "희우",
            "releaseDate": "2024-08-05",
            "credits": {
                "engineer": "Studio NOL (황경하)",
                "musicians": ["희우 (Vocal)"]
            },
            "productionNotes": {
                "ko": "희우는 국악과 인디 포크의 교차 지점에서 활동해 온 여성 솔로 싱어송라이터로, 본인이 작사·작곡·보컬을 직접 맡아 작품을 이어 왔다. '그대는'은 2024년 8월 6일에 디지털 싱글 형태로 발매되어 Bugs 등 주요 음원 사이트에 등재되었고, 아티스트 분류상 인디·국악 카테고리에서 다뤄지고 있다.\n\n본 싱글은 정규나 EP가 아닌 단일 트랙 싱글로 공개되었으며, 희우가 그간 발표해 온 '어느새' 등 이전 작업과 같은 솔로 명의 라인 안에 위치한다. 이 작품의 구체적 세션·믹싱 크레딧은 공개된 출처에서 확인되지 않아 별도 기록을 보류한다.",
                "en": "Heewoo is a Korean female solo singer-songwriter working at the intersection of gugak (Korean traditional music) and indie folk, writing, composing and singing her own material. \"Geudaeneun\" was released on 6 August 2024 as a digital single and is listed on major Korean streaming services including Bugs, where the artist is catalogued under the indie and gugak categories.\n\nThe release is a standalone single rather than an EP or full-length, and sits within the same solo-name catalogue as her earlier work such as the album \"Eoneusae.\" Specific session, mixing or production credits for this particular track are not stated in publicly verifiable sources, so no further production details are recorded here."
            }
        },
        {
            "id": "jinu-konda-burn-in-hell",
            "title": "Jinu Konda <Burn In Hell>",
            "description": t(locale, { ko: "레코딩, 믹싱, 마스터링", en: "Recording, Mixing, Mastering", vi: "Thu âm, Mixing, Mastering", th: "บันทึกเสียง, มิกซ์, มาสเตอริ่ง", uz: "Yozuv, Miks, Mastering" }),
            "image": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/d6/bc/4b/d6bc4b2f-b966-61ad-82a5-460e191013a9/artwork.jpg/600x600bf-60.jpg",
            "link": "https://www.youtube.com/watch?v=OAzlH5QgJJc&list=RDOAzlH5QgJJc&start_radio=1",
            "category": "single",
            "services": [
                getService(services.recording),
                getService(services.mixing),
                getService(services.mastering)
            ],
            "featured": false,
            "artist": "Jinu Konda",
            "releaseDate": "2024-03-26",
            "credits": {
                "engineer": "Studio NOL (황경하)",
                "musicians": ["Jinu Konda (Vocal, Guitar)"],
                "gear": ["Shure SM7B"]
            }
        },
        {
            "id": "namjae-haran",
            "title": "남자애 <하란>",
            "description": t(locale, { ko: "레코딩, 믹싱, 마스터링, 홍보", en: "Recording, Mixing, Mastering, Promotion", vi: "Thu âm, Mixing, Mastering, PR/Quảng bá", th: "บันทึกเสียง, มิกซ์, มาสเตอริ่ง, ประชาสัมพันธ์", uz: "Yozuv, Miks, Mastering, Targ‘ibot" }),
            "image": "https://i.ytimg.com/vi/qzlkFmRBUl4/maxresdefault.jpg",
            "link": "https://www.youtube.com/watch?v=qzlkFmRBUl4",
            "category": "single",
            "services": [
                getService(services.recording),
                getService(services.mixing),
                getService(services.mastering),
                getService(services.promotion)
            ],
            "featured": false,
            "artist": "남자애",
            "credits": {
                "engineer": "Studio NOL (황경하)",
                "musicians": ["남자애"]
            },
            "productionNotes": {
                "ko": "남자애(CHILD B)의 싱글 '하란(夏蘭, Eternal Summer Spark)'은 2024년 8월 29일 발매되었다. 작사·작곡·편곡 모두 남자애 본인이 맡았으며, 여름에 피는 난초처럼 뜨겁고 짙은 사랑의 감정을 표현한 인디·싱어송라이터 곡이다. 한국스마트협동조합이 제작에 참여했고, 같은 날 뮤직비디오가 함께 공개되었다.\n\n남자애는 전라도 출신의 솔로 아티스트로 자신을 퀴어 아티스트로 규정해 왔으며, Rhye와 The Flaming Lips의 영향을 언급해 온 색채와 실험성이 이 곡에도 이어진다. 스튜디오 놀은 한국스마트협동조합 산하 스튜디오로서 본 작업에 관여했다.",
                "en": "\"Haran (夏蘭, Eternal Summer Spark),\" a single by Korean indie singer-songwriter Namjae (CHILD B), was released on August 29, 2024. Written, composed, and arranged entirely by the artist himself, the track evokes the intense, fragrant heat of love through the metaphor of a summer-blooming orchid. The release was produced in cooperation with the Korea Smart Cooperative, and a music video was unveiled on the same day.\n\nNamjae is a solo artist from the Jeolla region who openly identifies as a queer artist, weaving themes of identity and love into his work. His sonic palette, often cited as influenced by Rhye and The Flaming Lips, carries through this dreamlike yet upbeat summer-night track. Studio NOL, operated under the Korea Smart Cooperative, was involved in the production."
            }
        },
        {
            "id": "namjae-haebang",
            "title": "남자애 <해방>",
            "description": t(locale, { ko: "레코딩, 믹싱, 마스터링, 홍보", en: "Recording, Mixing, Mastering, Promotion", vi: "Thu âm, Mixing, Mastering, PR/Quảng bá", th: "บันทึกเสียง, มิกซ์, มาสเตอริ่ง, ประชาสัมพันธ์", uz: "Yozuv, Miks, Mastering, Targ‘ibot" }),
            "image": "/images/portfolio2.jpg",
            "link": "https://www.youtube.com/watch?v=89hXcnBydp4&t=4s",
            "category": "single",
            "services": [
                getService(services.recording),
                getService(services.mixing),
                getService(services.mastering),
                getService(services.promotion)
            ],
            "featured": false,
            "artist": "남자애",
            "releaseDate": "2023-06-30",
            "credits": {
                "engineer": "Studio NOL (황경하)",
                "musicians": ["남자애"]
            },
            "productionNotes": {
                "ko": "남자애(CHILD B)의 싱글 '행복은 X와 X의 손을 맞잡음으로써 탄생하는'(2023년 6월 30일)에 수록된 트랙이다. 작사·작곡·편곡은 남자애 본인이 맡은 솔로 일렉트로닉·인디 작업으로, 아티스트명에는 \"남자+아이\"와 \"남자+사랑\"이라는 이중적 의미가 담겨 있다.\n\nStudio NOL(한국스마트협동조합)에서는 황경하가 편곡 협력과 함께 녹음·믹싱·마스터링 전 과정을 담당했고, 앨범아트는 김성은이 작업했다. 곡과 함께 공식 뮤직비디오도 공개되었다.",
                "en": "\"Haebang\" (Liberation) is a track from CHILD B (남자애)'s single \"Happiness is born from X and X holding hands,\" released on June 30, 2023. Written, composed, and arranged by the artist himself, the project sits within the electronic and indie scene. The stage name carries a double meaning, combining \"boy + child\" and \"boy + love.\"\n\nStudio NOL (Korean Smart Cooperative) handled the production end-to-end: Hwang Kyungha provided arrangement support and was credited with recording, mixing, and mastering, while Kim Seongeun designed the album artwork. An official music video accompanied the release."
            }
        },
        {
            "id": "semin-yeorin-ip",
            "title": "세민 <여린 잎>",
            "description": t(locale, { ko: "기획, 믹싱, 마스터링, 홍보", en: "Planning, Mixing, Mastering, Promotion", vi: "Lên kế hoạch, Mixing, Mastering, PR/Quảng bá", th: "วางแผน, มิกซ์, มาสเตอริ่ง, ประชาสัมพันธ์", uz: "Rejalash, Miks, Mastering, Targ‘ibot" }),
            "image": "https://image.bugsm.co.kr/album/images/500/206169/20616910.jpg",
            "link": "https://www.youtube.com/playlist?list=PLzLIgzZ5BKyBQdDZE7wZRZ3YD-Aocx53W",
            "category": "album",
            "services": [
                getService(services.planning),
                getService(services.mixing),
                getService(services.mastering),
                getService(services.promotion)
            ],
            "featured": false,
            "artist": "세민",
            "credits": {
                "engineer": "Studio NOL (황경하)",
                "musicians": ["세민 (Vocal)"]
            },
            "productionNotes": {
                "ko": "세민의 첫 정규 앨범 '여린 잎'은 2024년 1월 10일 한국스마트협동조합 제작, 바른음원협동조합 유통으로 발매된 8곡짜리 작품이다. 서울 언더그라운드를 기반으로 활동하는 싱어송라이터 세민이 보컬과 피아노를 맡았고, 포크·록·신국악·신스팝을 넘나드는 사운드 안에 장위동 철거민, 쫓겨난 족발집 부부, 해고 노동자, 이산가족 등 사회적 이야기를 담아냈다.\n\n스튜디오 놀이 앨범 전곡의 녹음·믹싱·마스터링을 맡았고, 황경하가 프로듀서로 참여해 기타 연주도 함께 했다. 수록곡은 '가져가세요', '나 2018', '헤어지지 말아요', '포도', '희망', '10분의 거리', '꽃가루', '영영' 8곡으로 구성된다.",
                "en": "Semin's debut full-length album 'Yeorin Ip' (Tender Leaves) was released on January 10, 2024, produced by Korea Smart Cooperative and distributed by Barun Music Cooperative. Semin, a Seoul-based underground singer-songwriter, sings and plays piano across the eight tracks. The album moves between folk, rock, neo-gugak and synth-pop while documenting evicted residents of Jangwi-dong, a displaced jokbal-restaurant couple, dismissed workers and separated families.\n\nStudio NOL handled recording, mixing and mastering for the entire album, with Hwang Kyung-ha serving as producer and also playing guitar. The tracklist consists of 'Take It Away', 'Me 2018', 'Don't Break Up', 'Grape', 'Hope', '10 Minutes Away', 'Pollen' and 'Forever'."
            }
        },
        {
            "id": "young-in-red-dot",
            "title": "영인 <빨간 점>",
            "description": t(locale, { ko: "믹싱, 마스터링", en: "Mixing, Mastering", vi: "Mixing, Mastering", th: "มิกซ์, มาสเตอริ่ง", uz: "Miks, Mastering" }),
            "image": "https://image.bugsm.co.kr/album/images/350/308732/30873239.jpg",
            "link": "https://www.youtube.com/watch?v=NGvBAaiWqU8",
            "category": "single",
            "services": [
                getService(services.mixing),
                getService(services.mastering)
            ],
            "featured": false,
            "artist": "영인",
            "releaseDate": "2023-03-13",
            "credits": {
                "engineer": "Studio NOL (황경하)",
                "musicians": ["영인 (Vocal)"]
            },
            "productionNotes": {
                "ko": "'빨간점'은 싱어송라이터 영인(YOUNG IN)이 2023년 1월 15일에 발표한 EP 'salt'의 수록곡이다. 영인은 2022년 'sea', 'sai' 두 장의 싱글로 데뷔한 솔로 아티스트로, 발라드와 R&B/소울을 기반으로 한 인디 사운드를 들려준다. EP 'salt'는 동명 타이틀곡 'salt'와 'NO ONE'을 포함해 총 세 곡으로 구성되어 있다.\n\n스튜디오 놀은 본 작업의 일부 공정에 참여했다. 보컬의 결과 정서가 또렷이 드러나야 하는 발라드/R&B 계열 작품의 특성에 맞춰, 노래의 호흡과 잔향이 자연스럽게 살아나도록 작업의 균형을 잡는 데 중점을 두었다.",
                "en": "\"Red Dot\" (빨간점) is a track from singer-songwriter YOUNG IN's (영인) EP \"salt,\" released on January 15, 2023. YOUNG IN is a solo Korean artist who debuted in 2022 with two singles, \"sea\" and \"sai,\" working primarily in ballad and R&B/soul-leaning indie territory. The \"salt\" EP comprises three tracks: \"빨간점,\" the title track \"salt,\" and \"NO ONE.\"\n\nStudio NOL contributed to part of the production process for this release. Given the ballad/R&B character of the material — where the singer's breath and emotional contour need to read clearly — the work focused on keeping the vocal forward and letting its natural decay and space sit honestly in the mix."
            }
        },
        {
            "id": "ryu-hyeong-su-haru",
            "title": "류형수 <하루>",
            "description": t(locale, { ko: "기획, 레코딩, 믹싱, 홍보", en: "Planning, Recording, Mixing, Promotion", vi: "Lên kế hoạch, Thu âm, Mixing, PR/Quảng bá", th: "วางแผน, บันทึกเสียง, มิกซ์, ประชาสัมพันธ์", uz: "Rejalash, Yozuv, Miks, Targ‘ibot" }),
            "image": "/images/portfolio3.jpg",
            "link": "https://youtu.be/6vgPysZOQ9c",
            "category": "album",
            "services": [
                getService(services.planning),
                getService(services.recording),
                getService(services.mixing),
                getService(services.promotion)
            ],
            "featured": false,
            "artist": "류형수",
            "releaseDate": "2023-06-20",
            "credits": {
                "engineer": "Studio NOL (황경하)",
                "musicians": ["류형수 (Vocal)"]
            },
            "productionNotes": {
                "ko": "'하루'는 작곡가 류형수의 첫 정규 앨범으로 2023년 6월 30일 발매되었다. 류형수는 서울대 노래모임과 노래패 '새벽'에서 활동하며 민중가수 윤선애가 부른 '저 평등의 땅에', '선언 1·2' 등을 작·편곡한 작곡가로, 2020년부터 유튜브 채널 '류형수 테레비'를 통해 자작곡을 공개해왔다.\n\n앨범에는 '너를 위하여', '먼 훗날(feat. 임정현)', '가게 문을 내리고(feat. 윤선애)', '하루2(feat. 김제섭)', '친구' 등이 수록되었고, 윤선애·임정현·김제섭·강은영·김수린이 객원으로 참여했다. 2023년 6월 24일 소월아트홀에서 발매 기념공연이 진행되었으며, 레코딩과 믹싱은 Studio NOL의 황경하가 맡았다.",
                "en": "\"Haru\" (One Day) is the debut full-length album by composer Ryu Hyeong-su, released on June 30, 2023. Ryu was active in the Seoul National University song circle and the protest-song ensemble \"Saebyeok,\" and is best known as the composer of \"Jeo Pyeongdeungui Tange\" and \"Seoneon 1·2,\" widely performed by people's singer Yoon Sun-ae. Since 2020 he has been releasing original songs through his YouTube channel \"Ryu Hyeong-su TV.\"\n\nThe album includes tracks such as \"Neoreul Wihayeo,\" \"Meon Hutnal (feat. Im Jeong-hyeon),\" \"Gage Mun-eul Naerigo (feat. Yoon Sun-ae),\" \"Haru 2 (feat. Kim Je-seop),\" and \"Chingu,\" with guest vocals by Yoon Sun-ae, Im Jeong-hyeon, Kim Je-seop, Kang Eun-yeong, and Kim Su-rin. A release concert was held on June 24, 2023 at Sowol Art Hall, and recording and mixing were handled by Hwang Gyeong-ha at Studio NOL."
            }
        },
        {
            "id": "eongadeul-self-titled",
            "title": "엉아들 <Self-titled>",
            "description": t(locale, { ko: "기획, 편곡, 레코딩, 믹싱, 홍보", en: "Planning, Arrangement, Recording, Mixing, Promotion", vi: "Lên kế hoạch, Hòa âm/Arr., Thu âm, Mixing, PR/Quảng bá", th: "วางแผน, เรียบเรียง, บันทึกเสียง, มิกซ์, ประชาสัมพันธ์", uz: "Rejalash, Aranjim, Yozuv, Miks, Targ‘ibot" }),
            "image": "https://img.tumblbug.com/eyJidWNrZXQiOiJ0dW1ibGJ1Zy1pbWctYXNzZXRzIiwia2V5Ijoic3RvcnkvNDRhY2E0MWItYzI0Zi00MTZmLWIyNzktNjMxZDZjZDA3MDAyLzA5Y2YzNjhjLThjZTgtNDYxMS1iZTQ4LTcwNzUyZjFiMTE2MS5qcGciLCJlZGl0cyI6eyJyZXNpemUiOnsid2l0aG91dEVubGFyZ2VtZW50Ijp0cnVlLCJ3aWR0aCI6IjEyNDAifX19",
            "link": "https://www.youtube.com/playlist?list=PLlm8-iwS-7gOY8-pmL0Xz25_Hzl2FM-U7",
            "category": "album",
            "services": [
                getService(services.planning),
                getService(services.arrangement),
                getService(services.recording),
                getService(services.mixing),
                getService(services.promotion)
            ],
            "featured": false,
            "artist": "엉아들",
            "credits": {
                "engineer": "Studio NOL (황경하)",
                "musicians": ["엉아들"]
            },
            "productionNotes": {
                "ko": "엉아들은 2022년에 데뷔한 한국 남성 인디 그룹이다. Self-titled EP \"엉아들\"은 2022년 8월 5일에 발매된 미니 앨범으로, 벅스에서는 인디 장르로 분류되어 있다. \"술취한 엉아들을 어찌할까\", \"Drink Song\", \"언덕에 올라\", \"지난 밤 이야기\", \"명태\" 등의 트랙을 담고 있다. 술자리와 일상의 정서를 친근한 어법으로 풀어낸 곡들이 중심이며, 크레딧에는 이영경(작·편곡)과 민정기, 박태종 등이 작사로 참여한 것이 확인된다. Studio NOL은 본 EP의 제작 과정 일부에 참여했다.",
                "en": "Eongadeul (엉아들) is a Korean male indie group that debuted in 2022. Their self-titled EP \"엉아들,\" released on August 5, 2022, is classified as indie on Bugs and contains tracks such as \"What to Do with Drunk Eongadeul,\" \"Drink Song,\" \"On the Hill,\" \"Last Night's Story,\" and \"Pollock.\" The songs revolve around drinking-table camaraderie and everyday sentiment delivered in a friendly, conversational tone. Credits on the EP include Lee Young-kyung (composition/arrangement) and lyric contributions from Min Jung-ki and Park Tae-jong. Studio NOL was involved in part of the production work for this release."
            }
        },
        {
            "id": "kang-ho-jung-self-titled",
            "title": "강호중 <Self-titled>",
            "description": t(locale, { ko: "기획, 편곡, 레코딩, 믹싱, 홍보", en: "Planning, Arrangement, Recording, Mixing, Promotion", vi: "Lên kế hoạch, Hòa âm/Arr., Thu âm, Mixing, PR/Quảng bá", th: "วางแผน, เรียบเรียง, บันทึกเสียง, มิกซ์, ประชาสัมพันธ์", uz: "Rejalash, Aranjim, Yozuv, Miks, Targ‘ibot" }),
            "image": "/images/portfolio4.jpg",
            "link": "https://www.youtube.com/watch?v=emtWqYhuZQw",
            "category": "album",
            "services": [
                getService(services.planning),
                getService(services.arrangement),
                getService(services.recording),
                getService(services.mixing),
                getService(services.promotion)
            ],
            "featured": false,
            "artist": "강호중",
            "releaseDate": "2022-03-07",
            "credits": {
                "engineer": "Studio NOL (황경하)",
                "musicians": ["강호중 (Vocal)"]
            },
            "productionNotes": {
                "ko": "소리꾼 강호중의 셀프타이틀 정규 1집으로, 2022년 3월 26일 국내 음원 사이트에 동시 발매됐다. 재즈 피아니스트 이영경이 협업해 피아노 연주를 중심으로 국악기와 서양악기가 어우러지는 국악·재즈 융합 사운드를 담았으며, 선공개 뮤직비디오는 '그대를 위해 부르는 노래'다.\n\n음반은 한국스마트협동조합이 주관한 텀블벅 크라우드펀딩(2022년 1~3월, 목표 대비 142% 달성)을 통해 제작 자금을 모았고, 같은 해 3월 26일 마포아트센터에서 월드뮤직그룹 공명을 게스트로 초청해 발매기념 단독공연을 열었다.",
                "en": "Self-titled debut full-length album by Korean traditional vocalist Kang Ho-jung, released simultaneously across domestic music services on March 26, 2022. Built around jazz pianist Lee Young-kyung's piano work, the record blends Korean traditional instruments with Western instrumentation into a gugak-meets-jazz fusion, previewed by the lead music video \"A Song for You.\"\n\nThe album was funded through a Tumblbug crowdfunding campaign (January-March 2022) organized by Korea Smart Cooperative, reaching 142% of its goal. A release concert was held the same day at Mapo Art Center, featuring world music group Gongmyoung as a guest act."
            }
        },
        {
            "id": "balkwaehan-cm-song",
            "title": "<발쾌한> CM송",
            "description": t(locale, { ko: "레코딩, 믹싱, 마스터링", en: "Recording, Mixing, Mastering", vi: "Thu âm, Mixing, Mastering", th: "บันทึกเสียง, มิกซ์, มาสเตอริ่ง", uz: "Yozuv, Miks, Mastering" }),
            "image": "/images/portfolio6.jpg",
            "link": "https://www.11st.co.kr/products/5966956725",
            "category": "commercial",
            "services": [
                getService(services.recording),
                getService(services.mixing),
                getService(services.mastering)
            ],
            "featured": false,
            "artist": "발쾌한",
            "releaseDate": "2024-08-20",
            "label": "Balkwaehan",
            "credits": {
                "engineer": "Studio NOL (황경하)",
                "musicians": ["발쾌한"],
                "gear": ["Neumann U87", "Neve 1073", "FabFilter Pro-Q 3", "Waves L1"]
            }
        },
        {
            "id": "various-artists-gentrification",
            "title": "Various Artists <젠트리피케이션>",
            "description": t(locale, { ko: "기획, 레코딩, 믹싱, 홍보", en: "Planning, Recording, Mixing, Promotion", vi: "Lên kế hoạch, Thu âm, Mixing, PR/Quảng bá", th: "วางแผน, บันทึกเสียง, มิกซ์, ประชาสัมพันธ์", uz: "Rejalash, Yozuv, Miks, Targ‘ibot" }),
            "image": "https://image.bugsm.co.kr/album/images/1000/200589/20058944.jpg",
            "link": "https://koreanmusicawards.com/project/various-artists-%EC%A0%A0%ED%8A%B8%EB%A6%AC%ED%94%BC%EC%BC%80%EC%9D%B4%EC%85%98/",
            "category": "compilation",
            "services": [
                getService(services.planning),
                getService(services.recording),
                getService(services.mixing),
                getService(services.promotion)
            ],
            "featured": true,
            "artist": "Various Artists",
            "releaseDate": "2023-11-15",
            "label": "Korean Music Awards",
            "credits": {
                "engineer": "Studio NOL (황경하) — Mastering & Album Direction",
                "musicians": ["Various Artists (KMA 참여 아티스트 전원)"],
                "gear": ["Pro Tools HDX", "Neumann U87", "Neve 88R", "Lexicon 480L"]
            },
            "productionNotes": {
                "ko": "2016년 10월 5일 포크라노스를 통해 발매된 컴필레이션 앨범으로, 자립음악생산조합이 기획했다. 옥바라지골목, 테이크아웃드로잉, 경의선공유지 등 강제 철거 위기에 놓인 공간과 그 곳의 이야기를 음악으로 기록한 프로젝트로, 파다파, 여행하는 작곡가 김동산, 아나킨 프로젝트, 황푸하, 김해원, 여유, 잇다, 심애리·이권형, 우레루나, 박지하·김오키 등 11곡이 수록되어 있다.\n\n황경하가 프로듀스·녹음·믹스를 맡았으며, 마스터링은 소노리떼 마스터링 스튜디오에서 진행했다. 포크, 블루스, 락 등 다양한 인디 사운드가 한 앨범에 모여 젠트리피케이션이라는 사회적 의제를 음악적으로 기록한 작품이다.",
                "en": "Released on October 5, 2016 via Poclanos and planned by the Self-Reliant Music Production Cooperative (자립음악생산조합), this compilation documents Korean indie musicians' response to gentrification. The 11 tracks address sites facing forced eviction such as Okbaraji Alley, Take Out Drawing, and the Gyeongui Line Common Ground, featuring artists including Padapa, Traveling Composer Kim Dong-san, Anakin Project, Hwang Puha, Kim Hae-won, Yeoyou, ITTA, Shim Ae-ri and Lee Gwon-hyung, Ureluna, and Park Jiha with Kim Oki.\n\nHwang Kyung-ha (Studio NOL) served as producer, recording engineer, and mixing engineer, with mastering handled by Sonorite Mastering Studio. The album collects folk, blues, and rock-leaning indie sounds into a single document of the gentrification crisis."
            }
        }
    ];
    return items;
};
