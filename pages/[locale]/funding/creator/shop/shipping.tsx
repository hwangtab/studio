import Head from 'next/head';

import { CreatorConsoleTabs } from '../../../../../components/funding/creator/CreatorConsoleTabs';
import { ShippingOrders } from '../../../../../components/shop/creator/ShippingOrders';
import { Notice } from '../../../../../components/ui/Notice';
import { PageHeader, PageShell } from '../../../../../components/ui/PageHeader';
import { getClientIp } from '../../../../../lib/contracts/client-ip';
import { authenticateCreatorRequest } from '../../../../../lib/funding/creatorAuth';
import { withI18nServerProps } from '../../../../../lib/getStatic';
import { privacyCreatorActor, recordPrivacyAccess } from '../../../../../lib/privacy/accessLog';
import { loadArtistShippingOrders, type ArtistShippingRow } from '../../../../../lib/shop/artistShipping';
import { hasAgreedCurrentShopArtistTerms } from '../../../../../lib/shop/artistTermsAgreement';

interface Props {
  rows: ArtistShippingRow[];
  loadFailed: boolean;
}

/**
 * 발송할 주문 — 아티스트가 직접 보내는 상품의 주문만. 받는 분 정보를 싣는 화면이라 no-store·noindex이고, 정보가 실릴 때마다
 * 접속기록을 남긴다(개설자 배송 화면과 같은 규칙, 대상은 개설자 id).
 */
export default function CreatorShopShippingPage({ rows, loadFailed }: Props) {
  return (
    <>
      <Head>
        <title>발송할 주문 | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <PageShell width="wide">
        <PageHeader backHref="/ko/funding/creator/shop" backLabel="내 상점" title="발송할 주문" />
        <CreatorConsoleTabs current="shop" />
        <Notice tone="neutral" className="mb-6">
          직접 보내시는 상품의 주문만 보여요. 받는 분 정보는 발송에만 쓰고, 배송 완료 30일 뒤에 지워져요. 판매·결제·환불·문의는 스튜디오 놀이 맡아요.
        </Notice>
        {loadFailed ? <Notice tone="error">주문을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</Notice> : <ShippingOrders rows={rows} />}
      </PageShell>
    </>
  );
}

export const getServerSideProps = withI18nServerProps<Props>(async (context) => {
  // 받는 분 정보가 담긴 화면이다 — 중간 캐시에 남으면 안 된다.
  context.res.setHeader('Cache-Control', 'no-store');
  // 개설자 콘솔은 ko 전용 — 세션 쿠키가 path=/라 로케일을 안 가려서 막지 않으면 같은 화면이 7개 URL로 존재한다.
  if (context.params?.locale !== 'ko') {
    return { redirect: { destination: '/ko/funding/creator/shop/shipping', permanent: false } };
  }
  const auth = await authenticateCreatorRequest(context);
  if (!auth.ok) return { redirect: { destination: '/ko/funding/apply', permanent: false } };

  // 받는 분 정보는 위탁 약관(제9조 개인정보 처리의 위탁)에 동의한 아티스트에게만 싣는다. 확인하지 못하면 싣지 않는다(fail-closed).
  let agreed = false;
  try {
    agreed = await hasAgreedCurrentShopArtistTerms(auth.creatorId);
  } catch (error: unknown) {
    console.error('[funding] 위탁 약관 동의 조회 실패:', error);
  }
  if (!agreed) return { redirect: { destination: '/ko/funding/creator/shop', permanent: false } };

  let rows: ArtistShippingRow[] = [];
  let loadFailed = false;
  try {
    rows = await loadArtistShippingOrders(auth.creatorId);
  } catch (error: unknown) {
    console.error('[funding] 아티스트 발송 주문 조회 실패:', error);
    loadFailed = true;
  }

  /**
   * 받는 분 정보가 실린 만큼 접속기록에 남긴다. 가려진 행은 정보가 없으므로 세지 않고, 실을 정보가 없으면(0건) 남기지 않는다 —
   * 개인정보가 한 줄도 나가지 않았는데 기록만 쌓으면 열람 사실을 가리키지 않게 된다. `recordPrivacyAccess`는 던지지 않지만
   * 개설자 배송 화면과 같은 이유로 `.catch`를 한 겹 더 둔다. await하는 것은 서버리스에서 응답 뒤 실행이 얼어붙을 수 있어서다.
   */
  const exposed = rows.filter((r) => !r.masked).length;
  if (exposed > 0) {
    await recordPrivacyAccess({
      actor: privacyCreatorActor(auth.creatorId),
      action: 'shop_artist_shipping_view',
      targetId: auth.creatorId,
      result: 'success',
      rowCount: exposed,
      ip: getClientIp(context.req),
    }).catch((error: unknown) => {
      console.error('[privacy] 접속기록 호출 실패 — 발송 화면은 계속됩니다', error);
    });
  }

  return { props: { rows, loadFailed } };
});

// 디자인 판 — lib/designEdition.ts
CreatorShopShippingPage.designEdition = 'v2';
