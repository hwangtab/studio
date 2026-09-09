#!/usr/bin/env node
/**
 * 받은 반응 보기·답하기 — Instagram 댓글, Threads 답글, Instagram DM.
 * 자동 답글은 없다. 전송은 항상 --reply / --dm-send 를 명시했을 때만.
 *
 *   node --env-file=.env.local scripts/social/inbox.mjs                 # 미답 댓글·답글 목록
 *   node --env-file=.env.local scripts/social/inbox.mjs --all           # 답한 것 포함
 *   node --env-file=.env.local scripts/social/inbox.mjs --reply ig:<comment_id> --text "…"
 *   node --env-file=.env.local scripts/social/inbox.mjs --reply threads:<reply_id> --text "…"
 *   node --env-file=.env.local scripts/social/inbox.mjs --dm            # IG 대화 목록 + 최근 메시지
 *   node --env-file=.env.local scripts/social/inbox.mjs --dm-send <igsid> --text "…"
 *
 * Threads에는 DM API가 없다. IG DM은 상대가 먼저 보낸 뒤 24시간 안에만 답할 수 있다.
 */
import { graph, requireEnv, hintForError, sleep, PLATFORMS, ensureFreshTokens } from './meta.mjs';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const showAll = args.includes('--all');
const MEDIA_LIMIT = Number(flag('--limit') ?? 15);
const me = { ig: process.env.INSTAGRAM_USER_ID, threads: process.env.THREADS_USER_ID };

const fmtTime = (iso) => iso?.replace('T', ' ').replace(/\+0000$/, 'Z').slice(0, 16) ?? '';

async function igComments() {
  const media = await graph('ig', 'GET', '/me/media', {
    fields: 'id,permalink,caption,comments_count', limit: MEDIA_LIMIT,
  });
  const out = [];
  for (const m of media.data.filter((x) => x.comments_count > 0)) {
    const { data } = await graph('ig', 'GET', `/${m.id}/comments`, {
      fields: 'id,text,username,timestamp,from,replies{id,text,from}', limit: 50,
    });
    for (const c of data) {
      if (c.from?.id === me.ig) continue; // 내 댓글
      const answered = (c.replies?.data ?? []).some((r) => r.from?.id === me.ig);
      if (answered && !showAll) continue;
      out.push({ platform: 'ig', id: c.id, user: c.username ?? c.from?.username, text: c.text, at: c.timestamp, post: m.permalink, answered });
    }
  }
  return out;
}

async function threadsReplies() {
  const posts = await graph('threads', 'GET', '/me/threads', { fields: 'id,permalink,text', limit: MEDIA_LIMIT });
  // 답글 객체는 자손을 안 보여준다(children 빈 배열 실측). 내가 쓴 답글 목록의 replied_to로 판정.
  const mine = await graph('threads', 'GET', '/me/replies', { fields: 'replied_to', limit: 100 });
  const repliedTo = new Set((mine.data ?? []).map((r) => r.replied_to?.id).filter(Boolean));
  const out = [];
  for (const p of posts.data) {
    const { data } = await graph('threads', 'GET', `/${p.id}/replies`, {
      fields: 'id,text,username,timestamp,is_reply_owned_by_me',
    });
    for (const r of data) {
      if (r.is_reply_owned_by_me) continue;
      const answered = repliedTo.has(r.id);
      if (answered && !showAll) continue;
      out.push({ platform: 'threads', id: r.id, user: r.username, text: r.text, at: r.timestamp, post: p.permalink, answered });
    }
  }
  return out;
}

async function listInbox() {
  const items = [...(await igComments()), ...(await threadsReplies())].sort((a, b) => (a.at < b.at ? 1 : -1));
  if (items.length === 0) { console.log(showAll ? '댓글·답글 없음' : '미답 댓글·답글 없음'); return; }
  for (const i of items) {
    console.log(`\n[${PLATFORMS[i.platform].label}] ${fmtTime(i.at)} @${i.user}${i.answered ? ' (답함)' : ''}\n  ${i.text?.replace(/\n/g, '\n  ')}\n  ↳ ${i.post}\n  답글: --reply ${i.platform}:${i.id} --text "…"`);
  }
}

async function reply(target, text) {
  const [platform, id] = target.split(':');
  if (!PLATFORMS[platform] || !id || !text) throw new Error('--reply <ig|threads>:<id> --text "…" 형식');
  if (platform === 'ig') {
    const r = await graph('ig', 'POST', `/${id}/replies`, { message: text });
    console.log(`[Instagram] 답글 게시 ${r.id}`);
    return;
  }
  const userId = requireEnv(PLATFORMS.threads.userIdKey);
  const { id: creationId } = await graph('threads', 'POST', `/${userId}/threads`, { media_type: 'TEXT', text, reply_to_id: id });
  await sleep(5000);
  const r = await graph('threads', 'POST', `/${userId}/threads_publish`, { creation_id: creationId });
  console.log(`[Threads] 답글 게시 ${r.id}`);
}

async function listDm() {
  const { data } = await graph('ig', 'GET', '/me/conversations', {
    platform: 'instagram', fields: 'id,updated_time,participants,messages.limit(3){id,from,message,created_time}', limit: 20,
  });
  if (!data?.length) { console.log('대화 없음'); return; }
  for (const c of data) {
    const other = (c.participants?.data ?? []).find((p) => p.id !== me.ig);
    console.log(`\n@${other?.username ?? '?'} (igsid ${other?.id})  ${fmtTime(c.updated_time)}`);
    for (const m of [...(c.messages?.data ?? [])].reverse()) {
      const who = m.from?.id === me.ig ? '나' : `@${m.from?.username ?? '?'}`;
      console.log(`  ${fmtTime(m.created_time)} ${who}: ${m.message ?? '(첨부)'}`);
    }
    if (other?.id) console.log(`  답장: --dm-send ${other.id} --text "…"`);
  }
}

async function sendDm(igsid, text) {
  if (!igsid || !text) throw new Error('--dm-send <igsid> --text "…" 형식');
  const r = await graph('ig', 'POST', '/me/messages', {
    recipient: JSON.stringify({ id: igsid }), message: JSON.stringify({ text }),
  });
  console.log(`[Instagram] DM 전송 ${r.message_id ?? JSON.stringify(r)}`);
}

try {
  const used = flag('--reply') ? [flag('--reply').split(':')[0]] : flag('--dm-send') || args.includes('--dm') ? ['ig'] : ['ig', 'threads'];
  await ensureFreshTokens(used.filter((x) => PLATFORMS[x]));
  if (flag('--reply')) await reply(flag('--reply'), flag('--text'));
  else if (flag('--dm-send')) await sendDm(flag('--dm-send'), flag('--text'));
  else if (args.includes('--dm')) await listDm();
  else await listInbox();
} catch (err) {
  console.error(`실패: ${err.message}`);
  const hint = hintForError(err);
  if (hint) console.error(hint);
  process.exit(1);
}
