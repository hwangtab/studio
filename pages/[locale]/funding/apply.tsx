import Head from 'next/head';
import { useState, type FormEvent } from 'react';
import type { GetStaticPaths, GetStaticProps } from 'next';

import { buildPageStaticProps } from '../../../lib/getStatic';
import { defaultLocale } from '../../../lib/i18n';

export default function FundingApply() {
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
        <div className="mt-6 space-y-3 text-gray-700 dark:text-gray-300">
          <p>앨범·공연·굿즈를 만들 비용을 후원으로 모읍니다. 페이지는 직접 쓰고, 결제·환불·정산은 스튜디오 놀이 맡습니다.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>판매자는 스튜디오 놀입니다. 후원금은 스튜디오 놀이 받아 정산으로 보내 드립니다.</li>
            <li>리워드를 준비해 보내는 일은 개설자가 맡습니다.</li>
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
