import React from 'react';
import { ExternalLink, Mic2, MousePointer2 } from '@/lib/lucide-icons';
import ResponsiveImage from '../ResponsiveImage';
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

    // 카테고리에 따른 뱃지 색상 (Light/Dark 대응).
    // 10px 볼드 텍스트 + 연한 50 배경 조합이라 text-*-600은 WCAG AA 미달(3.3~4.4:1).
    // text-*-700로 통일해 4.5:1 이상 확보.
    const getCategoryColor = (cat: string) => {
        switch (cat) {
            case 'album': return 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-500/20 dark:text-pink-400 dark:border-pink-500/30';
            case 'single': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30';
            case 'compilation': return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/20 dark:text-violet-400 dark:border-violet-500/30';
            case 'commercial': return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/30';
            default: return 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-500/30';
        }
    };

    // iOS Safari 잔존 깜빡임 fix: framer-motion m.button + staggered fade(delay: index * 0.05) 제거.
    // 다수 카드 동시 paint와 image 디코드가 겹쳐 row 깜빡 유발. plain button + CSS만 사용.
    void index;  // index는 더 이상 staggered animation에 안 쓰지만 props 호환 유지

    return (
        <button
            className="group relative bg-white dark:bg-[#1A1A1A] hover:bg-gray-50 dark:hover:bg-[#222] rounded-xl overflow-hidden border border-gray-200 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/10 transition-colors duration-200 cursor-pointer flex flex-col sm:flex-row h-full sm:h-48 shadow-sm hover:shadow-md dark:shadow-none touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 text-left disabled:cursor-default disabled:opacity-80"
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
                    // 실제 렌더 폭: 데스크톱(sm:)은 좌측 열이 sm:w-48/h-full = 고정 192px 정사각
                    // (뷰포트가 커져도 스케일 안 됨). 모바일(<sm)은 카드가 flex-col이 되며
                    // 이 div가 w-full로 카드 폭(Section container = 100vw - px-4 32px) 전체를 채움.
                    // 과거 "100vw, 200px"는 next/image의 getWidths()가 sizes 문자열 전체에서
                    // vw 최솟값(100)을 찾아 deviceSizes[0]*1.0=480px를 srcset 하한선으로 강제
                    // (미디어쿼리 스코프 무시, 문자열 어디든 vw가 있으면 전역 적용되는 next/image 자체 동작) —
                    // 그 결과 데스크톱 200px 표시에도 480w 미만 후보가 전부 제거돼 480w 확정 다운로드
                    // (실측 192×190px 표시에 480w, 2.5배 과다). vw를 완전히 제거하고 고정 px만 쓰면
                    // 하한선 필터 자체가 걸리지 않아 전체 imageSizes(16~384)가 후보에 남고,
                    // 데스크톱은 실제 필요한 256w를 받는다. 480/640 두 구간은 기존 100vw가
                    // 모바일 전 구간(뷰포트 0~639px)에서 실제로 골라주던 값(480 또는 640)을 그대로
                    // 재현하도록 계산한 값이라 모바일 다운로드 용량은 완전히 동일(회귀 없음).
                    sizes="(max-width: 480px) 480px, (max-width: 640px) 640px, 200px"
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
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getCategoryColor(category)} uppercase tracking-wider max-w-full break-words`}>
                            {category}
                        </span>
                        {services.slice(0, 3).map((service, i) => (
                            <span key={i} className="text-[10px] text-gray-500 border border-gray-200 dark:text-white/40 dark:border-white/10 px-2 py-0.5 rounded max-w-full break-words">
                                {service}
                            </span>
                        ))}
                    </div>

                    <h3 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-primary dark:group-hover:text-primary transition-colors mb-1 line-clamp-2 break-words" title={title}>
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

                    <div className="flex items-center text-xs font-mono text-primary group-hover:text-primary-dark dark:text-primary/80 opacity-0 group-hover:opacity-100 transform translate-x-4 group-hover:translate-x-0 transition-[opacity,transform] duration-300 flex-shrink-0">
                        <span className="mr-2">{viewProjectLabel}</span>
                        <ExternalLink size={14} aria-hidden="true" />
                    </div>
                </div>
            </div>
        </button>
    );
};

export default React.memo(ProjectRowCard);
