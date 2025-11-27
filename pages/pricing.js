import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FaMicrophone, FaSlidersH, FaCompactDisc, FaChartLine, FaCheck, FaInfoCircle } from 'react-icons/fa';
import SEO from '../components/SEO';
import SectionHeading from '../components/ui/SectionHeading';
import { PAGE_TITLE_ANIMATION, PAGE_SUBTITLE_ANIMATION } from '../utils/animationUtils';
import {
    VAT_NOTICE,
    recordingOffers,
    mixingOffers,
    masteringOffers,
    additionalServices,
} from '../data/pricing';

const SITE_URL = 'https://studionol.co.kr';

const SECTION_SUMMARIES = {
    recording: '레코딩은 시간당 7만원(최소 2시간) 혹은 Day Lock 10시간 50만원으로 이용할 수 있으며 모든 금액은 VAT 별도입니다.',
    mixing: '믹싱은 트랙 수에 따라 20만~50만원으로 고정되어 있고, 모든 플랜에는 기본 두 번의 수정이 포함됩니다.',
    mastering: '마스터링은 싱글 곡당 10만원, 4곡 이상의 EP·앨범 작업은 곡당 8만원으로 묶음 할인이 적용됩니다.',
    extras: '컨설팅은 시간당 5만원, 펀딩 설계 대행은 40만원+성과 수수료 10%, 홍보/EPK 패키지는 각 30·50만원으로 제공됩니다.',
};

const providerSchema = {
    '@type': 'MusicRecordingStudio',
    name: '스튜디오 놀',
    url: SITE_URL,
    telephone: '+82-2-764-3114',
    address: {
        '@type': 'PostalAddress',
        streetAddress: '대조동 84-3 3층',
        addressLocality: '은평구',
        addressRegion: '서울특별시',
        postalCode: '03424',
        addressCountry: 'KR',
    },
};

const mapOfferToSchema = (category, offer) => {
    const offerSchema = {
        '@type': 'Offer',
        name: `${category} - ${offer.title}`,
        description: `${offer.description} (${VAT_NOTICE})`,
        priceCurrency: 'KRW',
        price: offer.priceValue,
        availability: 'https://schema.org/InStock',
        url: `${SITE_URL}/pricing#${offer.id}`,
        itemOffered: {
            '@type': 'Service',
            name: offer.title,
            serviceType: category,
            provider: providerSchema,
        },
    };

    if (offer.unit) {
        offerSchema.eligibleQuantity = {
            '@type': 'QuantitativeValue',
            unitText: offer.unit.replace('/', '').trim(),
        };
    }

    return offerSchema;
};

const buildOfferCatalog = (name, offers) => ({
    '@type': 'OfferCatalog',
    name,
    itemListElement: offers.map((offer) => mapOfferToSchema(name, offer)),
});

const pricingSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: '스튜디오 놀 가격 안내',
    description: '레코딩, 믹싱, 마스터링, 부가 서비스까지 모든 가격을 VAT 별도 고정 단가로 제공합니다.',
    url: `${SITE_URL}/pricing`,
    provider: providerSchema,
    hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'Studio Nol Fixed Pricing',
        itemListElement: [
            buildOfferCatalog('레코딩', recordingOffers),
            buildOfferCatalog('믹싱', mixingOffers),
            buildOfferCatalog('마스터링', masteringOffers),
            buildOfferCatalog('부가 서비스', additionalServices),
        ],
    },
};

import PricingCard from '../components/ui/PricingCard';

const Pricing = () => {
    return (
        <div className="overflow-visible">
            <SEO
                title="녹음실·믹싱·마스터링 가격 | 스튜디오 놀 이용안내"
                description="시간당 7만원 레코딩, Day Lock 50만원, 믹싱 20~50만원, 마스터링 8~10만원까지 스튜디오 놀의 VAT 별도 고정 단가표를 확인하세요."
                keywords="녹음실 가격표, 믹싱 가격, 마스터링 가격, 레코딩 스튜디오 비용, 부가 서비스 패키지, 스튜디오 놀 가격"
                canonical="https://studionol.co.kr/pricing"
                includeSchema={true}
                schema={pricingSchema}
            />

            {/* Hero Section */}
            <section className="bg-gradient-to-b from-primary/5 to-transparent dark:from-primary/10 dark:to-transparent pt-20 pb-16">
                <div className="container mx-auto px-4 text-center">
                    <motion.h1
                        className="text-heading-1 font-title mb-6 text-center text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent"
                        {...PAGE_TITLE_ANIMATION}
                    >
                        합리적인 가격, 투명한 서비스
                    </motion.h1>
                    <motion.p
                        className="typo-section-lead text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed"
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
            <section id="recording" className="py-16">
                <div className="container mx-auto px-4">
                    <SectionHeading
                        icon={FaMicrophone}
                        title="레코딩 (Recording)"
                        subtitle="최고급 아날로그 장비와 전문 엔지니어링이 포함된 프리미엄 녹음 서비스"
                    />
                    <p className="typo-card-body text-center text-gray-500 dark:text-gray-400 max-w-3xl mx-auto mb-6">
                        {VAT_NOTICE}
                    </p>
                    <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                        {recordingOffers.map((offer, index) => (
                            <PricingCard
                                key={offer.id}
                                id={offer.id}
                                title={offer.title}
                                price={offer.priceDisplay}
                                unit={offer.unit}
                                description={offer.description}
                                features={offer.features}
                                recommended={offer.recommended}
                                delay={0.1 * (index + 1)}
                            />
                        ))}
                    </div>
                </div>
            </section>

            {/* Mixing Section */}
            <section id="mixing" className="py-16 bg-gray-50 dark:bg-gray-900/50">
                <div className="container mx-auto px-4">
                    <SectionHeading
                        icon={FaSlidersH}
                        title="믹싱 (Mixing)"
                        subtitle="트랙 수에 따른 합리적인 가격 책정. 아날로그와 디지털의 조화로 최상의 사운드를 만듭니다."
                    />
                    <p className="typo-card-body text-center text-gray-500 dark:text-gray-400 max-w-3xl mx-auto mb-6">
                        {VAT_NOTICE}
                    </p>
                    <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
                        {mixingOffers.map((offer, index) => (
                            <PricingCard
                                key={offer.id}
                                id={offer.id}
                                title={offer.title}
                                price={offer.priceDisplay}
                                unit={offer.unit}
                                description={offer.description}
                                features={offer.features}
                                recommended={offer.recommended}
                                delay={0.1 * (index + 1)}
                            />
                        ))}
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
            <section id="mastering" className="py-16">
                <div className="container mx-auto px-4">
                    <SectionHeading
                        icon={FaCompactDisc}
                        title="마스터링 (Mastering)"
                        subtitle="음악의 최종 완성도를 책임지는 단계로, 어떤 재생 환경에서도 균일한 사운드를 보장합니다."
                    />
                    <p className="typo-card-body text-center text-gray-500 dark:text-gray-400 max-w-3xl mx-auto mb-6">
                        {VAT_NOTICE}
                    </p>
                    <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                        {masteringOffers.map((offer, index) => (
                            <PricingCard
                                key={offer.id}
                                id={offer.id}
                                title={offer.title}
                                price={offer.priceDisplay}
                                unit={offer.unit}
                                description={offer.description}
                                features={offer.features}
                                recommended={offer.recommended}
                                delay={0.1 * (index + 1)}
                            />
                        ))}
                    </div>
                </div>
            </section>

            {/* Additional Services Section */}
            <section id="support-services" className="py-16 bg-gray-50 dark:bg-gray-900/50">
                <div className="container mx-auto px-4">
                    <SectionHeading
                        icon={FaChartLine}
                        title="부가 서비스"
                        subtitle="기획부터 홍보까지, 뮤지션의 성공적인 활동을 위한 올인원 서포트"
                    />
                    <p className="typo-card-body text-center text-gray-500 dark:text-gray-400 max-w-3xl mx-auto mb-6">
                        {VAT_NOTICE}
                    </p>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {additionalServices.map((service) => (
                            <motion.div
                                key={service.id}
                                id={service.id}
                                className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-100 dark:border-gray-700"
                                whileHover={{ y: -5 }}
                                transition={{ duration: 0.3 }}
                            >
                                <h3 className="typo-card-title font-bold mb-2 text-gray-800 dark:text-white">{service.title}</h3>
                                <p className="text-2xl font-bold text-primary dark:text-primary-light mb-4">
                                    {service.priceDisplay}
                                    {service.unit && <span className="text-sm text-gray-500 font-normal"> {service.unit}</span>}
                                </p>
                                <p className="typo-card-body text-gray-600 dark:text-gray-300">{service.description}</p>
                                {service.note && <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{service.note}</p>}
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 bg-gray-50 dark:bg-gray-950">
                <div className="container mx-auto px-4">
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary-dark via-secondary to-accent text-white text-center px-6 py-16 shadow-[0_20px_60px_rgba(15,23,42,0.35)]">
                        <div className="absolute inset-0 opacity-30 bg-gradient-to-br from-white/30 via-transparent to-black/30 pointer-events-none"></div>
                        <div className="relative">
                            <h2 className="text-3xl md:text-4xl font-bold mb-6">당신의 음악을 위한 최고의 파트너</h2>
                            <motion.p
                                className="text-xl text-white/90 mb-8 max-w-2xl mx-auto leading-relaxed"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.2 }}
                            >
                                예산과 일정에 맞는 최적의 플랜을 제안해 드립니다. 부담 없이 문의해주세요.
                            </motion.p>
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
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Pricing;
