import React from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import ResponsiveImage from '../ResponsiveImage';

const Slider = dynamic(() => import('react-slick').then((mod) => mod.default), { ssr: false });

const MediaGallery = ({ images, settings: customSettings, className = '' }) => {
    const defaultSettings = {
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
                                pictureClassName="block"
                                loading="lazy"
                                sizes="(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 90vw"
                                fill
                            />
                        </motion.div>
                    </div>
                ))}
            </Slider>
        </div>
    );
};

export default MediaGallery;
