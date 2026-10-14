import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useEffect, useState, type FormEvent } from 'react';

import { AdminShell } from '../../../../components/admin/AdminShell';
import { authenticateAdminRequest } from '../../../../lib/contracts/admin-auth';
import { listShopArtistsForAdmin } from '../../../../lib/shop/artists';
import { isStudioShopArtistSlug, STUDIO_SHOP_ARTIST_NAME } from '../../../../lib/shop/studioArtist';

interface Props {
  /** 스튜디오 계정은 뺀 등재 아티스트(스튜디오는 고정 선택지로 따로 둔다). */
  artists: Array<{ creatorId: string; name: string; slug: string }>;
  error?: string;
}

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return { redirect: { destination: '/admin/login', permanent: false } };
  try {
    const rows = await listShopArtistsForAdmin();
    return {
      props: { artists: rows.filter((r) => !isStudioShopArtistSlug(r.slug)).map((r) => ({ creatorId: r.creatorId, name: r.name, slug: r.slug })) },
    };
  } catch (error: unknown) {
    console.error('[admin/shop/products/new] 조회 실패:', error);
    return { props: { artists: [], error: '아티스트를 불러오지 못했습니다. 운영 DB에 마이그레이션 0053이 적용됐는지 확인해 주세요.' } };
  }
};

const inputClass = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70';
const STUDIO = '__studio__';

export default function AdminShopNewProductPage({ artists, error }: Props) {
  useEffect(() => { document.documentElement.classList.remove('dark'); }, []);
  const [owner, setOwner] = useState(STUDIO);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/shop/products', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(owner === STUDIO ? { studio: true } : { creatorId: owner }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; id?: string; message?: string } | null;
      if (res.ok && data?.ok && data.id) {
        window.location.assign(`/admin/shop/products/${encodeURIComponent(data.id)}`);
        return;
      }
      setMessage(data?.message ?? '만들지 못했습니다.');
    } catch {
      setMessage('연결에 실패했습니다.');
    }
    setBusy(false);
  };

  return (
    <>
      <Head>
        <title>상품 등록 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <AdminShell title="상품 등록" description="누구의 상품인지 고르면 빈 초안이 만들어지고, 다음 화면에서 내용을 채워 바로 승인할 수 있습니다." backHref="/admin/shop/products" backLabel="상품 심사" width="narrow">
        {error && <div role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</div>}
        <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-4 text-sm text-gray-900 shadow-sm md:p-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900">누구의 상품인가요</h2>
          <label className="block">판매 주체
            <select value={owner} onChange={(e) => setOwner(e.target.value)} className={`${inputClass} mt-1`}>
              <option value={STUDIO}>{STUDIO_SHOP_ARTIST_NAME} (스튜디오 자체 상품)</option>
              {artists.map((a) => <option key={a.creatorId} value={a.creatorId}>{a.name} ({a.slug})</option>)}
            </select>
          </label>
          <p className="text-xs text-gray-600">
            {owner === STUDIO
              ? '스튜디오 상품은 /ko/shop에만 나오고, 아티스트 페이지와 정산 표에는 들어가지 않습니다.'
              : '아티스트 대신 등록한 상품은 그 아티스트의 콘솔에도 보이고, 판매되면 정산 예정 표에 들어갑니다. 목록에 없으면 먼저 아티스트를 등재해 주세요.'}
          </p>
          {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
          <button type="submit" disabled={busy} className="rounded-lg bg-gray-900 px-4 py-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 disabled:opacity-60">
            {busy ? '만드는 중…' : '초안 만들기'}
          </button>
        </form>
      </AdminShell>
    </>
  );
}
