import type { PortfolioCategory, PortfolioItem, AudioTrack } from '../types/data';
import type { Locale } from '../lib/i18n';

// Translation helper
const t = (locale: Locale, dict: { ko: string; en: string; zh?: string; es?: string; vi?: string; th?: string; uz?: string }) => {
    return dict[locale] || dict['en'] || dict['ko'];
};

export const getCategories = (locale: Locale): PortfolioCategory[] => {
    return [
        {
            "id": "all",
            "name": t(locale, { ko: "전체", en: "All", zh: "全部", es: "Todo", vi: "Tất cả", th: "ทั้งหมด", uz: "Barchasi" }),
            "description": t(locale, { ko: "모든 프로젝트", en: "All Projects", zh: "所有项目", es: "Todos los proyectos", vi: "Tất cả dự án", th: "ทุกโปรเจกต์", uz: "Barcha loyihalar" }),
            "color": "#6d28d9"
        },
        {
            "id": "album",
            "name": t(locale, { ko: "앨범", en: "Album", zh: "专辑", es: "Álbum", vi: "Album", th: "อัลบั้ม", uz: "Albom" }),
            "description": t(locale, { ko: "정규 앨범 프로젝트", en: "Full Album Projects", zh: "正规专辑项目", es: "Proyectos de Álbum Completo", vi: "Dự án album đầy đủ", th: "โปรเจกต์อัลบั้มเต็ม", uz: "To‘liq albom loyihalari" }),
            "color": "#db2777"
        },
        {
            "id": "single",
            "name": t(locale, { ko: "싱글", en: "Single", zh: "单曲", es: "Sencillo", vi: "Single", th: "ซิงเกิล", uz: "Singl" }),
            "description": t(locale, { ko: "싱글 곡 프로젝트", en: "Single Song Projects", zh: "单曲项目", es: "Proyectos de Sencillo", vi: "Dự án single", th: "โปรเจกต์ซิงเกิล", uz: "Singl loyihalari" }),
            "color": "#059669"
        },
        {
            "id": "compilation",
            "name": t(locale, { ko: "컴필레이션", en: "Compilation", zh: "合辑", es: "Compilación", vi: "Tuyển tập", th: "รวมเพลง", uz: "Kompilyatsiya" }),
            "description": t(locale, { ko: "아티스트 간 협업 및 컴필레이션 프로젝트", en: "Collaboration & Compilation Projects", zh: "艺术家合作及合辑项目", es: "Proyectos de Colaboración y Compilación", vi: "Dự án hợp tác & tuyển tập", th: "โปรเจกต์คอลแลบและรวมเพลง", uz: "Hamkorlik va kompilyatsiya loyihalari" }),
            "color": "#7c3aed"
        },
        {
            "id": "commercial",
            "name": t(locale, { ko: "상업음악", en: "Commercial", zh: "商业音乐", es: "Comercial", vi: "Thương mại", th: "เชิงพาณิชย์", uz: "Tijoriy" }),
            "description": t(locale, { ko: "CM송 및 상업적 목적의 음악", en: "CM Songs & Commercial Music", zh: "广告歌曲及商业目的音乐", es: "Música Comercial y Jingles", vi: "Bài quảng cáo & nhạc thương mại", th: "เพลงโฆษณาและเพลงเชิงพาณิชย์", uz: "CM qo‘shiqlari va tijoriy musiqa" }),
            "color": "#ea580c"
        }
    ];
};

export const getPortfolioItems = (locale: Locale): PortfolioItem[] => {
    // Service names translation helper
    const getService = (serviceDict: { ko: string; en: string; zh?: string; es?: string; vi?: string; th?: string; uz?: string }) => t(locale, serviceDict);

    // Common service names
    const services = {
        planning: { ko: "기획", en: "Planning", zh: "策划", es: "Planificación", vi: "Lên kế hoạch", th: "วางแผน", uz: "Rejalash" },
        recording: { ko: "레코딩", en: "Recording", zh: "录音", es: "Grabación", vi: "Thu âm", th: "บันทึกเสียง", uz: "Yozuv" },
        mixing: { ko: "믹싱", en: "Mixing", zh: "混音", es: "Mezcla", vi: "Mixing", th: "มิกซ์", uz: "Miks" },
        mastering: { ko: "마스터링", en: "Mastering", zh: "母带", es: "Masterización", vi: "Mastering", th: "มาสเตอริ่ง", uz: "Mastering" },
        promotion: { ko: "홍보", en: "Promotion", zh: "宣传", es: "Promoción", vi: "PR/Quảng bá", th: "ประชาสัมพันธ์", uz: "Targ‘ibot" },
        design: { ko: "아트워크", en: "Artwork/Design", zh: "设计", es: "Arte/Diseño", vi: "Artwork/Thiết kế", th: "อาร์ตเวิร์ก/ดีไซน์", uz: "Artwork/Dizayn" },
        web: { ko: "웹사이트 제작", en: "Web Development", zh: "网站制作", es: "Desarrollo Web", vi: "Phát triển web", th: "พัฒนาเว็บไซต์", uz: "Veb ishlab chiqish" },
        arrangement: { ko: "편곡", en: "Arrangement", zh: "编曲", es: "Arreglos", vi: "Hòa âm/Arr.", th: "เรียบเรียง", uz: "Aranjim" },
        composition: { ko: "작곡", en: "Composition", zh: "作曲", es: "Composición", vi: "Sáng tác", th: "แต่งเพลง", uz: "Kompozitsiya" },
    };

    return [
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
            "artist": "더 프로젝터스"
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
            "artist": "Guitar Choi"
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
            "artist": "하루살이 프로젝트"
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
            "artist": "삼각전파사"
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
            "artist": "자이"
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
            "artist": "허정혁"
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
            "artist": "Various Artists"
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
            "artist": "이서영"
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
            "artist": "자이 x HANASH"
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
            "artist": "모모"
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
            "artist": "여유"
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
            "artist": "나뭇잎들"
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
            "artist": "모레도토요일"
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
            "artist": "김인"
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
            "artist": "까르"
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
            "artist": "남수"
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
            "artist": "김동산과 블루이웃"
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
            "artist": "정진석"
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
            "artist": "황경하"
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
            "artist": "희우"
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
            "artist": "희우"
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
            "artist": "Jinu Konda"
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
            "artist": "남자애"
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
            "artist": "남자애"
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
            "artist": "세민"
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
            "artist": "영인"
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
            "artist": "남자애"
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
            "artist": "류형수"
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
            "artist": "엉아들"
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
            "artist": "강호중"
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
            "artist": "Various Artists"
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
            "artist": "발쾌한"
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
            "artist": "Various Artists"
        }
    ];
};

export const getAudioTracks = (locale: Locale): AudioTrack[] => {
    return [
        {
            "id": "track-1",
            "title": "Fever",
            "artist": "Jai",
            "src": "/audio/jai-fever.mp3",
            "albumArt": "https://image.bugsm.co.kr/album/images/1000/373556/37355636.jpg",
            "duration": "3:44",
            "featured": true,
            "description": t(locale, { ko: "스튜디오 놀에서 레코딩, 믹싱한 트랙", en: "Recorded and Mixed at Studio NOL", vi: "Bản thu và mixing tại Studio NOL", th: "บันทึกและมิกซ์ที่ Studio NOL", uz: "Studio NOL’da yozilgan va miks qilingan trek" })
        },
        {
            "id": "track-2",
            "title": "물결 (Wave)",
            "artist": "김동산과 블루이웃",
            "src": "/audio/wave.mp3",
            "albumArt": "https://image.bugsm.co.kr/album/images/500/366018/36601838.jpg",
            "duration": "4:15",
            "featured": true,
            "description": t(locale, { ko: "스튜디오 놀에서 레코딩, 믹싱한 트랙", en: "Recorded and Mixed at Studio NOL", vi: "Bản thu và mixing tại Studio NOL", th: "บันทึกและมิกซ์ที่ Studio NOL", uz: "Studio NOL’da yozilgan va miks qilingan trek" })
        },
        {
            "id": "track-3",
            "title": "숨 (Breath)",
            "artist": "류형수 (Vocal 김수린)",
            "src": "/audio/sample3.mp3",
            "albumArt": "/images/album3.jpg",
            "duration": "3:58",
            "featured": true,
            "description": t(locale, { ko: "스튜디오 놀에서 레코딩, 믹싱한 트랙", en: "Recorded and Mixed at Studio NOL", vi: "Bản thu và mixing tại Studio NOL", th: "บันทึกและมิกซ์ที่ Studio NOL", uz: "Studio NOL’da yozilgan va miks qilingan trek" })
        }
    ];
};

// Deprecated: For backward compatibility if needed, but should be removed
export const portfolioItems = getPortfolioItems('ko');
export const audioTracks = getAudioTracks('ko');
