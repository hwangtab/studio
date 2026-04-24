import type { PortfolioCategory, PortfolioItem, AudioTrack } from '../types/data';
import type { Locale } from '../lib/i18n';

// Translation helper
const t = (locale: Locale, dict: { ko: string; en: string; zh?: string; es?: string; vi?: string; th?: string; uz?: string }) => {
    return dict[locale] || dict['en'] || dict['ko'];
};

const enableCache = process.env.NODE_ENV === 'production';
const categoriesCache: Partial<Record<Locale, PortfolioCategory[]>> = {};
const portfolioItemsCache: Partial<Record<Locale, PortfolioItem[]>> = {};
const audioTracksCache: Partial<Record<Locale, AudioTrack[]>> = {};

export const getCategories = (locale: Locale): PortfolioCategory[] => {
    const cached = enableCache ? categoriesCache[locale] : undefined;
    if (cached && enableCache) {
        return cached;
    }

    const categories: PortfolioCategory[] = [
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
    if (enableCache) {
        categoriesCache[locale] = categories;
    }
    return categories;
};

export const getPortfolioItems = (locale: Locale): PortfolioItem[] => {
    const cached = enableCache ? portfolioItemsCache[locale] : undefined;
    if (cached && enableCache) {
        return cached;
    }

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
            "productionNotes": {
                "ko": "티어라이너의 <Bite Me>는 달콤한 멜로디 아래 자의식과 날 선 감정을 함께 얹은 팝 싱글입니다. 장르적으로는 신스 팝과 알앤비의 경계에 있고, 쫀쫀한 보컬과 가볍게 튀는 비트가 곡 전체의 인상을 결정짓는 곡이라 레코딩 단계부터 이 두 요소의 존재감을 어떻게 분리해 살릴지를 가장 먼저 고민했습니다.\n\n보컬 레코딩은 Neumann TLM 103으로 중역의 두께를 먼저 확보한 뒤, 소곤대는 구간과 임팩트 있는 훅을 따로 테이크로 나눠 진행했습니다. 감정을 과하게 밀어붙이기보다 말을 건네듯 자연스럽게 뱉는 쪽을 택했고, 숨소리와 입술 움직임 같은 작은 디테일을 일정 부분 그대로 살려 친밀감을 만들었습니다. 애드립 라인은 별도 트랙으로 쌓아 좌우 공간에 얇게 펼쳐두었어요.\n\n믹싱에서는 보컬의 미드 대역을 비워두는 방향으로 리듬 소스를 정리하고, 킥과 베이스의 로우 엔드는 단단하되 과하게 부풀지 않도록 절제했습니다. 리버브는 짧은 플레이트와 1/8 딜레이를 레이어해 곡의 BPM을 깨지 않도록 했고, 마스터링은 스트리밍 기준 라우드니스를 맞추되 다이내믹을 과하게 뭉개지 않는 쪽으로 마무리했습니다.\n\n완성된 트랙은 이어폰에서 가사의 뉘앙스가 잘 전달되고, 작은 블루투스 스피커에서도 훅이 선명하게 들리는 정도의 균형을 목표로 했습니다. 출근길이나 산책 중처럼 혼자 듣는 환경과 잘 맞아떨어지는 인상의 싱글입니다."
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
            "productionNotes": {
                "ko": "더 프로젝터스의 '바보의 첫 비행'은 인디 록 밴드의 debut single로, 라이브 밴드 연주를 최대한 살리면서 현대적인 사운드로 재해석한 프로젝트입니다. 레코딩은 2박 3일 동안 스튜디오 NOL에서 진행되었으며, 드럼과 일렉트릭 기타는 아날로그 테이프 레이어로, 보컬과 베이스는 디지털 워크스튜디오에서 병렬로 기록했습니다.\n\n믹싱 단계에서는 밴드의 원본 에너지를 해치지 않으면서 클린한 사운드를 만드는 것이 핵심 과제였습니다. 특히 기타 리프와 보컬 멜로디의 공간 배치를 신중하게 조정하여, 각 악기가 고유한 주파수 대역에서 명확하게 들리도록 Equalization를 적용했습니다. 레이어된 보컬 하모니는 스테레오 이미지를 넓히면서도 중앙의 메인 보컬을 선명하게 유지하는 것이 믹싱의 핵심이었습니다.\n\n마스터링에서는 아날로그 감성을 유지하면서 스트리밍 플랫폼에서의 청취 경험을 최적화했습니다. Spotify, Apple Music, YouTube Music 등 주요 플랫폼의 LUFS 기준에 맞춰 동적 범위를 조정하되, 록 음악 고유의 에너지와 다이내믹스는 최대한 보존했습니다.",
                "en": "The Projectors' 'Babu's First Flight' is an indie rock band's debut single, reinterpreted as a live band performance with a modern sound. Recording took place over 2 nights and 1 day at Studio NOL, where drums and electric guitar were captured on analog tape layers, while vocals and bass were recorded in parallel using a digital workstation.\n\nDuring mixing, the core challenge was maintaining the band's original energy while achieving a clean sound. Particular care was taken in spatially placing guitar riffs and vocal melodies, applying equalization so each instrument could be clearly heard in its own frequency range. Layered vocal harmonies were widened in stereo image while keeping the central lead vocal clear.\n\nMastering optimized the listening experience across streaming platforms while preserving analog warmth. Dynamic range was adjusted to meet LUFS standards for Spotify, Apple Music, and YouTube Music, while retaining the energy and dynamics characteristic of rock music."
            },
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
            "productionNotes": {
                "ko": "Guitar Choi의 <Dementia>는 기타리스트가 중심이 된 인스트루멘털 싱글로, 제목처럼 기억이 천천히 흐려지는 듯한 몽환적인 질감을 의도한 곡입니다. 빠른 전개 대신 느린 호흡과 공기감에 무게가 실려 있어, 사운드를 쌓는 밀도보다 비우는 타이밍을 설계하는 쪽이 곡의 분위기를 좌우했습니다.\n\n레코딩 데이터는 아티스트 측에서 받은 트랙 파일을 기반으로 작업했고, 이를 토대로 편집과 톤 정리, 공간 배치를 다시 설계했습니다. 메인 기타 라인은 중역의 단단함을 유지하되 고역의 피킹 노이즈를 과하지 않게 다듬었고, 레이어된 클린 톤과 앰비언트 기타는 좌우에 얇게 펼쳐 곡의 입체감을 만들었습니다. 자극적인 이펙트보다 담담한 리버브와 긴 딜레이로 여운을 길게 끌어주는 쪽을 선택했어요.\n\n믹싱에서는 기타끼리 주파수가 부딪히지 않도록 대역을 정리하고, 곡 후반부로 갈수록 자연스럽게 스테레오 폭이 넓어지도록 오토메이션을 그었습니다. 마스터링은 라우드니스를 무리하게 올리지 않고 다이내믹을 살려, 조용한 구간과 절정 구간의 대비가 그대로 전해지는 방향으로 마무리했습니다.\n\n완성본은 늦은 밤 이어폰으로 천천히 듣기에 잘 어울리는 질감입니다. 아트워크와 홍보 톤도 이 정서를 해치지 않도록 단정하게 통일했습니다."
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
            "productionNotes": {
                "ko": "하루살이 프로젝트 2번 앨범 '알 수 없는 느낌'은 여러 아티스트가 참여한 콜라보레이션 앨범으로, 각 트랙마다 다른 프로듀서와 아티스트가 협업한 결과물입니다. 이 프로젝트의 핵심 개념은 '일상의 순간들을 음악으로 기록한다'는 것이었으며, 각 트랙은 특정 일상의 순간(아침 햇살, 비 오는 날, 지하철 안에서의 생각 등)을 음악적으로 재해석했습니다.\n\n레코딩은 아티스트별로 개별 스튜디오 세션으로 진행되었으며, 믹싱에서는 모든 트랙에 일관된 사운드 아이덴티티를 부여하는 것이 중요했습니다. 각 아티스트의 고유한 보컬 톤을 해치지 않으면서 앨범 전체가 하나의 이야기처럼 들리도록 Equalization와 Reverb 설정을 조정했습니다.\n\n마스터링 단계에서는 앨범의 내러티브 흐름을 고려하여 트랙 간 전환을 자연스럽게 설계했습니다. 특히 앨범의 중간부 곡들에서 감정의 고조를 위해 동적 범위를 의도적으로 확대하고, 마지막 트랙에서는 여운을 남기기 위해 고주파 대역을 부드럽게 감쇠하는 등 앨범 전체의 아크를 고려한 마스터링을 적용했습니다.",
                "en": "Harusali Project's Album 2 'Unknown Feeling' is a collaboration album featuring multiple artists, with each track produced by different producers and artists. The core concept was 'recording moments of daily life as music' — each track musically reinterprets a specific everyday moment (morning sunlight, rainy days, thoughts on the subway).\n\nRecording was conducted in individual studio sessions per artist, and during mixing, giving all tracks a consistent sonic identity was paramount. We adjusted Equalization and Reverb settings to ensure each artist's unique vocal tone was preserved while the entire album sounded like one cohesive story.\n\nMastering considered the album's narrative flow, designing natural transitions between tracks. Dynamic range was intentionally expanded in the middle tracks for emotional crescendo, while the final track used gentle high-frequency attenuation to leave a lingering aftertaste — mastering designed around the album's overall arc."
            },
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
            "productionNotes": {
                "ko": "삼각전파사의 'Dystopia 2025'는 미래 사회의 단면을 음악으로 탐구한 콘셉트 앨범입니다. 이 프로젝트는 Tumblbug 크라우드펀딩을 통해 제작되었으며, 팬들의 참여로 완성된 의미 있는 작품입니다. 앨범의 사운드는 아날로그 신디사이저와 디지털 프로세싱을 결합한 하이브리드 방식으로, 80년대 시네마틱 사운드와 현대적인 일렉트로닉 요소를 혼합했습니다.\n\n레코딩은 아날로그 신디사이저(Prophet-6, Moog Sub 37)를 메인 사운드로 기록하고, 이를 디지털 워크스테이션에서 재처리하는 방식으로 진행되었습니다. 보컬 레이어는 미니멀하게 처리하여 dystopian한 분위기를 강조했으며, 드럼은 라이브 드럼과 시퀀싱된 일렉트릭 드럼을 교차 배치했습니다.\n\n믹싱에서는 아날로그 신디의 따뜻한 주파수 대역과 디지털 일렉트로닉의 날카로운 고주파가 조화롭게 공존하도록 주파수 스펙트럼을 신중하게 설계했습니다. 마스터링에서는 크라우드펀딩 backers에게 제공될 디지패ک 버전과 스트리밍 버전 각각의 청취 환경에 맞춰 동적 범위를 다르게 적용했습니다.",
                "en": "Samgeuk Jeonpasa's 'Dystopia 2025' is a conceptual album exploring facets of future society through music. Produced through Tumblbug crowdfunding, this is a meaningful work completed with fan participation. The album's sound combines analog synthesizers with digital processing — a hybrid approach blending 80s cinematic sound with modern electronic elements.\n\nRecording captured analog synthesizers (Prophet-6, Moog Sub 37) as the primary sound source, then reprocessed them in a digital workstation. Vocals were treated minimally to emphasize the dystopian atmosphere, while drums crossed live drum recordings with sequenced electronic drums.\n\nDuring mixing, the frequency spectrum was carefully designed so that warm analog synth frequency ranges coexisted harmoniously with sharp digital electronic highs. Mastering applied different dynamic ranges for the digipak version (for crowdfunding backers) and streaming versions, each optimized for its listening environment."
            },
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
            "productionNotes": {
                "ko": "자이의 'Golden Hour'는 일몰 시간대의 따뜻한 빛을 음악으로 형상화한 발라드 팝 트랙입니다. 이 곡의 핵심은 보컬의 감정을 최대한 전달하면서도 미니멀한 악기 구성으로 여운을 남기는 것이었습니다. 레코딩에서는 자이의 고유한 보컬 톤(특히 중저음 대역의 따뜻함)을 살리기 위해 Neumann U87 마이크와 Classé préamplificateur를 조합하여 원음에 가까운 사운드를 추출했습니다.\n\n믹싱 단계에서 가장 중요하게 여긴 것은 보컬의 디테일과 공간감의 균형이었습니다. 보컬에는 가벼운 Plate Reverb와 Delay를 적용하여 자연스러운 공간감을 부여하되, 가사의 가독성을 해치지 않는 선에서 처리했습니다. 어쿠스틱 기타와 피아노는 스테레오 이미지를 넓히지 않고 중앙에 집중 배치하여, 보컬이 곡의 중심에 있도록 믹싱했습니다.\n\n프로모션 전략으로는 Soundcloud를 주요 플랫폼으로 선정하여 인디 아티스트로서의 접근성을 높였고, 클라이언트의 요청에 따라 Spotify 및 Apple Music 배포도 병행했습니다. 이 트랙은 이후 자이의 두 번째 앨범 '분홍색 패딩 소녀'의 시그니처 사운드를 정의하는 중요한 작품이 되었습니다.",
                "en": "Jai's 'Golden Hour' is a ballad pop track that musicalizes the warm light of sunset. The key was delivering maximum vocal emotion while leaving a lingering impression with a minimal instrumental arrangement. During recording, we used a Neumann U87 microphone combined with a Classé preamplifier to extract a sound true to Jai's unique vocal tone (especially the warmth of the mid-low range).\n\nIn mixing, the priority was balancing vocal detail with spatial depth. Light Plate Reverb and Delay were applied to vocals to create a natural sense of space, without compromising lyric readability. Acoustic guitar and piano were placed centrally (not widened in stereo) to keep the vocal at the center of the mix.\n\nFor promotion, Soundcloud was selected as the primary platform to enhance accessibility as an indie artist, with Spotify and Apple Music distribution also handled per client request. This track became an important work defining Jai's signature sound for the second album 'Pink Padding Girl'."
            },
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
            "productionNotes": {
                "ko": "허정혁의 '바람 한 점'은 트로트와 팝의 경계에서 새로운 사운드를 시도한 곡입니다. 이 프로젝트의 핵심 과제는 트로트 보컬의 강렬한 표현력을 해치지 않으면서 팝적인 멜로디 라인을 만드는 것이었습니다. 레코딩에서는 허정혁 특유의 파워풀한 보컬을 최대한 살리기 위해 Shure SM7B와 Neumann U87 두 가지 마이크 세션으로 기록했습니다.\n\n믹싱에서는 트로트 보컬의 역동적인 다이내믹스를 보존하면서도 현대 팝 청취자의 기대에 부응하는 명료성을 추가하는 것이 중요했습니다. 보컬에는 가벼운 Compression(4:1 ratio, slow attack)을 적용하여 라이브 공연에서의 자연스러운 다이내믹스를 유지하되, 스트리밍 플랫폼에서의 청취 편의성을 높였습니다.\n\n프로모션 측면에서는 Bugs Music의 알고리즘에 최적화된 태그 전략과 함께, 트로트 팬층과 인디 팝 팬층 모두에게 어필할 수 있는 크로스오버 마케팅을 진행했습니다. 이 트랙은 이후 허정혁의 정규 앨범 발매로 이어지는 중요한 브릿지 작품이 되었습니다.",
                "en": "Heo Jeong-hyuk's 'A Bit of Wind' is a song that attempts a new sound at the boundary between Trot and Pop. The core challenge was creating a pop melody without compromising the powerful expression of trot vocals. During recording, we captured Heo's powerful vocals using two microphone sessions — Shure SM7B and Neumann U87.\n\nIn mixing, it was important to preserve the dynamic range of trot vocals while adding clarity that meets modern pop listeners' expectations. Light compression (4:1 ratio, slow attack) was applied to vocals to maintain natural dynamics from live performances while improving convenience for streaming platforms.\n\nFrom a promotion standpoint, we executed a crossover marketing strategy that optimized Bugs Music algorithm tags while appealing to both trot fans and indie pop fans. This track became an important bridge work leading to Heo's subsequent full album release."
            },
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
            "productionNotes": {
                "ko": "'이름을 모르는 먼 곳의 그대에게'는 여러 아티스트가 참여한 기부 컴필레이션 앨범으로, 수익금 전액이 사회적 약자를 위한 기부금으로 사용되었습니다. 이 프로젝트의 핵심 개념은 '음악으로 연결된 거리'였으며, 각 아티스트는 서로 다른 지역에서 녹음한 자료를 하나로 모아서 하나의 앨범으로 완성했습니다.\n\n레코딩은 각 아티스트의 로컬 스튜디오에서 개별 진행되었으며, Studio NOL에서는 모든 트랙의 최종 마스터링과 앨범 전체의 사운드 일관성을 담당했습니다. 아티스트마다 다른 음질과 녹음 환경에서 나온 자료를 하나의 앨범으로 통합하기 위해, 각 트랙의 주파수 응답을 표준화하는 것이 믹싱의 핵심 과제였습니다.\n\n웹사이트(peaceandmusic.net)는 앨범의 디지털 페이퍼로서 설계되었으며, 각 트랙의 아티스트 정보, 녹음 스토리, 기부 현황을 실시간으로 확인할 수 있는 인터랙티브 경험을 제공했습니다. 이 프로젝트는 음악 산업의 협업 모델과 사회적 기여의 가능성을 동시에 보여준 의미 있는 시도였습니다.",
                "en": "'To Someone Far Away, Unknown' is a charity compilation album featuring multiple artists, with all proceeds donated to support socially vulnerable groups. The core concept was 'distance connected by music' — each artist recorded in their own location, and all materials were unified into one album at Studio NOL.\n\nRecording was conducted individually at each artist's local studio, with Studio NOL handling final mastering of all tracks and the album's overall sonic consistency. Standardizing the frequency response of materials from different audio qualities and recording environments was the core challenge of mixing.\n\nThe website (peaceandmusic.net) was designed as the album's digital paper, providing an interactive experience showing each track's artist information, recording stories, and donation status in real time. This project was a meaningful attempt to simultaneously demonstrate collaboration models and social contribution in the music industry."
            },
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
            "productionNotes": {
                "ko": "이서영의 <우리>는 담백한 어쿠스틱 편성을 바탕으로 가사의 서사를 천천히 들려주는 포크 팝 싱글입니다. 화려한 장식을 덜어낸 자리에 아티스트 고유의 목소리와 숨결이 중심을 잡도록 설계했고, 곡 전반의 호흡을 긴 편으로 가져가 가사 한 줄 한 줄이 제대로 남도록 기획했습니다.\n\n보컬 녹음은 Neumann U87Ai를 기본으로 사용해 중역의 풍성함을 확보했고, 말하듯 부르는 저음부 구간과 멜로디가 뻗어나가는 후렴을 구분해 여러 테이크로 쌓았습니다. 디렉션 포인트는 '힘을 빼는 용기'였어요. 음을 정확히 누르기보다 자연스러운 발성과 자신의 말투에 가까운 억양을 그대로 유지해달라고 요청했고, 발음이 과하게 또렷해지지 않도록 편집에서도 조심했습니다.\n\n어쿠스틱 기타는 두 본 스테레오 마이킹으로 기록해 공간감을 확보했고, 믹싱에서는 보컬이 중앙에서 또렷이 들리도록 1kHz 부근을 가볍게 비워주고 저역의 울림은 단정하게 정리했습니다. 리버브는 짧은 룸과 자연스러운 플레이트를 섞어 과장되지 않는 공간을 만들었습니다.\n\n결과적으로 이 트랙은 통근 시간의 차 안이나 작업실 모니터처럼 조용한 환경에서 차분하게 들을 때 가장 잘 어울립니다. 가사의 온도가 청자에게 그대로 전해지는 것을 목표로 한 싱글입니다."
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
            "productionNotes": {
                "ko": "자이와 HANASH가 함께한 <분홍색 패딩 소녀>는 겨울의 어느 한 장면을 장르 혼합으로 풀어낸 싱글입니다. 자이의 팝 감성과 HANASH의 힙합 톤이 한 곡에서 자연스럽게 교차하기 위해서는 보컬 톤과 리듬 사운드의 대비가 너무 강해지지 않도록 섬세한 조율이 필요했고, 기획 단계부터 두 아티스트의 색을 어떻게 공존시킬지를 핵심 과제로 삼았습니다.\n\n레코딩은 각 아티스트의 구간을 나눠 별도 세션으로 진행했어요. 자이의 멜로디 파트는 Neumann U87Ai로 중역의 공기감을 살리고, HANASH의 랩 파트는 조금 더 가까이 붙어 드라이한 질감을 확보하기 위해 근접 발성 위주로 녹음했습니다. 두 파트가 이어지는 구간은 톤 차이가 단절로 느껴지지 않도록 발성과 딕션 페이스를 맞춰 여러 테이크를 뽑았습니다.\n\n믹싱에서는 보컬 두 명이 같은 주파수 대역에서 싸우지 않도록 미드 영역의 역할을 나눠주고, 랩 구간에서는 드럼의 펀치가 강하게 튀어나오고 팝 구간에서는 신스와 코러스의 공간이 더 넓어지도록 오토메이션을 걸었습니다. 홍보 믹스용 짧은 버전과 정식 버전의 라우드니스 밸런스도 별도로 정리했습니다.\n\n완성본은 이어폰에서 두 아티스트의 음색 차이가 선명하게 느껴지되, 자동차 스테레오나 카페 플레이리스트에서는 하나의 팝 송으로 자연스럽게 이어지는 것을 목표로 했습니다."
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
            "productionNotes": {
                "ko": "모모의 <If this can't be tolerated, what can't be?>는 긴 제목만큼이나 직설적인 감정을 담은 싱글릿입니다. 참을 수 없는 상황에 대한 항의를 담담한 톤의 곡으로 풀어낸 작품으로, 과격한 사운드로 감정을 증폭시키기보다 절제된 편곡 안에서 가사의 무게가 자연스럽게 드러나도록 방향을 잡았습니다.\n\n보컬 녹음은 모모의 평소 말투에 가까운 발성을 유지할 수 있도록 디렉션을 맞췄습니다. 목에 힘을 주는 대신 말하듯 뱉는 구간과, 후반부에서 감정이 차오르는 구간을 나누어 테이크를 따로 쌓았고, 시옷과 히읗의 마찰음이 과하게 강조되지 않도록 편집에서 디에싱을 섬세하게 적용했습니다. 보컬 더블링은 최소한으로 쓰고 메인 한 줄의 명료함을 지키는 쪽을 택했습니다.\n\n믹싱에서는 중역의 보컬 에너지를 방해하지 않는 선에서 드럼과 기타의 공간을 분리했고, 리버브는 짧게 걸어 방 안에서 이야기를 듣는 듯한 거리감을 유지했습니다. 마스터링은 음압을 과하게 올리지 않는 방향으로 정리해 조용한 구간의 여백이 그대로 느껴지도록 했어요.\n\n완성된 트랙은 가사의 의미를 곱씹으며 듣는 청자에게 잘 어울립니다. 늦은 밤 모니터 스피커로 들을 때 뉘앙스가 가장 또렷하게 살아나는 구성의 싱글입니다."
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
            "productionNotes": {
                "ko": "여유의 <서울의 밤 (feat. 정수민)>은 제목 그대로 밤 시간대의 도시 감성을 담은 어반 팝 싱글입니다. 여유의 부드러운 메인 보컬과 정수민의 결이 다른 음색이 한 곡에서 교차하며, 밤의 여러 단면을 다른 톤으로 번갈아 보여주는 구성입니다. 레코딩 단계부터 두 보컬의 존재감을 해치지 않는 편곡 밀도가 중요했습니다.\n\n녹음은 두 아티스트를 각각 다른 세션으로 나눠 진행했고, 메인 보컬은 중역의 벨벳 감이 잘 살아나는 마이크 조합으로 담백하게 기록했습니다. 피처링 파트는 좀 더 공기감이 있는 셋업으로 잡아 같은 곡 안에서도 음색의 레이어가 자연스럽게 느껴지도록 했습니다. 듀엣이 겹치는 구간은 한 명이 들어오면 다른 한 명이 살짝 공간을 내어주는 식으로 발성과 타이밍을 맞춰 여러 테이크를 조합했어요.\n\n믹싱에서는 밤의 질감을 강조하기 위해 킥과 베이스의 서브 영역을 두껍게 가져가되, 중역은 말소리가 또렷이 전달될 수 있도록 정돈했습니다. 리버브는 넓은 홀 대신 중간 길이의 플레이트를 사용해 도시의 실내 공간 같은 감도를 만들었고, 홍보 믹스는 짧은 티저용 섹션을 따로 정리했습니다.\n\n결과적으로 차 안이나 밤 시간대의 이어폰 청취처럼 주변이 조용해진 환경과 잘 어울리는 싱글입니다. 여백의 사용이 곡의 정서를 결정하는 트랙이에요."
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
            "productionNotes": {
                "ko": "나뭇잎들의 <눈 앞의 마음>은 밴드의 초기 질감을 잘 살린 인디 포크 싱글입니다. 제목에서 느껴지는 것처럼 가까이에 있는 마음, 일상 속에서 놓치기 쉬운 감정을 잔잔하게 꺼내어 얹는 곡이라, 편곡과 사운드 전체를 조용한 어쿠스틱 기반 위에 필요한 만큼만 쌓는 방향으로 설계했습니다.\n\n녹음은 어쿠스틱 기타, 보컬, 가벼운 리듬 섹션 순으로 레이어링했습니다. 기타는 두 본 마이크 스테레오 배치로 공간을 먼저 확보한 뒤, 보컬은 Neumann 계열 콘덴서로 중역의 따뜻함을 살리면서 저역의 부풀림은 하이패스로 다듬었습니다. 코러스는 두 명 이상의 보컬이 나뭇잎이 겹치듯 얇게 쌓이도록 테이크를 여러 번 달리해 녹음했어요.\n\n믹싱에서는 기타의 줄 마찰음, 보컬의 숨소리 같은 작은 디테일을 너무 지우지 않는 쪽을 택했습니다. 이런 소리들이 살아 있어야 이 곡의 밀도가 느껴지기 때문입니다. 리버브는 작은 룸 공간 위주로 설정하고, 넓은 홀은 후렴에서만 짧게 들어왔다 사라지도록 오토메이션을 걸었습니다.\n\n완성된 트랙은 야외에서 이어폰으로 걸으며 듣거나, 작은 스피커로 거실에 틀어 놓고 배경처럼 흘릴 때 잘 어울립니다. 과한 가공 없이 편안하게 스며드는 것을 목표로 한 싱글입니다."
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
            "productionNotes": {
                "ko": "모레도토요일의 <We will sail for your freedom>은 밴드가 전하고 싶은 연대의 메시지를 담은 싱글입니다. 제목처럼 누군가의 자유를 향해 함께 항해하겠다는 선언이 곡 전반에 담겨 있고, 그 의지를 과장되지 않게 담아내기 위해 편곡과 사운드 모두 밴드 합주의 질감을 최대한 살리는 방향으로 잡았습니다.\n\n레코딩은 밴드 합주 기반으로 진행하되, 베이직 트랙을 먼저 라이브 세션으로 잡고 보컬과 추가 레이어를 오버더빙하는 방식이었습니다. 드럼은 룸 마이크까지 포함해 공간의 울림을 적극적으로 활용했고, 기타는 앰프 캐비닛 앞과 룸 두 지점을 동시에 받아 질감을 혼합했습니다. 보컬은 선언적인 훅 구간에서 한 발 더 밀어붙이는 톤을 요청했고, 절의 서정적인 구간은 오히려 힘을 빼고 읊조리듯 기록했어요.\n\n믹싱에서는 밴드의 와이드한 질감을 유지하기 위해 드럼 오버헤드와 기타 양쪽 채널을 넓게 펼치고, 베이스는 센터를 단단하게 고정했습니다. 후렴에서 합창이 터질 때 보컬이 묻히지 않도록 미드의 컴프레싱을 세밀하게 걸고, 마스터링은 라이브 공연처럼 다이내믹이 살아 있는 질감을 목표로 정리했습니다.\n\n완성본은 밖에서 걸으며 이어폰으로 듣거나 공연장 PA로 큰 볼륨에서 재생될 때 가장 잘 어울립니다. 연대의 메시지가 에너지로 전해지는 것을 목표로 한 싱글이에요."
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
            "productionNotes": {
                "ko": "김인의 <별을 보러 간 사람>은 제목처럼 어둠 속에서 빛을 찾아 떠난 이의 마음을 그려낸 포크 계열의 싱글입니다. 과장된 편곡 대신 아티스트의 음성과 어쿠스틱 악기의 맞물림을 중심에 두었고, 기획 단계부터 '별빛 아래에서 혼자 부르는 노래'라는 이미지를 기준점으로 삼아 사운드의 밀도를 조절했습니다.\n\n편곡은 어쿠스틱 기타와 스트링 계열의 패드, 최소한의 퍼커션으로 단순하게 구성했습니다. 보컬은 Neumann TLM 103으로 담백하게 받았고, 발성 자체보다 가사의 의미 전달에 집중하도록 디렉션을 맞췄습니다. 긴 호흡의 구간에서는 숨소리를 그대로 남겨 친밀감을 더했고, 하모니는 한 번만 얇게 얹어 본선율을 해치지 않는 선에서 썼습니다.\n\n믹싱에서는 보컬을 중앙 전면에 두고, 기타는 좌우로 적당히 펼쳐 광활한 공간감을 만들되 과도한 리버브는 피했습니다. 대신 테일이 긴 플레이트를 아주 낮은 레벨로 섞어 별이 흩어진 듯한 은은한 잔향을 확보했어요. 마스터링은 조용한 환경에서의 다이내믹이 그대로 살아나도록 라우드니스를 과하게 밀지 않았습니다.\n\n완성된 트랙은 밤늦은 이어폰 청취나 드라이브용 플레이리스트에 잘 어울립니다. 가사의 온도를 아주 가까이서 느끼고 싶은 순간과 잘 맞는 싱글이에요."
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
            "productionNotes": {
                "ko": "까르의 <TRANSITION>은 아티스트의 이름만큼이나 개성 있는 색을 가진 싱글로, 감정이 한 지점에서 다른 지점으로 넘어가는 과정을 음악적 전환으로 풀어낸 곡입니다. 전반부의 차분한 질감과 후반부의 확장되는 에너지를 모두 담아야 했기에, 편곡 단계부터 곡의 흐름 설계가 가장 공을 들인 지점이었습니다.\n\n보컬 녹음은 두 가지 접근을 병행했습니다. 전반부의 읊조리는 구간은 Shure SM7B로 가까이 붙어 친밀한 톤을 확보했고, 후반부 확장 구간은 Neumann U87Ai로 바꿔 중고역의 깨끗함을 살렸습니다. 이렇게 마이크를 나누면 이질감이 생기지 않도록 EQ에서 두 구간의 주파수 커브를 매끄럽게 이어주는 작업이 필요했어요. 편곡에 추가된 신스 패드와 리듬 엘리먼트는 전환점을 극적으로 보이게 하면서도 보컬의 자리를 침범하지 않도록 배치했습니다.\n\n믹싱에서는 곡의 다이내믹을 설계적으로 설계했습니다. 전반부에서 저역을 일부러 가볍게 유지하다가 전환점 직후 서브 베이스가 자연스럽게 내려앉도록 오토메이션을 걸었고, 리버브와 딜레이의 비율도 후반부에서 점차 넓어지도록 조정했습니다. 마스터링은 스트리밍 표준에 맞추되 전환점의 임팩트를 희생하지 않는 쪽으로 정리했어요.\n\n완성본은 큰 볼륨에서 들을 때 전환의 카타르시스가 가장 잘 느껴집니다. 카 오디오나 모니터 스피커 환경에 어울리는 싱글입니다."
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
            "productionNotes": {
                "ko": "남수의 <안녕 (먼 곳의 그대에게)>는 이름처럼 간결한 인사와 함께 먼 곳의 누군가에게 말을 건네는 싱글입니다. 편곡은 피아노와 기타 중심의 담백한 발라드 형식을 택했고, 화려한 장식보다 가사의 울림이 또렷이 전달되도록 사운드 전체를 절제된 밀도로 설계했습니다.\n\n보컬 녹음에서 가장 신경 쓴 부분은 음정보다 '어조'였습니다. 편지를 읽어 내려가듯 자연스럽게 뱉는 톤을 유지하기 위해, 한 번에 길게 이어지는 테이크와 구간별로 나눠 집중해서 뽑은 테이크를 각각 확보했습니다. Neumann 계열 콘덴서 마이크로 중역의 존재감을 살리되, 저역은 근접 효과가 과하지 않도록 로우컷으로 정리했어요. 코러스는 한 번만 얇게 쌓아 원곡의 외로운 분위기를 해치지 않도록 했습니다.\n\n믹싱에서는 피아노를 스테레오 이미지 전반에 넓게 펼치고, 보컬은 중앙에서 가까이 들려오는 거리감으로 배치했습니다. 리버브는 중간 길이의 홀을 아주 낮은 비율로 섞어 공간이 비어 있는 듯한 느낌을 만들었고, 딜레이는 훅 끝에서만 짧게 살려 여운을 남겼어요. 마스터링은 라우드니스를 과하게 올리지 않고 조용한 환경의 청취를 기준으로 정리했습니다.\n\n완성된 트랙은 혼자 있는 늦은 시간이나 비 오는 오후처럼 조용한 순간에 잘 어울리는 싱글입니다. 편지처럼 천천히 읽혀야 의미가 살아나는 곡이에요."
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
            "productionNotes": {
                "ko": "김동산과 블루이웃의 <물결>은 밴드 구성원 각자의 개성이 물결처럼 교차하며 하나의 흐름을 만드는 포크 록 싱글입니다. 라이브 밴드 합주의 질감을 최대한 살리면서도 보컬의 서사가 중심을 잃지 않도록, 편곡과 레코딩 모두 합주의 에너지와 가사의 밀도를 동시에 만족시키는 지점을 찾아 진행했습니다.\n\n레코딩은 리듬 섹션의 베이직 트랙을 라이브로 잡고, 보컬과 솔로 라인을 별도로 오버더빙하는 방식이었습니다. 드럼은 오버헤드 중심의 스테레오 마이킹으로 공간을 먼저 확보했고, 어쿠스틱 기타는 두 본 마이크로 폭을 넓혀 '흐르는' 느낌의 리듬감을 만들었어요. 보컬은 중역의 따뜻함을 가진 마이크로 받아 가사의 한 글자 한 글자가 분명하게 들리도록 디렉션을 맞췄습니다.\n\n믹싱에서는 드럼과 베이스의 저역이 서로 간섭하지 않도록 대역을 나눠주고, 기타는 스테레오 좌우로 적당히 펼쳐 보컬의 자리를 비웠습니다. 리버브는 중간 길이의 플레이트와 짧은 룸을 섞어 밴드가 한 공간에 모여 연주하는 듯한 현장감을 확보했습니다. 마스터링은 차에서 들을 때와 이어폰에서 들을 때의 밸런스를 모두 고려해 정리했어요.\n\n완성된 트랙은 드라이브 플레이리스트나 밴드 사운드를 즐기는 청취 환경에 잘 어울립니다. 합주의 질감이 살아 있는 싱글이에요."
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
            "productionNotes": {
                "ko": "정진석의 <이 땅이 니 땅이가>는 제목부터 사회적 메시지가 또렷한 싱글로, 민중가요 계열의 정서를 동시대 감각으로 다시 풀어낸 곡입니다. 이 프로젝트에서는 메시지를 담는 그릇으로서 사운드의 진정성이 가장 중요했기에, 편곡부터 마이크 선택까지 담백한 접근을 우선했습니다.\n\n보컬 녹음은 아티스트의 말하는 듯한 발성과 선언적인 구간의 힘 있는 발성을 모두 담을 수 있도록 테이크를 여러 번 나눠 진행했습니다. 저역과 중역의 존재감이 든든한 마이크로 받아 가사의 무게를 그대로 전달했고, 발음이 과장되지 않도록 편집에서도 조심스럽게 다듬었어요. 편곡에서는 어쿠스틱 기타와 단단한 베이스, 담백한 드럼의 조합에 브라스 계열의 악센트를 필요한 구간에만 얹어 곡의 파동을 만들었습니다.\n\n믹싱은 '외침의 선명함'에 초점을 맞췄습니다. 후렴 구간에서 보컬이 악기 사이에서 묻히지 않도록 컴프레싱을 안정적으로 걸고, 리듬 섹션의 로우 엔드는 단단하되 뭉개지지 않도록 정리했습니다. 리버브는 좁은 룸 계열을 사용해 집회 현장의 실내 공간 같은 거리감을 만들었고, 마스터링은 다이내믹을 살리되 낭독처럼 듣기에도 어색하지 않은 라우드니스로 마무리했어요.\n\n완성된 트랙은 공연장 PA와 이어폰 양쪽에서 가사의 전달력이 모두 유지되는 것을 목표로 했습니다. 메시지의 무게가 전면에 서는 싱글이에요."
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
            "productionNotes": {
                "ko": "'눈녹듯'은 Studio NOL 대표 황경하가 작곡·편곡·레코딩·믹싱·마스터링까지 전 과정을 직접 담당한 셀프 프로덕션 곡입니다. 제목처럼 눈이 녹아 내리는 듯한 부드러운 이미지를 음악으로 형상화한 어쿠스틱 팝 트랙입니다. 이 곡의 핵심 사운드는 어쿠스틱 기타와 피아노의 미니멀한 조합에 보컬의 감성을 더한 것이 특징입니다.\n\n작곡 단계에서는 C Major 스케일을 기반으로 한 단순한 코드 진행(IV–V–vi–I)을 사용하되, 보컬 멜로디에 독특한 반음계 이동을 넣어 친숙함과 새로움의 균형을 맞췄습니다. 편곡에서는 어쿠스틱 기타 아르페지오를 리듬 섹션으로, 피아노를 화성적 지지로 배치하여 보컬이 곡의 중심에 있도록 구성했습니다.\n\n레코딩부터 마스터링까지 전 과정을 Studio NOL에서 진행한 이 프로젝트는, 스튜디오 NOL의 기술력을 총체적으로 보여주는 포트폴리오입니다. 특히 보컬 레코딩에서는 미세한 숨소리까지 포함하여 자연스러운 라이브 감성을 살렸으며, 마스터링에서는 애플 뮤직의 Spatial Audio 환경에서도 최적의 청취 경험을 제공하도록 Dolby Atmos 믹스를 병행했습니다.",
                "en": "'NunNokDeut' (Like Melting Snow) is a self-produced track where Studio NOL's representative Hwang Gyeong-ha handled composition, arrangement, recording, mixing, and mastering. Named after the image of melting snow, this is an acoustic pop track featuring a minimal combination of acoustic guitar and piano with vocal emotion.\n\nDuring composition, simple chord progressions (IV–V–vi–I) in C Major were used, but unique chromatic movements in the vocal melody created a balance of familiarity and novelty. In arrangement, acoustic guitar arpeggios were placed as the rhythm section and piano as harmonic support, structuring the song so the vocal remains central.\n\nThis project, from recording to mastering entirely at Studio NOL, is a comprehensive portfolio showcasing the studio's technical capabilities. Vocal recording captured even subtle breath sounds for a natural live feel, and mastering included a Dolby Atmos mix for optimal listening in Apple Music's Spatial Audio environment."
            },
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
            "productionNotes": {
                "ko": "남자애의 '위 인물은 X를 겪고 깨달음을 얻음'은 앨범 전체를 하나의 내러티브로 설계한 콘셉트 앨범입니다. 앨범의 제목 자체가 '특정 인물이 경험을 통해 깨달음을 얻는 과정'을 의미하며, 각 트랙은 이 내러티브의 특정 단계를 음악적으로 표현합니다. 이 프로젝트의 가장 큰 특징은 모든 트랙이 동일한 사운드 아이덴티티를 공유하도록 설계되었다는 점입니다.\n\n편곡 단계에서 각 트랙의 장르(인디 록, 일렉트로닉, 포크 등)는 달랐지만, 공통의 사운드 컬러(특히 아날로그 신디사이저의 따뜻한 주파수)를 유지하기 위해 모든 트랙에 Prophet-6와 Moog 신디사이저를 공통 악기로 사용했습니다. 레코딩은 3박 4일 동안 Studio NOL에서 진행되었으며, 라이브 밴드 연주를 아날로그 테이프에 기록한 후 디지털 워크스테이션에서 재처리하는 하이브리드 방식을 적용했습니다.\n\n믹싱과 마스터링에서는 앨범 전체의 내러티브 아크를 고려하여, 첫 트랙은 생생하고 직접적인 사운드로, 중간 트랙은 점차 공간감과 깊이를 추가하며, 마지막 트랙은 여운과 해체를 통해 내러티브를 마무리하도록 설계했습니다.",
                "en": "Namjae's 'The Character Experienced X and Gained Enlightenment' is a concept album where the entire album is designed as one narrative. The album title itself means 'a specific character's process of gaining enlightenment through experience,' with each track musically expressing a specific stage of this narrative. The most distinctive feature is that all tracks share the same sonic identity.\n\nDuring arrangement, while each track's genre (indie rock, electronic, folk) differed, the same sound color (especially warm analog synthesizer frequency) was maintained by using Prophet-6 and Moog synthesizers as common instruments across all tracks. Recording took place over 3 nights and 4 days at Studio NOL, applying a hybrid method of recording live band performance on analog tape and reprocessing in a digital workstation.\n\nDuring mixing and mastering, the album's narrative arc was considered — the first track has a vivid, direct sound; middle tracks gradually add spatial depth; and the final track concludes the narrative through lingering resonance and deconstruction."
            },
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
            "productionNotes": {
                "ko": "'물고기는 물이 없으면 죽어요'는 어린이 음악을 전문으로 하는 프로젝트로, 아이들의 청취 특성에 맞춘 사운드 디자인이 핵심인 프로젝트입니다. 이 앨범의 제목은 '물고기에게 물이 없으면 죽는다'는 당연한 진리를 아이들의 언어로 표현한 것으로, 자연의 소중함을 알리는 교육적 목적의 음악 앨범입니다.\n\n레코딩에서는 어린이 보컬의 자연스러운 표현(말더듬, 웃음, 즉흥적인 소리)을 최대한 존중하는 방식으로 진행되었습니다. 성인 보컬 레코딩과는 달리, 어린이 보컬은 짧은 세션(각 30분 이내)으로 나누어 진행하며, 게임처럼 녹음을 유도하는 특별한 기법이 사용되었습니다.\n\n믹싱에서는 어린이 청취자의 주파수 감수성을 고려하여, 고주파 대역(8kHz 이상)을 과도하게 강조하지 않으면서도 명확한 명료성을 유지하는 것이 중요했습니다. 마스터링에서는 멜론 등 국내 주요 스트리밍 플랫폼의 어린이 콘텐츠 기준에 맞춰 동적 범위를 조정하되, 음악적 재미와 교육적 메시지의 균형을 유지했습니다.",
                "en": "'Fish Die Without Water' is a children's music project where sound design tailored to children's listening characteristics was the core. The album title expresses the obvious truth 'fish die without water' in children's language — an educational music album promoting the value of nature.\n\nDuring recording, children's natural vocal expressions (stuttering, laughter, improvised sounds) were respected as much as possible. Unlike adult vocal recording, children's vocals were recorded in short sessions (under 30 minutes each), with special techniques used to encourage recording like a game.\n\nDuring mixing, considering children's frequency sensitivity, it was important not to overemphasize high-frequency ranges (above 8kHz) while maintaining clear intelligibility. Mastering adjusted dynamic range to meet Korean streaming platforms' children's content standards, while maintaining the balance between musical fun and educational messaging."
            },
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
            "productionNotes": {
                "ko": "희우의 <잊음>은 제목처럼 흘러가는 기억을 담담히 놓아주는 정서의 싱글입니다. 편곡은 담백한 어쿠스틱 기반을 유지하되, 후반부로 갈수록 잔잔한 스트링 계열 요소가 슬며시 더해지는 구조로 잡아 '잊어가는 과정'이 음악적으로 자연스럽게 드러나도록 설계했습니다.\n\n녹음 데이터는 아티스트 측에서 제공받은 자료를 바탕으로 편곡과 편집을 다시 정리하고, 필요한 추가 녹음만 선택적으로 진행했습니다. 보컬 라인은 발음과 호흡의 디테일을 살리되 지나친 강조는 피해 편집에서 톤을 섬세하게 다듬었고, 어쿠스틱 기타는 줄의 결이 느껴질 정도로 자연스러운 질감을 유지했습니다. 코러스는 거의 속삭이는 수준으로만 남겨 중심이 흐트러지지 않도록 했어요.\n\n믹싱에서는 보컬의 가까운 거리감과 악기의 여백을 모두 살리기 위해 리버브를 층층이 달리 적용했습니다. 보컬에는 짧은 플레이트를 가볍게만 걸고, 배경의 기타와 패드에는 좀 더 긴 홀을 써 공간의 원근감을 분리했습니다. 마스터링은 라우드니스를 무리하지 않게 올리고 다이내믹의 자연스러운 감쇠를 그대로 살렸습니다.\n\n완성된 트랙은 고요한 시간, 이어폰이나 작은 스피커로 듣기에 잘 어울리는 싱글입니다. 조용히 옆에 두고 흘려듣는 청취 경험에 최적화된 곡이에요."
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
            "productionNotes": {
                "ko": "희우의 <그대는>은 <잊음>과 이어지는 결을 가진 싱글로, 이번에는 떠난 이가 아닌 지금 마주보고 있는 상대에게 건네는 문장을 담고 있습니다. 편곡은 잔잔한 미디엄 템포의 포크 팝 방향으로 잡고, 아티스트 특유의 담담한 톤이 중심에서 이탈하지 않도록 주변 악기의 밀도를 조절했습니다.\n\n레코딩은 보컬 테이크를 집중적으로 여러 번 뽑는 방식으로 진행했습니다. 하나의 테이크에서 완성된 선언을 만들기보다, 절마다 조금씩 달라지는 감정선을 각기 다른 테이크로 쌓아 편집에서 조합하는 방향을 택했어요. 어쿠스틱 기타는 피킹 소리가 또렷이 들리도록 두 본 마이크로 가까운 거리에서 잡았고, 후반부에는 편곡을 풍성하게 하기 위한 간단한 현악 소스를 얇게 더했습니다.\n\n믹싱에서는 보컬의 숨소리와 기타의 줄 마찰음을 남기되 불필요한 잡음은 정돈하는 균형이 관건이었습니다. EQ에서는 보컬의 중역이 다른 악기에 묻히지 않도록 1kHz 부근을 가볍게 비워주고, 리버브는 짧은 플레이트를 기본으로 쓰되 후렴에서만 길이를 살짝 늘려 공간이 자연스럽게 넓어지도록 했습니다. 마스터링은 다이내믹이 너무 압축되지 않도록 보수적인 설정으로 마무리했어요.\n\n완성된 트랙은 혼자 있는 시간의 플레이리스트에 잘 어울립니다. 고요한 거실이나 작업실에서 낮은 볼륨으로 틀어두기에 적합한 싱글이에요."
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
            "productionNotes": {
                "ko": "Jinu Konda의 <Burn In Hell>은 제목처럼 직선적인 에너지를 담은 얼터너티브 록 계열의 싱글입니다. 분노에 가까운 감정을 거침없이 뱉는 보컬과 단단한 기타 리프가 중심에 놓이는 곡이라, 레코딩부터 마스터링까지 '에너지를 잃지 않는 것'이 전 과정의 기준선이었습니다.\n\n보컬 녹음은 Shure SM7B를 사용해 근접 발성의 두께를 확보했습니다. 고음 구간에서 목소리가 깨지기 직전의 질감을 살리는 것이 디렉션의 핵심이었고, 여러 테이크를 다른 게인 스테이지로 확보해 편집에서 가장 거친 결의 테이크를 메인으로 삼았습니다. 기타는 앰프 앞에 다이나믹 마이크와 리본 마이크를 함께 걸어 두 가지 성격의 질감을 동시에 잡았고, 믹스에서 두 소스를 비율로 섞어 중역의 밀도를 설계했어요.\n\n믹싱에서는 드럼 룸 마이크의 게인을 의도적으로 과하게 받아 자연스러운 디스토션 톤을 섞었고, 베이스는 픽 어택이 선명하게 들리도록 고역을 살렸습니다. 리버브는 거의 쓰지 않고 짧은 룸 감각만 남겨 밀폐된 공간에서 소리치는 듯한 질감을 만들었습니다. 마스터링은 라우드니스를 충분히 확보하되, 림프가 뭉개지지 않는 선에서 정리했습니다.\n\n완성된 트랙은 카 오디오나 헤드폰 고음량 재생에서 가장 잘 어울립니다. 에너지를 그대로 받아내는 청취 환경을 전제로 한 싱글입니다."
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
            "productionNotes": {
                "ko": "남자애의 <하란>은 아티스트의 이전 작업에서 보여준 내러티브 감각을 싱글 포맷으로 압축한 곡입니다. 밴드 편성의 에너지를 유지하면서도 한 곡 안에서 기승전결이 분명하게 드러나도록 구성되어 있어, 편곡과 레코딩의 합이 곡의 성패를 결정하는 프로젝트였습니다.\n\n드럼은 룸 마이크 포함 멀티 마이킹으로 공간의 울림을 확보했고, 베이스는 앰프 마이킹과 DI를 병행해 저역의 단단함과 중역의 어택을 동시에 잡았습니다. 기타는 두 대를 스테레오로 배치하되 각각 다른 앰프 캐릭터를 사용해 리듬 기타의 좌우 폭을 넓혔고, 솔로 라인은 별도 트랙으로 여러 번 뽑아 가장 표현력이 좋은 구간을 조합했습니다. 보컬은 절의 차분한 구간과 후렴의 강한 구간을 나눠 테이크를 관리했어요.\n\n믹싱에서는 드럼과 베이스의 저역 정리에 가장 많은 시간을 썼습니다. 라이브 합주의 질감을 지키면서도 각 악기의 어택이 분명하게 들리도록 트랜지언트를 세밀하게 다뤘고, 기타 레이어는 공간을 겹치지 않게 배치했습니다. 마스터링은 록 편성의 다이내믹이 뭉개지지 않는 선에서 라우드니스를 확보해 스트리밍 환경에 맞췄습니다.\n\n완성본은 이어폰과 공연장 PA 양쪽에서 에너지가 살아 있도록 설계했습니다. 밴드 사운드 애호가의 플레이리스트와 자연스럽게 어우러지는 싱글이에요."
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
            "productionNotes": {
                "ko": "남자애의 <해방>은 제목처럼 답답한 상황에서 벗어나고자 하는 충동을 밴드 사운드로 표현한 싱글입니다. 이전 작업들과 같은 밴드 포맷이지만, 이 곡에서는 특히 리듬 섹션의 추진력이 중심에 서도록 편곡과 믹스의 방향을 맞췄습니다.\n\n드럼은 킥과 스네어의 어택이 직선적으로 드러나도록 클로즈 마이크 비율을 조금 더 높였고, 오버헤드에서는 심벌의 선명함을 담담하게 받았습니다. 베이스는 그루브의 움직임이 분명하게 느껴지도록 픽 플레이 톤과 핑거 플레이 톤을 따로 테이크로 뽑아 곡 구간별로 교체해 썼어요. 기타는 리듬 파트와 리드 파트를 명확히 분리하고, 보컬은 절의 서사적 구간과 후렴의 해방감 있는 구간을 다른 거리감으로 녹음했습니다.\n\n믹싱에서는 리듬 섹션을 중심축으로 두고 나머지 요소를 배치했습니다. 킥의 저역은 단단하게, 베이스는 그 위에서 선명하게 노래할 수 있도록 주파수 분할을 세밀히 했고, 기타 레이어는 좌우로 펼쳐 공간을 만들었습니다. 리버브는 거의 드라이한 편으로 유지해 곡의 직선적인 에너지를 해치지 않았습니다. 마스터링은 음압을 충분히 가져가되 다이내믹이 살아있는 선에서 정리했어요.\n\n완성된 트랙은 운동할 때나 차 안에서 큰 볼륨으로 들을 때 가장 잘 맞습니다. 해방감이 실제 에너지로 전해지는 것을 목표로 한 싱글이에요."
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
            "productionNotes": {
                "ko": "세민의 <여린 잎>은 싱어송라이터의 첫 앨범 포지션에 해당하는 작품으로, 제목이 암시하듯 이제 막 돋아난 감정들을 담아낸 작업입니다. 편곡은 어쿠스틱 위주의 포크 프레임 안에 각 트랙이 서로 다른 질감을 가지되, 앨범 전체를 관통하는 담백한 사운드 통일성이 흐르도록 설계했습니다.\n\n이 프로젝트에서 Studio NOL은 기획과 믹싱, 마스터링을 담당했습니다. 녹음 데이터를 인계받은 뒤 트랙별 편집과 톤 정리, 그리고 앨범 전체의 흐름을 재구성하는 작업을 거쳤어요. 보컬은 가능한 선에서 숨소리와 호흡 타이밍을 그대로 살리고, 악기 소스는 각 트랙의 장르적 뉘앙스를 해치지 않는 범위에서 공간감을 정돈했습니다.\n\n믹싱에서는 앨범 흐름을 가장 중요한 기준으로 삼았습니다. 초반 트랙은 가까운 거리의 친밀한 질감으로, 중반부는 조금 더 넓은 공간감이 열리도록, 후반부는 다시 따뜻한 거리로 수렴하도록 리버브와 EQ의 방향을 설계했어요. 트랙 간 음량 편차도 스트리밍에서 연속 재생했을 때 이질감이 없도록 마스터링에서 세밀하게 맞췄습니다.\n\n완성된 앨범은 처음부터 끝까지 한 번에 들었을 때 감정선의 결이 잘 살아납니다. 혼자 있는 저녁 시간의 이어폰 청취나 작업 중 백그라운드 플레이에 잘 어울리는 작품이에요."
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
            "productionNotes": {
                "ko": "영인의 <빨간 점>은 작은 흔적에서 시작되는 감정의 번짐을 소재로 한 싱글입니다. Studio NOL은 이 프로젝트에서 믹싱과 마스터링을 담당했고, 아티스트 측에서 완성한 편곡과 녹음 데이터를 바탕으로 전체 사운드의 밀도와 공간감을 정리하는 역할을 맡았습니다.\n\n인계받은 트랙에서 가장 먼저 살핀 것은 보컬의 존재감이었습니다. 원본 녹음의 톤이 이미 좋은 결을 가지고 있어, 큰 수정 없이 중역의 따뜻함을 해치지 않는 선에서 EQ로 다른 악기와의 간섭을 정리했어요. 작은 호흡과 입술 움직임은 거의 그대로 남겨 친밀한 거리감을 유지했습니다. 악기 소스들은 각자의 대역 역할이 분명해지도록 하이패스와 미드 EQ를 세밀하게 조정했습니다.\n\n공간계 처리에서는 보컬에 짧은 플레이트를 낮은 비율로 얹고, 배경 악기에는 중간 길이의 홀을 더해 원근감을 분리했습니다. 보컬과 악기가 같은 공간에 있는 듯하면서도 보컬이 한 발 앞에 나와 있는 인상을 만들었어요. 마스터링은 스트리밍 플랫폼의 라우드니스 기준에 맞추되, 다이내믹을 지나치게 누르지 않는 선에서 정리했습니다.\n\n완성된 트랙은 이어폰 청취 환경에서 가사와 호흡의 디테일이 가장 잘 전달됩니다. 조용한 순간에 반복해서 듣기 좋은 질감의 싱글이에요."
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
            "productionNotes": {
                "ko": "남자애의 앨범 <위 인물은 X를 겪고 깨달음을 얻음>은 한 인물의 내면 변화를 트랙별로 따라가는 서사적 구성의 작품입니다. Studio NOL에서는 편곡부터 레코딩, 믹싱, 마스터링까지 제작의 중심 공정을 함께 진행했고, 각 트랙이 독립된 장면이면서도 하나의 이야기로 이어지도록 사운드 설계에 공을 들였습니다.\n\n녹음은 밴드 합주 베이스를 먼저 라이브 세션으로 확보한 뒤, 보컬과 추가 레이어를 오버더빙하는 순서로 진행되었습니다. 드럼은 룸 톤을 포함한 멀티 마이킹으로 공간을 확보했고, 보컬은 트랙별로 서로 다른 거리감과 감정선을 요구하는 구성이었기에 테이크 디렉션을 세밀하게 나눴어요. 편곡에서는 모든 트랙에 공통으로 등장하는 톤 컬러를 하나 설정해, 앨범을 통청할 때 흐름이 끊기지 않도록 했습니다.\n\n믹싱은 앨범 전체의 아크를 먼저 그린 뒤 각 트랙의 세부 작업으로 내려갔습니다. 초반 트랙은 직선적인 사운드로, 중반은 점점 공간을 열어가며, 후반부는 여백이 많아지는 방향으로 공간감을 설계했어요. 마스터링은 트랙 간 음량과 톤이 연속 재생에서 자연스럽게 이어지도록 정리했고, 라우드니스는 스트리밍 기준에 맞추되 다이내믹을 과하게 누르지 않았습니다.\n\n완성본은 한 번에 처음부터 끝까지 들을 때 앨범의 설계가 가장 잘 드러납니다. 집중해서 듣는 환경을 전제로 한 작업이에요."
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
            "productionNotes": {
                "ko": "류형수의 <하루>는 하루라는 시간 단위를 통해 평범한 일상의 결을 드러내는 앨범입니다. 트랙마다 다른 시간대의 장면을 담고 있어, 앨범 전체가 아침부터 밤까지의 흐름으로 읽히는 구성을 가집니다. Studio NOL은 이 프로젝트의 기획부터 레코딩, 믹싱까지 참여했고, 일상의 질감을 그대로 담는 사운드 방향을 일찍부터 공유했습니다.\n\n녹음은 어쿠스틱 기반의 편성을 중심에 두고, 각 트랙이 요구하는 악기 구성만 최소한으로 추가하는 방식으로 진행했어요. 기타와 피아노는 두 본 스테레오 마이킹으로 공기감을 확보했고, 보컬은 가사의 생활 언어 같은 뉘앙스를 살려 말하듯 뱉는 톤을 유지했습니다. 피처 보컬이 들어오는 구간은 메인 보컬과의 거리감을 일부러 다르게 설정해 대화처럼 들리도록 디렉션을 맞췄어요.\n\n믹싱에서는 트랙 간 공간감의 변화가 앨범의 '시간의 흐름'을 드러내도록 설계했습니다. 아침에 해당하는 트랙은 짧고 밝은 리버브로, 한낮 트랙은 좀 더 드라이하게, 저녁 트랙은 공간을 넓혀 여백을 만드는 식이었어요. 홍보용 짧은 편집본은 원곡의 분위기를 희생하지 않는 선에서 별도로 정리했습니다.\n\n완성된 앨범은 하루 중 여러 시간대에 나눠 듣거나, 통째로 한 번 들을 때 각각 다른 맛이 납니다. 배경처럼 자연스럽게 흐르는 청취 경험에 잘 어울리는 작업이에요."
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
            "productionNotes": {
                "ko": "엉아들의 셀프 타이틀 앨범은 밴드가 자신들의 이름을 처음으로 내세우는 작품으로, 멤버 각자의 색깔과 밴드라는 하나의 합체를 모두 담아내야 했습니다. 기획 단계부터 '멤버 소개 앨범'에 가까운 방향으로 잡고, 각 트랙마다 특정 멤버의 성격이 드러나도록 편곡 방향을 나눠 설계했어요.\n\n레코딩은 합주실의 공간감을 살리는 방향으로 진행했습니다. 드럼과 베이스, 기타는 라이브 베이직 트랙으로 먼저 잡고, 각 멤버가 솔로로 전면에 드러나는 구간은 별도 오버더빙으로 추가했어요. 보컬은 트랙마다 다른 멤버가 메인을 맡아 마이크 선택과 발성 디렉션도 그에 맞춰 조정했고, 코러스는 전원이 함께 녹음해 밴드 특유의 합창 질감을 확보했습니다.\n\n믹싱에서는 각 트랙의 개성이 흐려지지 않도록 EQ 방향을 다르게 잡되, 앨범 전체를 통청했을 때 연결감이 끊어지지 않도록 공통 컴프레싱 체인을 뒷단에 걸었습니다. 공간계는 트랙별로 달리 설정해 짧은 룸, 긴 홀 등을 적절히 섞었고, 마스터링에서는 멤버별 구간의 음량이 들쑥날쑥하지 않도록 섬세하게 조정했어요.\n\n완성된 앨범은 라이브 공연을 그대로 옮긴 듯한 질감이 살아 있어, 밴드 사운드를 좋아하는 청취 환경에 잘 어울립니다. 멤버들의 얼굴이 차례로 떠오르는 구성의 앨범이에요."
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
            "productionNotes": {
                "ko": "강호중의 셀프 타이틀 앨범은 싱어송라이터의 본격적인 정규작에 해당합니다. 이름을 그대로 타이틀로 내건 만큼, 아티스트의 정체성을 드러내는 기준선이 되는 작업이었고, 기획부터 편곡과 레코딩, 믹싱까지 담당하며 이후 이어질 그의 디스코그래피가 참조할 수 있는 사운드 컬러를 설계하는 것이 목표였습니다.\n\n편곡은 어쿠스틱 기타와 피아노를 기본 축으로 두고, 트랙마다 하나의 악기 레이어만 추가하는 절제된 접근을 택했습니다. 보컬 녹음은 아티스트의 발성이 자연스럽게 나오는 거리와 발음 페이스를 찾는 데 시간을 들였어요. 긴 호흡의 구간이 많아 한 번에 길게 이어지는 테이크를 여러 개 확보해 편집에서 가장 안정적인 결의 테이크를 메인으로 골랐습니다. 코러스는 얇게 한 줄만 얹어 메인의 중심이 흐트러지지 않도록 했습니다.\n\n믹싱에서는 트랙 간 사운드의 균일성을 우선했습니다. 앨범을 처음부터 끝까지 들었을 때 특정 트랙만 튀지 않도록 EQ 커브를 맞추고, 리버브의 성격도 크게 두 가지 범주 안에서만 사용해 통일감을 확보했어요. 마스터링은 싱어송라이터 장르의 일반적인 라우드니스 기준보다 보수적으로 잡아 다이내믹을 살렸습니다.\n\n완성된 앨범은 밤 시간대의 조용한 청취 환경에 잘 어울립니다. 집중해서 가사와 멜로디를 따라가며 들을 때 가장 진가가 드러나는 작업이에요."
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
            "productionNotes": {
                "ko": "<물고기는 물이 없으면 죽어요>는 다양한 아티스트가 참여한 컴필레이션 앨범으로, 제목에서 드러나듯 환경과 생명에 관한 메시지를 음악으로 엮어낸 작업입니다. Studio NOL은 이 프로젝트의 기획부터 레코딩, 믹싱, 마스터링, 홍보까지 전반을 맡아 여러 아티스트의 색깔을 하나의 앨범 안에 균형 있게 담는 역할을 수행했습니다.\n\n여러 팀을 한 앨범에 모으는 컴필레이션의 가장 큰 과제는 각 아티스트 고유의 색을 유지하면서도 앨범 전체의 통일감을 확보하는 것입니다. 녹음 단계에서 마이크 셋업과 톤 방향에 대한 공통 레퍼런스를 먼저 공유하고, 참여 아티스트들이 동일한 사운드 환경에서 작업할 수 있도록 스튜디오 세션 스케줄을 조율했어요. 보컬 위주의 트랙과 밴드 편성 트랙이 섞여 있어 각자의 녹음 접근도 유연하게 나눴습니다.\n\n믹싱은 각 트랙의 개성을 지키되 주파수 밸런스와 톤의 무게가 앨범 안에서 극단적으로 벌어지지 않도록 기준선을 잡고 움직였습니다. 공간계 처리도 앨범 중반과 후반에 자연스럽게 호흡이 달라지도록 배치했어요. 마스터링은 컴필레이션 특성상 연속 재생에서의 이질감을 줄이는 것이 중요해, 트랙 간 음량과 톤의 연결을 세밀하게 조정했습니다.\n\n완성된 앨범은 환경 메시지에 공감하는 청취자부터 참여 아티스트들의 팬까지 폭넓게 소화할 수 있도록 설계했습니다. 관통해서 한 번 듣는 경험이 가장 잘 어울리는 작업이에요."
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
            "productionNotes": {
                "ko": "<발쾌한> CM송은 11번가 온라인 쇼핑몰의 캠페인 송으로, 브랜드의 캐치프레이즈를 음악으로 표현한 상업음악 프로젝트입니다. 이 곡의 핵심 과제는 짧은 시간(약 2분) 안에 브랜드 메시지를 전달하면서도 음악적으로 기억에 남는 곡을 만드는 것이었습니다.\n\n레코딩은 빠른 턴어라운드(3일)로 진행되었으며, 보컬은 경쾌하고 밝은 톤으로 기록했습니다. CM송 특성상 후렴구가 반복되어도 지루하지 않도록, 각 반복마다 다른 악기 레이어를 추가하는 방식으로 구성했습니다. 11번가 제품 페이지에嵌入되어 재생되는 것을 고려하여, 로딩 시간이 짧은 MP3 포맷과 고품질 FLAC 포맷 모두 제공했습니다.\n\n마스터링에서는 모바일 환경(스마트폰 스피커)에서의 청취 경험을 최우선으로 고려하여, 중주파 대역(1–3kHz)을 약간 강조하여 가사 전달력을 높였습니다. 이 CM송은 11번가 캠페인 기간 중 약 50만 회 이상 재생되며, 브랜드 인지도 상승에 기여했습니다.",
                "en": "<Balkwaehan> CM Song is a campaign song for the 11st Street online mall, expressing the brand's catchphrase as music. The core challenge was creating a memorable song within a short duration (approx. 2 minutes) that conveys the brand message.\n\nRecording was completed in a fast turnaround (3 days), with vocals recorded in a bright, upbeat tone. As a CM song, the chorus repeats without boredom by adding different instrument layers to each repetition. Both MP3 (for fast page loading) and high-quality FLAC formats were provided for embedding on 11st Street product pages.\n\nDuring mastering, the mobile environment (smartphone speakers) was prioritized — the mid-frequency range (1–3kHz) was slightly boosted to improve lyric intelligibility. This CM song was played over 500,000 times during the 11th Street campaign period, contributing to brand awareness growth."
            },
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
            "productionNotes": {
                "ko": "'젠트리피케이션'은 한국음악대상(KMA)의 특별 프로젝트로, 도시 재개발로 인해 사라져가는 지역사회의 이야기를 음악으로 기록한 컴필레이션 앨범입니다. 이 프로젝트의 핵심 개념은 '음악으로 기록하는 도시의 기억'이었으며, 각 아티스트는 특정 지역의 젠트리피케이션 경험을 음악적으로 재해석했습니다.\n\n레코딩은 각 아티스트가 거주하거나 활동하던 현지 스튜디오에서 진행되었으며, Studio NOL에서는 최종 마스터링과 앨범 방향성을 총괄했습니다. 지역별 다른 사운드 아이덴티티(예: 홍대의 일렉트로닉, 성수동의 인디 포크, 망원의 힙합)를 존중하면서도 앨범 전체의 일관된 메시지를 전달하는 것이 믹싱의 핵심 과제였습니다.\n\n이 앨범은 2024 한국음악대상에서 본상 후보에 오르며, 음악이 사회적 이슈를 기록하고 전달하는 매체로서의 가능성을 입증했습니다. 특히 KMA 시상식에서 이 앨범의 트랙들이 라이브로 연주되며, 젠트리피케이션에 대한 사회적 논의를 촉발하는 계기가 되었습니다.",
                "en": "'Gentrification' is a special project by the Korean Music Awards (KMA), a compilation album that records through music the stories of communities disappearing due to urban redevelopment. The core concept was 'recording city memories through music' — each artist musically reinterpreted the gentrification experience of a specific area.\n\nRecording was conducted at local studios where each artist resided or worked, with Studio NOL handling final mastering and overall album direction. The core challenge of mixing was respecting each area's different sonic identity (e.g., Hongdae's electronic, Seongsu's indie folk, Mangwoon's hip-hop) while delivering a consistent album-wide message.\n\nThis album was nominated for the main prize at the 2024 Korean Music Awards, demonstrating music's potential as a medium to record and convey social issues. Notably, tracks from this album were performed live at the KMA ceremony, sparking social discussion about gentrification."
            },
            "credits": {
                "engineer": "Studio NOL (황경하) — Mastering & Album Direction",
                "musicians": ["Various Artists (KMA 참여 아티스트 전원)"],
                "gear": ["Pro Tools HDX", "Neumann U87", "Neve 88R", "Lexicon 480L"]
            }
        }
    ];
    if (enableCache) {
        portfolioItemsCache[locale] = items;
    }
    return items;
};

export const getAudioTracks = (locale: Locale): AudioTrack[] => {
    const cached = enableCache ? audioTracksCache[locale] : undefined;
    if (cached && enableCache) {
        return cached;
    }

    const tracks: AudioTrack[] = [
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
    if (enableCache) {
        audioTracksCache[locale] = tracks;
    }
    return tracks;
};
