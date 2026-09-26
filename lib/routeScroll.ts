/**
 * 페이지 전환이 끝난 뒤의 스크롤 위치.
 *
 * _app의 AnimatePresence(onExitComplete)가 부른다. 예전에는 무조건 scrollTo(0)이라
 * **다른 페이지의 앵커로 가는 링크가 전부 그 페이지 맨 위에 떨어졌다** — 프로덕션 푸터
 * "취소·환불 규정"(/ko/terms#refund)이 약관 맨 위에 도착하고 환불 조항은 1,017px 아래에
 * 있었다(2026-09-26 실측). next/router가 해시로 스크롤해도 그 뒤에 이 콜백이 맨 위로 되돌렸다.
 *
 * mode="wait"라 이 콜백이 불리는 시점엔 새 페이지가 아직 마운트되지 않았다. 그래서 대상
 * 요소가 생길 때까지 프레임 단위로 다시 찾는다. 끝내 없으면(잘못된 앵커) 예전처럼 맨 위.
 *
 * 헤더에 가리지 않는 것은 대상 요소의 scroll-mt-*가 맡는다 — scrollIntoView는 scroll-margin을
 * 존중한다. behavior는 'instant'다: html에 scroll-behavior: smooth가 걸려 있어 'auto'면
 * 페이지 맨 위에서부터 부드럽게 굴러 내려간다.
 */

const MAX_FRAMES = 30; // 약 0.5초 — 동적 import 섹션이 늦게 붙는 경우까지

export const scrollAfterRouteChange = (win: Window = window): void => {
  const id = decodeURIComponent(win.location.hash.slice(1));
  if (!id) {
    win.scrollTo({ top: 0, behavior: 'auto' });
    return;
  }

  let frame = 0;
  const attempt = () => {
    const target = win.document.getElementById(id);
    if (target) {
      target.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior });
      return;
    }
    frame += 1;
    if (frame < MAX_FRAMES) {
      win.requestAnimationFrame(attempt);
    } else {
      win.scrollTo({ top: 0, behavior: 'auto' });
    }
  };
  attempt();
};

/** 전환 key — 쿼리와 해시를 뗀 경로. 해시가 key에 남으면 같은 페이지 안의 앵커 이동도 페이지를 통째로 다시 마운트한다. */
export const routeTransitionKey = (asPath: string): string => asPath.split(/[?#]/)[0];
