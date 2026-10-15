import { useRouter } from 'next/router';
import { useState } from 'react';

import { SHOP_ARTIST_TERMS_SECTIONS, SHOP_ARTIST_TERMS_VERSION } from '../../../lib/shop/artistTerms';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Notice } from '../../ui/Notice';
import { agreeShopArtistTerms } from './api';

interface Props {
  /** 옛 판본에 동의한 적이 있으면 그 판본 — 안내 문구만 바뀐다. */
  previousVersion: string | null;
}

/**
 * 상점 위탁 약관 전자 동의 — 현재 판본에 동의하기 전에는 콘솔 상점 탭이 상품 목록·판매 현황·발송 대신 이 화면을 보인다.
 * 동의는 서버가 판본별로 기록한다(`/api/funding/creator/shop/terms`). 화면이 보여 준 판본을 함께 보내, 그 사이 판본이 바뀌었으면 서버가 거부한다.
 */
export function ArtistTermsConsent({ previousVersion }: Props) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAgree = async () => {
    setSaving(true);
    setError(null);
    const result = await agreeShopArtistTerms(SHOP_ARTIST_TERMS_VERSION);
    if (!result.ok) {
      setError(result.message);
      setSaving(false);
      return;
    }
    await router.replace(router.asPath);
  };

  return (
    <section aria-labelledby="shop-artist-terms-title" className="mt-6">
      <h2 id="shop-artist-terms-title" className="typo-card-title mb-2">상점 위탁 약관</h2>
      <Notice tone={previousVersion ? 'warning' : 'info'} className="mb-4">
        {previousVersion
          ? '위탁 약관이 바뀌었어요. 바뀐 약관을 읽고 다시 동의하시면 상품 등록·재고 입력·발송 처리를 이어서 하실 수 있어요.'
          : '상점에서 상품을 판매하려면 먼저 아래 위탁 약관에 동의해 주세요. 동의하시면 상품 등록·재고 입력·발송 처리를 하실 수 있어요.'}
      </Notice>

      <div
        className="max-h-[60vh] space-y-5 overflow-y-auto rounded-xl border border-gray-200 p-5 dark:border-gray-700"
        tabIndex={0}
        aria-label="상점 위탁 약관 전문"
      >
        {SHOP_ARTIST_TERMS_SECTIONS.map((section) => (
          <article key={section.heading}>
            <h3 className="typo-card-subtitle mb-2 text-gray-900 dark:text-white">{section.heading}</h3>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="typo-card-body mb-2 leading-relaxed text-gray-700 last:mb-0 dark:text-gray-300">{paragraph}</p>
            ))}
          </article>
        ))}
        <p className="typo-caption">약관 판본: {SHOP_ARTIST_TERMS_VERSION}</p>
      </div>

      <div className="mt-4">
        <Checkbox
          emphasis
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          label="위 상점 위탁 약관(개인정보 처리의 위탁 조항 포함)을 모두 읽었고 이에 동의합니다."
        />
      </div>
      {error && <Notice tone="error" className="mt-3">{error}</Notice>}
      <Button type="button" className="mt-4" onClick={handleAgree} disabled={!checked || saving}>
        {saving ? '저장 중…' : '동의하고 시작하기'}
      </Button>
    </section>
  );
}
