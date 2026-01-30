import { Mic, Disc, Globe } from 'lucide-react';
import type { HomeService, StudioImage } from '../types/data';

export const homeServices = [
    {
        title: '음반 기획',
        description: '당신의 음악적 비전을 현실로 만들어드립니다. 기획부터 제작까지 전 과정을 함께합니다.',
        link: '/about',
        icon: Disc,
    },
    {
        title: '녹음 & 믹싱',
        description: '고급 장비와 전문가와 함께 최상의 사운드를 만들어보세요. 당신의 소리에 생명을 불어넣습니다.',
        link: '/about',
        icon: Mic,
    },
    {
        title: '홍보 & 마케팅',
        description: '언론에 효과적으로 홍보하고, 쇼케이스를 풍부하게 지원함으로써 당신 음악의 매력을 더욱 널리 알립니다.',
        link: '/about',
        icon: Globe,
    },
] as const;

export const studioImages = [
    {
        src: `/images/studio2.jpg`,
        alt: "모니터링 스피커와 컨트롤 데스크가 있는 레코딩 룸"
    },
    {
        src: `/images/studio3.jpg`,
        alt: "프로페셔널 마이크와 팝 필터가 설치된 보컬 녹음 부스"
    },
    {
        src: `/images/studio4.jpg`,
        alt: "최신 DAW 시스템과 모니터를 갖춘 믹싱 워크스테이션"
    },
    {
        src: `/images/studio5.jpg`,
        alt: "음향 처리가 완료된 프로덕션 룸 전경"
    },
    {
        src: `/images/hardware8.jpg`,
        alt: "아날로그 아웃보드 장비와 프리앰프 랙"
    }
] as const;
