import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { ArrowLeft, Share2, ExternalLink } from 'lucide-react';
import SEO from '../../components/SEO';
import ResponsiveImage from '../../components/ResponsiveImage';
import { categories, portfolioItems } from '../../data/portfolio';

const PortfolioDetailPage = ({ item }) => {
  const router = useRouter();

  if (router.isFallback) {
    return (
      <div className="container mx-auto px-4 pt-16 pb-12 flex justify-center items-center h-64">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const shareUrl = `https://studionol.co.kr/portfolio/${item.id}`;
  const metaDescription = `${item.artist}의 "${item.title}" - ${item.description}. 스튜디오 놀에서 작업한 프로젝트입니다.`;

  // 카테고리 정보 가져오기
  const categoryInfo = categories.find((cat) => cat.id === item.category) || {
    name: item.category,
    color: '#6d28d9',
  };

  const sharePortfolio = async () => {
    const shareData = {
      title: `${item.title} - 스튜디오 놀`,
      text: metaDescription,
      url: shareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${item.title}\n${shareUrl}`);
        alert('링크가 클립보드에 복사되었습니다.');
      }
    } catch (error) {
      console.error('공유 오류:', error);
    }
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
      <div className="container mx-auto px-4 pt-8 pb-12">
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
            {/* 이미지 영역 */}
            <div className="relative aspect-square max-w-md mx-auto mt-8">
              <ResponsiveImage
                src={item.image}
                alt={item.title}
                className="object-cover rounded-lg"
                pictureClassName="block w-full h-full"
                sizes="(min-width: 768px) 400px, 100vw"
                fill
              />
            </div>

            {/* 콘텐츠 영역 */}
            <div className="p-8">
              {/* 카테고리 배지 */}
              <div className="mb-4">
                <span
                  className="inline-block px-3 py-1 text-sm font-medium text-white rounded-full"
                  style={{ backgroundColor: categoryInfo.color }}
                >
                  {categoryInfo.name}
                </span>
              </div>

              {/* 제목 */}
              <h1 className="text-heading-2 font-title text-gray-900 dark:text-white mb-2">
                {item.title}
              </h1>

              {/* 아티스트 */}
              <p className="typo-card-body text-gray-600 dark:text-gray-300 mb-6">
                아티스트: {item.artist}
              </p>

              {/* 제공 서비스 */}
              <div className="mb-8">
                <h2 className="typo-card-title text-gray-900 dark:text-white mb-3">
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

              {/* 버튼 그룹 */}
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
      </div>
    </>
  );
};

export const getStaticPaths = () => {
  const paths = portfolioItems.map((item) => ({
    params: { id: item.id },
  }));
  return { paths, fallback: false };
};

export const getStaticProps = async ({ params }) => {
  const item = portfolioItems.find((p) => p.id === params.id);

  if (!item) {
    return { notFound: true };
  }

  return {
    props: { item },
  };
};

export default PortfolioDetailPage;
