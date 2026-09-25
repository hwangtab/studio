import React from 'react';
import Link from 'next/link';
import { ArrowRight } from '@/lib/lucide-icons';
import { Section } from '../ui/Section';
import SectionHeading from '../ui/SectionHeading';
import { releasePipelineCopy } from '../../data/releasePipeline';

const copy = releasePipelineCopy.fundingPromo;

/**
 * /ko/funding 목록 아래 — 펀딩을 보러 온 사람이 "내 음반도"로 넘어가는 길(발매 파이프라인 3단계).
 * 직접 개설·설계 대행·발매 프로젝트 세 갈래. 가격·수수료는 data/releasePipeline.ts가 상수에서 만든다.
 */
const FundingPipelinePromo = () => (
  <Section variant="alternate">
    <SectionHeading title={copy.title} subtitle={copy.subtitle} className="mb-10" />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto" role="list">
      {copy.items.map((item) => (
        <div key={item.id} role="listitem" className="glass-card rounded-2xl p-6 flex flex-col">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{item.title}</h3>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-5">{item.body}</p>
          <Link
            href={item.href}
            prefetch={false}
            className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-primary dark:text-primary-lighter hover:underline underline-offset-2"
          >
            {item.label} <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      ))}
    </div>
  </Section>
);

export default FundingPipelinePromo;
