import { withI18nServerProps } from '../../../../lib/getStatic';
import { loginCreatorSessionFromContext } from '../../../../lib/funding/creatorAuth';
import { consumeCreatorLoginToken } from '../../../../lib/funding/creatorToken';

// 화면이 없는 페이지(항상 redirect)라 i18nResources를 실제로 쓰지는 않지만,
// withI18nServerProps로 감싼다 — lib/getStatic.test.ts가 pages/[locale] 아래 모든
// getServerSideProps 페이지를 전수로 스캔해 이 배선을 요구한다(2026-09-15
// /ko/booking/* 스피너 셸 사고 재발 방지 가드). redirect 결과는 그대로 통과한다.
export const getServerSideProps = withI18nServerProps(async (context) => {
  context.res.setHeader('Cache-Control', 'no-store');
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
