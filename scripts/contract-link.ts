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
 *   npx tsx scripts/contract-link.ts events <계약 id>      # 진행 기록 타임라인(최근 30건, 무효 표시·통지 결과 포함)
 *   npx tsx scripts/contract-link.ts log <계약 id> --type payment_received --amount 225000 [--yes]   # 진행 기록 남기기
 *   npx tsx scripts/contract-link.ts log <계약 id> --type stage_delivered --stage mixing --song 1 --at "2026-10-20 14:30" --yes
 *   npx tsx scripts/contract-link.ts log <계약 id> --void <기록 id> --note "사유" --yes
 *
 * - mixmaster: `--tracks N`으로 믹싱 가격 구간이 정해진다(10 이하 / 11~30 / 31 이상 + 싱글 마스터링, data/pricing.ts —
 *   applyMixMasterTracks). 정가와 다른 금액은 `--total N`(부가세 포함). 50만원 이하는 일시불, 넘으면 계약금·잔금 절반씩
 *   (terms.ts splitPayment). 납품 기한은 믹싱 1차 `--first-days N`영업일(기본 7)·최종 `--weeks N`주(기본 2).
 * - rework(AI 리워크 1곡): `--scope none|small|band`(편곡 없음 50만 일시불 / 재편곡·재작곡 소편성 100만 / 풀밴드 150만 — 100만원 이상은
 *   50·30·20% 3회 분할, 중간금은 편곡 승인 뒤). 해지는 받은 금액 × 단계 비율(terms.ts buildDefaultReworkTerms). `--total N`으로 금액을
 *   바꾸면 분할도 그 금액으로 다시 나눈다(splitThreeInstallments).
 *   npx tsx scripts/contract-link.ts create --kind rework --scope small --song "물결" --yes
 * - single·ep·album: 사이트 번들 가격의 기본 조건 그대로다. 금액을 바꾸려면 관리자 작성 폼에서 항목표까지 맞춘다
 *   (제작 계약은 환불 항목이 다섯이라 총액만 바꿀 수 없다).
 * - `--memo`: 누구에게 보낸 링크인지 — 계약 제목 끝에 붙는다(제목은 관리용이라 의뢰인에게 보이지 않는다). `--title`로 제목 전체를
 *   정할 수도 있다. `--deposit-days N`: 대금(계약금) 입금 기한, 기본 3일.
 * - 발송하면 관리자 화면과 같이 운영자 알림 메일이 나간다(링크 계약은 의뢰인 메일은 없다).
 * - `--yes` 없이는 미리보기만. 발송은 스튜디오 대표 서명이다 — 서명 기록의 서명자는 `CONTRACT_ACTOR`(기본 kyungha)에
 *   " (scripts/contract-link.ts)"를 붙여 남긴다. 발송한 계약은 고칠 수 없다 — 틀렸으면 cancel하고 새로 만든다.
 *
 * - `log`: 관리자 상세의 "진행 기록"과 **같은 코드**(lib/contracts/production/admin-record.ts — 입력 검증·해지 환불 확인·장부 판정·
 *   기록)를 지나고, 통지 대상 기록이면 의뢰인 메일도 같이 나간다(sendEventNotice). 받는 종류는 관리자 폼과 같다
 *   (adminEventTypesFor). `--song`은 1부터(여러 곡 계약), `--at`은 KST("YYYY-MM-DD HH:mm", 기본 지금, 미래·120일 전 이전은 거절).
 *   `--yes` 없이는 미리보기 — 장부가 거절할 기록이면 미리보기에서도 사유가 나온다. 기록의 수행자는 `admin:<CONTRACT_ACTOR>
 *   (scripts/contract-link.ts)`로 남는다. 틀린 기록은 지우지 않고 `--void`(사유 필수)로 무효 처리한다.
 * - `events`: 읽기 전용. 무효 처리된 기록은 [무효]로 표시한다.
 *
 * 접속: pay-link.ts와 같다(TURSO_* 또는 로그인된 Turso CLI로 만료 1일 토큰, 파일에 쓰지 않는다).
 */
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';

/**
 * 메일 키(RESEND_API_KEY) 등은 .env.local에서 읽는다 — 이 스크립트는 운영자 알림·의뢰인 통지 메일을 실제로 보낸다(관리자 화면과
 * 같은 코드). 읽지 않으면 메일이 RESEND_API_KEY_MISSING으로 실패하고 그 실패가 계약의 알림 오류로 남는다(2026-10-20 실제로 났다).
 * 파일이 없으면 넘어간다 — 그때 메일은 실패로 기록되고 관리자 화면에서 다시 보낼 수 있다.
 */
{
  // DB 접속은 .env.local이 아니라 로그인된 Turso CLI가 정한다(connect) — .env.local의 토큰은 만료(30일)될 수 있고 다른 DB를
  // 가리킬 수도 있다. 실행할 때 직접 준 TURSO_* 값만 남긴다.
  const given = { url: process.env.TURSO_DATABASE_URL, token: process.env.TURSO_AUTH_TOKEN };
  try {
    process.loadEnvFile('.env.local');
  } catch {
    // .env.local 없음
  }
  if (given.url === undefined) delete process.env.TURSO_DATABASE_URL;
  if (given.token === undefined) delete process.env.TURSO_AUTH_TOKEN;
}

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
  '사용법:\n  create --kind rework --scope none|small|band [--total N] [--weeks N] [--deposit-days N] [--song 제목] [--memo 메모] [--title 제목] [--yes]\n  create --kind mixmaster --tracks N [--total N] [--first-days N] [--weeks N] [--deposit-days N] [--song 제목] [--memo 메모] [--title 제목] [--yes]\n  create --kind single|ep|album [--songs N] [--song 제목] [--album 제목] [--weeks N] [--deposit-days N] [--memo 메모] [--title 제목] [--yes]\n  list\n  resend <계약 id>\n  cancel <계약 id>\n  events <계약 id>\n  log <계약 id> --type <기록 종류> [--stage mixing|mastering|arrangement|tuning] [--song N(1부터)] [--amount N] [--note 내용] [--link https://…] [--at "YYYY-MM-DD HH:mm"(KST)] [--cause client|studio] [--yes]\n  log <계약 id> --void <기록 id> --note 사유 [--yes]';

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
    } else if (terms.isReworkKind(k)) {
      const scope = flag('scope') ?? '';
      if (!(terms.REWORK_SCOPES as readonly string[]).includes(scope)) {
        throw new Error(`AI 리워크는 --scope ${terms.REWORK_SCOPES.join('|')}가 필요합니다(편곡 없음 / 소편성 / 풀밴드).`);
      }
      t = terms.buildDefaultReworkTerms(scope as (typeof terms.REWORK_SCOPES)[number]);
      const total = flag('total');
      if (total !== undefined) {
        const n = Number(total);
        if (!Number.isInteger(n) || n < 1) throw new Error('--total은 원 단위 정수입니다(부가세 포함).');
        t = { ...t, amount: { ...t.amount, total: n, ...terms.splitThreeInstallments(n) }, refundSchedule: [{ ...t.refundSchedule[0], amount: n }] };
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
        `${terms.isMixMasterKind(k) ? '믹싱·마스터링' : terms.isReworkKind(k) ? 'AI 리워크' : '음원 제작'} 용역 계약 (카톡 링크 ${today}${flag('memo') ? ` · ${flag('memo')}` : ''})`,
      terms: t,
    });
    if (!v.ok) throw new Error(v.errors.map((e) => `${e.field}: ${e.message}`).join('\n'));
    const d = v.data.terms;
    console.log(`종류     ${terms.KIND_LABEL[k]}${d.songs.length > 1 ? ` ${d.songs.length}곡` : ''}  ${terms.releaseTitle(k, d)}`);
    console.log(
      terms.isSinglePayment(d)
        ? `금액     ${won(d.amount.total)} (부가세 포함) — 일시불, 체결 후 ${d.amount.depositDueDays}일 이내`
        : `금액     ${won(d.amount.total)} (부가세 포함) — 계약금 ${won(d.amount.deposit)}(체결 후 ${d.amount.depositDueDays}일)${
            d.amount.second > 0 ? `, 중간금 ${won(d.amount.second)}(편곡 승인 후 ${d.amount.secondDueDays}일)` : ''
          }, 잔금 ${won(d.amount.balance)}`,
    );
    if (terms.isReworkKind(k)) {
      console.log(`범위     ${terms.REWORK_SCOPE_LABEL[terms.reworkScopeOf(d)]}, 보컬 녹음 ${d.scope.recordingHours}시간, 믹싱 ${d.scope.mixingTracks}트랙 이하`);
    }
    if (terms.isMixMasterKind(k)) console.log(`범위     믹싱 ${d.scope.mixingTracks}트랙 이하 + 싱글 마스터링, 수정 믹싱 ${d.revisions.mixing}·마스터링 ${d.revisions.mastering}회`);
    console.log(
      d.refundPolicy
        ? `해지환불 받은 금액 × 단계 비율 — 착수 전 100% → ${d.refundPolicy.stages.map((s) => `${s.event} ${Math.round(s.ratio * 100)}%`).join(' → ')} (스튜디오 사정 100%)`
        : `해지정산 ${d.refundSchedule.map((r) => `${r.label} ${won(r.amount)} [${r.milestones.map((m) => `${m.event} ${Math.round(m.ratio * 100)}%`).join(' → ')}]`).join(' / ')}`,
    );
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

  if (command === 'events' || command === 'log') {
    const id = args[1] ?? '';
    if (!ID_PATTERN.test(id)) throw new Error(`사용법: ${command} <계약 id>\n${USAGE}`);
    connect();
    const progress = await import('../lib/contracts/production/progress');
    const spec = await import('../lib/contracts/production/event-spec');
    const context = await progress.loadProgressContext(id);
    if (!context) throw new Error('그런 계약이 없습니다. list로 id를 확인해 주세요.');
    const mixMaster = spec.isMixMasterTerms(context.terms);
    const kstTime = (iso: string): string =>
      new Date(iso).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 16);

    if (command === 'events') {
      const { buildAdminProgressView } = await import('../lib/contracts/production/progress-view');
      const view = buildAdminProgressView(context.terms, context.ledger, context.events, context.contract.status === 'signed');
      const NOTICE: Record<string, string> = { none: '', pending: '통지 대기', sent: '통지 완료', failed: '통지 실패' };
      console.log(`${context.contract.title}\n${context.contract.clientName || '(의뢰인 미정)'} · 계약 상태 ${context.contract.status}\n`);
      for (const item of view.timeline.slice(0, 30)) {
        const parts = [
          kstTime(item.occurredAt),
          item.voided ? '[무효]' : '',
          item.label,
          item.stage ?? '',
          item.amount !== null ? won(item.amount) : '',
          item.note ? `"${item.note}"` : '',
          item.link ?? '',
          `by ${item.actor}`,
          NOTICE[item.noticeStatus] ?? item.noticeStatus,
          item.noticeError ? `(${item.noticeError})` : '',
        ];
        console.log(parts.filter(Boolean).join('  '));
        console.log(`      id ${item.id}`);
      }
      if (view.timeline.length === 0) console.log('아직 기록이 없습니다.');
      else if (view.timeline.length > 30) console.log(`… 이전 ${view.timeline.length - 30}건은 관리자 화면에서 확인해 주세요.`);
      return;
    }

    // log — 관리자 기록 API와 같은 함수(recordAdminProgress)를 지난다. 미리보기에서는 같은 파서·판정만 읽기로 돌린다.
    const voidId = flag('void');
    const type = flag('type');
    if (voidId !== undefined && type !== undefined) throw new Error('--void와 --type은 함께 쓰지 않습니다.');
    if (voidId === undefined && type === undefined) throw new Error(`--type(기록 종류) 또는 --void(무효로 할 기록 id)가 필요합니다.\n${USAGE}`);
    const allowed = spec.adminEventTypesFor(mixMaster);
    if (type !== undefined && !(allowed as readonly string[]).includes(type)) {
      throw new Error(
        `--type은 다음 중 하나입니다:\n${allowed.map((t) => `  ${t.padEnd(22)} ${spec.eventLabelFor(t, mixMaster)}`).join('\n')}`,
      );
    }
    const amountRaw = flag('amount');
    const songRaw = intFlag('song');
    const atRaw = flag('at');
    if (atRaw !== undefined && !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(atRaw)) throw new Error('--at은 KST "YYYY-MM-DD HH:mm" 형식입니다.');
    const body: Record<string, unknown> =
      voidId !== undefined
        ? { eventId: voidId, reason: flag('note') }
        : {
            type,
            stage: flag('stage'),
            song: songRaw !== undefined ? songRaw - 1 : undefined,
            amount: amountRaw !== undefined ? Number(amountRaw) : undefined,
            note: flag('note'),
            link: flag('link'),
            cause: flag('cause'),
            occurredAt: atRaw?.replace(' ', 'T'),
          };
    const action = voidId !== undefined ? 'void' : 'record';
    const eventsModule = await import('../lib/contracts/production/events');
    const parsed = action === 'void' ? eventsModule.parseVoidInput(body) : eventsModule.parseAdminEventInput(body);
    if (!parsed.ok) {
      console.error(parsed.message);
      process.exit(1);
    }
    const refusal = eventsModule.checkEventAllowed(context.contract, context.ledger, context.events, parsed.input);
    if (refusal) {
      console.error(`기록할 수 없습니다: ${refusal}`);
      process.exit(1);
    }

    const input = parsed.input;
    const notifies = spec.EVENT_SPEC[input.type].notifies;
    const { songLabel } = await import('../lib/contracts/production/terms');
    console.log(`계약     ${context.contract.title}`);
    console.log(`의뢰인   ${context.contract.clientName || '(의뢰인 미정)'}`);
    console.log(`기록     ${spec.eventLabelFor(input.type, mixMaster)}${input.voidsEventId ? ` (무효로 할 기록 ${input.voidsEventId})` : ''}`);
    if (input.stage) console.log(`단계     ${spec.STAGE_LABEL[input.stage]}`);
    if (input.song !== null && context.terms.songs.length > 1) console.log(`곡       ${songLabel(context.terms, input.song)}`);
    if (input.amount !== null) console.log(`금액     ${won(input.amount)}`);
    const note = input.data.note ?? input.data.reason;
    if (note) console.log(`내용     ${note}`);
    if (input.data.link) console.log(`링크     ${input.data.link}`);
    if (input.data.cause) console.log(`사유     ${input.data.cause === 'client' ? '의뢰인' : '스튜디오'}`);
    console.log(`일어난 때 ${kstTime(input.occurredAt.toISOString())} (KST)`);
    console.log(`의뢰인 메일 ${notifies ? '나감 — 통지 메일이 의뢰인에게 발송됩니다' : '없음'}`);
    if (!has('yes')) {
      console.log('\n미리보기입니다. 맞으면 --yes를 붙여 다시 실행하세요.');
      return;
    }

    const { recordAdminProgress } = await import('../lib/contracts/production/admin-record');
    const recorded = await recordAdminProgress(id, action, body, {
      actor: `admin:${process.env.CONTRACT_ACTOR ?? 'kyungha'} (scripts/contract-link.ts)`,
      ip: null,
    });
    if (!recorded.ok) {
      console.error(`기록하지 못했습니다(${recorded.status}): ${recorded.message}`);
      process.exit(1);
    }
    console.log(`\n기록했습니다 (기록 id ${recorded.event.id})`);
    if (spec.EVENT_SPEC[recorded.event.type].notifies) {
      // API는 응답 뒤(waitUntil)에 보내지만 스크립트는 끝나기 전에 보내고 결과를 확인한다.
      await progress.sendEventNotice(id, recorded.event.id);
      const after = (await progress.loadProgressContext(id))?.events.find((e) => e.id === recorded.event.id);
      console.log(
        after?.noticeStatus === 'sent'
          ? '의뢰인에게 통지 메일을 보냈습니다.'
          : `통지 메일이 나가지 않았습니다(${after?.noticeStatus}${after?.noticeError ? `: ${after.noticeError}` : ''}) — 관리자 화면에서 "통지 다시 보내기"를 누르세요.`,
      );
    }
    return;
  }

  console.error(USAGE);
  process.exit(1);
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
