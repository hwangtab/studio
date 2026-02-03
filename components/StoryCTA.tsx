import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Music, Mic2, Settings } from 'lucide-react';

const StoryCTA = () => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="my-16 relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 to-purple-900 text-white shadow-xl"
        >
            {/* Background Decor */}
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
            <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-purple-500/20 rounded-full blur-2xl" />

            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between p-8 md:p-10 gap-8">
                <div className="flex-1 text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-3 mb-4 text-purple-200">
                        <Mic2 size={20} />
                        <span className="w-1 h-1 bg-purple-200 rounded-full" />
                        <Settings size={20} />
                        <span className="w-1 h-1 bg-purple-200 rounded-full" />
                        <Music size={20} />
                    </div>

                    <h3 className="text-2xl md:text-3xl font-bold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-white to-purple-200">
                        더 나은 사운드를 원하시나요?
                    </h3>

                    <p className="text-purple-100/90 text-lg leading-relaxed mb-6">
                        스튜디오 놀의 전문적인 레코딩, 믹싱 서비스를 경험해보세요.<br className="hidden md:block" />
                        최고의 장비와 노하우로 당신의 음악을 완성해드립니다.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                        <Link
                            href="/pricing"
                            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-white text-indigo-900 font-bold hover:bg-purple-50 transition-colors shadow-lg shadow-black/20"
                        >
                            서비스 가격 보기
                            <ArrowRight size={18} className="ml-2" />
                        </Link>
                        <Link
                            href="/contact"
                            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-purple-700/50 text-white font-medium hover:bg-purple-700/70 transition-colors backdrop-blur-sm border border-purple-500/30"
                        >
                            문의하기
                        </Link>
                    </div>
                </div>

                <div className="hidden md:block w-full max-w-xs lg:max-w-sm">
                    {/* Abstract Visual Representation */}
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-black/20 backdrop-blur-sm border border-white/10 p-6 flex flex-col justify-center items-center">
                        <div className="w-full flex justify-between items-end h-32 gap-2 mb-4">
                            {[40, 70, 50, 90, 60, 80, 40, 60].map((h, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ height: '20%' }}
                                    whileInView={{ height: `${h}%` }}
                                    transition={{
                                        repeat: Infinity,
                                        repeatType: "reverse",
                                        duration: 1.5,
                                        delay: i * 0.1
                                    }}
                                    className="flex-1 bg-gradient-to-t from-purple-500 to-indigo-400 rounded-t-sm opacity-80"
                                />
                            ))}
                        </div>
                        <p className="text-sm font-mono text-purple-200">Professional Audio</p>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default StoryCTA;
