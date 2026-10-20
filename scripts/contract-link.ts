/* eslint-disable no-console */
/**
 * 링크 계약(의뢰인 정보를 서명할 때 받는 제작 계약) 발급·조회·취소 — 관리자 로그인 없이 운영 DB에 바로 쓴다.
 * 관리자 화면(작성 폼 "의뢰인 정보를 아직 몰라요" → 서명하고 발송 → 서명 링크 복사)과 **같은 코드**
 * (lib/contracts/production/service.ts)를 부른다. 나온 링크를 카카오톡으로 의뢰인에게 보낸다.
 *
 *   npx tsx scripts/contract-link.ts create --kind mixmaster --tracks 30            # 미리보기
 *   npx tsx scripts/contract-link.ts create --kind mixmaster --tracks 30 --yes      # 만들고 발송(운영자 서명)
 *   npx tsx scripts/contract-link.ts create --kind single --song "물결" --yes
 *   npx tsx scripts/contract-link.ts create --kind ep --songs 4 --album "바다" --yes
 *   npx tsx scripts/contract-link.ts create --kind mixmaster --tracks 30 --memo "카톡 홍길동(물결)" --yes
 *   npx tsx scripts/contract-link.ts list                  # 최근 20건 — 상태(만료 포함)·발송일·만료·열람·서명 대기 링크
 *   npx tsx scripts/contract-link.ts resend <계약 id>      # 만료됐거나 다시 보낼 링크 — 옛 링크는 즉시 무효, 새 링크 출력
 *   npx tsx scripts/contract-link.ts cancel <계약 id>
 *
 * - mixmaster: `--tracks N`으로 믹싱 가격 구간이 정해진다(10 이하 / 11~30 / 31 이상 + 싱글 마스터링, data/pricing.ts —
 *   applyMixMasterTracks). 정가와 다른 금액은 `--total N`(부가세 포함). 50만원 이하는 일시불, 넘으면 계약금·잔금 절반씩
 *   (terms.ts splitPayment). 납품 기한은 믹싱 1차 `--first-days N`영업일(기본 7)·최종 `--weeks N`주(기본 2).
 * - single·ep·album: 사이트 번들 가격의 기본 조건 그대로다. 금액을 바꾸려면 관리자 작성 폼에서 항목표까지 맞춘다
 *   (제작 계약은 환불 항목이 다섯이라 총액만 바꿀 수 없다).
 * - `--memo`: 누구에게 보낸 링크인지 — 계약 제목 끝에 붙는다(제목은 관리용이라 의뢰인에게 보이지 않는다). `--title`로 제목 전체를
 *   정할 수도 있다. `--deposit-days N`: 대금(계약금) 입금 기한, 기본 3일.
 * - 발송하면 관리자 화면과 같이 운영자 알림 메일이 나간다(링크 계약은 의뢰인 메일은 없다).
 * - `--yes` 없이는 미리보기만. 발송은 스튜디오 대표 서명이다 — 서명 기록의 서명자는 `CONTRACT_ACTOR`(기본 kyungha)에
 *   " (scripts/contract-link.ts)"를 붙여 남긴다. 발송한 계약은 고칠 수 없다 — 틀렸으면 cancel하고 새로 만든다.
 *
 * 접속: pay-link.ts와 같다(TURSO_* 또는 로그인된 Turso CLI로 만료 1일 토큰, 파일에 쓰지 않는다).
 */
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';

const TURSO = `${homedir()}/.turso/turso`;
const DB_NAME = 'studio-nol';
const args = process.argv.slice(2);
const command = args[0];
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && i + 1 < args.length && !args[i + 1].startsWith('--') ? args[i + 1] : undefined;
};
const has = (name: string): boolean => args.includes(`--${name}`);
const cli = (...a: string[]): string => execFileSync(TURSO, a, { encoding: 'utf8' }).trim();
const won = (n: number): string => `${n.toLocaleString('ko-KR')}원`;

const connect = () => {
  process.env.TURSO_DATABASE_URL ||= cli('db', 'show', DB_NAME, '--url');
  process.env.TURSO_AUTH_TOKEN ||= cli('db', 'tokens', 'create', DB_NAME, '-e', '1d');
};

const USAGE =
  '사용법:\n  create --kind mixmaster --tracks N [--total N] [--first-days N] [--weeks N] [--deposit-days N] [--song 제목] [--memo 메모] [--title 제목] [--yes]\n  create --kind single|ep|album [--songs N] [--song 제목] [--album 제목] [--weeks N] [--deposit-days N] [--memo 메모] [--title 제목] [--yes]\n  list\n  resend <계약 id>\n  cancel <계약 id>';

/** 양의 정수 옵션. 잘못 적으면 조용히 기본값으로 가지 않고 멈춘다. */
const intFlag = (name: string): number | undefined => {
  const raw = flag(name);
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) throw new Error(`--${name}는 1 이상의 정수입니다(받은 값: ${raw}).`);
  return n;
};

const ID_PATTERN = /^[0-9a-f-]{36}$/;
const kstDate = (date: Date | null): string =>
  date ? date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

const main = async (): Promise<void> => {
  if (command === 'create') {
    const terms = await import('../lib/contracts/production/terms');
    const kind = flag('kind') ?? '';
    if (!(kind in terms.KIND_LABEL)) throw new Error(`--kind는 ${Object.keys(terms.KIND_LABEL).join('·')} 중 하나입니다.\n${USAGE}`);
    const k = kind as keyof typeof terms.KIND_LABEL;

    let t: ReturnType<typeof terms.buildDefaultProductionTerms>;
    if (terms.isMixMasterKind(k)) {
      const tracks = Number(flag('tracks'));
      if (!Number.isInteger(tracks) || tracks < 1) throw new Error('믹싱·마스터링은 --tracks(믹싱 트랙 수)가 필요합니다.');
      t = terms.applyMixMasterTracks(terms.buildDefaultProductionTerms('mixmaster'), tracks);
      const total = flag('total');
      if (total !== undefined) {
        const n = Number(total);
        if (!Number.isInteger(n) || n < 1) throw new Error('--total은 원 단위 정수입니다(부가세 포함).');
        t = { ...t, amount: { ...t.amount, total: n, ...terms.splitPayment(n) }, refundSchedule: [{ ...t.refundSchedule[0], amount: n }] };
      }
    } else {
      if (flag('total') !== undefined) throw new Error('제작 계약(싱글·EP·정규)의 금액은 관리자 작성 폼에서 항목표와 함께 고쳐 주세요.');
      t = terms.buildDefaultProductionTerms(k, Number(flag('songs') ?? '1') || 1);
      if (flag('album')) t = { ...t, albumTitle: flag('album') ?? null };
    }
    if (flag('song')) t = { ...t, songs: [{ title: flag('song') ?? null }, ...t.songs.slice(1)] };
    // 납품 기한(제4조 1항) — 최종 마스터 N주 이내, 믹싱·마스터링은 1차 결과물 N영업일 이내도.
    const weeks = intFlag('weeks');
    if (weeks !== undefined) t = { ...t, workWeeks: weeks };
    const firstDays = intFlag('first-days');
    if (firstDays !== undefined) t = { ...t, firstDeliveryBusinessDays: firstDays };
    const depositDays = intFlag('deposit-days');
    if (depositDays !== undefined) t = { ...t, amount: { ...t.amount, depositDueDays: depositDays } };

    const { validateProductionContractPayload } = await import('../lib/contracts/production/validation');
    const today = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
    const v = validateProductionContractPayload({
      openLink: true,
      kind: k,
      // 제목은 관리용이다(의뢰인 화면·PDF에는 계약서 이름이 나간다) — 메모로 누구에게 보낸 링크인지 남긴다.
      title:
        flag('title') ??
        `${terms.isMixMasterKind(k) ? '믹싱·마스터링' : '음원 제작'} 용역 계약 (카톡 링크 ${today}${flag('memo') ? ` · ${flag('memo')}` : ''})`,
      terms: t,
    });
    if (!v.ok) throw new Error(v.errors.map((e) => `${e.field}: ${e.message}`).join('\n'));
    const d = v.data.terms;
    console.log(`종류     ${terms.KIND_LABEL[k]}${d.songs.length > 1 ? ` ${d.songs.length}곡` : ''}  ${terms.releaseTitle(k, d)}`);
    console.log(
      terms.isSinglePayment(d)
        ? `금액     ${won(d.amount.total)} (부가세 포함) — 일시불, 체결 후 ${d.amount.depositDueDays}일 이내`
        : `금액     ${won(d.amount.total)} (부가세 포함) — 계약금 ${won(d.amount.deposit)}(체결 후 ${d.amount.depositDueDays}일), 잔금 ${won(d.amount.balance)}`,
    );
    if (terms.isMixMasterKind(k)) console.log(`범위     믹싱 ${d.scope.mixingTracks}트랙 이하 + 싱글 마스터링, 수정 믹싱 ${d.revisions.mixing}·마스터링 ${d.revisions.mastering}회`);
    console.log(`해지정산 ${d.refundSchedule.map((r) => `${r.label} ${won(r.amount)} [${r.milestones.map((m) => `${m.event} ${Math.round(m.ratio * 100)}%`).join(' → ')}]`).join(' / ')}`);
    console.log(`납품기한 ${d.firstDeliveryBusinessDays ? `믹싱 1차 ${d.firstDeliveryBusinessDays}영업일, ` : ''}최종 마스터 ${d.workWeeks}주 이내`);
    if (!has('yes')) {
      console.log('\n미리보기입니다. 맞으면 --yes를 붙여 다시 실행하세요(발송 = 스튜디오 대표 서명).');
      return;
    }
    connect();
    const service = await import('../lib/contracts/production/service');
    const contract = await service.createProductionContract(v.data);
    const sent = await service.sendProductionContract(contract.id, {
      allowedStatuses: ['draft'],
      adminActor: `${process.env.CONTRACT_ACTOR ?? 'kyungha'} (scripts/contract-link.ts)`,
      ipAddress: null,
      userAgent: 'scripts/contract-link.ts',
    });
    if (!sent?.signUrls.client) throw new Error(`초안(${contract.id})은 만들었지만 발송하지 못했습니다. 관리자 화면에서 확인해 주세요.`);
    // 관리자 화면의 발송과 같이 운영자 알림을 보낸다(링크 계약은 의뢰인 메일이 없다 — service.ts가 건너뛴다).
    await service.sendProductionSignRequestNotifications(sent.contract, sent.signUrls);
    console.log(`\n만들었습니다 — 이 링크를 카카오톡으로 보내세요:\n${sent.signUrls.client}\n(계약 id ${contract.id})`);
    return;
  }

  if (command === 'list') {
    connect();
    const { getDb } = await import('../db/client');
    const { buildProductionSignUrl } = await import('../lib/contracts/production/links');
    const { getEffectiveProductionStatus } = await import('../lib/contracts/production/status');
    const rows = await getDb().query.productionContracts.findMany({
      orderBy: (c, { desc }) => [desc(c.createdAt)],
      limit: 20,
      with: { signers: true },
    });
    const STATUS: Record<string, string> = { draft: '초안', sent: '서명대기', signed: '체결', expired: '만료', cancelled: '취소', completed: '완료', terminated: '해지' };
    for (const r of rows) {
      const status = getEffectiveProductionStatus(r);
      const client = r.signers.find((s) => s.role === 'client');
      const viewed = client?.firstViewedAt ? `열람 ${client.viewCount}회(처음 ${kstDate(client.firstViewedAt)})` : '안 열어 봄';
      const dates = r.sentAt ? `발송 ${kstDate(r.sentAt)}${status === 'sent' || status === 'expired' ? ` · 만료 ${kstDate(r.expiresAt)}` : ''}` : '';
      const link = status === 'sent' && client?.status === 'pending' && client.signToken ? `\n      ${buildProductionSignUrl(r.id, client.signToken)}` : '';
      console.log(
        `${(STATUS[status] ?? status).padEnd(5)} ${won(r.totalAmount).padStart(11)}  ${r.clientName || '(의뢰인 미정)'}  ${r.title}\n      ${[dates, status === 'sent' ? viewed : '', `id ${r.id}`].filter(Boolean).join(' · ')}${link}`,
      );
    }
    if (rows.length === 0) console.log('아직 없습니다.');
    return;
  }

  if (command === 'resend') {
    const id = args[1] ?? '';
    if (!ID_PATTERN.test(id)) throw new Error('사용법: resend <계약 id>');
    connect();
    const service = await import('../lib/contracts/production/service');
    const sent = await service.sendProductionContract(id, {
      allowedStatuses: ['sent', 'expired'],
      adminActor: `${process.env.CONTRACT_ACTOR ?? 'kyungha'} (scripts/contract-link.ts)`,
      ipAddress: null,
      userAgent: 'scripts/contract-link.ts',
    });
    if (!sent) throw new Error('다시 보낼 수 없는 계약입니다 — 서명 대기·만료 상태만 됩니다(방금 보냈다면 10초 뒤에).');
    await service.sendProductionSignRequestNotifications(sent.contract, sent.signUrls);
    console.log(sent.signUrls.client ? `새 링크(옛 링크는 무효) — 카카오톡으로 다시 보내세요:\n${sent.signUrls.client}` : '의뢰인은 이미 서명했습니다.');
    return;
  }

  if (command === 'cancel') {
    const id = args[1] ?? '';
    if (!ID_PATTERN.test(id)) throw new Error('사용법: cancel <계약 id>');
    connect();
    const service = await import('../lib/contracts/production/service');
    if (await service.cancelProductionContract(id)) {
      console.log('취소했습니다 — 그 링크는 "취소된 계약"으로 열립니다.');
      return;
    }
    const { getDb } = await import('../db/client');
    const row = await getDb().query.productionContracts.findFirst({ where: (c, { eq }) => eq(c.id, id), columns: { status: true } });
    console.log(row ? `취소할 수 없는 상태입니다(${row.status}) — 체결된 계약은 관리자 화면에서 해지합니다.` : '그런 계약이 없습니다. list로 id를 확인해 주세요.');
    return;
  }

  console.error(USAGE);
  process.exit(1);
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
