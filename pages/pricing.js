import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FaMicrophone, FaSlidersH, FaCompactDisc, FaChartLine, FaCheck, FaInfoCircle } from 'react-icons/fa';
import SEO from '../components/SEO';
import { PAGE_TITLE_ANIMATION, PAGE_SUBTITLE_ANIMATION } from '../utils/animationUtils';

const PricingCard = ({ title, price, unit, description, features, recommended, delay }) => {
    return (
        <motion.div
            className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg border ${recommended
                ? 'border-primary dark:border-primary-light ring-2 ring-primary/20 dark:ring-primary-light/20'
                : 'border-gray-100 dark:border-gray-700'
                } p-8 flex flex-col h-full transition-all duration-300 hover:shadow-xl hover:-translate-y-1`}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay }}
        >
            {recommended && (
                <div className="absolute top-0 right-0 bg-primary text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">
                    RECOMMENDED
                </div>
            )}
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">{title}</h3>
            <div className="flex items-baseline mb-4">
                <span className="text-3xl font-extrabold text-primary dark:text-primary-light">{price}</span>
                {unit && <span className="text-gray-500 dark:text-gray-400 ml-1 text-sm">{unit}</span>}
            </div>
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-6 min-h-[40px]">{description}</p>

            <div className="border-t border-gray-100 dark:border-gray-700 my-4"></div>

            <ul className="space-y-3 flex-grow">
                {features.map((feature, index) => (
                    <li key={index} className="flex items-start text-sm text-gray-600 dark:text-gray-300">
                        <FaCheck className="text-green-500 mt-1 mr-2 flex-shrink-0" />
                        <span>{feature}</span>
                    </li>
                ))}
            </ul>
        </motion.div>
    );
};

const SectionTitle = ({ icon: Icon, title, subtitle }) => (
    <motion.div
        className="text-center mb-12"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
    >
        <div className="inline-flex items-center justify-center p-3 bg-primary/10 dark:bg-primary/20 rounded-full mb-4">
            <Icon className="text-2xl text-primary dark:text-primary-light" />
        </div>
        <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-3">{title}</h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">{subtitle}</p>
    </motion.div>
);

const Pricing = () => {
    return (
        <div className="overflow-visible">
            <SEO
                title="이용안내 - 스튜디오 놀"
                description="스튜디오 놀의 합리적이고 투명한 가격 정책을 확인하세요. 레코딩, 믹싱, 마스터링부터 올인원 프로덕션 서비스까지."
                keywords="스튜디오 가격, 녹음실 가격, 믹싱 비용, 마스터링 비용, 음반 제작 비용, 스튜디오 놀 이용안내"
                canonical="https://studionol.co.kr/pricing"
            />

            {/* Hero Section */}
            <section className="bg-gradient-to-b from-primary/5 to-transparent dark:from-primary/10 dark:to-transparent pt-20 pb-16">
                <div className="container mx-auto px-4 text-center">
                    <motion.h1
                        className="text-4xl md:text-5xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent"
                        {...PAGE_TITLE_ANIMATION}
                    >
                        합리적인 가격, 투명한 서비스
                    </motion.h1>
                    <motion.p
                        className="text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed"
                        {...PAGE_SUBTITLE_ANIMATION}
                    >
                        프로젝트 스튜디오 운영에 필요한 핵심 서비스에 대한 고정 단가를 제시합니다.<br className="hidden md:block" />
                        숨겨진 비용 없이, 뮤지션의 예산 계획을 돕습니다.
                    </motion.p>
                    <motion.p
                        className="mt-4 text-sm font-medium text-red-500 dark:text-red-400"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                    >
                        * 모든 가격은 VAT 별도입니다.
                    </motion.p>
                </div>
            </section>

            {/* Recording Section */}
            <section className="py-16">
                <div className="container mx-auto px-4">
                    <SectionTitle
                        icon={FaMicrophone}
                        title="레코딩 (Recording)"
                        subtitle="최고급 아날로그 장비와 전문 엔지니어링이 포함된 프리미엄 녹음 서비스"
                    />
                    <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                        <PricingCard
                            title="시간당 레코딩"
                            price="70,000원"
                            unit="/ 시간"
                            description="짧은 녹음이나 성우 녹음, 간단한 악기 녹음에 적합합니다."
                            features={[
                                "전문 엔지니어링 포함",
                                "최소 2시간부터 예약 가능",
                                "보컬 디렉팅 지원",
                                "실시간 모니터링 및 피드백"
                            ]}
                            delay={0.1}
                        />
                        <PricingCard
                            title="일당 레코딩 (Day Lock)"
                            price="600,000원"
                            unit="/ 일"
                            description="앨범 작업 등 장시간 녹음이 필요할 때 합리적인 선택입니다."
                            features={[
                                "10시간 패키지 (시간당 6만원 꼴)",
                                "충분한 휴식과 여유로운 작업",
                                "식사 시간 포함",
                                "장시간 집중이 필요한 프로젝트에 최적"
                            ]}
                            recommended={true}
                            delay={0.2}
                        />
                    </div>
                </div>
            </section>

            {/* Mixing Section */}
            <section className="py-16 bg-gray-50 dark:bg-gray-900/50">
                <div className="container mx-auto px-4">
                    <SectionTitle
                        icon={FaSlidersH}
                        title="믹싱 (Mixing)"
                        subtitle="트랙 수에 따른 합리적인 가격 책정. 아날로그와 디지털의 조화로 최상의 사운드를 만듭니다."
                    />
                    <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
                        <PricingCard
                            title="Level 1"
                            price="200,000원"
                            unit="/ 곡"
                            description="심플한 구성의 곡에 적합합니다."
                            features={[
                                "10 트랙 이하",
                                "보컬 + MR 또는 소편성 악기",
                                "기본 2회 수정 포함",
                                "밸런스 및 톤 보정"
                            ]}
                            delay={0.1}
                        />
                        <PricingCard
                            title="Level 2"
                            price="350,000원"
                            unit="/ 곡"
                            description="일반적인 밴드 구성이나 팝 음악에 적합합니다."
                            features={[
                                "11 ~ 30 트랙",
                                "풀 밴드 구성 또는 팝 편곡",
                                "기본 2회 수정 포함",
                                "디테일한 이펙팅 및 공간감 형성"
                            ]}
                            recommended={true}
                            delay={0.2}
                        />
                        <PricingCard
                            title="Level 3"
                            price="500,000원"
                            unit="/ 곡"
                            description="대편성 오케스트라나 복잡한 레이어의 곡에 적합합니다."
                            features={[
                                "31 트랙 이상",
                                "대편성 또는 복잡한 일렉트로닉",
                                "기본 2회 수정 포함",
                                "최고 수준의 디테일 작업"
                            ]}
                            delay={0.3}
                        />
                    </div>
                    <div className="mt-8 max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-xl p-6 border border-primary/20 shadow-sm flex items-start">
                        <FaInfoCircle className="text-primary mt-1 mr-3 flex-shrink-0" />
                        <div>
                            <h4 className="font-bold text-gray-800 dark:text-white mb-1">보컬 튠/에딧 옵션</h4>
                            <p className="text-gray-600 dark:text-gray-300 text-sm">
                                정교한 보컬 튜닝과 박자 보정이 필요한 경우 <span className="font-bold text-primary dark:text-primary-light">곡당 150,000원</span>이 추가됩니다. 자연스러운 보정을 원칙으로 합니다.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Mastering Section */}
            <section className="py-16">
                <div className="container mx-auto px-4">
                    <SectionTitle
                        icon={FaCompactDisc}
                        title="마스터링 (Mastering)"
                        subtitle="음악의 최종 완성도를 높이는 마지막 단계. 어떤 재생 환경에서도 일관된 사운드를 보장합니다."
                    />
                    <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                        <PricingCard
                            title="싱글 마스터링"
                            price="100,000원"
                            unit="/ 곡"
                            description="디지털 싱글 발매를 위한 최적의 마스터링입니다."
                            features={[
                                "스트리밍 플랫폼 규격 준수",
                                "기본 1회 수정 포함",
                                "고해상도 음원 제공",
                                "장르별 최적화된 라우드니스 설정"
                            ]}
                            delay={0.1}
                        />
                        <PricingCard
                            title="EP / 앨범 패키지"
                            price="80,000원"
                            unit="/ 곡"
                            description="4곡 이상의 앨범 작업 시 적용되는 할인 가격입니다."
                            features={[
                                "4곡 이상 진행 시 적용",
                                "앨범 전체의 톤 앤 매너 통일",
                                "곡 간 레벨 밸런싱",
                                "기본 1회 수정 포함"
                            ]}
                            recommended={true}
                            delay={0.2}
                        />
                    </div>
                </div>
            </section>

            {/* Additional Services Section */}
            <section className="py-16 bg-gray-50 dark:bg-gray-900/50">
                <div className="container mx-auto px-4">
                    <SectionTitle
                        icon={FaChartLine}
                        title="부가 서비스"
                        subtitle="기획부터 홍보까지, 뮤지션의 성공적인 활동을 위한 올인원 서포트"
                    />
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        <motion.div
                            className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-100 dark:border-gray-700"
                            whileHover={{ y: -5 }}
                            transition={{ duration: 0.3 }}
                        >
                            <h3 className="font-bold text-lg mb-2 text-gray-800 dark:text-white">기획/컨설팅</h3>
                            <p className="text-2xl font-bold text-primary dark:text-primary-light mb-4">50,000원 <span className="text-sm text-gray-500 font-normal">/ 시간</span></p>
                            <p className="text-sm text-gray-600 dark:text-gray-300">프로젝트 기획, 일정 관리, 예산 수립 등 전반적인 앨범 제작 컨설팅</p>
                        </motion.div>

                        <motion.div
                            className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-100 dark:border-gray-700"
                            whileHover={{ y: -5 }}
                            transition={{ duration: 0.3 }}
                        >
                            <h3 className="font-bold text-lg mb-2 text-gray-800 dark:text-white">펀딩 설계 대행</h3>
                            <div className="mb-4">
                                <p className="text-lg font-bold text-primary dark:text-primary-light">400,000원 <span className="text-xs text-gray-500 font-normal">(선불)</span></p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">+ 성공 수수료 10% (후불)</p>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-300">텀블벅 등 크라우드 펀딩 페이지 기획, 스토리텔링, 리워드 설계</p>
                        </motion.div>

                        <motion.div
                            className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-100 dark:border-gray-700"
                            whileHover={{ y: -5 }}
                            transition={{ duration: 0.3 }}
                        >
                            <h3 className="font-bold text-lg mb-2 text-gray-800 dark:text-white">펀딩 성공 수수료</h3>
                            <p className="text-2xl font-bold text-primary dark:text-primary-light mb-4">성공액의 10%</p>
                            <p className="text-sm text-gray-600 dark:text-gray-300">목표 금액 초과분 포함 최종 펀딩 성공액 기준, 성과 발생 시 후불 청구</p>
                        </motion.div>

                        <motion.div
                            className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-100 dark:border-gray-700"
                            whileHover={{ y: -5 }}
                            transition={{ duration: 0.3 }}
                        >
                            <h3 className="font-bold text-lg mb-2 text-gray-800 dark:text-white">기본 홍보 패키지</h3>
                            <p className="text-2xl font-bold text-primary dark:text-primary-light mb-4">300,000원</p>
                            <p className="text-sm text-gray-600 dark:text-gray-300">전문 보도자료 작성 및 언론 배포, 주요 음악 사이트 앨범 소개 등록 대행</p>
                        </motion.div>

                        <motion.div
                            className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-100 dark:border-gray-700"
                            whileHover={{ y: -5 }}
                            transition={{ duration: 0.3 }}
                        >
                            <h3 className="font-bold text-lg mb-2 text-gray-800 dark:text-white">EPK 웹사이트</h3>
                            <p className="text-2xl font-bold text-primary dark:text-primary-light mb-4">500,000원</p>
                            <p className="text-sm text-gray-600 dark:text-gray-300">아티스트/앨범 소개를 위한 반응형 웹사이트 제작 (Electronic Press Kit)</p>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 bg-gradient-to-r from-primary via-secondary to-accent text-white text-center">
                <div className="container mx-auto px-4">
                    <h2 className="text-3xl md:text-4xl font-bold mb-6">당신의 음악을 위한 최고의 파트너</h2>
                    <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
                        예산과 일정에 맞는 최적의 플랜을 제안해 드립니다.<br />
                        부담 없이 문의해주세요.
                    </p>
                    <Link href="/contact" passHref legacyBehavior>
                        <motion.a
                            className="inline-block bg-white text-primary-dark font-bold py-4 px-10 rounded-full shadow-lg hover:bg-gray-100 transition-colors duration-300"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            무료 상담 신청하기
                        </motion.a>
                    </Link>
                </div>
            </section>
        </div>
    );
};

export default Pricing;
