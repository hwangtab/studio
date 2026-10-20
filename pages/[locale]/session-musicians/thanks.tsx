import type { GetStaticPaths, GetStaticProps } from 'next';
import Link from 'next/link';

import SEO from '../../../components/SEO';
import { Notice } from '../../../components/ui/Notice';
import { PageHeader, PageShell } from '../../../components/ui/PageHeader';
import { buildPageStaticProps } from '../../../lib/getStatic';
import { defaultLocale } from '../../../lib/i18n';

// 접수 완료 — noindex, 사이트맵 제외. 새 등록이든 이미 있는 이메일이든 같은 화면이다(이메일 존재 여부를 알리지 않는다).

export default function SessionMusiciansThanksPage() {
  return (
    <>
      <SEO
        locale="ko"
        title="세션 연주자 등록을 받았어요 | 스튜디오 놀"
        description="세션 연주자 등록 접수 완료 안내"
        canonical="/ko/session-musicians/thanks"
        availableLocales={['ko']}
        robots="noindex, follow"
      />
      <PageShell width="result">
        <PageHeader title="등록을 받았어요" lead="입력하신 이메일로 안내 메일을 보냈어요." align="center" />
        <Notice tone="info" title="메일을 확인해 주세요">
          등록 정보를 고치거나 지울 수 있는 링크가 메일에 들어 있어요. 몇 분이 지나도 오지 않으면 스팸함을 확인해 주세요.
          맞는 프로젝트가 생기면 스튜디오 놀이 먼저 연락드려요.
        </Notice>
        <p className="mt-8 text-center typo-card-meta">
          <Link href="/ko" prefetch={false} className="underline">스튜디오 놀 홈으로</Link>
        </p>
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
SessionMusiciansThanksPage.designEdition = 'v2';
