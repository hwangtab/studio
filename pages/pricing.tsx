// @ts-nocheck
import type { NextPage } from 'next'; import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mic, SlidersHorizontal, Disc, TrendingUp, Check, Info, MessageCircle, CalendarCheck } from 'lucide-react';
// @ts-ignore - Component is JS
import SEO from '../components/SEO';
// @ts-ignore - Component is JS
import SectionHeading from '../components/ui/SectionHeading';
import { PAGE_TITLE_ANIMATION, PAGE_SUBTITLE_ANIMATION } from '../utils/animationUtils';
import {
    VAT_NOTICE,
    recordingOffers,
    mixingOffers,
    masteringOffers,
    additionalServices,
    specialPackages,
} from '../data/pricing';

const SITE_URL = 'https://studionol.co.kr';

const SECTION_SUMMARIES = {
    special: '축가, 성우, 유튜브 촬영 등 목적에 맞춰 최적화된 올인원 패키지 상품입니다.',
    recording: '레코딩은 시간당 10만원(최소 2시간) 혹은 6시간 패키지(Day Lock) 50만원으로 이용할 수 있으며 모든 금액은 VAT 별도입니다.',
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
            buildOfferCatalog('스페셜 패키지', specialPackages),
            buildOfferCatalog('레코딩', recordingOffers),
            buildOfferCatalog('믹싱', mixingOffers),
            buildOfferCatalog('마스터링', masteringOffers),
            buildOfferCatalog('부가 서비스', additionalServices),
        ],
    },
};

// @ts-ignore - Component is JS
import PricingCard from '../components/ui/PricingCard';
// @ts-ignore - Component is JS
import ImageHero from '../components/common/ImageHero';
// @ts-ignore - Component is JS
import ResponsiveImage from '../components/ResponsiveImage';
import { SECTION_BG } from '../utils/sectionStyles';

const Pricing: NextPage = () => {
    return (
        <div className="overflow-visible">
            <SEO
                title="셀프 축가 녹음 비용 · 성우 녹음 & 유튜브 스튜디오 대관료 | 스튜디오 놀"
                description="투명한 정찰제 운영. 셀프 축가 녹음 패키지, 성우/나레이션 녹음 견적, 유튜브 촬영 스튜디오 대관 비용을 확인하세요. 합리적인 가격의 프로덕션."
                keywords="셀프 축가 비용, 축가 녹음 가격, 성우 녹음 견적, 유튜브 스튜디오 대관료, 녹음실 대여 비용, 믹싱 의뢰 가격, 음반 제작 비용, 스튜디오 놀"
                canonical="https://studionol.co.kr/pricing"
                includeSchema={true}
                schema={pricingSchema}
                breadcrumbs={[
                    { name: '홈', path: '/' },
                    { name: '가격 안내', path: '/pricing' },
                ]}
            />

            {/* Hero Section */}
            <ImageHero
                title="합리적인 가격, 투명한 서비스"
                subtitle={
                    <>
                        프로젝트 스튜디오 운영에 필요한 핵심 서비스에 대한 고정 단가를 제시합니다.
                        <br />
                        숨겨진 비용 없이, 뮤지션의 예산 계획을 돕습니다.
                    </>
                }
                backgroundImage="/images/hardware2.jpg"
                imageAlt="스튜디오 놀 가격 안내"
                minHeight="min-h-[60vh]"
                overlayGradient="from-black/60 via-black/40 to-transparent"
            />

            {/* Special Packages Section */}
            <section id="special-packages" className={`py-16 ${SECTION_BG.highlight} bg-amber-50 dark:bg-amber-900/10`}>
                <div className="container mx-auto px-4">
                    <SectionHeading
                        icon={TrendingUp}
                        title="스페셜 패키지 (Purpose-Built)"
                        subtitle="축가, 성우, 유튜브 등 구체적인 목적에 맞춰 최적화된 올인원 패키지"
                    />
                    <p className="typo-card-body text-center text-gray-500 dark:text-gray-400 max-w-3xl mx-auto mb-6">
                        {VAT_NOTICE}
                    </p>
                    <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                        {specialPackages.map((offer, index) => (
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

            {/* Recording Section */}
            <section id="recording" className="py-16">
                <div className="container mx-auto px-4">
                    <SectionHeading
                        icon={Mic}
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
            <section id="mixing" className={`py-16 ${SECTION_BG.alternate}`}>
                <div className="container mx-auto px-4">
                    <SectionHeading
                        icon={SlidersHorizontal}
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
                        <Info className="text-primary mt-1 mr-3 flex-shrink-0" size={18} />
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
                        icon={Disc}
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
            <section id="support-services" className={`py-16 ${SECTION_BG.alternate}`}>
                <div className="container mx-auto px-4">
                    <SectionHeading
                        icon={TrendingUp}
                        title="부가 서비스"
                        subtitle="기획부터 홍보까지, 뮤지션의 성공적인 활동을 위한 올인원 서포트"
                    />
                    <p className="typo-card-body text-center text-gray-500 dark:text-gray-400 max-w-3xl mx-auto mb-6">
                        {VAT_NOTICE}
                    </p>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {additionalServices.map((service, index) => (
                            <PricingCard
                                key={service.id}
                                id={service.id}
                                title={service.title}
                                price={service.priceDisplay}
                                unit={service.unit}
                                description={service.description}
                                features={service.note ? [service.note] : []}
                                delay={0.1 * (index + 1)}
                            />
                        ))}
                    </div>
                </div>
            </section>

            {/* Improved CTA Section (Consistency with other pages) */}
            <section className="py-12">
                <div className="container mx-auto px-4">
                    <motion.div
                        className="overflow-hidden rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700"
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8 }}
                    >
                        <div className="grid md:grid-cols-2 items-stretch min-h-[400px]">
                            <div className="bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 dark:from-primary/20 dark:via-secondary/20 dark:to-accent/20 p-8 md:p-12 flex flex-col justify-center">
                                <h2 className="typo-section-title mb-4 text-gray-800 dark:text-white">
                                    당신의 음악을 위한<br />
                                    <span className="text-primary">최고의 파트너</span>
                                </h2>
                                <p className="typo-section-lead text-gray-600 dark:text-gray-300 mb-8">
                                    예산과 일정에 맞는 최적의 플랜을 제안해 드립니다. <br className="hidden md:block" />
                                    부담 없이 문의주세요. 첫 소통부터 최종 결과물까지 함께합니다.
                                </p>
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <Link
                                        href="/contact"
                                        className="inline-flex items-center justify-center bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold py-4 px-8 rounded-2xl shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100 dark:border-gray-600"
                                    >
                                        오시는 길
                                    </Link>
                                    <a
                                        href="https://open.kakao.com/me/nol"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center justify-center bg-primary hover:bg-primary-dark text-white font-bold py-4 px-8 rounded-2xl shadow-xl transition-all duration-300"
                                    >
                                        <MessageCircle className="mr-2" size={20} />
                                        카카오톡 문의하기
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
                                    src="/images/recording15.png"
                                    alt="스튜디오 놀 프로 패키지 녹음 장비"
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
            </section>
        </div>
    );
};

export default Pricing;

(Pricing as any).hasHero = true;
