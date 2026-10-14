/* eslint-disable @next/next/no-html-link-for-pages --
 * 비공개 경로(측정·캐시 제외)라 이탈 링크는 문서 이동으로 둔다 — lib/analytics/privatePaths.ts.
 */
import Head from 'next/head';
import { useState } from 'react';

import { Button } from '../../../components/ui/Button';
import { Field, TextInput } from '../../../components/ui/Field';
import { Notice } from '../../../components/ui/Notice';
import { PageHeader, PageShell } from '../../../components/ui/PageHeader';
import { withI18nServerProps } from '../../../lib/getStatic';

/**
 * 구매 내역 링크 다시 받기 — 이메일을 넣으면 그 주소로 산 라이선스의 구매 내역 주소를 메일로 보낸다.
 * 결과는 언제나 같은 문구다(그 주소로 산 적이 있는지 화면에 드러내지 않는다).
 */
export default function SoftwareFindPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/software/resend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim() }) });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (res.ok && data?.ok) setDone(true);
      else setError(data?.message || '보내지 못했어요. 잠시 후 다시 시도해 주세요.');
    } catch {
      setError('네트워크 오류가 났어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Head>
        <title>구매 내역 링크 다시 받기 | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <PageShell width="result">
        <p className="typo-card-meta mb-4 text-center">스튜디오 놀</p>
        <PageHeader title="구매 내역 링크 다시 받기" lead="구매할 때 적은 이메일을 넣으면 라이선스 키·설치 파일을 볼 수 있는 주소를 그 메일로 보내 드려요." />
        {done ? (
          <Notice tone="success" title="메일을 확인해 주세요">
            그 주소로 산 라이선스가 있으면 구매 내역 링크를 보냈어요. 몇 분이 지나도 오지 않으면 스팸함을 보거나 카카오톡·010-4255-7893으로 문의해 주세요.
          </Notice>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-4">
            <Field id="find-email" label="이메일" required>
              <TextInput value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" autoComplete="email" />
            </Field>
            {error && <Notice tone="error">{error}</Notice>}
            <Button type="submit" fullWidth disabled={busy || !email.trim()}>{busy ? '보내는 중…' : '링크 받기'}</Button>
          </form>
        )}
        <p className="mt-8 text-center typo-card-meta"><a href="/ko/software" rel="noreferrer" className="underline">소프트웨어 목록</a></p>
      </PageShell>
    </>
  );
}

type Props = Record<string, never>;

export const getServerSideProps = withI18nServerProps<Props>(async ({ params, res }) => {
  res.setHeader('Cache-Control', 'private, no-store');
  if (params?.locale !== 'ko') return { redirect: { destination: '/ko/software/find', permanent: false } };
  return { props: {} };
});

// 디자인 판 — lib/designEdition.ts
SoftwareFindPage.designEdition = 'v2';
