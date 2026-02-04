import React from 'react';
import type { NextPage, GetStaticProps, GetStaticPaths, GetStaticPropsContext } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { ArrowLeft, Share2, ExternalLink } from 'lucide-react';
import SEO from '../../components/SEO';
import ResponsiveImage from '../../components/ResponsiveImage';
import { portfolioItems } from '../../data/portfolio';
import type { PortfolioItem } from '../../types/data';
import { shareContent } from '../../utils/shareUtils';
import { getCategoryInfo } from '../../utils/portfolioDataUtils';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { Section } from '../../components/ui/Section';

interface PortfolioDetailPageProps {
  item: PortfolioItem;
}

type Params = {
  id: string;
};

const PortfolioDetailPage: NextPage<PortfolioDetailPageProps> = ({ item }) => {
  const router = useRouter();

  if (router.isFallback) {
    return <LoadingSpinner />;
  }

  const shareUrl = `https://studionol.co.kr/portfolio/${item.id}`;
  const metaDescription = `${item.artist}의 "${item.title}" - ${item.description}. 스튜디오 놀에서 작업한 프로젝트입니다.`;

  const categoryInfo = getCategoryInfo(item.category);

  const sharePortfolio = async () => {
    await shareContent({
      title: `${item.title} - 스튜디오 놀`,
      text: metaDescription,
      url: shareUrl,
    });
  };

  return (
    <>
      <SEO
        title={`${item.title} - 스튜디오 놀 포트폴리오`}
        description={metaDescription}
        canonical={shareUrl}
        ogImage={item.image}
        ogType="music.album"
        keywords={`${item.artist}, ${item.title}, ${item.services.join(', ')}, 스튜디오 놀`}
      />
      <Section variant="default" className="pt-8 pb-12">
        <div className="mb-8">
          <Link
            href="/portfolio"
            className="inline-flex items-center typo-card-cta hover:underline mb-6"
          >
            <ArrowLeft className="mr-2" size={16} />
            포트폴리오 목록으로 돌아가기
          </Link>
        </div>

        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="relative aspect-square max-w-md mx-auto mt-8">
              <ResponsiveImage
                src={item.image}
                alt={item.title}
                className="object-cover rounded-lg"
                pictureClassName="block w-full h-full"
                sizes="(min-width: 768px) 400px, 100vw"
                width={400}
                height={400}
                fill
              />
            </div>

            <div className="p-8">
              <div className="mb-4">
                <span
                  className="inline-block px-3 py-1 text-sm font-medium text-white rounded-full"
                  style={{ backgroundColor: categoryInfo.color }}
                >
                  {categoryInfo.name}
                </span>
              </div>

              <h1 className="text-heading-2 font-title mb-2">
                {item.title}
              </h1>

              <p className="typo-card-body mb-6">
                아티스트: {item.artist}
              </p>

              <div className="mb-8">
                <h2 className="typo-card-title mb-3">
                  제공 서비스
                </h2>
                <div className="flex flex-wrap gap-2">
                  {item.services.map((service) => (
                    <span
                      key={service}
                      className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm"
                    >
                      {service}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors font-medium"
                >
                  <ExternalLink size={16} />
                  음원 들으러 가기
                </a>
                <button
                  onClick={sharePortfolio}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 border-2 border-primary text-primary hover:bg-primary hover:text-white rounded-lg transition-colors font-medium"
                >
                  <Share2 size={16} />
                  공유하기
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </Section>
    </>
  );
};

export const getStaticPaths: GetStaticPaths<Params> = () => {
  const paths = portfolioItems.map((item) => ({
    params: { id: item.id },
  }));
  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps<PortfolioDetailPageProps, Params> = async ({ params }) => {
  const item = portfolioItems.find((p) => p.id === params!.id);

  if (!item) {
    return { notFound: true };
  }

  return {
    props: { item },
  };
};

export default PortfolioDetailPage;
