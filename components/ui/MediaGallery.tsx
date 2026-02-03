import React from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import ResponsiveImage from '../ResponsiveImage';
import type { Settings } from 'react-slick';

const Slider = dynamic(() => import('react-slick').then((mod) => mod.default), { ssr: false }) as any;

interface MediaImage {
    src: string;
    alt: string;
}

interface MediaGalleryProps {
    images: readonly MediaImage[];
    settings?: Settings;
    className?: string;
}

const MediaGallery = ({ images, settings: customSettings, className = '' }: MediaGalleryProps) => {
    const defaultSettings: Settings = {
        dots: true,
        infinite: true,
        speed: 500,
        slidesToShow: 3,
        slidesToScroll: 1,
        autoplay: true,
        autoplaySpeed: 3000,
        responsive: [
            {
                breakpoint: 1024,
                settings: {
                    slidesToShow: 2,
                    slidesToScroll: 1,
                }
            },
            {
                breakpoint: 600,
                settings: {
                    slidesToShow: 1,
                    slidesToScroll: 1
                }
            }
        ]
    };

    const settings = { ...defaultSettings, ...customSettings };

    return (
        <div className={`mb-12 ${className}`}>
            <Slider {...settings}>
                {images.map((image, index) => (
                    <div key={index} className="px-2">
                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            transition={{ duration: 0.3 }}
                        >
                            <ResponsiveImage
                                src={image.src}
                                alt={image.alt}
                                className="w-full h-64 object-cover rounded-lg shadow-md"
                                pictureClassName="block aspect-video"
                                loading="lazy"
                                width={600}
                                height={400}
                                sizes="(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 90vw"
                            />
                        </motion.div>
                    </div>
                ))}
            </Slider>
        </div>
    );
};

export default MediaGallery;
