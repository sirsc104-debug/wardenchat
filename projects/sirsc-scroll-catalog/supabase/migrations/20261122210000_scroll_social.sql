-- SirSC Scroll: likes and comments for Warden Chat accounts.
--
-- People sign in to SirSC Scroll with their Warden Chat account (Supabase Auth, the same project).
-- Everything below lives in scroll_private, which the API doesn't expose: no table is granted to anon
-- or authenticated, and every read and write goes through the public scroll_* functions at the end.
--
-- Rules, all enforced here:
--   * Only signed-in, active Warden Chat accounts (warden_private.game_session_valid: not suspended or
--     banned, session still valid). Anything else gets 'scroll_not_signed_in'.
--   * Likes and comments only on approved, active catalog videos.
--   * Comments: 1-300 characters, control characters removed, at most two blank lines in a row,
--     replies one level deep (a reply to a reply joins the same thread), no exact repeats within two
--     minutes, at most 6 a minute and 150 a day.
--   * Warden Chat's own rules carry over: an account an admin muted can't comment, comments from
--     suspended or banned accounts are hidden, and two people who blocked each other on Warden Chat
--     don't see each other's comments and can't reply to each other.
--   * The owner moderates with the review key (Vault 'scroll_review_key', the one the review page uses):
--     see reported comments, remove or restore them, and stop an account from liking and commenting on
--     SirSC Scroll. People can delete their own comments; deleted comments are hidden from everyone but
--     kept so the owner can still see what was said.

-- ---------------------------------------------------------------- tables

create table scroll_private.video_likes (
  video_id   text not null references public.scroll_videos(video_id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (video_id, user_id)
);
create index video_likes_user_idx on scroll_private.video_likes (user_id, created_at desc);

create table scroll_private.comments (
  id            bigint generated always as identity primary key,
  video_id      text not null references public.scroll_videos(video_id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  -- Top-level comment this one replies to (replies are one level deep).
  parent_id     bigint references scroll_private.comments(id) on delete cascade,
  -- Whose comment it answers: the parent's author, or the author of the reply it answers.
  reply_to_user uuid references auth.users(id) on delete set null,
  body          text not null check (char_length(body) between 1 and 300),
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  deleted_by    text check (deleted_by in ('author', 'owner')),
  check ((deleted_at is null) = (deleted_by is null))
);
create index comments_video_idx on scroll_private.comments (video_id, created_at desc) where deleted_at is null;
create index comments_parent_idx on scroll_private.comments (parent_id, created_at) where parent_id is not null;
create index comments_user_idx on scroll_private.comments (user_id, created_at desc);
create index comments_reply_to_idx on scroll_private.comments (reply_to_user, created_at desc) where reply_to_user is not null;
create index comments_recent_idx on scroll_private.comments (created_at desc);

create table scroll_private.comment_likes (
  comment_id bigint not null references scroll_private.comments(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create index comment_likes_user_idx on scroll_private.comment_likes (user_id);

create table scroll_private.comment_reports (
  comment_id  bigint not null references scroll_private.comments(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  reason      text not null check (reason in ('bullying', 'hate', 'inappropriate', 'spam', 'other')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  primary key (comment_id, user_id)
);
create index comment_reports_open_idx on scroll_private.comment_reports (comment_id) where resolved_at is null;

-- Accounts the owner stopped from liking and commenting (their comments are hidden too).
create table scroll_private.social_bans (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  reason     text check (char_length(reason) <= 200),
  created_at timestamptz not null default now()
);

-- Rate limiting: one row per counted action, pruned after a day.
create table scroll_private.social_events (
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null,
  created_at timestamptz not null default clock_timestamp()
);
create index social_events_idx on scroll_private.social_events (user_id, kind, created_at);

-- When each person last opened their notifications.
create table scroll_private.notices_seen (
  user_id uuid primary key references auth.users(id) on delete cascade,
  seen_at timestamptz not null
);

create table scroll_private.mod_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  action      text not null,
  comment_ids bigint[],
  user_id     uuid,
  note        text
);

do $$
declare t text;
begin
  foreach t in array array['video_likes', 'comments', 'comment_likes', 'comment_reports', 'social_bans', 'social_events', 'notices_seen', 'mod_log'] loop
    execute format('alter table scroll_private.%I enable row level security', t);
    execute format('revoke all on scroll_private.%I from public, anon, authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- helpers (not callable through the API)

-- The signed-in Warden Chat account, or 'scroll_not_signed_in' (no session, expired, suspended, banned).
create or replace function scroll_private.social_uid()
returns uuid language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not coalesce(warden_private.game_session_valid(), false) then
    raise exception 'scroll_not_signed_in' using errcode = 'P0001';
  end if;
  return auth.uid();
end $$;

-- Someone who may like and comment: signed in and not stopped by the owner.
create or replace function scroll_private.social_writer()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := scroll_private.social_uid();
begin
  if exists (select 1 from scroll_private.social_bans b where b.user_id = v_uid) then
    raise exception 'scroll_banned' using errcode = 'P0001';
  end if;
  return v_uid;
end $$;

-- Whether this author's comments show: active Warden Chat account, not stopped on SirSC Scroll.
create or replace function scroll_private.author_visible(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
      select 1 from warden_private.account_state s
      where s.user_id = p_user and (s.status = 'active' or (s.status = 'suspended' and s.restricted_until <= now())))
    and not exists (select 1 from scroll_private.social_bans b where b.user_id = p_user)
$$;

-- Likes and comments are open on approved, active catalog videos only.
create or replace function scroll_private.video_open(p_video text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.scroll_videos v where v.video_id = p_video and v.is_active and v.review_status = 'approved')
$$;

-- Comments on a video that everyone can see (blocks aside): not deleted, author visible, thread intact.
create or replace function scroll_private.comment_total(p_video text)
returns bigint language sql stable security definer set search_path = '' as $$
  select count(*) from scroll_private.comments c
  where c.video_id = p_video and c.deleted_at is null and scroll_private.author_visible(c.user_id)
    and (c.parent_id is null or exists (
      select 1 from scroll_private.comments t where t.id = c.parent_id and t.deleted_at is null and scroll_private.author_visible(t.user_id)))
$$;

-- At most p_burst actions per p_burst_per and p_day per day, per person and kind.
create or replace function scroll_private.rate(p_user uuid, p_kind text, p_burst int, p_burst_per interval, p_day int)
returns void language plpgsql security definer set search_path = '' as $$
declare stamp timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || ':' || p_kind, 50217));
  stamp := clock_timestamp();
  if (select count(*) from scroll_private.social_events e
      where e.user_id = p_user and e.kind = p_kind and e.created_at > stamp - p_burst_per) >= p_burst
    or (select count(*) from scroll_private.social_events e
      where e.user_id = p_user and e.kind = p_kind and e.created_at > stamp - interval '1 day') >= p_day then
    raise exception 'scroll_rate_limited' using errcode = 'P0001';
  end if;
  delete from scroll_private.social_events e where e.user_id = p_user and e.kind = p_kind and e.created_at <= stamp - interval '1 day';
  insert into scroll_private.social_events (user_id, kind, created_at) values (p_user, p_kind, stamp);
end $$;

create or replace function scroll_private.username(p_user uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select p.username from public.profiles p where p.id = p_user), 'unknown')
$$;

-- One comment as the browser sees it.
create or replace function scroll_private.comment_json(c scroll_private.comments, p_viewer uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id,
    'video_id', c.video_id,
    'parent_id', c.parent_id,
    'author', jsonb_build_object('id', c.user_id, 'username', scroll_private.username(c.user_id)),
    -- Only for a reply to a reply: whose reply it answers.
    'reply_to', case when c.parent_id is not null and c.reply_to_user is not null
      and c.reply_to_user is distinct from (select t.user_id from scroll_private.comments t where t.id = c.parent_id)
      then scroll_private.username(c.reply_to_user) end,
    'body', c.body,
    'created_at', c.created_at,
    'likes', (select count(*) from scroll_private.comment_likes l where l.comment_id = c.id),
    'liked', exists (select 1 from scroll_private.comment_likes l where l.comment_id = c.id and l.user_id = p_viewer),
    'replies', case when c.parent_id is null then (
      select count(*) from scroll_private.comments r
      where r.parent_id = c.id and r.deleted_at is null and scroll_private.author_visible(r.user_id)
        and not warden_private.pair_blocked(p_viewer, r.user_id)) else 0 end,
    'mine', c.user_id = p_viewer)
$$;

-- A comment the viewer may see and act on, or 'scroll_comment_gone'.
create or replace function scroll_private.visible_comment(p_id bigint, p_viewer uuid)
returns scroll_private.comments language plpgsql stable security definer set search_path = '' as $$
declare c scroll_private.comments;
begin
  select * into c from scroll_private.comments where id = p_id;
  if not found or c.deleted_at is not null or not scroll_private.author_visible(c.user_id)
    or warden_private.pair_blocked(p_viewer, c.user_id) or not scroll_private.video_open(c.video_id)
    or (c.parent_id is not null and not exists (
      select 1 from scroll_private.comments t where t.id = c.parent_id and t.deleted_at is null and scroll_private.author_visible(t.user_id))) then
    raise exception 'scroll_comment_gone' using errcode = 'P0001';
  end if;
  return c;
end $$;

create or replace function scroll_private.review_key_check(p_key text)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not scroll_private.review_ok(p_key) then
    raise exception 'Review key required' using errcode = '42501';
  end if;
end $$;

-- ---------------------------------------------------------------- the API

-- So the app can tell this migration is deployed.
create or replace function public.scroll_social_ping()
returns boolean language sql security definer set search_path = '' as $$ select true $$;

-- Who is signed in, and whether they can like and comment here.
create or replace function public.scroll_me()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := scroll_private.social_uid();
begin
  return (select jsonb_build_object(
    'id', v_uid,
    'username', scroll_private.username(v_uid),
    'banned', b.user_id is not null,
    'ban_reason', b.reason,
    'muted', coalesce(s.muted_by_admin, false),
    'notices_seen_at', n.seen_at)
  from (select 1) one
  left join scroll_private.social_bans b on b.user_id = v_uid
  left join warden_private.account_state s on s.user_id = v_uid
  left join scroll_private.notices_seen n on n.user_id = v_uid);
end $$;

-- Like and comment counts (and whether you liked) for up to 200 videos. Videos that aren't open for
-- likes and comments (not approved yet, or gone) are left out.
create or replace function public.scroll_social_counts(p_ids text[])
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := scroll_private.social_uid();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'video_id', v.video_id,
      'likes', (select count(*) from scroll_private.video_likes l where l.video_id = v.video_id),
      'comments', scroll_private.comment_total(v.video_id),
      'liked', exists (select 1 from scroll_private.video_likes l where l.video_id = v.video_id and l.user_id = v_uid)))
    from public.scroll_videos v
    where v.video_id = any (coalesce(p_ids[1:200], '{}')) and v.is_active and v.review_status = 'approved'
  ), '[]'::jsonb);
end $$;

-- Like or unlike a video. Returns the new state and count.
create or replace function public.scroll_like_set(p_video text, p_liked boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := scroll_private.social_uid();
begin
  if p_liked is null then raise exception 'scroll_bad_request' using errcode = 'P0001'; end if;
  if p_liked then
    -- Stopped accounts can still take a like back, but not add one.
    perform scroll_private.social_writer();
    if not scroll_private.video_open(p_video) then raise exception 'scroll_video_unavailable' using errcode = 'P0001'; end if;
    if not exists (select 1 from scroll_private.video_likes where video_id = p_video and user_id = v_uid) then
      perform scroll_private.rate(v_uid, 'like', 60, interval '1 minute', 2000);
      insert into scroll_private.video_likes (video_id, user_id) values (p_video, v_uid) on conflict do nothing;
    end if;
  else
    delete from scroll_private.video_likes where video_id = p_video and user_id = v_uid;
  end if;
  return jsonb_build_object('video_id', p_video, 'liked', p_liked,
    'likes', (select count(*) from scroll_private.video_likes l where l.video_id = p_video));
end $$;

-- Videos you liked, newest first (approved and active only), for your profile and recommendations.
create or replace function public.scroll_my_likes(p_limit int default 500)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := scroll_private.social_uid();
begin
  return jsonb_build_object('items', coalesce((
    select jsonb_agg(jsonb_build_object('video_id', x.video_id, 'at', x.created_at) order by x.created_at desc)
    from (
      select l.video_id, l.created_at from scroll_private.video_likes l
      join public.scroll_videos v on v.video_id = l.video_id and v.is_active and v.review_status = 'approved'
      where l.user_id = v_uid order by l.created_at desc limit least(greatest(coalesce(p_limit, 500), 1), 1000)
    ) x), '[]'::jsonb));
end $$;

-- Top-level comments on a video. sort: 'top' (most liked) or 'new'. Replies load with scroll_comment_replies.
create or replace function public.scroll_comments_list(p_video text, p_sort text default 'top', p_offset int default 0, p_limit int default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := scroll_private.social_uid();
  v_lim int := least(greatest(coalesce(p_limit, 30), 1), 50);
  v_off int := greatest(coalesce(p_offset, 0), 0);
  v_ids bigint[];
  v_top bigint;
begin
  if p_sort is null or p_sort not in ('top', 'new') then raise exception 'scroll_bad_request' using errcode = 'P0001'; end if;
  if not scroll_private.video_open(p_video) then raise exception 'scroll_video_unavailable' using errcode = 'P0001'; end if;
  select count(*) into v_top from scroll_private.comments c
  where c.video_id = p_video and c.parent_id is null and c.deleted_at is null
    and scroll_private.author_visible(c.user_id) and not warden_private.pair_blocked(v_uid, c.user_id);
  select array_agg(x.id order by x.rn) into v_ids from (
    select c.id, row_number() over (order by
      case when p_sort = 'top' then (select count(*) from scroll_private.comment_likes l where l.comment_id = c.id) end desc nulls last,
      c.created_at desc, c.id desc) as rn
    from scroll_private.comments c
    where c.video_id = p_video and c.parent_id is null and c.deleted_at is null
      and scroll_private.author_visible(c.user_id) and not warden_private.pair_blocked(v_uid, c.user_id)
    order by rn offset v_off limit v_lim) x;
  return jsonb_build_object(
    'video_id', p_video, 'sort', p_sort, 'offset', v_off,
    'top_level', v_top,
    'total', scroll_private.comment_total(p_video),
    'items', coalesce((
      select jsonb_agg(scroll_private.comment_json(c, v_uid) order by o.n)
      from unnest(coalesce(v_ids, '{}')) with ordinality o(id, n)
      join scroll_private.comments c on c.id = o.id), '[]'::jsonb));
end $$;

-- Replies in one thread, oldest first.
create or replace function public.scroll_comment_replies(p_parent bigint, p_offset int default 0, p_limit int default 50)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := scroll_private.social_uid();
  v_parent scroll_private.comments := scroll_private.visible_comment(p_parent, v_uid);
begin
  if v_parent.parent_id is not null then raise exception 'scroll_bad_request' using errcode = 'P0001'; end if;
  return jsonb_build_object('parent_id', p_parent, 'items', coalesce((
    select jsonb_agg(scroll_private.comment_json(c, v_uid) order by c.created_at, c.id)
    from scroll_private.comments c
    where c.id in (
      select r.id from scroll_private.comments r
      where r.parent_id = p_parent and r.deleted_at is null and scroll_private.author_visible(r.user_id)
        and not warden_private.pair_blocked(v_uid, r.user_id)
      order by r.created_at, r.id
      offset greatest(coalesce(p_offset, 0), 0) limit least(greatest(coalesce(p_limit, 50), 1), 100))), '[]'::jsonb));
end $$;

-- Post a comment, or a reply (p_parent: the comment you're answering; a reply to a reply joins its thread).
create or replace function public.scroll_comment_post(p_video text, p_body text, p_parent bigint default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := scroll_private.social_writer();
  v_body text;
  v_parent scroll_private.comments;
  v_top bigint;
  v_reply_to uuid;
  v_row scroll_private.comments;
begin
  if exists (select 1 from warden_private.account_state s where s.user_id = v_uid and s.muted_by_admin) then
    raise exception 'scroll_muted' using errcode = 'P0001';
  end if;
  if not scroll_private.video_open(p_video) then raise exception 'scroll_video_unavailable' using errcode = 'P0001'; end if;
  v_body := btrim(regexp_replace(public.strip_control_chars(coalesce(p_body, ''), true), E'\n{3,}', E'\n\n', 'g'), E' \t\n');
  if v_body = '' then raise exception 'scroll_comment_empty' using errcode = 'P0001'; end if;
  if char_length(v_body) > 300 then raise exception 'scroll_comment_too_long' using errcode = 'P0001'; end if;
  if p_parent is not null then
    select * into v_parent from scroll_private.comments where id = p_parent;
    if found and warden_private.pair_blocked(v_uid, v_parent.user_id) then
      raise exception 'scroll_blocked' using errcode = 'P0001';
    end if;
    v_parent := scroll_private.visible_comment(p_parent, v_uid);
    if v_parent.video_id <> p_video then raise exception 'scroll_bad_request' using errcode = 'P0001'; end if;
    v_top := coalesce(v_parent.parent_id, v_parent.id);
    v_reply_to := v_parent.user_id;
  end if;
  if exists (select 1 from scroll_private.comments c where c.user_id = v_uid and c.video_id = p_video
      and c.body = v_body and c.deleted_at is null and c.created_at > now() - interval '2 minutes') then
    raise exception 'scroll_duplicate' using errcode = 'P0001';
  end if;
  perform scroll_private.rate(v_uid, 'comment', 6, interval '1 minute', 150);
  insert into scroll_private.comments (video_id, user_id, parent_id, reply_to_user, body)
  values (p_video, v_uid, v_top, v_reply_to, v_body) returning * into v_row;
  return scroll_private.comment_json(v_row, v_uid);
end $$;

-- Delete one of your own comments (its replies go with it).
create or replace function public.scroll_comment_delete(p_id bigint)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := scroll_private.social_uid();
begin
  update scroll_private.comments set deleted_at = now(), deleted_by = 'author'
  where id = p_id and user_id = v_uid and deleted_at is null;
  return found;
end $$;

-- Like or unlike a comment.
create or replace function public.scroll_comment_like_set(p_id bigint, p_liked boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := scroll_private.social_uid(); v_c scroll_private.comments;
begin
  if p_liked is null then raise exception 'scroll_bad_request' using errcode = 'P0001'; end if;
  if p_liked then
    perform scroll_private.social_writer();
    v_c := scroll_private.visible_comment(p_id, v_uid);
    if not exists (select 1 from scroll_private.comment_likes where comment_id = v_c.id and user_id = v_uid) then
      perform scroll_private.rate(v_uid, 'comment_like', 60, interval '1 minute', 2000);
      insert into scroll_private.comment_likes (comment_id, user_id) values (v_c.id, v_uid) on conflict do nothing;
    end if;
  else
    delete from scroll_private.comment_likes where comment_id = p_id and user_id = v_uid;
  end if;
  return jsonb_build_object('id', p_id, 'liked', p_liked,
    'likes', (select count(*) from scroll_private.comment_likes l where l.comment_id = p_id));
end $$;

-- Report someone else's comment to the owner.
create or replace function public.scroll_comment_report(p_id bigint, p_reason text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := scroll_private.social_uid(); v_c scroll_private.comments;
begin
  if p_reason is null or p_reason not in ('bullying', 'hate', 'inappropriate', 'spam', 'other') then
    raise exception 'scroll_bad_request' using errcode = 'P0001';
  end if;
  v_c := scroll_private.visible_comment(p_id, v_uid);
  if v_c.user_id = v_uid then raise exception 'scroll_bad_request' using errcode = 'P0001'; end if;
  perform scroll_private.rate(v_uid, 'report', 10, interval '10 minutes', 40);
  insert into scroll_private.comment_reports (comment_id, user_id, reason) values (v_c.id, v_uid, p_reason)
  on conflict (comment_id, user_id) do update set reason = excluded.reason, created_at = now(), resolved_at = null;
  return true;
end $$;

-- Your notifications from the last 30 days: replies to your comments, @mentions, likes on your comments.
create or replace function public.scroll_notifications(p_limit int default 50)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := scroll_private.social_uid();
  v_name text := scroll_private.username(v_uid);
  v_re text := '(^|[^a-z0-9_.-])@' || regexp_replace(lower(v_name), '([.\-])', '\\\1', 'g') || '($|[^a-z0-9_.-])';
  v_since timestamptz := now() - interval '30 days';
  v_lim int := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  return jsonb_build_object(
    'seen_at', (select n.seen_at from scroll_private.notices_seen n where n.user_id = v_uid),
    'items', coalesce((
      select jsonb_agg(to_jsonb(x) - 'actor_id' || jsonb_build_object('actor', jsonb_build_object('id', x.actor_id, 'username', scroll_private.username(x.actor_id))) order by x.at desc)
      from (
        select * from (
          -- replies to you
          select 'reply' as kind, c.created_at as at, c.user_id as actor_id, c.video_id, c.id as comment_id,
                 coalesce(c.parent_id, c.id) as thread_id, c.body as text
          from scroll_private.comments c
          where c.reply_to_user = v_uid and c.user_id <> v_uid and c.created_at > v_since
          union all
          -- @mentions that aren't already replies to you
          select 'mention', c.created_at, c.user_id, c.video_id, c.id, coalesce(c.parent_id, c.id), c.body
          from scroll_private.comments c
          where c.created_at > v_since and c.user_id <> v_uid and c.reply_to_user is distinct from v_uid
            and c.body ilike '%@%' and lower(c.body) ~ v_re
          union all
          -- likes on your comments
          select 'comment_like', l.created_at, l.user_id, c.video_id, c.id, coalesce(c.parent_id, c.id), c.body
          from scroll_private.comment_likes l join scroll_private.comments c on c.id = l.comment_id
          where c.user_id = v_uid and l.user_id <> v_uid and l.created_at > v_since and c.deleted_at is null
        ) all_items
        where scroll_private.author_visible(all_items.actor_id)
          and not warden_private.pair_blocked(v_uid, all_items.actor_id)
          and scroll_private.video_open(all_items.video_id)
          and exists (select 1 from scroll_private.comments c where c.id = all_items.comment_id and c.deleted_at is null)
          and exists (select 1 from scroll_private.comments t where t.id = all_items.thread_id and t.deleted_at is null)
        order by at desc limit v_lim
      ) x), '[]'::jsonb));
end $$;

-- Mark notifications up to p_at as seen.
create or replace function public.scroll_notifications_seen(p_at timestamptz default now())
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := scroll_private.social_uid(); v_at timestamptz := least(coalesce(p_at, now()), now());
begin
  insert into scroll_private.notices_seen (user_id, seen_at) values (v_uid, v_at)
  on conflict (user_id) do update set seen_at = greatest(scroll_private.notices_seen.seen_at, excluded.seen_at);
  return (select n.seen_at from scroll_private.notices_seen n where n.user_id = v_uid);
end $$;

-- ---------------------------------------------------------------- moderation (owner, review key)

-- p_view: 'reported' (open reports first), 'recent' (every comment, newest first), 'removed'.
create or replace function public.scroll_mod_comments(p_key text, p_view text default 'reported', p_offset int default 0, p_limit int default 50)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_ids bigint[]; v_total bigint;
begin
  perform scroll_private.review_key_check(p_key);
  if p_view is null or p_view not in ('reported', 'recent', 'removed') then raise exception 'scroll_bad_request' using errcode = 'P0001'; end if;
  select count(*) into v_total from scroll_private.comments c
  where case p_view
    when 'reported' then c.deleted_at is null and exists (select 1 from scroll_private.comment_reports r where r.comment_id = c.id and r.resolved_at is null)
    when 'recent' then c.deleted_at is null
    else c.deleted_at is not null end;
  select array_agg(x.id order by x.rn) into v_ids from (
    select c.id, row_number() over (order by
      case when p_view = 'reported' then (select count(*) from scroll_private.comment_reports r where r.comment_id = c.id and r.resolved_at is null) end desc nulls last,
      case when p_view = 'removed' then c.deleted_at end desc nulls last,
      c.created_at desc, c.id desc) as rn
    from scroll_private.comments c
    where case p_view
      when 'reported' then c.deleted_at is null and exists (select 1 from scroll_private.comment_reports r where r.comment_id = c.id and r.resolved_at is null)
      when 'recent' then c.deleted_at is null
      else c.deleted_at is not null end
    order by rn offset greatest(coalesce(p_offset, 0), 0) limit least(greatest(coalesce(p_limit, 50), 1), 200)) x;
  return jsonb_build_object(
    'view', p_view,
    'total', v_total,
    'offset', greatest(coalesce(p_offset, 0), 0),
    'counts', jsonb_build_object(
      'reported', (select count(distinct r.comment_id) from scroll_private.comment_reports r join scroll_private.comments c on c.id = r.comment_id where r.resolved_at is null and c.deleted_at is null),
      'recent', (select count(*) from scroll_private.comments c where c.deleted_at is null),
      'removed', (select count(*) from scroll_private.comments c where c.deleted_at is not null)),
    'banned', coalesce((select jsonb_agg(jsonb_build_object('id', b.user_id, 'username', scroll_private.username(b.user_id), 'reason', b.reason, 'at', b.created_at) order by b.created_at desc)
      from scroll_private.social_bans b), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'video_id', c.video_id,
        'video_title', (select v.title from public.scroll_videos v where v.video_id = c.video_id),
        'parent_id', c.parent_id,
        'author', jsonb_build_object('id', c.user_id, 'username', scroll_private.username(c.user_id)),
        'author_banned', exists (select 1 from scroll_private.social_bans b where b.user_id = c.user_id),
        'body', c.body, 'created_at', c.created_at, 'deleted_at', c.deleted_at, 'deleted_by', c.deleted_by,
        'likes', (select count(*) from scroll_private.comment_likes l where l.comment_id = c.id),
        'reports', (select count(*) from scroll_private.comment_reports r where r.comment_id = c.id and r.resolved_at is null),
        'reasons', coalesce((select jsonb_object_agg(g.reason, g.n) from (
          select r.reason, count(*) as n from scroll_private.comment_reports r
          where r.comment_id = c.id and r.resolved_at is null group by r.reason) g), '{}'::jsonb))
        order by o.n)
      from unnest(coalesce(v_ids, '{}')) with ordinality o(id, n)
      join scroll_private.comments c on c.id = o.id), '[]'::jsonb));
end $$;

-- p_action: 'remove' (hide from everyone), 'restore' (undo a removal by the owner), 'dismiss' (close reports).
create or replace function public.scroll_mod_set(p_key text, p_ids bigint[], p_action text)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  perform scroll_private.review_key_check(p_key);
  if p_ids is null or cardinality(p_ids) = 0 or cardinality(p_ids) > 500 or p_action is null or p_action not in ('remove', 'restore', 'dismiss') then
    raise exception 'scroll_bad_request' using errcode = 'P0001';
  end if;
  if p_action = 'remove' then
    update scroll_private.comments set deleted_at = now(), deleted_by = 'owner' where id = any (p_ids) and deleted_at is null;
    get diagnostics v_n = row_count;
    update scroll_private.comment_reports set resolved_at = now() where comment_id = any (p_ids) and resolved_at is null;
  elsif p_action = 'restore' then
    update scroll_private.comments set deleted_at = null, deleted_by = null where id = any (p_ids) and deleted_by = 'owner';
    get diagnostics v_n = row_count;
  else
    update scroll_private.comment_reports set resolved_at = now() where comment_id = any (p_ids) and resolved_at is null;
    get diagnostics v_n = row_count;
  end if;
  insert into scroll_private.mod_log (action, comment_ids) values (p_action, p_ids);
  return v_n;
end $$;

-- Stop (or allow again) an account liking and commenting on SirSC Scroll. Their comments are hidden while stopped.
create or replace function public.scroll_mod_ban(p_key text, p_user uuid, p_banned boolean, p_reason text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform scroll_private.review_key_check(p_key);
  if p_user is null or p_banned is null then raise exception 'scroll_bad_request' using errcode = 'P0001'; end if;
  if p_banned then
    insert into scroll_private.social_bans (user_id, reason) values (p_user, left(nullif(btrim(p_reason), ''), 200))
    on conflict (user_id) do update set reason = excluded.reason;
  else
    delete from scroll_private.social_bans where user_id = p_user;
  end if;
  insert into scroll_private.mod_log (action, user_id, note) values (case when p_banned then 'ban' else 'unban' end, p_user, p_reason);
  return p_banned;
end $$;

-- ---------------------------------------------------------------- grants

do $$
declare f text;
begin
  -- Helpers: nobody calls these through the API.
  foreach f in array array[
    'scroll_private.social_uid()', 'scroll_private.social_writer()', 'scroll_private.author_visible(uuid)',
    'scroll_private.video_open(text)', 'scroll_private.comment_total(text)', 'scroll_private.rate(uuid,text,int,interval,int)',
    'scroll_private.username(uuid)', 'scroll_private.comment_json(scroll_private.comments,uuid)',
    'scroll_private.visible_comment(bigint,uuid)', 'scroll_private.review_key_check(text)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  -- Signed-in people (the functions check the session themselves).
  foreach f in array array[
    'public.scroll_me()', 'public.scroll_social_counts(text[])', 'public.scroll_like_set(text,boolean)',
    'public.scroll_my_likes(int)', 'public.scroll_comments_list(text,text,int,int)', 'public.scroll_comment_replies(bigint,int,int)',
    'public.scroll_comment_post(text,text,bigint)', 'public.scroll_comment_delete(bigint)', 'public.scroll_comment_like_set(bigint,boolean)',
    'public.scroll_comment_report(bigint,text)', 'public.scroll_notifications(int)', 'public.scroll_notifications_seen(timestamptz)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  -- The ping, and the owner's moderation (guarded by the review key, like the review page).
  foreach f in array array[
    'public.scroll_social_ping()', 'public.scroll_mod_comments(text,text,int,int)',
    'public.scroll_mod_set(text,bigint[],text)', 'public.scroll_mod_ban(text,uuid,boolean,text)'] loop
    execute format('revoke all on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end $$;
