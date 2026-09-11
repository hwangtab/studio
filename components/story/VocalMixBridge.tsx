import React from 'react';
import NextLink from 'next/link';
import { Button } from '../ui/Button';
import { getSiteConfig } from '../../data/siteConfig';
import { MIXING_LEVEL1_PRICE, formatPriceAmount } from '../../data/pricing';
import { type Locale } from '../../lib/i18n';
import { trackLeadEvent, trackMicroEvent } from '../../utils/analytics';

interface VocalMixBridgeProps {
  locale?: Locale;
}

/**
 * 보컬 기법 가이드 → 믹싱 문의로 잇는 진단형 브릿지. %%vocal-mix-bridge%%
 *
 * 믹싱 문의의 주 유입은 LLM이 보컬톤 상담 중 우리를 추천하는 경로인데, 그때 인용되는
 * 코퍼스(보컬 카테고리 140편)에는 믹싱으로 가는 길이 0건이었다. 발성법을 읽는 독자에게
 * "믹싱 의뢰하세요"는 동문서답이라, 상품이 아니라 독자의 증상("녹음하면 이상하다")에서
 * 출발해 원인 진단을 먼저 제안한다 — 문턱이 낮고, 믹싱이 왜 필요한지를 설명하면서 잇는다.
 *
 * 렌더 문구를 고치면 lib/storyContentPolicy.ts의 SHORTCODE_CHAR_ESTIMATES['vocal-mix-bridge']와
 * scripts/content-quality-check.js·scan-near-duplicates.mjs의 추정치도 실측으로 다시 맞출 것.
 */
const VocalMixBridge: React.FC<VocalMixBridgeProps> = ({ locale = 'ko' }) => {
  const siteConfig = getSiteConfig(locale);
  const items = [
    '드라이 보컬 30초면 충분합니다 — 곡 전체를 보낼 필요 없어요',
    '발성 문제인지, 마이크·방 울림인지, 믹싱인지 먼저 갈라드립니다',
    `믹싱이 필요하다면 곡당 ${formatPriceAmount(MIXING_LEVEL1_PRICE)}원부터, 3~7영업일`,
  ];

  return (
    <div className="my-8 rounded-xl glass-card overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h4 className="text-base font-semibold text-gray-900 dark:text-white">
          연습할 땐 괜찮은데, 녹음하면 이상하게 들린다면
        </h4>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          발성 문제가 아닐 수 있습니다. 홈레코딩 보컬이 앨범처럼 안 들리는 원인은 대개 마이크 거리, 방 울림, 그리고 믹싱에서 갈립니다. 어디서 막혔는지 모르겠다면 녹음한 파일 일부만 보내주세요. 원인을 먼저 짚어드리고, 상담은 무료입니다.
        </p>
      </div>
      <ul className="px-6 py-4 space-y-2">
        {items.map((it) => (
          <li key={it} className="text-sm text-gray-700 dark:text-gray-300">
            · {it}
          </li>
        ))}
      </ul>
      <div className="px-6 pb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* 반경·포커스 링은 Button이 소유한다 — 직접 짠 rounded-lg에는
            focus-visible 링이 아예 없었다(정본 §3·§5). */}
        <Button asChild variant="kakao" shape="block" size="md">
          <a
            href={siteConfig.contact.kakaoUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              trackLeadEvent('lead_click_kakao', {
                locale,
                component: 'VocalMixBridge',
                cta_id: 'vocal_mix_bridge_kakao',
              })
            }
            className="touch-manipulation"
          >
            파일 보내고 원인 물어보기
          </a>
        </Button>
        <NextLink
          href={`/${locale}/mixing-mastering`}
          prefetch={false}
          onClick={() =>
            trackMicroEvent('micro_click_service', {
              locale,
              component: 'VocalMixBridge',
              cta_id: 'vocal_mix_bridge_detail',
              service_type: 'mixing',
            })
          }
          className="rounded text-sm font-semibold text-primary hover:underline underline-offset-4 min-h-[44px] inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
        >
          온라인 믹싱 의뢰 안내
        </NextLink>
      </div>
    </div>
  );
};

export default VocalMixBridge;
