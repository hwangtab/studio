
import type { NextPage } from 'next';
import React from 'react';
import { motion } from 'framer-motion';
import { Mic2, Music, Sliders, Disc, CheckCircle, MessageCircle, Users, LucideIcon, GraduationCap, BookOpen, Sparkles } from 'lucide-react';
import ResponsiveImage from '../components/ResponsiveImage';
import SEO from '../components/SEO';
import ImageHero from '../components/common/ImageHero';
import BaseCard from '../components/ui/BaseCard';
import SectionHeading from '../components/ui/SectionHeading';
import Link from 'next/link';

interface CurriculumCardProps {
    step: string;
    title: string;
    subtitle: string;
    description: string[];
    icon: LucideIcon;
    delay?: number;
}

const CurriculumCard = ({ step, title, subtitle, description, icon: Icon, delay = 0 }: CurriculumCardProps) => (
    <BaseCard variant="default" delay={delay} className="p-8 h-full relative overflow-hidden group hover:shadow-xl transition-shadow duration-300 border border-gray-100 dark:border-gray-700">
        <div className="absolute top-0 right-0 p-4 opacity-10 font-black text-6xl text-primary transition-transform group-hover:scale-110">
            {step}
        </div>
        <div className="relative z-10">
            <div className="bg-primary/10 dark:bg-primary/20 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 text-primary dark:text-primary-light">
                <Icon size={32} />
            </div>
            <h3 className="typo-card-title mb-1">{title}</h3>
            <p className="text-sm font-semibold text-primary mb-4">{subtitle}</p>
            <ul className="space-y-2">
                {description.map((item, idx) => (
                    <li key={idx} className="flex items-start text-gray-600 dark:text-gray-300 text-sm">
                        <CheckCircle size={14} className="mt-1 mr-2 text-primary flex-shrink-0" />
                        <span>{item}</span>
                    </li>
                ))}
            </ul>
        </div>
    </BaseCard>
);

type PageWithHero = NextPage & { hasHero?: boolean };

const Lesson: PageWithHero = () => {
    return (
        <>
            <SEO
                title="음원 발매 컨설팅 · 믹싱 피드백 & 단기 미디 레슨 | 스튜디오 놀"
                description="혼자 하기 힘든 음원 유통/저작권 등록 컨설팅부터 믹싱 1:1 원포인트 피드백까지. 현업 엔지니어가 필요한 부분만 콕 집어 해결해 드립니다."
                keywords="음원 발매 컨설팅, 믹싱 피드백, 미디 멘토링, 앨범 제작 상담, 단기 미디 레슨, 큐베이스 원데이, 로직 프로 과외, 연신내 실용음악"
                canonical="https://studionol.co.kr/lesson"
                includeSchema={true}
                schema={{
                    '@context': 'https://schema.org',
                    '@type': 'Course',
                    'name': '올인원 프로덕션 마스터 클래스',
                    'description': '미디 작곡부터 레코딩, 믹싱, 마스터링까지. 현업 엔지니어와 함께 나만의 음반을 완성하는 실전형 음악 제작 레슨입니다.',
                    'provider': {
                        '@type': 'Organization',
                        'name': '스튜디오 놀',
                        'sameAs': 'https://studionol.co.kr'
                    },
                    'hasCourseInstance': {
                        '@type': 'CourseInstance',
                        'courseMode': 'Onsite',
                        'courseWorkload': 'PT1H',
                        'instructor': {
                            '@type': 'Person',
                            'name': 'Studio Nol Engineer'
                        },
                        'location': {
                            '@type': 'Place',
                            'name': '스튜디오 놀',
                            'address': {
                                '@type': 'PostalAddress',
                                'streetAddress': '대조동 84-3 3층',
                                'addressLocality': '은평구',
                                'addressRegion': '서울특별시',
                                'postalCode': '03424',
                                'addressCountry': 'KR'
                            }
                        }
                    },
                    'offers': {
                        '@type': 'Offer',
                        'category': 'Paid',
                        'price': '350000',
                        'priceCurrency': 'KRW',
                        'availability': 'https://schema.org/InStock',
                        'url': 'https://studionol.co.kr/lesson'
                    }
                }}
                breadcrumbs={[
                    { name: '홈', path: '/' },
                    { name: '레슨', path: '/lesson' },
                ]}
                ogImage="/images/lesson1.png"
            />
            <ImageHero
                title="올인원 프로덕션 마스터 클래스"
                subtitle={
                    <>
                        상상을 현실의 소리로, 아이디어를 완성된 음반으로.
                        <br />
                        프로의 공간에서 프로의 노하우를 배우세요.
                    </>
                }
                backgroundImage="/images/lesson1.png"
                imageAlt="스튜디오 믹싱 콘솔"
                minHeight="min-h-[60vh]"
                overlayGradient="from-black/60 via-black/40 to-transparent"
            />

            <div className="container mx-auto px-4 py-16">

                {/* Intro Section */}
                {/* Intro Section */}
                <SectionHeading
                    icon={GraduationCap}
                    title={
                        <>
                            단순히 배우는 것을 넘어,<br />
                            <span className="text-primary">아티스트로 데뷔하는 과정</span>입니다
                        </>
                    }
                    subtitle={
                        <>
                            스튜디오 놀의 레슨은 교과서적인 이론 교육이 아닙니다. <br className="hidden md:block" />
                            실제 앨범 제작 현장에서 프로들이 사용하는 장비와 워크플로우를 그대로 경험하며, <br className="hidden md:block" />
                            자신만의 음악을 완성해가는 <strong>&apos;실전형 프로젝트&apos;</strong>입니다.
                        </>
                    }
                    className="mb-16"
                />

                {/* Curriculum Grid */}
                <div className="mb-16">
                    <SectionHeading
                        icon={BookOpen}
                        title="Curriculum: 4 Steps to Master"
                        as="h3"
                        className="mb-12"
                        titleClassName="text-2xl"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <CurriculumCard
                            step="01"
                            title="MIDI & Producing"
                            subtitle="창작의 기초"
                            icon={Music}
                            description={[
                                "DAW 워크플로우 최적화",
                                "가상악기 및 사운드 디자인",
                                "드럼/베이스 리듬 편곡법",
                                "송 폼(Song Form)과 편곡의 미학"
                            ]}
                            delay={0.1}
                        />
                        <CurriculumCard
                            step="02"
                            title="Recording"
                            subtitle="프로 사운드 캡처"
                            icon={Mic2}
                            description={[
                                "프로급 마이크(U87ai 등) 비교 청음",
                                "시그널 플로우 (마이크-프리-DAW) 이해",
                                "보컬 디렉팅 및 튠 보정(Melodyne)",
                                "실제 악기 마이킹 테크닉"
                            ]}
                            delay={0.2}
                        />
                        <CurriculumCard
                            step="03"
                            title="Mixing"
                            subtitle="사운드 조각하기"
                            icon={Sliders}
                            description={[
                                "밸런스와 패닝, 스테레오 이미지",
                                "EQ & Dynamics(컴프레서) 활용",
                                "공간계 이펙트(리버브/딜레이)",
                                "아날로그 아웃보드 하이브리드 믹싱"
                            ]}
                            delay={0.3}
                        />
                        <CurriculumCard
                            step="04"
                            title="Mastering"
                            subtitle="완성과 발매"
                            icon={Disc}
                            description={[
                                "라우드니스 표준(LUFS)과 플랫폼 규격",
                                "앨범 톤 밸런스 및 일관성",
                                "유통 메타데이터 및 ISRC",
                                "최종 모니터링 및 음원 발매 실습"
                            ]}
                            delay={0.4}
                        />
                    </div>
                </div>

                {/* Why Choose Us & Pricing - 2 Column Layout */}
                <div className="grid lg:grid-cols-2 gap-12 items-start mb-16">

                    {/* Why Choose Us */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                    >
                        <SectionHeading
                            title="Why Studio Nol?"
                            as="h3"
                            align="left"
                            className="mb-8"
                        />
                        <div className="space-y-10">
                            <div className="flex">
                                <div className="bg-primary/10 p-4 rounded-xl h-fit mr-6">
                                    <Mic2 className="text-primary" size={32} />
                                </div>
                                <div>
                                    <h4 className="typo-card-title mb-3">최고급 장비 실습</h4>
                                    <p className="typo-card-body text-gray-600 dark:text-gray-300">
                                        강의실이 아닌 실제 레코딩 스튜디오에서 수업합니다. Neumann, SPL, SSL 등 프로들이 사용하는 장비를 직접 만져보고 소리를 들어보며 귀를 트레이닝합니다.
                                    </p>
                                </div>
                            </div>
                            <div className="flex">
                                <div className="bg-primary/10 p-4 rounded-xl h-fit mr-6">
                                    <Disc className="text-primary" size={32} />
                                </div>
                                <div>
                                    <h4 className="typo-card-title mb-3">음원 발매 지원</h4>
                                    <p className="typo-card-body text-gray-600 dark:text-gray-300">
                                        수업의 결과물은 연습 파일로 끝나지 않습니다. 완성된 곡을 실제 음원 사이트에 발매하여 아티스트로서의 커리어를 시작할 수 있도록 돕습니다.
                                    </p>
                                </div>
                            </div>

                            <div className="flex">
                                <div className="bg-primary/10 p-4 rounded-xl h-fit mr-6">
                                    <Users className="text-primary" size={32} />
                                </div>
                                <div>
                                    <h4 className="typo-card-title mb-3">현업 엔지니어 실전 멘토링</h4>
                                    <p className="typo-card-body text-gray-600 dark:text-gray-300">
                                        단순한 기술 전수가 아닌, 현장에서 즉시 활용 가능한 실전 노하우와 음악적 고민을 함께 나누는 1:1 멘토링을 제공합니다.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Pricing Card */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700"
                    >
                        <div className="p-8 bg-gradient-to-br from-primary to-secondary text-white text-center">
                            <h3 className="text-2xl font-bold mb-2">1:1 Private Lesson</h3>
                            <p className="opacity-90">개개인의 수준과 목표에 맞춘 맞춤형 수업</p>
                        </div>
                        <div className="p-8">
                            <div className="flex justify-center items-end mb-6">
                                <span className="text-4xl font-bold text-gray-800 dark:text-white">350,000</span>
                                <span className="text-xl text-gray-500 mb-1 ml-1">원 / 월</span>
                            </div>
                            <ul className="space-y-4 mb-8">
                                <li className="flex items-center text-gray-600 dark:text-gray-300">
                                    <CheckCircle size={18} className="text-green-500 mr-3" />
                                    <span>주 1회, 60분 1:1 집중 수업</span>
                                </li>
                                <li className="flex items-center text-gray-600 dark:text-gray-300">
                                    <CheckCircle size={18} className="text-green-500 mr-3" />
                                    <span>스튜디오 장비/시설 무상 사용</span>
                                </li>
                                <li className="flex items-center text-gray-600 dark:text-gray-300">
                                    <CheckCircle size={18} className="text-green-500 mr-3" />
                                    <span>수업 외 연습 시 녹음실 할인</span>
                                </li>

                            </ul>
                            <a
                                href="https://open.kakao.com/me/nol"
                                target="_blank"
                                rel="noreferrer"
                                className="block w-full text-center bg-gray-900 dark:bg-gray-700 hover:bg-primary text-white font-bold py-4 rounded-xl transition-colors duration-300"
                            >
                                상담 신청하기
                            </a>
                        </div>
                    </motion.div>

                </div>

                {/* Improved CTA Section (Reference: Practice Room style) */}
                <motion.div
                    className="mt-16 overflow-hidden rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                >
                    <div className="grid md:grid-cols-2 items-stretch min-h-[400px]">
                        <div className="bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 dark:from-primary/20 dark:via-secondary/20 dark:to-accent/20 p-8 md:p-12 flex flex-col justify-center">
                            <SectionHeading
                                icon={Sparkles}
                                title={
                                    <>
                                        아직 망설여지시나요?<br />
                                        <span className="text-primary">첫 걸음을 함께합니다.</span>
                                    </>
                                }
                                subtitle="음악을 시작하는 데 늦은 때란 없습니다. 프로의 공간에서 직접 장비를 만져보고 상담받으며 당신만의 커리큘럼을 계획해보세요."
                                align="left"
                                className="mb-8"
                                as="h3"
                            />
                            <div className="flex flex-col sm:flex-row gap-4">
                                <Link href="/contact" className="inline-flex items-center justify-center bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold py-4 px-8 rounded-2xl shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100 dark:border-gray-600">
                                    오시는 길
                                </Link>
                                <a
                                    href="https://open.kakao.com/me/nol"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center bg-primary hover:bg-primary-dark text-white font-bold py-4 px-8 rounded-2xl shadow-xl transition-all duration-300"
                                >
                                    <MessageCircle className="mr-2" size={20} />
                                    카카오톡 상담하기
                                </a>
                            </div>
                        </div>
                        <a
                            href="https://open.kakao.com/me/nol"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="relative h-64 md:h-auto overflow-hidden block group cursor-pointer"
                        >
                            <ResponsiveImage
                                src="/images/lesson1.png"
                                alt="스튜디오 놀 음악 레슨 현장"
                                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                                pictureClassName="block h-full"
                                loading="lazy"
                                sizes="(min-width: 768px) 50vw, 100vw"
                                fill
                            />
                            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent pointer-events-none" />
                        </a>
                    </div>
                </motion.div>

            </div>
        </>
    );
};

Lesson.hasHero = true;

export default Lesson;

export const getStaticProps = () => ({
    props: {},
});

