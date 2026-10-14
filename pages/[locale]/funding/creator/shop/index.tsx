import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { eq } from 'drizzle-orm';

import { logoutCreator } from '../../../../../components/funding/creator/api';
import { CreatorConsoleTabs } from '../../../../../components/funding/creator/CreatorConsoleTabs';
import { ShopProfilePanel } from '../../../../../components/funding/creator/ShopProfilePanel';
import type { EditorCreatorProfile } from '../../../../../components/funding/creator/types';
import { Button } from '../../../../../components/ui/Button';
import { EmptyState } from '../../../../../components/ui/EmptyState';
import { Notice } from '../../../../../components/ui/Notice';
import { PageHeader, PageShell } from '../../../../../components/ui/PageHeader';
import { getDb } from '../../../../../db/client';
import { fundingCreators } from '../../../../../db/schema';
import { authenticateCreatorRequest } from '../../../../../lib/funding/creatorAuth';
import { isCreatorNameLocked } from '../../../../../lib/funding/creatorProjectWrite';
import { withI18nServerProps } from '../../../../../lib/getStatic';
import { getShopArtistByCreator } from '../../../../../lib/shop/artists';

interface Props {
  /** 상점이 열린 아티스트만 값이 있다. */
  shop: { slug: string; profileImageUrl: string | null; profile: EditorCreatorProfile; nameLocked: boolean } | null;
}

export default function CreatorShopHome({ shop }: Props) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const handleLogout = async () => {
    setLoggingOut(true);
    setLogoutError(null);
    const result = await logoutCreator();
    if (result.ok) {
      router.push('/ko/funding/apply');
      return;
    }
    setLogoutError(result.message);
    setLoggingOut(false);
  };

  return (
    <>
      <Head>
        <title>내 상점 | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <PageShell width="wide">
        <PageHeader
          title="내 상점"
          meta={
            <Button type="button" variant="ghost" size="sm" onClick={handleLogout} disabled={loggingOut}>
              {loggingOut ? '로그아웃 중…' : '로그아웃'}
            </Button>
          }
        />
        <CreatorConsoleTabs current="shop" />
        {logoutError && <Notice tone="error" className="mb-6">{logoutError}</Notice>}
        {shop ? (
          <ShopProfilePanel
            initial={shop.profile}
            nameLocked={shop.nameLocked}
            profileImageUrl={shop.profileImageUrl}
            shopPath={`/ko/shop/artist/${shop.slug}`}
          />
        ) : (
          <EmptyState title="상점은 위탁 계약을 맺은 아티스트에게 열려요." />
        )}
      </PageShell>
    </>
  );
}

export const getServerSideProps = withI18nServerProps<Props>(async (context) => {
  context.res.setHeader('Cache-Control', 'no-store');
  // 개설자 콘솔은 ko 전용 — 세션 쿠키가 path=/라 로케일을 안 가려서 막지 않으면 같은 화면이 7개 URL로 존재한다.
  if (context.params?.locale !== 'ko') {
    return { redirect: { destination: '/ko/funding/creator/shop', permanent: false } };
  }
  const auth = await authenticateCreatorRequest(context);
  if (!auth.ok) return { redirect: { destination: '/ko/funding/apply', permanent: false } };

  let shop: Props['shop'] = null;
  try {
    const artist = await getShopArtistByCreator(auth.creatorId);
    if (artist) {
      const [row] = await getDb()
        .select({ contactName: fundingCreators.contactName, phone: fundingCreators.phone })
        .from(fundingCreators).where(eq(fundingCreators.id, auth.creatorId)).limit(1);
      shop = {
        slug: artist.slug,
        profileImageUrl: artist.profileImageUrl,
        profile: { name: artist.name, contactName: row?.contactName ?? null, phone: row?.phone ?? null, bio: artist.bio, links: artist.links.length > 0 ? artist.links : null },
        nameLocked: await isCreatorNameLocked(auth.creatorId),
      };
    }
  } catch (error: unknown) {
    // 상점 표 조회 실패가 콘솔 전체를 막지 않는다 — 상점이 안 열린 것처럼 보인다.
    console.error('[funding] 개설자 상점 조회 실패:', error);
  }
  return { props: { shop } };
});

// 디자인 판 — lib/designEdition.ts
CreatorShopHome.designEdition = 'v2';
