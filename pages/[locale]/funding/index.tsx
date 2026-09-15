import type { GetStaticPaths, GetStaticProps } from 'next';
import SEO from '../../../components/SEO';
import ImageHero, { HERO_SCRIM_STRONG } from '../../../components/common/ImageHero';
import Link from 'next/link';
import { ArrowRight } from '@/lib/lucide-icons';
import { Section } from '../../../components/ui/Section';
import FundingProjectCard from '../../../components/funding/FundingProjectCard';
import { buildPageStaticProps } from '../../../lib/getStatic';
import { defaultLocale } from '../../../lib/i18n';
import { computeProjectState, getListableFundingProjects, type ProjectState } from '../../../lib/funding/projects';

interface Item {
  slug: string;
  title: string;
  summary: string;
  cover: string;
  goalAmount: number;
  state: ProjectState;
  status: 'auto' | 'draft' | 'closed';
  startAt: string;
  endAt: string;
}
interface Props {
  items: Item[];
}

/**
 * 목록 히어로의 배경은 **지금 열려 있는 프로젝트의 커버**다. 고정 이미지를 쓰면
 * 화면과 내용이 따로 놀고, 프로젝트가 바뀔 때마다 사람이 갈아 끼워야 한다.
 * 진행 중인 것이 없을 때만 스튜디오 사진으로 떨어진다.
 */
const FALLBACK_HERO = '/images/bulgwang-mixing-club.webp';

const pickHeroImage = (items: Item[]): string =>
  items.find((it) => it.state === 'live')?.cover ?? items[0]?.cover ?? FALLBACK_HERO;

/** 1장이면 한 칸, 2장이면 두 칸까지만 벌린다 — 3열 고정이면 한 장짜리가 왼쪽으로 몰린다. */
const gridColumns = (count: number): string =>
  count <= 1 ? 'max-w-md' : count === 2 ? 'max-w-3xl md:grid-cols-2' : 'max-w-6xl md:grid-cols-2 lg:grid-cols-3';

export default function FundingIndexPage({ items }: Props) {
  return (
    <>
      <SEO
        title="펀딩 — 스튜디오 놀"
        description="스튜디오 놀이 제작하는 음반의 제작비를 리워드 후원으로 함께 만듭니다."
        canonical="/ko/funding"
      />
      <ImageHero
        locale="ko"
        priority
        overlayGradient={HERO_SCRIM_STRONG}
        backgroundImage={pickHeroImage(items)}
        imageAlt=""
        title="펀딩"
        subtitle="음반 제작비를 후원자와 함께 만듭니다. 리워드를 고르면 CD·굿즈·음원으로 돌려드립니다."
      />
      <Section>
        {items.length === 0 ? (
          <div className="mx-auto max-w-xl text-center">
            <p className="typo-card-title text-gray-900 dark:text-white">지금 열려 있는 펀딩이 없습니다</p>
            <p className="typo-card-body mt-3">
              새 프로젝트는 스토리와 SNS에서 먼저 알립니다. 지난 펀딩이 어떻게 진행됐는지는
              스토리에서 보실 수 있습니다.
            </p>
            <Link
              href="/ko/stories"
              className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline dark:text-primary-lighter"
            >
              스튜디오 놀 스토리 보기
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div className={`mx-auto grid items-stretch gap-6 ${gridColumns(items.length)}`}>
            {items.map((it) => (
              <FundingProjectCard key={it.slug} {...it} />
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

/** 히어로가 헤더 밑까지 풀블리드로 깔리고 헤더가 투명해진다(Layout의 hasHero 분기). */
FundingIndexPage.hasHero = true;

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: [{ params: { locale: defaultLocale } }],
  fallback: false,
});

export const getStaticProps: GetStaticProps<Props> = async () => {
  const now = new Date();
  const items = getListableFundingProjects(now).map((p) => ({
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    cover: p.cover,
    goalAmount: p.goalAmount,
    state: computeProjectState(p, now),
    status: p.status,
    startAt: p.startAt,
    endAt: p.endAt,
  }));
  return buildPageStaticProps(defaultLocale, { items }, { i18nSections: [] });
};
