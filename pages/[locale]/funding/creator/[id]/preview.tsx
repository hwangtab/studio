import Head from 'next/head';
import Link from 'next/link';

import ProjectDetailView from '../../../../../components/funding/ProjectDetailView';
import { authenticateCreatorRequest } from '../../../../../lib/funding/creatorAuth';
import { loadProjectForCreator } from '../../../../../lib/funding/creatorProjectWrite';
import { rowsToFundingProject } from '../../../../../lib/funding/dbProjects';
import { computeProjectState, stripRewardDownloads, type FundingProject, type ProjectState } from '../../../../../lib/funding/projects';
import { withI18nServerProps } from '../../../../../lib/getStatic';

import type { FundingProjectRow } from '../../../../../db/schema';

interface CompleteProps {
  incomplete: false;
  projectId: string;
  project: FundingProject;
  state: ProjectState;
}
interface IncompleteProps {
  incomplete: true;
  projectId: string;
}
type Props = CompleteProps | IncompleteProps;

/**
 * 개설자 미리보기 — 승인 전에는 이것이 개설자가 자기 페이지를 보는 **유일한 수단**이다.
 *
 * 공개 상세(`pages/[locale]/funding/[slug]/index.tsx`)와 같은 `ProjectDetailView`로 그린다
 * (합성이 다르면 "미리 보여 준" 의미가 없다). SEO 메타·구조화 데이터·상태 폴링·후원 CTA는
 * 여기 없다 — 승인되지 않은 프로젝트라 색인·후원 자체가 성립하지 않는다.
 */
export default function FundingCreatorPreviewPage(props: Props) {
  const editHref = `/ko/funding/creator/${encodeURIComponent(props.projectId)}`;
  return (
    <>
      <Head>
        <title>미리보기 | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      {/*
        상단 고정 띠 — 아직 아무에게도 공개되지 않았다는 것을 개설자 본인에게도 분명히
        한다. `top-16`으로 헤더(fixed, z-50, 모바일 h-16/데스크톱 pt-2+h-14 — 둘 다 64px)
        바로 아래에 둔다. `top-0`이면 헤더보다 아래 z(z-40 < z-50)라 항상 헤더 뒤로 들어가
        가려진다 — hasHero라 헤더가 투명한 순간에는 헤더의 흰 글씨가 이 띠 위에 겹쳐 뜨고,
        스크롤로 헤더가 불투명해지면 이 화면에서 유일하게 항상 보여야 할 문장이 통째로
        사라진다.
      */}
      <div className="sticky top-16 z-40 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-400 px-4 py-2.5 text-center text-sm font-semibold text-amber-950">
        <span>미리보기입니다. 아직 공개되지 않았습니다.</span>
        <Link href={editHref} className="underline underline-offset-2">
          편집으로 돌아가기
        </Link>
      </div>

      {props.incomplete ? (
        // hasHero가 페이지 전역에 켜져 헤더가 투명하다(아래 선언 참조) — 배경이 흰색이면
        // 흰 헤더 글씨가 그대로 묻힌다. 히어로 사진 없이도 상단을 어둡게 채워 대비를 지킨다.
        <main className="min-h-[70vh] bg-gray-900 px-4 pt-32 pb-24 text-center">
          <p className="typo-body text-gray-200">
            아직 미리 볼 수 없습니다. 기본정보와 리워드를 먼저 채워 주세요.
          </p>
          <Link
            href={editHref}
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-6 font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            편집으로 돌아가기
          </Link>
        </main>
      ) : (
        // 미리보기는 실제 모금액이 없어 후원 CTA를 그리지 않는다(interactive: false) —
        // 승인 전 프로젝트라 후원도 성립하지 않는다.
        <ProjectDetailView project={props.project} state={props.state} status={null} interactive={false} />
      )}
    </>
  );
}

/**
 * ImageHero를 쓰는 페이지는 hasHero 선언이 필수다(components/layout/heroHeader.test.ts가
 * 소스를 정적으로 대조한다 — 페이지가 ProjectDetailView를 통해 간접적으로 ImageHero를
 * 그려도 잡아낸다). 헤더가 투명해지고 본문 상단 여백(pt-20)이 빠진다.
 *
 * 초안(필수값이 빈 상태)은 히어로 사진이 없으므로 위 incomplete 분기가 대신 어두운
 * 배경(bg-gray-900)을 깔아 투명 헤더의 흰 글씨 대비를 지킨다.
 */
FundingCreatorPreviewPage.hasHero = true;

// 주석을 달지 않는다 — withI18nServerProps는 Props에 locale·i18nResources를 더한 타입을 돌려준다
// (pages/[locale]/funding/creator/[id].tsx와 같은 모양).
export const getServerSideProps = withI18nServerProps<Props>(async (context) => {
  context.res.setHeader('Cache-Control', 'no-store');
  const id = typeof context.params?.id === 'string' ? context.params.id : '';
  // funding의 다른 SSR 형제 페이지와 같은 자리, 같은 방식 — 펀딩은 ko 전용이라 비-ko
  // 경로는 같은 화면을 ko로 되돌린다.
  if (context.params?.locale !== 'ko') {
    return { redirect: { destination: `/ko/funding/creator/${encodeURIComponent(id)}/preview`, permanent: false } };
  }
  const auth = await authenticateCreatorRequest(context);
  if (!auth.ok) return { redirect: { destination: '/ko/funding/apply', permanent: false } };
  if (!id) return { notFound: true };

  // loadProjectForCreator가 소유 확인(creatorId 일치)까지 함께 한다 — 남의 프로젝트면
  // null이라 notFound. '권한 없음'이라고 답하지 않는 것은 creatorProjectWrite.ts의 guard와
  // 같은 이유(그 id가 존재한다는 사실 자체를 알려 주지 않는다).
  const detail = await loadProjectForCreator(auth.creatorId, id);
  if (!detail) return { notFound: true };

  /**
   * rowsToFundingProject(lib/funding/dbProjects.ts)이 실제로 읽는 필드만 채운다 —
   * `rowToShapeInput`이 쓰는 필드에 더해 `content`도 필요하다(그건 `row.content`로 따로
   * 읽는다, rowToShapeInput에는 없다 — 처음 구현에서 빠뜨려 완성된 프로젝트에서 항상
   * `undefined`가 섞여 터졌었다). loadProjectForCreator는 화면이 쓰는 필드만 골라 담은
   * 좁은 투영이라(pages/[locale]/funding/creator/[id].tsx의 toEditorProject 주석과 같은
   * 자리) og·hero 이미지·hidden·lastmod가 없다 — 전부 미리보기 렌더에 영향이 없는 값이라
   * 기본값을 준다: og·hero는 `??` 폴백으로 cover를 그대로 쓰고(validateFundingProjectShape와
   * 같은 동작), hidden은 승인 전 프로젝트에 의미가 없는 축이며, lastmod은 사이트맵 전용이라
   * 이 화면이 아예 읽지 않는다.
   */
  const projectRow = {
    slug: detail.slug,
    title: detail.title,
    summary: detail.summary,
    content: detail.content,
    coverUrl: detail.coverUrl,
    ogImageUrl: null,
    heroImageUrl: null,
    goalAmount: detail.goalAmount,
    startAt: detail.startAt,
    endAt: detail.endAt,
    status: detail.status,
    hidden: false,
    lastmod: null,
  } as unknown as FundingProjectRow;

  try {
    // 검증에 걸리면 404가 아니다 — 초안은 필수값이 비어 있는 것이 정상이라, 무엇을
    // 채워야 하는지 알려 주는 화면을 대신 띄운다(아래 catch).
    const project = rowsToFundingProject(projectRow, detail.rewards);
    return {
      props: {
        incomplete: false,
        projectId: id,
        // 리워드의 내려받기 주소를 벗긴다 — 승인 전이라 후원 자체가 성립하지 않지만,
        // "공개로 나가는 값은 무조건 벗긴다"가 규칙이다(렌더 경로가 여럿이라 한 곳을
        // 빠뜨리면 그 경로로만 샌다, lib/funding/shape.ts 주석과 같은 이유).
        project: stripRewardDownloads(project),
        state: computeProjectState(project, new Date()),
      },
    };
  } catch {
    return { props: { incomplete: true, projectId: id } };
  }
});
