import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Music, Mic2, Settings, BookOpen, GraduationCap, Lightbulb, MapPin, Speaker, Clock } from 'lucide-react';

export type CTAType = 'recording' | 'lesson' | 'practice' | 'production';

interface StoryCTAProps {
    type?: CTAType;
}

const StoryCTA: React.FC<StoryCTAProps> = ({ type = 'recording' }) => {
    const content = {
        recording: {
            gradient: 'from-indigo-900 to-purple-900',
            accentColor: 'text-purple-200',
            accentBg: 'bg-purple-200',
            buttonBg: 'bg-white text-indigo-900 hover:bg-purple-50',
            secondaryButtonBg: 'bg-purple-700/50 text-white hover:bg-purple-700/70 border-purple-500/30',
            icons: (
                <>
                    <Mic2 size={20} />
                    <span className="w-1 h-1 bg-purple-200 rounded-full" />
                    <Settings size={20} />
                    <span className="w-1 h-1 bg-purple-200 rounded-full" />
                    <Music size={20} />
                </>
            ),
            title: '더 나은 사운드를 원하시나요?',
            description: (
                <>
                    스튜디오 놀의 전문적인 레코딩, 믹싱 서비스를 경험해보세요.<br className="hidden md:block" />
                    최고의 장비와 노하우로 당신의 음악을 완성해드립니다.
                </>
            ),
            primaryLink: '/pricing',
            primaryText: '서비스 가격 보기',
            secondaryLink: '/contact',
            secondaryText: '문의하기',
            visualText: 'Professional Audio',
            visualGradient: 'from-purple-500 to-indigo-400',
        },
        lesson: {
            gradient: 'from-orange-800 to-amber-900',
            accentColor: 'text-amber-200',
            accentBg: 'bg-amber-200',
            buttonBg: 'bg-white text-amber-900 hover:bg-amber-50',
            secondaryButtonBg: 'bg-amber-700/50 text-white hover:bg-amber-700/70 border-amber-500/30',
            icons: (
                <>
                    <BookOpen size={20} />
                    <span className="w-1 h-1 bg-amber-200 rounded-full" />
                    <Lightbulb size={20} />
                    <span className="w-1 h-1 bg-amber-200 rounded-full" />
                    <GraduationCap size={20} />
                </>
            ),
            title: '직접 음악을 만들고 싶으신가요?',
            description: (
                <>
                    혼자 고민하지 마세요. 1:1 맞춤형 레슨으로 도와드립니다.<br className="hidden md:block" />
                    미디, 믹싱, 사운드 디자인까지 기초부터 탄탄하게 배워보세요.
                </>
            ),
            primaryLink: '/lesson',
            primaryText: '레슨 커리큘럼 보기',
            secondaryLink: '/contact',
            secondaryText: '상담 신청하기',
            visualText: 'Music Education',
            visualGradient: 'from-amber-500 to-orange-400',
        },
        practice: {
            gradient: 'from-emerald-900 to-teal-900',
            accentColor: 'text-emerald-200',
            accentBg: 'bg-emerald-200',
            buttonBg: 'bg-white text-emerald-900 hover:bg-emerald-50',
            secondaryButtonBg: 'bg-teal-700/50 text-white hover:bg-teal-700/70 border-teal-500/30',
            icons: (
                <>
                    <MapPin size={20} />
                    <span className="w-1 h-1 bg-emerald-200 rounded-full" />
                    <Clock size={20} />
                    <span className="w-1 h-1 bg-emerald-200 rounded-full" />
                    <Speaker size={20} />
                </>
            ),
            title: '몰입할 나만의 공간이 필요한가요?',
            description: (
                <>
                    언제든 자유롭게 이용할 수 있는 프리미엄 연습실.<br className="hidden md:block" />
                    쾌적한 환경과 완벽한 방음 시설이 준비되어 있습니다.
                </>
            ),
            primaryLink: '/practice-room',
            primaryText: '연습실 시설 보기',
            secondaryLink: '/contact',
            secondaryText: '예약 문의하기',
            visualText: 'Creative Space',
            visualGradient: 'from-emerald-500 to-teal-400',
        },
        production: {
            gradient: 'from-blue-900 to-indigo-900',
            accentColor: 'text-blue-200',
            accentBg: 'bg-blue-200',
            buttonBg: 'bg-white text-blue-900 hover:bg-blue-50',
            secondaryButtonBg: 'bg-indigo-700/50 text-white hover:bg-indigo-700/70 border-indigo-500/30',
            icons: (
                <>
                    <Music size={20} />
                    <span className="w-1 h-1 bg-blue-200 rounded-full" />
                    <Mic2 size={20} />
                    <span className="w-1 h-1 bg-blue-200 rounded-full" />
                    <Settings size={20} />
                </>
            ),
            title: '나만의 음원을 제작하고 싶으신가요?',
            description: (
                <>
                    작곡, 편곡부터 믹싱, 마스터링까지.<br className="hidden md:block" />
                    당신의 아이디어를 완성된 음원으로 만들어드립니다.
                </>
            ),
            primaryLink: '/contact',
            primaryText: '음원 제작 상담하기',
            secondaryLink: '/pricing',
            secondaryText: '제작 비용 보기',
            visualText: 'Music Production',
            visualGradient: 'from-blue-500 to-indigo-400',
        }
    };

    const current = content[type];
    const heights = [40, 70, 50, 90, 60, 80, 40, 60];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className={`my-16 relative overflow-hidden rounded-2xl bg-gradient-to-br ${current.gradient} text-white shadow-xl`}
        >
            {/* Background Decor */}
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
            <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-white/5 rounded-full blur-2xl" />

            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between p-8 md:p-10 gap-8">
                <div className="flex-1 text-center md:text-left">
                    <div className={`flex items-center justify-center md:justify-start gap-3 mb-4 ${current.accentColor}`}>
                        {current.icons}
                    </div>

                    <h3 className={`text-2xl md:text-3xl font-bold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-200`}>
                        {current.title}
                    </h3>

                    <p className="text-white/90 text-lg leading-relaxed mb-6">
                        {current.description}
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                        <Link
                            href={current.primaryLink}
                            className={`inline-flex items-center justify-center px-6 py-3 rounded-xl font-bold transition-colors shadow-lg shadow-black/20 ${current.buttonBg}`}
                        >
                            {current.primaryText}
                            <ArrowRight size={18} className="ml-2" />
                        </Link>
                        <Link
                            href={current.secondaryLink}
                            className={`inline-flex items-center justify-center px-6 py-3 rounded-xl font-medium transition-colors backdrop-blur-sm border ${current.secondaryButtonBg}`}
                        >
                            {current.secondaryText}
                        </Link>
                    </div>
                </div>

                <div className="hidden md:block w-full max-w-xs lg:max-w-sm">
                    {/* Abstract Visual Representation */}
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-black/20 backdrop-blur-sm border border-white/10 p-6 flex flex-col justify-center items-center">
                        <div className="w-full flex justify-between items-end h-32 gap-2 mb-4">
                            {heights.map((h, i) => (
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
                                    className={`flex-1 bg-gradient-to-t ${current.visualGradient} rounded-t-sm opacity-80`}
                                />
                            ))}
                        </div>
                        <p className={`text-sm font-mono ${current.accentColor}`}>{current.visualText}</p>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default StoryCTA;
