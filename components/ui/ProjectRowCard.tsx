import React from 'react';
import { m } from 'framer-motion';
import { ExternalLink, Mic2, MousePointer2 } from 'lucide-react';
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

    // Editorial token-based category badges
    const getCategoryColor = (cat: string) => {
        switch (cat) {
            case 'album': return 'bg-canvas-warm text-ink-muted-80 border-hairline';
            case 'single': return 'bg-canvas-warm text-ink-muted-80 border-hairline';
            case 'compilation': return 'bg-canvas-warm text-ink-muted-80 border-hairline';
            case 'commercial': return 'bg-canvas-warm text-ink-muted-80 border-hairline';
            default: return 'bg-canvas-warm text-ink-muted-80 border-hairline';
        }
    };

    return (
        <m.button
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.4, ease: 'easeOut' }}
            className="group relative bg-canvas-soft border border-hairline shadow-card rounded-card overflow-hidden hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300 cursor-pointer flex flex-col sm:flex-row h-full sm:h-48 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-canvas-deep text-left disabled:cursor-default disabled:opacity-80 dark:bg-surface-dark-elevated dark:border-white/10"
            onClick={onClick}
            type="button"
            disabled={!isInteractive}
        >
            {/* Left: Album Art */}
            <div className="relative w-full sm:w-48 h-48 sm:h-full flex-shrink-0 overflow-hidden bg-canvas-warm dark:bg-canvas-deep">
                <ResponsiveImage
                    src={image}
                    alt={`${title} — ${artist}`}
                    pictureClassName="w-full h-full"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-100 dark:opacity-90 dark:group-hover:opacity-100"
                    width={200}
                    height={200}
                    sizes="(max-width: 640px) 100vw, 200px"
                />

                {/* Subtle overlay on dark */}
                <div className="hidden dark:block absolute inset-0 bg-gradient-to-tr from-black/40 via-transparent to-white/10 pointer-events-none" />

                {/* Hover Action Overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-canvas-deep/40 backdrop-blur-[2px]">
                    <div className="bg-white/10 p-3 rounded-pill border border-white/20 backdrop-blur-md">
                        <MousePointer2 className="text-white" size={24} aria-hidden="true" />
                    </div>
                </div>
            </div>

            {/* Right: Content */}
            <div className="flex-1 p-5 flex flex-col justify-between relative overflow-hidden min-w-0">
                <div className="relative z-10">
                    <div className="flex flex-wrap gap-2 mb-3 min-w-0">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getCategoryColor(category)} uppercase tracking-wider max-w-full break-words`}>
                            {category}
                        </span>
                        {services.slice(0, 3).map((service, i) => (
                            <span key={i} className="text-[10px] text-ink-muted-60 border border-hairline px-2 py-0.5 rounded-pill max-w-full break-words dark:text-on-dark-soft dark:border-white/10">
                                {service}
                            </span>
                        ))}
                    </div>

                    <h3 className="text-title-md text-ink dark:text-on-dark group-hover:text-ink-muted-80 transition-colors mb-1 line-clamp-2 break-words" title={title}>
                        {title}
                    </h3>
                    <div className="flex items-center text-ink-muted-60 dark:text-on-dark-soft mb-2">
                        <Mic2 size={14} className="mr-1.5" aria-hidden="true" />
                        <span className="text-caption font-medium">{artist}</span>
                    </div>
                </div>

                <div className="relative z-10 flex items-end justify-between mt-2 gap-3 min-w-0">
                    <p className="text-caption text-ink-muted-60 dark:text-on-dark-soft line-clamp-2 flex-1 min-w-0 break-words" title={description}>
                        {description}
                    </p>

                    <div className="flex items-center text-xs font-mono text-ink dark:text-on-dark opacity-0 group-hover:opacity-100 transform translate-x-4 group-hover:translate-x-0 transition-[opacity,transform] duration-300 flex-shrink-0">
                        <span className="mr-2">{viewProjectLabel}</span>
                        <ExternalLink size={14} aria-hidden="true" />
                    </div>
                </div>
            </div>
        </m.button>
    );
};

export default React.memo(ProjectRowCard);
