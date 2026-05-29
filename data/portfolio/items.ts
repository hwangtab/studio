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
            ]
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
            ]
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
            ]
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
            }
        }
    ];
    return items;
};
