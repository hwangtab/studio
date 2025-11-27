import React from 'react';
import { motion } from 'framer-motion';
import { FaExternalLinkAlt } from 'react-icons/fa';
import BaseCard from './BaseCard';
import ResponsiveImage from '../ResponsiveImage';

const PortfolioCard = ({ image, title, description, link, delay = 0 }) => {
    return (
        <BaseCard
            href={link}
            delay={delay}
            variant="default"
            className="group p-0 border-0 overflow-hidden"
            hoverEffect={false} // Custom hover effect implemented below
        >
            <div className="relative overflow-hidden">
                <div className="w-full pb-[100%] relative">
                    <ResponsiveImage
                        src={image}
                        alt={title}
                        pictureClassName="absolute inset-0 block h-full w-full"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        loading="lazy"
                        sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 100vw"
                    />
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div
                    className="absolute bottom-4 right-4 bg-white/90 text-primary p-3 rounded-full shadow-lg transform translate-y-10 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 hover:bg-primary hover:text-white z-10"
                    aria-label="외부 링크로 이동"
                >
                    <FaExternalLinkAlt />
                </div>
            </div>

            <div className="p-6">
                <h3 className="typo-card-title text-gray-600 dark:text-gray-200 mb-3">{title}</h3>
                <p className="typo-card-body">{description}</p>
            </div>

            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary to-secondary transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
        </BaseCard>
    );
};

export default PortfolioCard;
