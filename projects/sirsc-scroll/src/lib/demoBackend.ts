// A pretend Warden Chat for the demo builds (the claude.ai Artifact, and `vite build --mode demo` for
// tests). It answers the same requests lib/warden.ts and lib/social.ts send to Supabase, keeps its data
// in this browser, and never touches the network. Sign in with any username and a password of 4 or more
// characters; the username "banned" shows the banned screen. Made-up classmates comment on videos, and
// like and answer your comments a few seconds after you post, so notifications have something in them.
import type { HttpResult, Transport } from './warden';

interface DComment {
  id: number;
  video_id: string;
  user: string;
  parent_id: number | null;
  reply_to: string | null;
  body: string;
  at: number;
  likes: string[];
  deleted?: boolean;
}

interface DState {
  next: number;
  comments: DComment[];
  likes: Record<string, string[]>;
  seeded: string[];
  seen: Record<string, number>;
  reports: number[];
}

const KEY = 'sirsc-scroll:demo-backend';
const CLASSMATES = ['maya_k', 'jaylen.b', 'sofia-r', 'devon22', 'ari.p', 'noor_h', 'theo.m', 'lucia_v'];
const LINES = [
  'okay this is actually so good',
  'the ending got me',
  'how is nobody talking about this',
  'watched this 4 times already',
  'my teacher needs to see this',
  'part 2 please',
  'this is literally my brother',
  'no because why is this so accurate',
  'saving this for later',
  'the timing on this is perfect',
];
const REPLIES = ['fr', 'same honestly', 'LOL', 'wait you’re right', 'agreed', 'this ^'];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

let st: DState | null = null;
function state(): DState {
  if (st) return st;
  try {
    st = JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    st = null;
  }
  if (!st || typeof st.next !== 'number') st = { next: 1000, comments: [], likes: {}, seeded: [], seen: {}, reports: [] };
  return st;
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state()));
  } catch {
    /* fine */
  }
}

/** Some made-up comments the first time a video is asked about. */
function seed(video: string) {
  const s = state();
  if (s.seeded.includes(video)) return;
  s.seeded.push(video);
  const h = hash(video);
  const n = h % 6;
  const base = Date.now() - 3 * 86_400_000;
  for (let i = 0; i < n; i++) {
    const user = CLASSMATES[(h >>> (i + 2)) % CLASSMATES.length];
    const c: DComment = { id: s.next++, video_id: video, user, parent_id: null, reply_to: null, body: LINES[(h >>> i) % LINES.length], at: base + i * 3_600_000 + (h % 1000) * 1000, likes: CLASSMATES.slice(0, (h >>> (i * 3)) % 5) };
    s.comments.push(c);
    if ((h >>> (i + 5)) % 3 === 0) {
      const ru = CLASSMATES[(h >>> (i + 7)) % CLASSMATES.length];
      if (ru !== user) s.comments.push({ id: s.next++, video_id: video, user: ru, parent_id: c.id, reply_to: null, body: REPLIES[(h >>> i) % REPLIES.length], at: c.at + 1_800_000, likes: [] });
    }
  }
  s.likes[video] = CLASSMATES.slice(0, h % 7);
}

const ok = (data: unknown, status = 200): HttpResult => ({ status, data });
const fail = (message: string, status = 400): HttpResult => ({ status, data: { code: 'P0001', message } });

function userFromToken(headers: Record<string, string>): string | null {
  const m = /^Bearer demo\.([a-zA-Z0-9_.-]{3,24})\.\d+$/.exec(headers.Authorization ?? '');
  return m ? m[1] : null;
}

function idOf(user: string) {
  return `demo-${user.toLowerCase()}`;
}

function json(c: DComment, viewer: string) {
  const s = state();
  const top = c.parent_id == null ? null : s.comments.find((x) => x.id === c.parent_id);
  return {
    id: c.id,
    video_id: c.video_id,
    parent_id: c.parent_id,
    author: { id: idOf(c.user), username: c.user },
    reply_to: c.reply_to && top && c.reply_to !== top.user ? c.reply_to : null,
    body: c.body,
    created_at: new Date(c.at).toISOString(),
    likes: c.likes.length,
    liked: c.likes.includes(viewer),
    replies: c.parent_id == null ? s.comments.filter((r) => r.parent_id === c.id && !r.deleted).length : 0,
    mine: c.user === viewer,
  };
}

function visible(video: string): DComment[] {
  const s = state();
  const gone = new Set(s.comments.filter((c) => c.deleted).map((c) => c.id));
  return s.comments.filter((c) => c.video_id === video && !c.deleted && !(c.parent_id != null && gone.has(c.parent_id)));
}

/** Classmates react to your comment: a like after a few seconds, sometimes a reply. */
function react(c: DComment) {
  const s = state();
  const fan = CLASSMATES[hash(c.body) % CLASSMATES.length];
  window.setTimeout(() => {
    const cur = state().comments.find((x) => x.id === c.id);
    if (cur && !cur.deleted && !cur.likes.includes(fan)) {
      cur.likes.push(fan);
      save();
    }
  }, 3_000);
  window.setTimeout(() => {
    const cur = state().comments.find((x) => x.id === c.id);
    if (!cur || cur.deleted) return;
    const replier = CLASSMATES[(hash(c.body) >>> 3) % CLASSMATES.length];
    s.comments.push({ id: s.next++, video_id: c.video_id, user: replier, parent_id: c.parent_id ?? c.id, reply_to: c.user, body: REPLIES[hash(c.body) % REPLIES.length], at: Date.now(), likes: [] });
    save();
  }, 7_000);
}

function rpc(fn: string, b: Record<string, unknown>, user: string): HttpResult {
  const s = state();
  if (user.toLowerCase() === 'banned') return fail('scroll_not_signed_in');
  switch (fn) {
    case 'scroll_social_ping':
      return ok(true);
    case 'scroll_me':
      return ok({ id: idOf(user), username: user, banned: false, ban_reason: null, muted: false, notices_seen_at: s.seen[user] ? new Date(s.seen[user]).toISOString() : null });
    case 'scroll_social_counts': {
      const ids = (b.p_ids as string[]) ?? [];
      return ok(
        ids.map((v) => {
          seed(v);
          return { video_id: v, likes: (s.likes[v] ?? []).length, comments: visible(v).length, liked: (s.likes[v] ?? []).includes(user) };
        }),
      );
    }
    case 'scroll_like_set': {
      const v = String(b.p_video);
      seed(v);
      const list = (s.likes[v] ??= []);
      if (b.p_liked && !list.includes(user)) list.push(user);
      if (!b.p_liked) s.likes[v] = list.filter((x) => x !== user);
      save();
      return ok({ video_id: v, liked: !!b.p_liked, likes: s.likes[v].length });
    }
    case 'scroll_my_likes':
      return ok({ items: Object.entries(s.likes).filter(([, l]) => l.includes(user)).map(([video_id]) => ({ video_id, at: new Date().toISOString() })) });
    case 'scroll_comments_list': {
      const v = String(b.p_video);
      seed(v);
      const all = visible(v);
      const top = all.filter((c) => c.parent_id == null);
      top.sort((x, y) => (b.p_sort === 'top' ? y.likes.length - x.likes.length : 0) || y.at - x.at);
      const off = Number(b.p_offset) || 0;
      const lim = Number(b.p_limit) || 30;
      return ok({ video_id: v, sort: b.p_sort, offset: off, top_level: top.length, total: all.length, items: top.slice(off, off + lim).map((c) => json(c, user)) });
    }
    case 'scroll_comment_replies': {
      const parent = s.comments.find((c) => c.id === Number(b.p_parent) && !c.deleted);
      if (!parent) return fail('scroll_comment_gone');
      return ok({ parent_id: parent.id, items: s.comments.filter((c) => c.parent_id === parent.id && !c.deleted).sort((x, y) => x.at - y.at).map((c) => json(c, user)) });
    }
    case 'scroll_comment_post': {
      const body = String(b.p_body ?? '')
        .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      if (!body) return fail('scroll_comment_empty');
      if (body.length > 300) return fail('scroll_comment_too_long');
      const v = String(b.p_video);
      if (s.comments.some((c) => c.user === user && c.video_id === v && c.body === body && !c.deleted && Date.now() - c.at < 120_000)) return fail('scroll_duplicate');
      let parent: DComment | undefined;
      if (b.p_parent != null) {
        parent = s.comments.find((c) => c.id === Number(b.p_parent) && !c.deleted);
        if (!parent) return fail('scroll_comment_gone');
      }
      const c: DComment = { id: s.next++, video_id: v, user, parent_id: parent ? (parent.parent_id ?? parent.id) : null, reply_to: parent ? parent.user : null, body, at: Date.now(), likes: [] };
      s.comments.push(c);
      save();
      react(c);
      return ok(json(c, user));
    }
    case 'scroll_comment_delete': {
      const c = s.comments.find((x) => x.id === Number(b.p_id) && x.user === user && !x.deleted);
      if (c) {
        c.deleted = true;
        save();
      }
      return ok(!!c);
    }
    case 'scroll_comment_like_set': {
      const c = s.comments.find((x) => x.id === Number(b.p_id) && !x.deleted);
      if (!c) return fail('scroll_comment_gone');
      if (b.p_liked && !c.likes.includes(user)) c.likes.push(user);
      if (!b.p_liked) c.likes = c.likes.filter((x) => x !== user);
      save();
      return ok({ id: c.id, liked: !!b.p_liked, likes: c.likes.length });
    }
    case 'scroll_comment_report':
      s.reports.push(Number(b.p_id));
      save();
      return ok(true);
    case 'scroll_notifications': {
      const mine = s.comments.filter((c) => c.user === user && !c.deleted);
      const items: Record<string, unknown>[] = [];
      for (const c of s.comments) {
        if (c.deleted || c.user === user) continue;
        if (c.reply_to === user) items.push({ kind: 'reply', at: new Date(c.at).toISOString(), actor: { id: idOf(c.user), username: c.user }, video_id: c.video_id, comment_id: c.id, thread_id: c.parent_id ?? c.id, text: c.body });
      }
      for (const c of mine)
        c.likes.forEach((u, i) => {
          if (u !== user) items.push({ kind: 'comment_like', at: new Date(c.at + 3_000 + i).toISOString(), actor: { id: idOf(u), username: u }, video_id: c.video_id, comment_id: c.id, thread_id: c.parent_id ?? c.id, text: c.body });
        });
      items.sort((x, y) => String(y.at).localeCompare(String(x.at)));
      return ok({ seen_at: s.seen[user] ? new Date(s.seen[user]).toISOString() : null, items: items.slice(0, Number(b.p_limit) || 50) });
    }
    case 'scroll_notifications_seen': {
      const at = Math.min(Date.parse(String(b.p_at)) || Date.now(), Date.now());
      s.seen[user] = Math.max(s.seen[user] ?? 0, at);
      save();
      return ok(new Date(s.seen[user]).toISOString());
    }
    default:
      return { status: 404, data: { code: 'PGRST202', message: `Could not find the function public.${fn}` } };
  }
}

let tokenN = 0;
function session(user: string) {
  tokenN++;
  return {
    access_token: `demo.${user}.${tokenN}`,
    refresh_token: `demo-refresh.${user}.${tokenN}`,
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: idOf(user), email: `${user.toLowerCase()}@warden.invalid`, user_metadata: { username: user } },
  };
}

export const demoTransport: Transport = async (_method, url, headers, body) => {
  await new Promise((r) => setTimeout(r, 120));
  const u = new URL(url);
  const b = (body ?? {}) as Record<string, unknown>;
  if (u.pathname === '/auth/v1/token') {
    if (u.searchParams.get('grant_type') === 'password') {
      const user = String(b.email ?? '').split('@')[0];
      if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(user) || String(b.password ?? '').length < 4) return { status: 400, data: { error_code: 'invalid_credentials', msg: 'Invalid login credentials' } };
      return ok(session(user));
    }
    const m = /^demo-refresh\.([a-zA-Z0-9_.-]{3,24})\.\d+$/.exec(String(b.refresh_token ?? ''));
    return m ? ok(session(m[1])) : { status: 400, data: { error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' } };
  }
  if (u.pathname === '/auth/v1/logout') return ok(null, 204);
  const fn = u.pathname.replace('/rest/v1/rpc/', '');
  const user = userFromToken(headers);
  if (fn === 'my_account_state') {
    if (!user) return { status: 401, data: { message: 'JWT expired' } };
    return ok(user.toLowerCase() === 'banned' ? { active: false, status: 'banned', reason: 'This is the demo build’s pretend ban.', restrictedUntil: null } : { active: true, status: 'active' });
  }
  if (fn === 'scroll_social_ping') return ok(true);
  if (!user) return fail('scroll_not_signed_in');
  return rpc(fn, b, user);
};
