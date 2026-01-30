import { Music, Users, Lightbulb, Clock, Headphones, Palette, Globe, Megaphone, Banknote, Calendar } from 'lucide-react';
import type { ProcessStep, Advantage, CoreService } from '../types/data';

export const productionProcess = [
    {
        title: "기획 단계",
        description: "앨범 콘셉트 설정, 제작 일정 및 예산 계획을 함께 수립합니다.",
        icon: Lightbulb
    },
    {
        title: "펀딩 지원",
        description: "크라우드 펀딩을 통한 예산 마련 컨설팅을 제공합니다.",
        icon: Banknote
    },
    {
        title: "레코딩",
        description: "프리미엄 아날로그 장비를 활용한 고품질 녹음 서비스를 제공합니다.",
        icon: Headphones
    },
    {
        title: "믹싱/마스터링",
        description: "따뜻하고 입체적인 사운드를 구현하여 음악에 생명을 불어넣습니다.",
        icon: Music
    },
    {
        title: "디자인",
        description: "앨범 아트워크, 자켓, 프로모션 이미지 제작을 지원합니다.",
        icon: Palette
    },
    {
        title: "유통",
        description: "온라인/오프라인 음원 및 음반 유통 서비스를 제공합니다.",
        icon: Globe
    },
    {
        title: "홍보/마케팅",
        description: "SNS 활용, 언론 배포, 온오프라인 홍보 지원으로 음악을 알립니다.",
        icon: Megaphone
    },
    {
        title: "공연 기획",
        description: "라이브 공연 기획 및 운영 지원으로 아티스트의 무대를 완성합니다.",
        icon: Calendar
    }
] as const;

export const advantages = [
    {
        title: "소통 오류 최소화",
        description: "각 단계별 소통 오류를 최소화하여 원활한 제작 과정을 보장합니다.",
        icon: Users
    },
    {
        title: "일관된 콘셉트 유지",
        description: "처음부터 끝까지 일관된 앨범 콘셉트를 유지하여 작품의 완성도를 높입니다.",
        icon: Lightbulb
    },
    {
        title: "시간과 비용 효율성",
        description: "통합 프로세스를 통해 시간과 비용의 효율성을 극대화합니다.",
        icon: Clock
    },
    {
        title: "창작 집중 환경",
        description: "뮤지션은 창작에만 집중할 수 있는 환경을 제공합니다.",
        icon: Music
    }
] as const;

export const coreServices = [
    {
        title: "앨범 기획부터 유통까지",
        description: "모든 음악 제작 과정을 한 곳에서 처리하여 효율성을 극대화합니다.",
        icon: Music
    },
    {
        title: "뮤지션의 비전 실현",
        description: "뮤지션의 음악적 비전을 최우선으로 존중하는 프로덕션 철학을 가지고 있습니다.",
        icon: Lightbulb
    },
    {
        title: "전문가 연계 시스템",
        description: "각 분야 최고의 전문가들과 협업하여 최상의 결과물을 보장합니다.",
        icon: Users
    }
] as const;
