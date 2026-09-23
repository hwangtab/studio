import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, type FormEvent } from 'react';
import type { GetStaticPaths, GetStaticProps } from 'next';

import { FUNDING_PAYMENT_FEE_PERCENT, FUNDING_PLATFORM_FEE_PERCENT } from '../../../data/pricing';
import { FUNDING_PAYOUT_BUSINESS_DAYS } from '../../../lib/funding/policy';
import { buildPageStaticProps } from '../../../lib/getStatic';
import { defaultLocale } from '../../../lib/i18n';

export default function FundingApply() {
  const router = useRouter();
  // 개설자 매직링크 착지(auth.tsx)가 로그인 API 실패 뒤 여기로 보내며 붙이는 쿼리다.
  // 만료됐는지 이미 쓰였는지는 구분하지 않는다(캐물을 여지를 주지 않으려는 의도가
  // creatorToken.ts부터 일관된다) — 할 일은 "다시 받기" 하나뿐이다.
  const linkExpired = router.query.e === 'link';
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/funding/creator/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) setError(data?.message ?? '잠시 후 다시 시도해 주세요.');
      else setSent(true);
    } catch {
      setError('연결에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Head>
        <title>펀딩 개설 신청 | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-3xl font-bold">펀딩 개설 신청</h1>
        {linkExpired && (
          <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            링크가 만료됐거나 이미 사용되었습니다. 이메일을 다시 넣어 새 링크를 받아 주세요.
          </p>
        )}
        <div className="mt-6 space-y-3 text-gray-700 dark:text-gray-300">
          <p>앨범·공연·굿즈를 만들 비용을 후원으로 모읍니다. 페이지는 직접 쓰고, 결제·환불·정산은 스튜디오 놀이 맡습니다.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>판매자는 스튜디오 놀입니다. 후원금은 스튜디오 놀이 받아 정산으로 보내 드립니다.</li>
            <li>리워드의 제작과 발송은 개설자가 맡습니다. 모금이 마감되면 배송 리워드를 선택한 서포터의 배송지가 개설자 화면에 열리며, 개설자는 그 정보를 발송에만 쓰고 발송을 마친 뒤 파기해야 합니다.</li>
            {/* 수수료와 정산 시점은 신청 전에 알아야 한다 — 숫자는 상수에서 끌어온다
                (data/pricing.ts · lib/funding/policy.ts). 문자열로 박으면 정산 계산과 갈라진다. */}
            <li>
              정산은 모금이 끝나고 영업일 {FUNDING_PAYOUT_BUSINESS_DAYS}일 이내에 보내 드립니다.
              플랫폼 수수료 {FUNDING_PLATFORM_FEE_PERCENT}%와 결제 수수료 {FUNDING_PAYMENT_FEE_PERCENT}%(둘 다 부가세 포함)를
              개설자가 부담합니다.
            </li>
            <li>제출하시면 운영자가 확인하고 승인 또는 보완 요청을 메일로 알려 드립니다.</li>
          </ul>
        </div>

        <form onSubmit={submit} className="mt-10 space-y-3">
          <label htmlFor="email" className="block font-medium">이메일 주소</label>
          <input
            id="email" type="email" required value={email} autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 dark:border-gray-700 dark:bg-gray-900"
            placeholder="you@example.com"
          />
          <button
            type="submit" disabled={busy}
            className="w-full rounded-lg bg-primary px-4 py-3 font-semibold text-white disabled:opacity-60"
          >
            {busy ? '보내는 중…' : '로그인 링크 받기'}
          </button>
          {sent && <p className="text-sm text-green-700 dark:text-green-400">로그인 링크를 보냈습니다. 메일함을 확인해 주세요.</p>}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <p className="text-sm text-gray-500">비밀번호는 없습니다. 메일로 받은 링크로 들어옵니다.</p>
          {/*
            이 버튼 한 번에 개설자 계정(funding_creators 행)이 만들어진다 — lib/funding/creatorToken.ts가
            이메일을 받는 즉시 행을 넣는다. 그래서 "로그인 링크를 받는다"가 곧 수집 시점이고, 그 사실과
            처리방침을 누르기 전에 보여야 한다(2026-09-21 문서·코드 대조에서 링크가 0건이었다).
          */}
          <p className="text-sm text-gray-500">
            이 버튼을 누르면 입력하신 이메일로 개설자 계정이 만들어집니다. 수집·이용·보관은{' '}
            <Link href="/ko/privacy-policy" className="underline">개인정보 처리방침</Link>을, 개설 조건은{' '}
            <Link href="/ko/funding/creator-terms" className="underline">개설자 약관</Link>을 확인해 주세요.
          </p>
        </form>
      </main>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: [{ params: { locale: defaultLocale } }],
  fallback: false,
});

export const getStaticProps: GetStaticProps = async () =>
  buildPageStaticProps(defaultLocale, {}, { i18nSections: [] });
