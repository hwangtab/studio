import React from 'react';
import { motion } from 'framer-motion';
import ResponsiveImage from '../ResponsiveImage';

const HeroBanner = ({
    title,
    subtitle,
    ctaButtons,
    image,
    imageAlt = "Hero Image",
    className = "",
}) => {
    return (
        <div className={`relative overflow-hidden bg-gradient-to-r from-primary-dark via-primary to-secondary min-h-[90vh] flex items-center px-4 sm:px-0 ${className}`}>
            {/* 배경 패턴 */}
            <div className="absolute inset-0 opacity-10">
                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <pattern id="grid" width="8" height="8" patternUnits="userSpaceOnUse">
                        <path d="M 8 0 L 0 0 0 8" fill="none" stroke="currentColor" strokeWidth="0.5" />
                    </pattern>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
            </div>

            {/* 음파 애니메이션 */}
            <div className="absolute bottom-0 left-0 right-0 h-32 opacity-20">
                <motion.div
                    className="w-full h-full"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{
                        duration: 2,
                        ease: "easeInOut",
                        repeat: Infinity,
                        repeatType: "reverse"
                    }}
                >
                    <svg viewBox="0 0 1440 320" className="w-full h-full">
                        <path
                            fill="none"
                            stroke="white"
                            strokeWidth="2"
                            d="M0,160 C320,300,420,240,640,160 C880,80,960,120,1120,160 C1280,200,1360,120,1440,80 L1440,320 L0,320 Z"
                        />
                    </svg>
                </motion.div>
            </div>

            <div className="container mx-auto px-4 z-10 pt-8 pb-12 sm:pt-16">
                <div className="grid md:grid-cols-2 gap-8 items-center">
                    <div>
                        <motion.div
                            className="text-heading-1 sm:text-display-2 md:text-display-1 font-title text-white mb-6 break-keep"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                        >
                            {title}
                        </motion.div>

                        {subtitle && (
                            <motion.p
                                className="text-body-1-light text-white/80 mb-8 max-w-lg leading-relaxed"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 0.2 }}
                            >
                                {subtitle}
                            </motion.p>
                        )}

                        {ctaButtons && (
                            <motion.div
                                className="flex flex-wrap gap-4"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 0.4 }}
                            >
                                {ctaButtons}
                            </motion.div>
                        )}
                    </div>

                    {image && (
                        <motion.div
                            className="relative"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.8, delay: 0.3 }}
                        >
                            <div className="relative z-10 rounded-2xl overflow-hidden shadow-2xl">
                                <ResponsiveImage
                                    src={image}
                                    alt={imageAlt}
                                    className="w-full h-auto"
                                    pictureClassName="block"
                                    loading="eager"
                                    sizes="(min-width: 1024px) 50vw, 100vw"
                                />

                                {/* 오버레이 그라데이션 */}
                                <div className="absolute inset-0 bg-gradient-to-tr from-primary-dark/30 to-transparent" />
                            </div>

                            {/* 장식 요소 */}
                            <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-accent rounded-full opacity-80 blur-sm z-0" />
                            <div className="absolute -top-6 -left-6 w-16 h-16 bg-secondary rounded-full opacity-60 blur-sm z-0" />
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HeroBanner;
