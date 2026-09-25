import React from 'react';
import Link from 'next/link';
import { Banknote, ArrowRight } from '@/lib/lucide-icons';
import { Section } from '../ui/Section';
import SectionHeading from '../ui/SectionHeading';
import HeroKakaoCta from '../common/HeroKakaoCta';
import { releasePipelineCopy as copy } from '../../data/releasePipeline';

interface ReleaseFundingPathsProps {
  kakaoUrl: string;
}

/**
 * "제작비, 이렇게 만듭니다" — 발매 페이지의 ko 전용 절(설계 §5-2).
 * 발매를 막는 1순위 이유(돈)에 페이지 위쪽에서 답한다. 세 갈래(펀딩·지원사업·자비)는
 * 자금원만 다르고 제작부터는 같은 흐름이다.
 */
const ReleaseFundingPaths = ({ kakaoUrl }: ReleaseFundingPathsProps) => (
  <Section variant="alternate">
    <SectionHeading icon={Banknote} title={copy.paths.title} subtitle={copy.paths.subtitle} className="mb-12" />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto" role="list">
      {copy.paths.items.map((item) => (
        <div key={item.id} role="listitem" className="glass-card rounded-2xl p-7 flex flex-col">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">{item.title}</h3>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-4">{item.body}</p>
          <p className="text-sm font-semibold text-primary dark:text-primary-lighter mb-5">{item.stat}</p>
          <div className="mt-auto flex flex-col gap-2">
            {item.links.map((link) =>
              link.href.startsWith('#') ? (
                <a
                  key={link.href}
                  href={link.href}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary dark:text-primary-lighter hover:underline underline-offset-2"
                >
                  {link.label} <ArrowRight size={14} aria-hidden="true" />
                </a>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  prefetch={false}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary dark:text-primary-lighter hover:underline underline-offset-2"
                >
                  {link.label} <ArrowRight size={14} aria-hidden="true" />
                </Link>
              )
            )}
          </div>
        </div>
      ))}
    </div>
    <div className="mt-10 flex justify-center">
      <HeroKakaoCta
        locale="ko"
        kakaoUrl={kakaoUrl}
        component="ReleaseFundingPaths"
        ctaId="release_funding_consult"
        label={copy.hero.cta}
        surface="onSurface"
      />
    </div>
  </Section>
);

export default ReleaseFundingPaths;
