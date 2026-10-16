/* eslint-disable @next/next/no-html-link-for-pages --
 * private 페이지(URL에 관리 토큰이 실린다)의 이탈 링크는 문서 이동이어야 한다.
 * 근거·경로 목록: lib/analytics/privatePaths.ts, 회귀 테스트: tests/pages/privateLinkNavigation.test.ts
 */
import Head from 'next/head';
import { useState } from 'react';

import { Button, buttonVariants } from '../../../../components/ui/Button';
import { Notice } from '../../../../components/ui/Notice';
import { PageShell } from '../../../../components/ui/PageHeader';
import { Panel } from '../../../../components/ui/Panel';
import StatusBadge from '../../../../components/ui/StatusBadge';
import { formatPriceAmount } from '../../../../data/pricing';
import { SOFTWARE_DEACTIVATIONS_PER_30_DAYS, SOFTWARE_SELF_CANCEL_DAYS } from '../../../../data/software/policy';
import { getSiteConfig } from '../../../../data/siteConfig';
import { isTokenMatch } from '../../../../lib/booking/token';
import { withI18nServerProps } from '../../../../lib/getStatic';
import { softwareSelfCancelBlocker } from '../../../../lib/software/cancel';
import { getAnySoftware, latestReleaseOf, softwareDownloadPath } from '../../../../lib/software/catalog';
import { formatBytes, PLATFORM_LABEL } from '../../../../lib/software/copy';
import { findSoftwareOrder, normalizeSoftwareOrderNo } from '../../../../lib/software/order';
import { getDb } from '../../../../db/client';

interface Device {
  id: string;
  label: string;
  activatedAt: string;
}

interface Props {
  orderNo: string;
  token: string;
  state: 'paid' | 'refunded' | 'unpaid';
  productTitle: string;
  productSlug: string;
  totalAmount: number;
  licenses: { key: string; active: boolean; maxActivations: number; devices: Device[] }[];
  downloads: { platform: string; url: string; sha256: string; size: string; version: string }[];
  /** 고객 셀프 환불 가능 여부와, 안 되면 그 이유. */
  cancel: 'available' | 'activated' | 'expired_window' | 'none';
}

const kst = (iso: string) => new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric', day: 'numeric' });

export default function SoftwareManagePage({ orderNo, token, state, productTitle, productSlug, totalAmount, licenses, downloads, cancel }: Props) {
  const kakaoUrl = getSiteConfig('ko').contact.kakaoUrl;
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const post = async (url: string, body: Record<string, unknown>, failText: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderNo, token, ...body }) });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (res.ok && data?.ok) {
        window.location.reload();
        return;
      }
      setMessage({ tone: 'error', text: data?.message || failText });
    } catch {
      setMessage({ tone: 'error', text: '네트워크 오류가 났어요. 잠시 후 다시 시도해 주세요.' });
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <>
      <Head>
        <title>구매 내역 | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <PageShell width="form">
        <p className="typo-card-meta mb-4 text-center">스튜디오 놀</p>
        <header className="mb-6 text-center">
          <h1 className="typo-page-title text-gray-900 dark:text-white">{productTitle}</h1>
          <p className="mt-2 typo-card-meta">주문번호 {orderNo} · {formatPriceAmount(totalAmount)}원</p>
          <StatusBadge tone={state === 'paid' ? 'active' : 'neutral'} className="mt-3">
            {state === 'paid' ? '사용 중' : state === 'refunded' ? '환불됨' : '결제 전'}
          </StatusBadge>
        </header>

        {message && <Notice tone={message.tone} className="mb-4">{message.text}</Notice>}

        {state === 'paid' && licenses.map((l) => (
          <Panel key={l.key} as="section" padding="default" title="라이선스 키" className="mb-6">
            <p className="select-all font-mono text-lg tracking-wide text-gray-900 dark:text-white">{l.key}</p>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              플러그인(또는 앱)을 열고 이 키를 넣으면 정식판으로 바뀌어요. 처음 한 번만 인터넷이 필요해요. 기기는 {l.maxActivations}대까지 쓸 수 있어요.
            </p>
            <h2 className="mt-5 text-sm font-semibold text-gray-900 dark:text-white">활성화한 기기 {l.devices.length} / {l.maxActivations}</h2>
            {l.devices.length === 0 ? (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">아직 없어요.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {l.devices.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 text-sm text-gray-800 dark:text-gray-200">
                    <span>{d.label} <span className="text-gray-500 dark:text-gray-400">· {kst(d.activatedAt)}</span></span>
                    <Button type="button" size="sm" variant="weak" disabled={busy}
                      onClick={() => { if (window.confirm('이 기기를 해제할까요? 그 기기에서 쓰려면 다시 활성화해야 해요.')) void post('/api/software/manage-device', { activationId: d.id }, '해제하지 못했어요.'); }}>
                      해제
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">컴퓨터를 바꿨다면 옛 기기를 해제하고 새 기기에서 활성화하세요. 해제는 30일에 {SOFTWARE_DEACTIVATIONS_PER_30_DAYS}번까지 할 수 있어요.</p>
          </Panel>
        ))}

        {state === 'paid' && downloads.length > 0 && (
          <Panel as="section" padding="default" title={`설치 파일 · v${downloads[0].version}`} className="mb-6">
            <ul className="space-y-3">
              {downloads.map((d) => (
                <li key={d.platform}>
                  <a href={d.url} className={buttonVariants({ variant: 'solid', size: 'md' })} rel="noreferrer">{d.platform}용 받기 · {d.size}</a>
                  <p className="mt-1 break-all font-mono text-xs text-gray-500 dark:text-gray-400">SHA-256 {d.sha256}</p>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {cancel === 'available' && (
          <div className="mb-6 space-y-3">
            {!confirming ? (
              <Button type="button" variant="weak" fullWidth onClick={() => setConfirming(true)}>환불하기</Button>
            ) : (
              <Panel className="space-y-3">
                <p className="text-sm text-gray-800 dark:text-gray-200">환불하면 라이선스 키를 더 이상 쓸 수 없어요. 결제하신 수단으로 전액을 돌려받을까요?</p>
                <div className="flex gap-2">
                  <Button type="button" onClick={() => void post('/api/software/cancel', {}, '환불하지 못했어요. 잠시 후 다시 시도해 주세요.')} disabled={busy}>{busy ? '처리 중…' : '네, 환불할게요'}</Button>
                  <Button type="button" variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>아니요</Button>
                </div>
              </Panel>
            )}
            <p className="typo-card-meta">라이선스를 활성화하기 전, 결제 후 {SOFTWARE_SELF_CANCEL_DAYS}일 안에는 여기서 바로 환불할 수 있어요.</p>
          </div>
        )}
        {cancel === 'activated' && (
          <p className="mb-6 typo-card-meta">라이선스를 활성화해 이 페이지에서는 환불할 수 없어요. 설치·동작에 문제가 있으면 카카오톡이나 010-4255-7893으로 알려 주세요.</p>
        )}
        {cancel === 'expired_window' && (
          <p className="mb-6 typo-card-meta">결제 후 {SOFTWARE_SELF_CANCEL_DAYS}일이 지나 이 페이지에서는 환불할 수 없어요. 문의는 카카오톡이나 010-4255-7893으로 해 주세요.</p>
        )}

        <p className="mt-8 text-center typo-card-meta">
          <a href={kakaoUrl} target="_blank" rel="noopener noreferrer" className="underline">카카오톡 문의</a>
          {' · '}
          <a href="tel:01042557893" rel="noreferrer" className="underline">010-4255-7893</a>
          {' · '}
          <a href={`/ko/software/${productSlug}`} rel="noreferrer" className="underline">상품 페이지</a>
        </p>
      </PageShell>
    </>
  );
}

export const getServerSideProps = withI18nServerProps<Props>(async ({ params, query, res }) => {
  res.setHeader('Cache-Control', 'private, no-store');
  if (params?.locale !== 'ko') return { notFound: true };
  // 미들웨어가 경로를 소문자로 308한다 — 주문번호는 대문자로 맞춰 비교한다.
  const orderNo = normalizeSoftwareOrderNo(params?.orderNo);
  const token = typeof query.token === 'string' ? query.token : '';
  if (!orderNo || !token) return { notFound: true };
  const order = await findSoftwareOrder(orderNo).catch(() => null);
  if (!order || !order.item || !isTokenMatch(order.manageToken, token)) return { notFound: true };

  const live = order.status === 'paid' || order.status === 'partially_refunded';
  const state: Props['state'] = live ? 'paid' : order.status === 'refunded' ? 'refunded' : 'unpaid';
  const db = getDb();
  const licenses: Props['licenses'] = [];
  for (const l of order.licenses) {
    const acts = await db.query.softwareActivations.findMany({
      where: (t, { and, eq, isNull }) => and(eq(t.licenseId, l.id), isNull(t.deactivatedAt)),
    }).catch(() => []);
    licenses.push({
      key: l.licenseKey,
      active: l.status === 'active',
      maxActivations: l.maxActivations,
      devices: acts.map((a) => ({ id: a.id, label: a.label ?? `기기 ${a.machineId.slice(0, 6)}`, activatedAt: a.activatedAt.toISOString() })),
    });
  }
  const productSlug = order.item.productSlug;
  const product = getAnySoftware(productSlug);
  const release = product ? latestReleaseOf(product) : null;
  const blocker = softwareSelfCancelBlocker(order, new Date());
  return {
    props: {
      orderNo: order.orderNo,
      token,
      state,
      productTitle: order.item.productTitle,
      productSlug: order.item.productSlug,
      totalAmount: order.totalAmount,
      licenses: licenses.filter((l) => l.active),
      downloads: release
        ? release.downloads.map((d) => ({ platform: PLATFORM_LABEL[d.platform], url: softwareDownloadPath(productSlug, release.version, d.platform), sha256: d.sha256, size: formatBytes(d.sizeBytes), version: release.version }))
        : [],
      cancel: blocker === null ? 'available' : blocker === 'invalid_state' ? 'none' : blocker,
    },
  };
});

// 디자인 판 — lib/designEdition.ts
SoftwareManagePage.designEdition = 'v2';
