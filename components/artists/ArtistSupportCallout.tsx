import React, { useEffect, useState } from 'react';
import HeroKakaoCta from '../common/HeroKakaoCta';
import { Button } from '../ui/Button';
import { Field, TextInput } from '../ui/Field';
import type { SupportedArtist } from '../../data/artists';
import { ARTIST_SUPPORT_SHARE_PERCENT, ARTIST_SUPPORT_TIERS, formatPriceAmount, type ArtistSupportTierId } from '../../data/pricing';
import type { Locale } from '../../lib/i18n';
import { trackMicroEvent } from '../../utils/analytics';

export interface ArtistSupportLabels {
  title: string;
  pending: string;
  pendingBody: string;
  pendingLabel: string;
  /** 2차(결제) 문구 */
  tierTitle: string;
  shareNote: string;
  perMonth: string;
  nameLabel: string;
  emailLabel: string;
  phoneLabel: string;
  displayNameLabel: string;
  displayNameHint: string;
  consentLabel: string;
  submit: string;
  submitting: string;
  agreeNote: string;
  supportersTitle: string;
  supportersCount: string;
  supportersEmpty: string;
  errorGeneric: string;
}

interface ArtistSupportCalloutProps {
  artist: Pick<SupportedArtist, 'slug' | 'name'>;
  locale: Locale;
  kakaoUrl: string;
  /** 토스 빌링 심사가 끝나 결제를 받는가(lib/artistSupport/open.ts). 페이지가 빌드 시점 값을 넘긴다. */
  supportOpen: boolean;
  labels: ArtistSupportLabels;
}

interface SupportersPayload {
  count: number;
  supporters: Array<{ displayName: string; since: string }>;
}

/**
 * 아티스트 페이지의 구독 자리.
 *
 * 닫혀 있으면(심사 전) "준비 중 + 카카오톡" — 1차 그대로. 열리면 등급 카드 세 장과 신청 폼이
 * 들어온다. 제출하면 서버가 구독 행을 만들고 카드 등록 화면 주소를 돌려주며, 브라우저는 그리로
 * 문서 이동한다(그 화면부터는 연습실·레슨과 같은 길이다). 금액은 여기서 보내지 않는다 —
 * 등급 id만 보내고 서버가 상수에서 계산한다.
 *
 * 구독 시작 버튼은 bg-primary다. 목적지가 카카오가 아니므로 옐로를 쓰지 않는다(배색 규칙).
 */
const ArtistSupportCallout = ({ artist, locale, kakaoUrl, supportOpen, labels }: ArtistSupportCalloutProps) => {
  const [tierId, setTierId] = useState<ArtistSupportTierId>('standard');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [displayConsent, setDisplayConsent] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supporters, setSupporters] = useState<SupportersPayload | null>(null);

  useEffect(() => {
    if (!supportOpen) return;
    let cancelled = false;
    fetch(`/api/artists/${encodeURIComponent(artist.slug)}/supporters`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: (SupportersPayload & { ok: boolean }) | null) => {
        if (!cancelled && data?.ok) setSupporters({ count: data.count, supporters: data.supporters });
      })
      .catch(() => {
        // 명단은 장식이다 — 못 가져와도 신청은 되어야 한다.
      });
    return () => {
      cancelled = true;
    };
  }, [artist.slug, supportOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    trackMicroEvent('artist_support_start', { locale, component: 'ArtistSupportCallout', cta_id: `artist-support-${artist.slug}`, tier: tierId });
    try {
      const res = await fetch('/api/artists/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistSlug: artist.slug, tierId, customerName, customerEmail, customerPhone, displayName, displayConsent }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok || typeof data.setupUrl !== 'string') {
        setError(data?.message || labels.errorGeneric);
        setBusy(false);
        return;
      }
      // 카드 등록 화면은 토큰이 붙는 private 경로다 — 문서 이동으로 간다(lib/analytics/privatePaths.ts).
      window.location.assign(data.setupUrl);
    } catch {
      setError(labels.errorGeneric);
      setBusy(false);
    }
  };

  if (!supportOpen) {
    return (
      <section className="glass-card rounded-2xl p-6 md:p-8" aria-labelledby={`support-${artist.slug}`}>
        <h2 id={`support-${artist.slug}`} className="typo-card-title text-gray-900 dark:text-white">
          {labels.title}
        </h2>
        <p className="mt-2 font-semibold text-gray-800 dark:text-gray-100">{labels.pending}</p>
        <p className="mt-1 text-gray-600 dark:text-gray-300">{labels.pendingBody}</p>
        <div className="mt-5">
          <HeroKakaoCta
            locale={locale}
            kakaoUrl={kakaoUrl}
            component="ArtistSupportCallout"
            ctaId={`artist-support-${artist.slug}`}
            label={labels.pendingLabel}
            surface="onSurface"
          />
        </div>
      </section>
    );
  }

  return (
    <section className="glass-card rounded-2xl p-6 md:p-8" aria-labelledby={`support-${artist.slug}`}>
      <h2 id={`support-${artist.slug}`} className="typo-card-title text-gray-900 dark:text-white">
        {labels.title}
      </h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
        {labels.shareNote.replace('{{percent}}', String(ARTIST_SUPPORT_SHARE_PERCENT))}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <fieldset>
          <legend className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">{labels.tierTitle}</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {ARTIST_SUPPORT_TIERS.map((tier) => {
              const selected = tier.id === tierId;
              return (
                <label
                  key={tier.id}
                  className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                    selected
                      ? 'border-primary bg-primary/5 dark:bg-primary/10 ring-2 ring-primary/40'
                      : 'border-gray-200 dark:border-gray-700 hover:border-primary/50'
                  }`}
                >
                  <input
                    type="radio"
                    name={`tier-${artist.slug}`}
                    value={tier.id}
                    checked={selected}
                    onChange={() => setTierId(tier.id)}
                    className="sr-only"
                  />
                  <span className="block text-xs text-gray-500 dark:text-gray-400">{tier.label}</span>
                  <span className="mt-1 block text-lg font-bold text-gray-900 dark:text-white">
                    {labels.perMonth.replace('{{amount}}', formatPriceAmount(tier.monthlyTotal))}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`support-name-${artist.slug}`} label={labels.nameLabel} required>
            <TextInput type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required maxLength={50} autoComplete="name" />
          </Field>
          <Field id={`support-email-${artist.slug}`} label={labels.emailLabel} required>
            <TextInput type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} required autoComplete="email" />
          </Field>
          <Field id={`support-phone-${artist.slug}`} label={labels.phoneLabel}>
            <TextInput type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} autoComplete="tel" />
          </Field>
          <Field id={`support-display-${artist.slug}`} label={labels.displayNameLabel} hint={labels.displayNameHint}>
            <TextInput type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={30} />
          </Field>
        </div>

        <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={displayConsent}
            onChange={(e) => setDisplayConsent(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary dark:text-primary-lighter focus:ring-primary"
          />
          <span>{labels.consentLabel}</span>
        </label>

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <div>
          <Button type="submit" disabled={busy} fullWidth>
            {busy ? labels.submitting : labels.submit}
          </Button>
          <p className="mt-3 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{labels.agreeNote}</p>
        </div>
      </form>

      <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          {labels.supportersTitle}
          {supporters && supporters.count > 0 && (
            <span className="ml-2 font-normal text-gray-500 dark:text-gray-400">
              {labels.supportersCount.replace('{{count}}', String(supporters.count))}
            </span>
          )}
        </h3>
        {supporters && supporters.supporters.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {supporters.supporters.map((s, i) => (
              <li key={`${s.displayName}-${i}`} className="rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-sm text-gray-700 dark:text-gray-200">
                {s.displayName}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{labels.supportersEmpty}</p>
        )}
      </div>
    </section>
  );
};

export default ArtistSupportCallout;
