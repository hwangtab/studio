import { withI18nServerProps } from '../../../../lib/getStatic';
import { loginCreatorSessionFromContext } from '../../../../lib/funding/creatorAuth';
import { consumeCreatorLoginToken } from '../../../../lib/funding/creatorToken';

// 화면이 없는 페이지(항상 redirect)라 i18nResources를 실제로 쓰지는 않지만,
// withI18nServerProps로 감싼다 — lib/getStatic.test.ts가 pages/[locale] 아래 모든
// getServerSideProps 페이지를 전수로 스캔해 이 배선을 요구한다(2026-09-15
// /ko/booking/* 스피너 셸 사고 재발 방지 가드). redirect 결과는 그대로 통과한다.
export const getServerSideProps = withI18nServerProps(async (context) => {
  context.res.setHeader('Cache-Control', 'no-store');
  // funding의 다른 SSR 형제 페이지와 같은 자리, 같은 방식(ko 전용 → 비-ko는 ko로 되돌림).
  // 여기서는 쿼리스트링(토큰)을 반드시 그대로 들고 가야 한다 — 잃으면 이 착지 자체가
  // "링크가 만료됐거나 이미 쓰였다"로 오판돼 로그인이 깨진다. resolvedUrl은 사용자가
  // 실제로 요청한 경로+쿼리 원문이라 재조립 없이 그대로 옮긴다.
  if (context.params?.locale !== 'ko') {
    const search = context.resolvedUrl.split('?')[1];
    return { redirect: { destination: `/ko/funding/creator/auth${search ? `?${search}` : ''}`, permanent: false } };
  }
  const token = typeof context.query.token === 'string' ? context.query.token : '';
  const consumed = token ? await consumeCreatorLoginToken(token) : null;
  if (!consumed) {
    // 링크가 만료됐거나 이미 쓰였다. 왜인지는 구분해 알리지 않는다 — 어느 쪽이든 할 일은
    // "다시 받기" 하나뿐이고, 구분해 주면 토큰의 상태를 밖에서 캐물을 수 있게 된다.
    return { redirect: { destination: '/ko/funding/apply?e=link', permanent: false } };
  }
  await loginCreatorSessionFromContext(context, consumed.creatorId);
  return { redirect: { destination: '/ko/funding/creator', permanent: false } };
});

export default function CreatorAuth() {
  return null;
}
