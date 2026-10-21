import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useState, type FormEvent } from 'react';

import { AdminShell } from '../../../components/admin/AdminShell';
import { CreatorAccountEditor } from '../../../components/admin/CreatorAccountEditor';
import { CreatorTaxProfilePanel } from '../../../components/admin/CreatorTaxProfilePanel';
import { Disclosure } from '../../../components/ui/Disclosure';
import { authenticateAdminRequest } from '../../../lib/contracts/admin-auth';
import { describeShopArtistTerms } from '../../../lib/shop/artistTerms';
import { loadShopArtistTermsStatuses } from '../../../lib/shop/artistTermsAgreement';
import { listShopArtistsForAdmin, type AdminShopArtistRow } from '../../../lib/shop/artists';
import { isStudioShopArtistSlug } from '../../../lib/shop/studioArtist';
import { buttonVariants } from '../../../components/ui/Button';

type ArtistWithTerms = AdminShopArtistRow & { termsLabel: string; termsAgreed: boolean };

interface Props {
  artists: ArtistWithTerms[];
  error?: string;
}

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return { redirect: { destination: '/admin/login', permanent: false } };
  try {
    const rows = await listShopArtistsForAdmin();
    // 위탁 약관 동의는 따로 읽는다 — 실패해도 목록은 보인다("확인하지 못함"). 표가 없으면 전부 미동의.
    let statuses: Awaited<ReturnType<typeof loadShopArtistTermsStatuses>> | null = null;
    try {
      statuses = await loadShopArtistTermsStatuses(rows.map((r) => r.creatorId));
    } catch (error: unknown) {
      console.error('[admin/shop/artists] 위탁 약관 동의 조회 실패:', error);
    }
    const artists = rows.map((r) => {
      const status = statuses?.get(r.creatorId) ?? null;
      const studio = isStudioShopArtistSlug(r.slug);
      return { ...r, termsLabel: describeShopArtistTerms(status, studio), termsAgreed: studio || status?.state === 'agreed' };
    });
    return { props: { artists } };
  } catch (error: unknown) {
    console.error('[admin/shop/artists] 조회 실패:', error);
    return { props: { artists: [], error: '아티스트를 불러오지 못했습니다.' } };
  }
};

const inputClass = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70';

async function send(method: 'POST' | 'PATCH', body: Record<string, unknown>): Promise<string | null> {
  const res = await fetch('/api/admin/shop/artists', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
  return res.ok && data?.ok ? null : (data?.message ?? '저장하지 못했습니다.');
}

function CreateForm() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [linkCurated, setLinkCurated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const err = await send('POST', { email, name, slug, linkCurated });
    if (err) { setMessage(err); setBusy(false); return; }
    window.location.reload();
  };

  return (
    <form onSubmit={submit} className="mb-6 space-y-3 rounded-2xl bg-white p-4 text-sm text-gray-900 shadow-sm md:p-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900">아티스트 등재</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="block">이메일<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputClass} mt-1`} /></label>
        <label className="block">이름<input required value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className={`${inputClass} mt-1`} /></label>
        <label className="block">주소(slug)<input required value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="artist-name" className={`${inputClass} mt-1`} /></label>
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={linkCurated} onChange={(e) => setLinkCurated(e.target.checked)} className="accent-primary" />
        data/artists의 후원 아티스트와 같은 사람
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className={buttonVariants({ variant: 'solid', size: 'sm', light: true })}>{busy ? '등재 중…' : '등재'}</button>
        {message && <span role="alert" className="text-red-700">{message}</span>}
      </div>
    </form>
  );
}

function ArtistRow({ artist }: { artist: ArtistWithTerms }) {
  const [slug, setSlug] = useState(artist.slug);
  const [linkCurated, setLinkCurated] = useState(artist.curatedSlugLinked);
  const [message, setMessage] = useState<string | null>(null);
  // 패널은 처음 펼칠 때 붙인다 — 접힌 줄마다 사업자 정보를 불러오지 않게.
  const [taxOpened, setTaxOpened] = useState(false);
  const locked = artist.approvedProducts > 0;

  const save = async () => {
    setMessage('저장 중…');
    const err = await send('PATCH', { creatorId: artist.creatorId, slug, linkCurated });
    if (err) setMessage(err);
    else window.location.reload();
  };

  return (
    <>
      <tr className="border-t border-gray-100 align-top">
        <td className="py-2 pr-3">{artist.name}<span className="block text-xs text-gray-500">{artist.email}</span><CreatorAccountEditor creatorId={artist.creatorId} name={artist.name} email={artist.email} /></td>
        <td className="py-2 pr-3">
          <div className="flex flex-wrap items-center gap-2">
            <input value={slug} onChange={(e) => setSlug(e.target.value)} disabled={locked} aria-label={`${artist.name} 주소`} className={`${inputClass} w-48`} />
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={linkCurated} disabled={locked} onChange={(e) => setLinkCurated(e.target.checked)} className="accent-primary" />후원 아티스트와 같은 사람</label>
            {!locked && <button type="button" onClick={save} className={buttonVariants({ variant: 'solid', size: 'sm', light: true })}>저장</button>}
          </div>
          {locked && <span className="block text-xs text-gray-500">승인된 상품이 있어 주소를 바꿀 수 없습니다.</span>}
          {message && <span className="block text-xs text-gray-600">{message}</span>}
        </td>
        <td className="py-2 pr-3 tabular-nums">{artist.approvedProducts}</td>
        <td className={`py-2 text-xs ${artist.termsAgreed ? 'text-gray-700' : 'font-semibold text-red-700'}`}>{artist.termsLabel}</td>
      </tr>
      <tr>
        <td colSpan={4} className="pb-3">
          <Disclosure
            summary="사업자 정보"
            variant="plain"
            onToggle={(e) => { if (e.currentTarget.open) setTaxOpened(true); }}
          >
            {taxOpened && <CreatorTaxProfilePanel creatorId={artist.creatorId} heading={false} residentNumber />}
          </Disclosure>
        </td>
      </tr>
    </>
  );
}

export default function AdminShopArtistsPage({ artists, error }: Props) {
  return (
    <>
      <Head>
        <title>상점 아티스트 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <AdminShell title="상점 아티스트" description="위탁 계약을 맺은 아티스트를 등재합니다. 등재하면 아티스트가 개설자 콘솔의 상점 탭을 쓸 수 있습니다." backHref="/admin/shop" backLabel="상점" width="wide">
        {error && <div role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</div>}
        <CreateForm />
        <section className="rounded-2xl bg-white p-4 text-sm text-gray-900 shadow-sm md:p-6">
          <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-gray-900">등재된 아티스트</h2>
          {artists.length === 0 ? (
            <p className="text-gray-600">아직 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-left">
                <thead className="text-xs text-gray-500"><tr><th className="py-2 pr-3">아티스트</th><th className="py-2 pr-3">주소</th><th className="py-2 pr-3">승인 상품</th><th className="py-2">위탁 약관</th></tr></thead>
                <tbody>{artists.map((a) => <ArtistRow key={a.creatorId} artist={a} />)}</tbody>
              </table>
            </div>
          )}
        </section>
      </AdminShell>
    </>
  );
}
