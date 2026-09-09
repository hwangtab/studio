import type { GetStaticPaths, GetStaticProps } from 'next';
import SEO from '../../../components/SEO';
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
}
interface Props {
  items: Item[];
}

export default function FundingIndexPage({ items }: Props) {
  return (
    <>
      <SEO
        title="펀딩 — 스튜디오 놀"
        description="스튜디오 놀이 제작하는 음반의 제작비를 리워드 후원으로 함께 만듭니다."
        canonical="/ko/funding"
      />
      <Section className="pt-28">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">펀딩</h1>
        <p className="mt-3 text-gray-600 dark:text-gray-300">
          음반 제작비를 후원자와 함께 만듭니다. 리워드를 고르면 CD·굿즈·음원으로 돌려드립니다.
        </p>
        {items.length === 0 ? (
          <p className="mt-12 text-gray-500">지금 진행 중인 펀딩이 없습니다. 새 프로젝트는 스토리와 SNS에서 먼저 알립니다.</p>
        ) : (
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {items.map((it) => (
              <FundingProjectCard key={it.slug} {...it} />
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

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
  }));
  return buildPageStaticProps(defaultLocale, { items }, { i18nSections: [] });
};
