import React from 'react';
import { Eye } from 'lucide-react';
import BaseCard from './BaseCard';
import ResponsiveImage from '../ResponsiveImage';

interface PortfolioCardProps {
    image: string;
    title: string;
    description: string;
    onClick?: () => void;
    delay?: number;
}

const PortfolioCard = ({ image, title, description, onClick, delay = 0 }: PortfolioCardProps) => {
    return (
        <BaseCard
            onClick={onClick}
            delay={delay}
            variant="default"
            className="group p-0 border-0 overflow-hidden h-full flex flex-col cursor-pointer"
            hoverEffect={false}
        >
            <div className="relative overflow-hidden">
                <div className="w-full pb-[100%] relative">
                    <ResponsiveImage
                        src={image}
                        alt={title}
                        pictureClassName="absolute inset-0 block h-full w-full"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        loading="lazy"
                        fill={true}
                        width={400}
                        height={400}
                        sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                    />
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div
                    className="absolute bottom-4 right-4 bg-white/90 text-primary p-3 rounded-full shadow-lg transform translate-y-10 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 hover:bg-primary hover:text-white z-10"
                    aria-label="상세 보기"
                >
                    <Eye size={16} />
                </div>
            </div>

            <div className="p-6 flex flex-col flex-grow">
                <h3 className="typo-card-title text-gray-600 dark:text-gray-200 mb-3">{title}</h3>
                <p className="typo-card-body flex-grow">{description}</p>
            </div>

            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary to-secondary transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
        </BaseCard>
    );
};

export default PortfolioCard;
