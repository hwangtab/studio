import React from 'react';
import Link from 'next/link';
import { Disc, ExternalLink, ArrowRight } from '@/lib/lucide-icons';
import { Section } from '../ui/Section';
import SectionHeading from '../ui/SectionHeading';
import { formatPriceAmount } from '../../data/pricing';
import { pipelineCases, releasePipelineCopy as copy } from '../../data/releasePipeline';

/**
 * "펀딩으로 시작해 발매까지 간 음반" — 발매 페이지의 ko 전용 절(설계 §5-5).
 * data/crowdfundingCases.ts에서 release 필드가 있는 건만 싣는다(운영자가 기획·제작·음향을
 * 전부 맡았다고 확인한 음반). 수치는 플랫폼에서 직접 확인한 값 그대로.
 */
const ReleasePipelineCases = () => {
  const cases = pipelineCases();
  if (cases.length === 0) return null;
  return (
    <Section variant="default">
      <SectionHeading icon={Disc} title={copy.cases.title} subtitle={copy.cases.subtitle} className="mb-3" />
      <p className="text-center text-xs text-gray-500 dark:text-gray-400 mb-10">{copy.cases.checkedOn}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-4xl mx-auto" role="list">
        {cases.map((c) => (
          <div key={c.url} role="listitem" className="glass-card rounded-2xl p-6 flex flex-col">
            <span className="self-start text-xs font-medium text-primary dark:text-primary-lighter bg-primary/10 rounded-full px-2.5 py-0.5 mb-3">
              {copy.cases.role}
            </span>
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-3">{c.title}</h3>
            <dl className="grid grid-cols-2 gap-2 text-sm mb-5">
              <div>
                <dt className="text-gray-500 dark:text-gray-400">{copy.cases.raisedLabel}</dt>
                <dd className="font-semibold text-gray-900 dark:text-white">{formatPriceAmount(c.raised)}원</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400">{copy.cases.backersLabel}</dt>
                <dd className="font-semibold text-gray-900 dark:text-white">{formatPriceAmount(c.backers)}명</dd>
              </div>
            </dl>
            <div className="mt-auto flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
              <a
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-primary dark:text-primary-lighter hover:underline underline-offset-2"
              >
                {copy.cases.fundingLink} <ExternalLink size={14} aria-hidden="true" />
              </a>
              <Link
                href={`/ko/portfolio/${c.release.portfolioId}`}
                prefetch={false}
                className="inline-flex items-center gap-1.5 text-primary dark:text-primary-lighter hover:underline underline-offset-2"
              >
                {copy.cases.releaseLink} <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
};

export default ReleasePipelineCases;
