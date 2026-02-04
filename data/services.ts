// Icon names are used here to avoid serialization issues in getStaticProps
// The actual components will be mapped in the frontend component

import type { Locale } from '../lib/i18n';

// Translation helper
const t = (locale: Locale, dict: { ko: string; en: string; zh?: string; es?: string }) => {
  return dict[locale] || dict['en'] || dict['ko'];
};

export const getServicesData = (locale: Locale) => {
  const productionProcess = [
    {
      title: t(locale, { ko: "기획 단계", en: "Planning", zh: "策划阶段", es: "Planificación" }),
      description: t(locale, {
        ko: "앨범 콘셉트 설정, 제작 일정 및 예산 계획을 함께 수립합니다.",
        en: "Setting album concepts, scheduling production, and planning budgets together.",
        zh: "设定专辑概念，共同制定制作日程及预算计划。",
        es: "Establecimiento de conceptos, programación y presupuestos del álbum."
      }),
      icon: 'Lightbulb'
    },
    {
      title: t(locale, { ko: "펀딩 지원", en: "Funding Support", zh: "众筹支持", es: "Soporte de Fondos" }),
      description: t(locale, {
        ko: "크라우드 펀딩을 통한 예산 마련 컨설팅을 제공합니다.",
        en: "Consulting for budget raising through crowdfunding.",
        zh: "提供通过众筹筹集预算的咨询。",
        es: "Consultoría para la recaudación de fondos a través de crowdfunding."
      }),
      icon: 'Banknote'
    },
    {
      title: t(locale, { ko: "레코딩", en: "Recording", zh: "录音", es: "Grabación" }),
      description: t(locale, {
        ko: "프리미엄 아날로그 장비를 활용한 고품질 녹음 서비스를 제공합니다.",
        en: "High-quality recording services using premium analog equipment.",
        zh: "利用高级模拟设备提供高品质录音服务。",
        es: "Servicios de grabación de alta calidad con equipos analógicos premium."
      }),
      icon: 'Headphones'
    },
    {
      title: t(locale, { ko: "믹싱/마스터링", en: "Mixing/Mastering", zh: "混音/母带", es: "Mezcla/Masterización" }),
      description: t(locale, {
        ko: "따뜻하고 입체적인 사운드를 구현하여 음악에 생명을 불어넣습니다.",
        en: "Breathing life into music with warm, three-dimensional sound.",
        zh: "实现温暖且立体的声音，为音乐注入生命。",
        es: "Dando vida a la música con un sonido cálido y tridimensional."
      }),
      icon: 'Music'
    },
    {
      title: t(locale, { ko: "디자인", en: "Design", zh: "设计", es: "Diseño" }),
      description: t(locale, {
        ko: "앨범 아트워크, 자켓, 프로모션 이미지 제작을 지원합니다.",
        en: "Support for album artwork, jackets, and promotional image creation.",
        zh: "支持专辑封面、封套、宣传图片的制作。",
        es: "Soporte para arte de álbum, portadas e imágenes promocionales."
      }),
      icon: 'Palette'
    },
    {
      title: t(locale, { ko: "유통", en: "Distribution", zh: "发行", es: "Distribución" }),
      description: t(locale, {
        ko: "온라인/오프라인 음원 및 음반 유통 서비스를 제공합니다.",
        en: "Online/offline music and album distribution services.",
        zh: "提供线上/线下音源及唱片发行服务。",
        es: "Servicios de distribución de música y álbumes online/offline."
      }),
      icon: 'Globe'
    },
    {
      title: t(locale, { ko: "홍보/마케팅", en: "PR/Marketing", zh: "宣传/营销", es: "RP/Marketing" }),
      description: t(locale, {
        ko: "SNS 활용, 언론 배포, 온오프라인 홍보 지원으로 음악을 알립니다.",
        en: "Promoting music via SNS, press releases, and on/offline support.",
        zh: "利用SNS、媒体发布、线上线下宣传支持来推广音乐。",
        es: "Promoción vía redes sociales, comunicados de prensa y soporte on/offline."
      }),
      icon: 'Megaphone'
    },
    {
      title: t(locale, { ko: "공연 기획", en: "Concert Planning", zh: "演出策划", es: "Planificación de Conciertos" }),
      description: t(locale, {
        ko: "라이브 공연 기획 및 운영 지원으로 아티스트의 무대를 완성합니다.",
        en: "Completing the artist's stage with live concert planning and operation support.",
        zh: "通过现场演出策划及运营支持，完成艺术家的舞台。",
        es: "Completando el escenario del artista con planificación y soporte de conciertos."
      }),
      icon: 'Calendar'
    }
  ];

  const advantages = [
    {
      title: t(locale, { ko: "소통 오류 최소화", en: "Minimized Miscommunication", zh: "最大限度减少沟通误误", es: "Minimización de Errores" }),
      description: t(locale, {
        ko: "각 단계별 소통 오류를 최소화하여 원활한 제작 과정을 보장합니다.",
        en: "Ensuring a smooth production process by minimizing communication errors at each step.",
        zh: "最大限度地减少各阶段的沟通错误，保障顺畅的制作过程。",
        es: "Asegurando un proceso de producción fluido minimizando errores de comunicación."
      }),
      icon: 'Users'
    },
    {
      title: t(locale, { ko: "일관된 콘셉트 유지", en: "Consistent Concept", zh: "保持一致的概念", es: "Concepto Consistente" }),
      description: t(locale, {
        ko: "처음부터 끝까지 일관된 앨범 콘셉트를 유지하여 작품의 완성도를 높입니다.",
        en: "Maintaining a consistent album concept from start to finish to enhance quality.",
        zh: "从头到尾保持一致的专辑概念，提高作品的完成度。",
        es: "Manteniendo un concepto de álbum consistente de principio a fin."
      }),
      icon: 'Lightbulb'
    },
    {
      title: t(locale, { ko: "시간과 비용 효율성", en: "Time & Cost Efficiency", zh: "时间和成本效率", es: "Eficiencia de Tiempo y Costos" }),
      description: t(locale, {
        ko: "통합 프로세스를 통해 시간과 비용의 효율성을 극대화합니다.",
        en: "Maximizing time and cost efficiency through an integrated process.",
        zh: "通过整合流程，最大限度地提高时间和成本效率。",
        es: "Maximizando la eficiencia de tiempo y costos a través de un proceso integrado."
      }),
      icon: 'Clock'
    },
    {
      title: t(locale, { ko: "창작 집중 환경", en: "Focus on Creation", zh: "专注于创作的环境", es: "Enfoque en la Creación" }),
      description: t(locale, {
        ko: "뮤지션은 창작에만 집중할 수 있는 환경을 제공합니다.",
        en: "Providing an environment where musicians can focus solely on creation.",
        zh: "提供音乐人只专注于创作的环境。",
        es: "Proporcionando un entorno donde los músicos pueden centrarse solo en la creación."
      }),
      icon: 'Music'
    },
  ];

  const coreServices = [
    {
      title: t(locale, { ko: "앨범 기획부터 유통까지", en: "From Planning to Distribution", zh: "从专辑策划到发行", es: "De la Planificación a la Distribución" }),
      description: t(locale, {
        ko: "모든 음악 제작 과정을 한 곳에서 처리하여 효율성을 극대화합니다.",
        en: "Maximizing efficiency by handling the entire music production process in one place.",
        zh: "在一处处理所有音乐制作过程，最大限度地提高效率。",
        es: "Maximizando la eficiencia manejando todo el proceso de producción musical en un solo lugar."
      }),
      icon: 'Music'
    },
    {
      title: t(locale, { ko: "뮤지션의 비전 실현", en: "Realizing Musician's Vision", zh: "实现音乐人的愿景", es: "Realizando la Visión del Músico" }),
      description: t(locale, {
        ko: "뮤지션의 음악적 비전을 최우선으로 존중하는 프로덕션 철학을 가지고 있습니다.",
        en: "Our production philosophy prioritizes respecting the musician's musical vision.",
        zh: "拥有优先尊重音乐人音乐愿景的制作理念。",
        es: "Nuestra filosofía de producción prioriza el respeto por la visión musical del músico."
      }),
      icon: 'Lightbulb'
    },
    {
      title: t(locale, { ko: "전문가 연계 시스템", en: "Expert Network System", zh: "专家连接系统", es: "Red de Expertos" }),
      description: t(locale, {
        ko: "각 분야 최고의 전문가들과 협업하여 최상의 결과물을 보장합니다.",
        en: "Collaborating with top experts in each field to guarantee the best results.",
        zh: "与各领域最优秀的专家合作，保证最佳结果。",
        es: "Colaborando con los mejores expertos en cada campo para garantizar los mejores resultados."
      }),
      icon: 'Users'
    }
  ];

  return { productionProcess, advantages, coreServices };
};
