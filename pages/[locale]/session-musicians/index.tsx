import type { GetStaticPaths, GetStaticProps } from 'next';
import { useRouter } from 'next/router';

import SEO from '../../../components/SEO';
import SessionMusicianForm, { type SubmitResult } from '../../../components/sessionMusicians/SessionMusicianForm';
import { PageHeader, PageShell } from '../../../components/ui/PageHeader';
import { Panel } from '../../../components/ui/Panel';
import { buildPageStaticProps } from '../../../lib/getStatic';
import { defaultLocale } from '../../../lib/i18n';

// 세션 연주자 등록 — 소개 + 폼 한 화면. 등록한 명단은 사이트에 공개하지 않고 운영자만 본다(설계 D1).
// 연주자는 국내 섭외 대상이라 ko 전용이다(정적 경로를 ko 하나만 등록 — lib/koOnlyRoutes.ts).
// 설계: docs/session-musician-registration-design-2026-10.md

const TITLE = '세션 연주자 등록';
const DESCRIPTION = '스튜디오 놀의 녹음·편곡·발매 프로젝트에서 함께할 세션 연주자를 모집해요. 프로필을 등록해 두시면 맞는 프로젝트가 생겼을 때 먼저 연락드려요.';

const WORK_ITEMS = [
  '녹음실 세션 — 스튜디오에서 직접 연주해 녹음해요.',
  '편곡 실연 — 스트링·브라스·밴드 파트를 실연으로 채워요.',
  '원격 녹음 — 내 장비로 녹음해 파일로 보내 주세요.',
];

export default function SessionMusiciansPage() {
  const router = useRouter();

  const submit = async (payload: Record<string, unknown>): Promise<SubmitResult> => {
    const res = await fetch('/api/session-musicians', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string; field?: string } | null;
    if (res.ok && data?.ok) {
      await router.push('/ko/session-musicians/thanks');
      return { ok: true };
    }
    return { ok: false, message: data?.message, field: data?.field };
  };

  return (
    <>
      <SEO
        locale="ko"
        title={`${TITLE} | 스튜디오 놀`}
        description={DESCRIPTION}
        canonical="/ko/session-musicians"
        availableLocales={['ko']}
      />
      <PageShell>
        <PageHeader title={TITLE} lead={DESCRIPTION} className="mb-8" />

        <div className="mb-10 space-y-6">
          <Panel as="section" variant="outline" padding="default" title="어떤 일인가요">
            <ul className="list-disc space-y-1 pl-5 text-gray-700 dark:text-gray-300">
              {WORK_ITEMS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Panel>

          <Panel as="section" variant="outline" padding="default" title="등록하기 전에 알아 두세요">
            <ul className="list-disc space-y-1 pl-5 text-gray-700 dark:text-gray-300">
              <li>등록이 섭외를 약속하는 건 아니에요. 맞는 프로젝트가 생기면 스튜디오 놀이 먼저 연락드려요.</li>
              <li>연주비는 프로젝트마다 협의해요. 스튜디오는 연주비에서 섭외 수수료를 떼지 않아요.</li>
              <li>등록한 정보는 사이트에 공개하지 않고, 운영자만 봐요.</li>
              <li>만 19세 이상만 등록할 수 있어요.</li>
              <li>등록하면 이메일로 정보를 고치거나 지울 수 있는 링크를 보내 드려요. 로그인은 필요 없어요.</li>
            </ul>
          </Panel>
        </div>

        <SessionMusicianForm mode="register" submitLabel="등록하기" onSubmit={submit} />
      </PageShell>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: [{ params: { locale: defaultLocale } }],
  fallback: false,
});

export const getStaticProps: GetStaticProps = async () => buildPageStaticProps(defaultLocale, {}, { i18nSections: [] });

// 디자인 판 — lib/designEdition.ts
SessionMusiciansPage.designEdition = 'v2';
