import React from 'react';
import { ExternalLink, Mic2, MousePointer2 } from '@/lib/lucide-icons';
import ResponsiveImage from '../ResponsiveImage';
import { Badge } from './Badge';
import { PortfolioItem } from '../../types/data';

interface ProjectRowCardProps extends PortfolioItem {
    onClick?: () => void;
    index: number;
    viewProjectLabel?: string;
}

const ProjectRowCard = ({
    title,
    description,
    image,
    artist,
    category,
    services,
    onClick,
    index,
    viewProjectLabel = 'View project',
}: ProjectRowCardProps) => {
    const isInteractive = Boolean(onClick);

    // 카테고리 배지는 공용 Badge(중립)다 — 카테고리별 색(핑크·에메랄드…)은 다섯 분류를 외워야
    // 뜻이 생기는 장식이었고 PortfolioMiniCard와도 색이 달랐다(2026-10-05 1단계 통일).

    // iOS Safari 잔존 깜빡임 fix: framer-motion m.button + staggered fade(delay: index * 0.05) 제거.
    // 다수 카드 동시 paint와 image 디코드가 겹쳐 row 깜빡 유발. plain button + CSS만 사용.
    void index;  // index는 더 이상 staggered animation에 안 쓰지만 props 호환 유지

    return (
        <button
            className="group relative bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-[background-color,border-color] duration-200 cursor-pointer flex flex-col sm:flex-row h-full sm:h-48 shadow-sm hover:shadow-md dark:shadow-none touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 text-left disabled:cursor-default disabled:opacity-80"
            onClick={onClick}
            type="button"
            disabled={!isInteractive}
        >
            {/* Left: Album Art */}
            <div className="relative w-full sm:w-48 h-48 sm:h-full flex-shrink-0 overflow-hidden bg-gray-100 dark:bg-black">
                <ResponsiveImage
                    src={image}
                    alt={`${title} — ${artist}`}
                    pictureClassName="w-full h-full"
                    className="w-full h-full object-cover transition-transform duration-slow group-hover:scale-105 opacity-100 dark:opacity-90 dark:group-hover:opacity-100"
                    width={200}
                    height={200}
                    // 이 이미지는 반응형으로 렌더 폭이 다르다:
                    //  - 모바일(<640px): 이 div가 w-full → 카드=뷰포트 전폭. 100vw가 정답
                    //    (Moto G4 412px×dpr → 768w). 이 구간은 절대 건드리면 안 됨.
                    //  - 데스크톱(≥640px, sm:w-48): 좌측 열이 고정 192px 정사각(뷰포트 무관 불변).
                    // 딜레마: next/image getWidths()는 sizes 문자열 전체에서 vw 최솟값을 찾아
                    //   floor=deviceSizes[0]×(minVw/100)=480×(minVw/100)로 그 미만 srcset 후보를
                    //   전부 제거한다(미디어쿼리 스코프 무시, 전역 적용). "100vw, 200px"는 minVw=100
                    //   →floor=480이라 데스크톱 192px 표시에도 480w 미만이 다 잘려 480w 확정(2.5배 과다).
                    // 해결: 데스크톱 분기를 작은 vw(30vw)로 표현해 floor를 480→144로 낮춘다.
                    //   floor 144는 (a)128w 이하를 후보에서 제외해 192px 표시가 128w로 흐려질 blur를
                    //   원천 차단하고 (b)256w는 후보로 남겨 데스크톱이 256w를 받게 한다.
                    //   30vw는 641~1024px에서 source 192~307px→항상 256w 선택(sharp). >1024px는
                    //   고정 192px 클램프로 뷰포트가 아무리 커져도 dpr1=256w/dpr2=384w 평탄(대형
                    //   화면 과다 다운로드 방지). 모바일 100vw 분기는 문자열에 그대로라 후보 상단부
                    //   (≥480w)가 기존과 동일 → 모바일 선택폭 불변(768w, 회귀 0). getWidths+브라우저
                    //   geometric-mean 선택 재현 스크립트로 Moto G4(412,dpr2)=768w·데스크톱(1280,dpr1)
                    //   =256w 양쪽 검증 완료.
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 30vw, 192px"
                />

                {/* Vinyl Effect Overlay (Dark Mode Only) */}
                <div className="hidden dark:block absolute inset-0 bg-gradient-to-tr from-black/40 via-transparent to-white/10 pointer-events-none" />

                {/* Hover Play/Action Overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/40 dark:bg-black/60 backdrop-blur-[2px]">
                    <div className="bg-white/10 p-3 rounded-full border border-white/20 backdrop-blur-md">
                        <MousePointer2 className="text-white" size={24} aria-hidden="true" />
                    </div>
                </div>
            </div>

            {/* Right: Content */}
            <div className="flex-1 p-6 flex flex-col justify-between relative overflow-hidden min-w-0">
                {/* Background Decor (Dark Mode Only) */}
                <div className="hidden dark:block absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                <div className="relative z-10">
                    <div className="flex flex-wrap gap-2 mb-3 min-w-0">
                        <Badge tone="neutral" className="uppercase tracking-wider max-w-full whitespace-normal break-words">
                            {category}
                        </Badge>
                        {services.slice(0, 3).map((service, i) => (
                            <Badge key={i} tone="outline" className="max-w-full whitespace-normal break-words">
                                {service}
                            </Badge>
                        ))}
                    </div>

                    <h3 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-primary dark:group-hover:text-primary-lighter transition-colors mb-1 line-clamp-2 break-words" title={title}>
                        {title}
                    </h3>
                    <div className="flex items-center text-gray-600 dark:text-white/60 mb-2">
                        <Mic2 size={14} className="mr-1.5" aria-hidden="true" />
                        <span className="text-sm font-medium">{artist}</span>
                    </div>
                </div>

                <div className="relative z-10 flex items-end justify-between mt-2 gap-3 min-w-0">
                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 flex-1 min-w-0 break-words" title={description}>
                        {description}
                    </p>

                    <div className="flex items-center text-xs font-mono text-primary group-hover:text-primary-dark dark:text-primary-lighter dark:group-hover:text-primary-lighter opacity-0 group-hover:opacity-100 transform translate-x-4 group-hover:translate-x-0 transition-[opacity,transform] duration-300 flex-shrink-0">
                        <span className="mr-2">{viewProjectLabel}</span>
                        <ExternalLink size={14} aria-hidden="true" />
                    </div>
                </div>
            </div>
        </button>
    );
};

export default React.memo(ProjectRowCard);
