-- SirSC Scroll: sample comments, so every approved video has 7 to 20 comments from day one.
--
-- The sample commenters are SirSC Scroll-only "seed authors", not Warden Chat accounts: they never
-- appear in Warden Chat (no auth user, no profile, no chats), can't sign in, and nothing they "write"
-- creates notifications. Real comments always come first, in both sort orders; sample comments follow.
-- Real people can like, reply to and report sample comments like any other.
--
-- Every approved video is seeded once (and newly approved videos automatically, by a trigger). To remove
-- every sample comment:   delete from scroll_private.comments where seed_author is not null;
-- To stop new ones:        drop trigger scroll_videos_seed_comments on public.scroll_videos;
--
-- Applied to the project as two migrations (scroll_sample_comments: everything down to the trigger;
-- scroll_sample_comment_data: the authors and lines), then the final statement was run once.

create table scroll_private.seed_authors (
  id       int primary key,
  username text not null unique check (username ~ '^[a-zA-Z0-9_.-]{3,24}$')
);
create table scroll_private.seed_lines (
  id       int generated always as identity primary key,
  -- a catalog category, 'any' (fits every video) or 'reply'. {channel} is replaced by the channel name.
  category text not null,
  line     text not null check (char_length(line) between 1 and 280)
);
alter table scroll_private.seed_authors enable row level security;
alter table scroll_private.seed_lines enable row level security;
revoke all on scroll_private.seed_authors, scroll_private.seed_lines from public, anon, authenticated;

alter table scroll_private.comments
  alter column user_id drop not null,
  add column seed_author int references scroll_private.seed_authors(id),
  add column seed_likes int not null default 0 check (seed_likes >= 0),
  add constraint comments_one_author check ((user_id is null) <> (seed_author is null));
create index comments_seed_video_idx on scroll_private.comments (video_id) where seed_author is not null;

-- Sample comments have no Warden Chat account behind them (user_id is null) and are always visible.
create or replace function scroll_private.author_visible(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_user is null or (
    exists (
      select 1 from warden_private.account_state s
      where s.user_id = p_user and (s.status = 'active' or (s.status = 'suspended' and s.restricted_until <= now())))
    and not exists (select 1 from scroll_private.social_bans b where b.user_id = p_user))
$$;

create or replace function scroll_private.comment_json(c scroll_private.comments, p_viewer uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id,
    'video_id', c.video_id,
    'parent_id', c.parent_id,
    'author', case when c.seed_author is not null
      then jsonb_build_object('id', 'seed:' || c.seed_author, 'username', (select a.username from scroll_private.seed_authors a where a.id = c.seed_author))
      else jsonb_build_object('id', c.user_id, 'username', scroll_private.username(c.user_id)) end,
    'reply_to', case when c.parent_id is not null and c.reply_to_user is not null
      and c.reply_to_user is distinct from (select t.user_id from scroll_private.comments t where t.id = c.parent_id)
      then scroll_private.username(c.reply_to_user) end,
    'body', c.body,
    'created_at', c.created_at,
    'likes', c.seed_likes + (select count(*) from scroll_private.comment_likes l where l.comment_id = c.id),
    'liked', exists (select 1 from scroll_private.comment_likes l where l.comment_id = c.id and l.user_id = p_viewer),
    'replies', case when c.parent_id is null then (
      select count(*) from scroll_private.comments r
      where r.parent_id = c.id and r.deleted_at is null and scroll_private.author_visible(r.user_id)
        and not warden_private.pair_blocked(p_viewer, r.user_id)) else 0 end,
    'mine', coalesce(c.user_id = p_viewer, false))
$$;

-- Real comments first, then sample ones; within each, most liked ('top') or newest ('new').
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
      (c.seed_author is not null),
      case when p_sort = 'top' then c.seed_likes + (select count(*) from scroll_private.comment_likes l where l.comment_id = c.id) end desc nulls last,
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
    'likes', coalesce((select c.seed_likes from scroll_private.comments c where c.id = p_id), 0)
      + (select count(*) from scroll_private.comment_likes l where l.comment_id = p_id));
end $$;

-- Moderation: sample comments are left out of "All comments" (they'd bury the real ones) but show when
-- reported or removed, marked "seeded".
create or replace function public.scroll_mod_comments(p_key text, p_view text default 'reported', p_offset int default 0, p_limit int default 50)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_ids bigint[]; v_total bigint;
begin
  perform scroll_private.review_key_check(p_key);
  if p_view is null or p_view not in ('reported', 'recent', 'removed') then raise exception 'scroll_bad_request' using errcode = 'P0001'; end if;
  select count(*) into v_total from scroll_private.comments c
  where case p_view
    when 'reported' then c.deleted_at is null and exists (select 1 from scroll_private.comment_reports r where r.comment_id = c.id and r.resolved_at is null)
    when 'recent' then c.deleted_at is null and c.seed_author is null
    else c.deleted_at is not null end;
  select array_agg(x.id order by x.rn) into v_ids from (
    select c.id, row_number() over (order by
      case when p_view = 'reported' then (select count(*) from scroll_private.comment_reports r where r.comment_id = c.id and r.resolved_at is null) end desc nulls last,
      case when p_view = 'removed' then c.deleted_at end desc nulls last,
      c.created_at desc, c.id desc) as rn
    from scroll_private.comments c
    where case p_view
      when 'reported' then c.deleted_at is null and exists (select 1 from scroll_private.comment_reports r where r.comment_id = c.id and r.resolved_at is null)
      when 'recent' then c.deleted_at is null and c.seed_author is null
      else c.deleted_at is not null end
    order by rn offset greatest(coalesce(p_offset, 0), 0) limit least(greatest(coalesce(p_limit, 50), 1), 200)) x;
  return jsonb_build_object(
    'view', p_view,
    'total', v_total,
    'offset', greatest(coalesce(p_offset, 0), 0),
    'counts', jsonb_build_object(
      'reported', (select count(distinct r.comment_id) from scroll_private.comment_reports r join scroll_private.comments c on c.id = r.comment_id where r.resolved_at is null and c.deleted_at is null),
      'recent', (select count(*) from scroll_private.comments c where c.deleted_at is null and c.seed_author is null),
      'removed', (select count(*) from scroll_private.comments c where c.deleted_at is not null)),
    'banned', coalesce((select jsonb_agg(jsonb_build_object('id', b.user_id, 'username', scroll_private.username(b.user_id), 'reason', b.reason, 'at', b.created_at) order by b.created_at desc)
      from scroll_private.social_bans b), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'video_id', c.video_id,
        'video_title', (select v.title from public.scroll_videos v where v.video_id = c.video_id),
        'parent_id', c.parent_id,
        'seeded', c.seed_author is not null,
        'author', case when c.seed_author is not null
          then jsonb_build_object('id', 'seed:' || c.seed_author, 'username', (select a.username from scroll_private.seed_authors a where a.id = c.seed_author))
          else jsonb_build_object('id', c.user_id, 'username', scroll_private.username(c.user_id)) end,
        'author_banned', c.user_id is not null and exists (select 1 from scroll_private.social_bans b where b.user_id = c.user_id),
        'body', c.body, 'created_at', c.created_at, 'deleted_at', c.deleted_at, 'deleted_by', c.deleted_by,
        'likes', c.seed_likes + (select count(*) from scroll_private.comment_likes l where l.comment_id = c.id),
        'reports', (select count(*) from scroll_private.comment_reports r where r.comment_id = c.id and r.resolved_at is null),
        'reasons', coalesce((select jsonb_object_agg(g.reason, g.n) from (
          select r.reason, count(*) as n from scroll_private.comment_reports r
          where r.comment_id = c.id and r.resolved_at is null group by r.reason) g), '{}'::jsonb))
        order by o.n)
      from unnest(coalesce(v_ids, '{}')) with ordinality o(id, n)
      join scroll_private.comments c on c.id = o.id), '[]'::jsonb));
end $$;

-- 7 to 20 sample comments for one video (up to about a third of them replies), once. Deterministic per
-- video: lines that fit its category plus general ones, a different sample author for each, spread over
-- the last 45 days (or since the video came out), likes skewed low and scaled to the video's views.
create or replace function scroll_private.seed_video_comments(p_video text)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v public.scroll_videos;
  v_total int; v_replies int; v_top int;
  v_start timestamptz; v_end timestamptz;
  v_lines text[]; v_reply_lines text[]; v_authors int[]; v_parents bigint[] := '{}';
  v_id bigint; v_parent bigint; v_pat timestamptz; i int;
  rnd float8;
begin
  select * into v from public.scroll_videos where video_id = p_video;
  if not found or v.review_status <> 'approved'
    or exists (select 1 from scroll_private.comments c where c.video_id = p_video and c.seed_author is not null) then
    return 0;
  end if;
  v_total := 7 + (abs(hashtextextended(p_video, 11)) % 14)::int;
  v_replies := (v_total * (abs(hashtextextended(p_video, 12)) % 30) / 100)::int;
  v_top := v_total - v_replies;
  v_end := now() - interval '25 minutes';
  v_start := greatest(coalesce(v.published_at, v.discovered_at), now() - interval '45 days');
  if v_start > v_end - interval '6 hours' then v_start := v_end - interval '2 days'; end if;
  select array_agg(l.line order by hashtextextended(p_video || ':' || l.id, 13)) into v_lines
  from scroll_private.seed_lines l where l.category in (v.category, 'any');
  select array_agg(l.line order by hashtextextended(p_video || ':r' || l.id, 15)) into v_reply_lines
  from scroll_private.seed_lines l where l.category = 'reply';
  select array_agg(a.id order by hashtextextended(p_video || ':a' || a.id, 14)) into v_authors
  from scroll_private.seed_authors a;
  if coalesce(array_length(v_lines, 1), 0) < v_top or coalesce(array_length(v_authors, 1), 0) < v_total then
    raise exception 'not enough seed lines or authors';
  end if;
  for i in 1..v_top loop
    rnd := (abs(hashtextextended(p_video || ':t' || i, 16)) % 1000000) / 1000000.0;
    insert into scroll_private.comments (video_id, seed_author, body, created_at, seed_likes)
    values (
      p_video, v_authors[i],
      left(replace(v_lines[i], '{channel}', coalesce(nullif(btrim(v.channel_title), ''), 'this channel')), 300),
      v_start + (v_end - v_start) * rnd,
      -- mostly a handful of likes, a few popular ones; the ceiling grows with the video's views
      floor(power((abs(hashtextextended(p_video || ':l' || i, 17)) % 1000000) / 1000000.0, 4)
        * greatest(25, least(2500, coalesce(v.view_count, 0) / 400)))::int)
    returning id into v_id;
    v_parents := v_parents || v_id;
  end loop;
  for i in 1..v_replies loop
    v_parent := v_parents[1 + (abs(hashtextextended(p_video || ':p' || i, 18)) % least(v_top, 6))::int];
    select c.created_at into v_pat from scroll_private.comments c where c.id = v_parent;
    rnd := (abs(hashtextextended(p_video || ':q' || i, 19)) % 1000000) / 1000000.0;
    insert into scroll_private.comments (video_id, seed_author, parent_id, body, created_at, seed_likes)
    values (
      p_video, v_authors[v_top + i], v_parent,
      v_reply_lines[1 + ((i - 1) % greatest(array_length(v_reply_lines, 1), 1))],
      v_pat + (v_end - v_pat) * rnd * 0.5,
      (abs(hashtextextended(p_video || ':m' || i, 20)) % greatest(4, least(60, coalesce(v.view_count, 0) / 20000 + 4)))::int);
  end loop;
  return v_total;
end $$;
revoke all on function scroll_private.seed_video_comments(text) from public, anon, authenticated;

-- Videos approved later get their sample comments when they're approved.
create or replace function scroll_private.seed_on_approve()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform scroll_private.seed_video_comments(new.video_id);
  return null;
end $$;
revoke all on function scroll_private.seed_on_approve() from public, anon, authenticated;

create trigger scroll_videos_seed_comments
after update of review_status on public.scroll_videos
for each row when (new.review_status = 'approved' and old.review_status is distinct from 'approved')
execute function scroll_private.seed_on_approve();

-- Grants for the replaced public functions stay as they were (create or replace keeps them).
insert into scroll_private.seed_authors (id, username)
select id, username from (values
  (1, 'lowkey_moose'),
  (2, 'nina.ok'),
  (3, 'Elena_ok'),
  (4, 'sleepymoose'),
  (5, 'jayden.clips'),
  (6, 'nina62'),
  (7, 'Rapidpanda'),
  (8, 'jack.life'),
  (9, 'crispy_rocket'),
  (10, 'owen_sketch'),
  (11, 'Sage_tv'),
  (12, 'crispy_dino'),
  (13, 'lowkey_koala'),
  (14, 'Dylan.reads'),
  (15, 'Dylan.clips'),
  (16, 'luna.sketch'),
  (17, 'priya71'),
  (18, 'sam13'),
  (19, 'alana.reads'),
  (20, 'Pixelkoala'),
  (21, 'Nate_builds'),
  (22, 'chill_rocket'),
  (23, 'jack78'),
  (24, 'felix58'),
  (25, 'nate.plays'),
  (26, 'lucas39'),
  (27, 'Ella34'),
  (28, 'kira_hoops'),
  (29, 'ella.zone'),
  (30, 'kai51'),
  (31, 'cami.life'),
  (32, 'sofia_clips'),
  (33, 'diego_ok'),
  (34, 'tessa81'),
  (35, 'elena24'),
  (36, 'eli.builds'),
  (37, 'Sam.gg'),
  (38, 'troy.ok'),
  (39, 'dylan.clips'),
  (40, 'kai.art'),
  (41, 'hazel48'),
  (42, 'priya_zone'),
  (43, 'Sillytaco'),
  (44, 'lowkey_panda'),
  (45, 'caleb.ok'),
  (46, 'Colt.sketch'),
  (47, 'remy_codes'),
  (48, 'drew_art'),
  (49, 'chill_panda'),
  (50, 'jade90'),
  (51, 'Zoe_codes'),
  (52, 'nora40'),
  (53, 'chillotter19'),
  (54, 'lowkey_comet'),
  (55, 'omar98'),
  (56, 'noah05'),
  (57, 'neon_falcon'),
  (58, 'neon_koala'),
  (59, 'sage.codes'),
  (60, 'cosmic_panda'),
  (61, 'pixel_penguin'),
  (62, 'June58'),
  (63, 'kai.life'),
  (64, 'maya22'),
  (65, 'mason33'),
  (66, 'neon_tiger'),
  (67, 'neonotter74'),
  (68, 'logan_ok'),
  (69, 'carter49'),
  (70, 'stella.vibes'),
  (71, 'ava.builds'),
  (72, 'stella.codes'),
  (73, 'jayden.zone'),
  (74, 'mason.fan'),
  (75, 'pixelllama'),
  (76, 'ethan.gg'),
  (77, 'kira47'),
  (78, 'hazel_irl'),
  (79, 'tinywaffle'),
  (80, 'alana.runs'),
  (81, 'mellow_mango'),
  (82, 'pixelkoala'),
  (83, 'ethan67'),
  (84, 'colt.beats'),
  (85, 'Sofia.fan'),
  (86, 'aria_art'),
  (87, 'Ava.builds'),
  (88, 'mateo.irl'),
  (89, 'neonllama92'),
  (90, 'cami_sketch'),
  (91, 'maya.runs'),
  (92, 'rapidtaco54'),
  (93, 'lily.fan'),
  (94, 'sunnyfox41'),
  (95, 'lowkey_otter'),
  (96, 'caleb.beats'),
  (97, 'mason_lol'),
  (98, 'turbocomet'),
  (99, 'isaac_vibes'),
  (100, 'sam.zone'),
  (101, 'golden_comet'),
  (102, 'liam_life'),
  (103, 'mason.clips'),
  (104, 'Ella.gg'),
  (105, 'ivy21'),
  (106, 'jade.tv'),
  (107, 'Jonah_ok'),
  (108, 'dylan14'),
  (109, 'maya.beats'),
  (110, 'hazel.codes'),
  (111, 'sunny_panda'),
  (112, 'owen.runs'),
  (113, 'sunny_falcon'),
  (114, 'emma16'),
  (115, 'june.lol'),
  (116, 'carter_irl'),
  (117, 'owen.fan'),
  (118, 'dylan.gg'),
  (119, 'jonah22'),
  (120, 'tessa_lol'),
  (121, 'dylan.sketch'),
  (122, 'luna.hoops'),
  (123, 'sam.plays'),
  (124, 'miles02'),
  (125, 'Tessa_sketch'),
  (126, 'ben.hoops'),
  (127, 'ava.sketch'),
  (128, 'felix_irl'),
  (129, 'chloe_gg'),
  (130, 'aria.tv'),
  (131, 'mellow_koala'),
  (132, 'luna58'),
  (133, 'jade93'),
  (134, 'Chloe_lol'),
  (135, 'june.irl'),
  (136, 'elena_gg'),
  (137, 'jayden_hoops'),
  (138, 'spicy_falcon'),
  (139, 'sillydino41'),
  (140, 'colt12'),
  (141, 'Luckymango11'),
  (142, 'sleepy_moose'),
  (143, 'spicyllama44'),
  (144, 'Colt_life'),
  (145, 'zippytiger3'),
  (146, 'ben.fan'),
  (147, 'hazel_reads'),
  (148, 'lucas.runs'),
  (149, 'jayden_builds'),
  (150, 'mateo_sketch'),
  (151, 'colt.runs'),
  (152, 'isaac_gg'),
  (153, 'mason_ok'),
  (154, 'reid43'),
  (155, 'jonah56'),
  (156, 'layla35'),
  (157, 'jack.ok'),
  (158, 'logan_irl'),
  (159, 'cloudy_cactus'),
  (160, 'maya.plays'),
  (161, 'frosty_koala'),
  (162, 'mason12'),
  (163, 'lily_codes'),
  (164, 'drew.fan'),
  (165, 'finn21'),
  (166, 'owen.clips'),
  (167, 'Rapidrocket'),
  (168, 'lucky_fox'),
  (169, 'ben_runs'),
  (170, 'pixelbadger'),
  (171, 'dylan20'),
  (172, 'alana.fan'),
  (173, 'goldenotter47'),
  (174, 'quinn.irl'),
  (175, 'emma_builds'),
  (176, 'sleepy_tiger'),
  (177, 'Ruby.clips'),
  (178, 'hazel_runs'),
  (179, 'mellowllama96'),
  (180, 'finn32'),
  (181, 'luna_reads'),
  (182, 'Hazel.builds'),
  (183, 'hazel87'),
  (184, 'tessa78'),
  (185, 'talia_codes'),
  (186, 'ruby.sketch'),
  (187, 'anya.ok'),
  (188, 'quiet_taco'),
  (189, 'jace.zone'),
  (190, 'felix.hoops'),
  (191, 'diego_zone'),
  (192, 'reid_codes'),
  (193, 'felix.tv'),
  (194, 'Ella.daily'),
  (195, 'colt.vibes'),
  (196, 'june_fan'),
  (197, 'ava_sketch'),
  (198, 'ethan_beats'),
  (199, 'lucas.tv'),
  (200, 'goldenbadger16'),
  (201, 'chloe91'),
  (202, 'jonah87'),
  (203, 'nate.codes'),
  (204, 'tessa_daily'),
  (205, 'chloe_builds'),
  (206, 'troy.vibes'),
  (207, 'troy_clips'),
  (208, 'carter04'),
  (209, 'jace.daily'),
  (210, 'cosmicdino82'),
  (211, 'ethan.fan'),
  (212, 'tinyllama'),
  (213, 'finn67'),
  (214, 'caleb.clips'),
  (215, 'chill_pickle'),
  (216, 'troy20'),
  (217, 'quinn.sketch'),
  (218, 'june40'),
  (219, 'layla92'),
  (220, 'Layla.codes'),
  (221, 'luckyllama'),
  (222, 'june_lol'),
  (223, 'Rapidotter'),
  (224, 'chloe.clips'),
  (225, 'chloe22'),
  (226, 'Jayden40'),
  (227, 'silly_llama'),
  (228, 'ava_plays'),
  (229, 'emma_life'),
  (230, 'jace.builds'),
  (231, 'mellow_taco'),
  (232, 'troy_art'),
  (233, 'reid_gg'),
  (234, 'cloudybadger23'),
  (235, 'reid.life'),
  (236, 'troy80'),
  (237, 'sage_hoops'),
  (238, 'jace.fan'),
  (239, 'chillwaffle49'),
  (240, 'anya_codes'),
  (241, 'stella44'),
  (242, 'pixelotter'),
  (243, 'lucas_ok'),
  (244, 'miles_vibes'),
  (245, 'ella.codes'),
  (246, 'crispyotter'),
  (247, 'lowkey_bagel'),
  (248, 'hazel_codes'),
  (249, 'reid.runs'),
  (250, 'Chloe_plays'),
  (251, 'lowkey_llama'),
  (252, 'Zoe_beats'),
  (253, 'june33'),
  (254, 'chill_cactus'),
  (255, 'ruby.beats'),
  (256, 'logan.builds'),
  (257, 'miles_plays'),
  (258, 'amara.lol'),
  (259, 'felix99'),
  (260, 'ethan_codes'),
  (261, 'kira_art'),
  (262, 'jace_sketch'),
  (263, 'Lily.art'),
  (264, 'turbobagel82'),
  (265, 'liam.gg'),
  (266, 'logan.sketch'),
  (267, 'frostycomet29'),
  (268, 'ethan.vibes'),
  (269, 'goldenfalcon23'),
  (270, 'isaac_hoops'),
  (271, 'sunnyllama15'),
  (272, 'chillpanda'),
  (273, 'ryan91'),
  (274, 'jack_hoops'),
  (275, 'reid25'),
  (276, 'talia_life'),
  (277, 'chillmango'),
  (278, 'Elena.art'),
  (279, 'colt_hoops'),
  (280, 'noah35'),
  (281, 'Caleb.fan'),
  (282, 'tessa.runs'),
  (283, 'felix.beats'),
  (284, 'ava.codes'),
  (285, 'neonmango'),
  (286, 'caleb_vibes'),
  (287, 'jack71'),
  (288, 'Elena.clips'),
  (289, 'Sofia.reads'),
  (290, 'tiny_cactus'),
  (291, 'mellow_otter'),
  (292, 'grace82'),
  (293, 'kira_vibes'),
  (294, 'ruby_codes'),
  (295, 'jade38'),
  (296, 'aria.zone'),
  (297, 'Isaac.irl'),
  (298, 'cloudywaffle30'),
  (299, 'theo_plays'),
  (300, 'felix.daily'),
  (301, 'sofia.hoops'),
  (302, 'theo75'),
  (303, 'neoncomet18'),
  (304, 'tinycactus52'),
  (305, 'neonpanda11'),
  (306, 'chillmango98'),
  (307, 'turbo_dino'),
  (308, 'Hazel.codes'),
  (309, 'nina_ok'),
  (310, 'Pixelmoose84'),
  (311, 'piper.life'),
  (312, 'Theo.builds'),
  (313, 'spicypanda'),
  (314, 'sillykoala37'),
  (315, 'mateo.codes'),
  (316, 'tiny_panda'),
  (317, 'dylan50'),
  (318, 'ava.gg'),
  (319, 'crispy_mango'),
  (320, 'sunny_pickle'),
  (321, 'Logan79'),
  (322, 'pixelbagel58'),
  (323, 'miles_codes'),
  (324, 'zippy_otter'),
  (325, 'Tinypickle2'),
  (326, 'maya95'),
  (327, 'frosty_falcon'),
  (328, 'lowkeykoala'),
  (329, 'gavin.fan'),
  (330, 'tiny_penguin'),
  (331, 'spicywaffle'),
  (332, 'neon_penguin'),
  (333, 'diego_daily'),
  (334, 'cami.clips'),
  (335, 'neon_comet'),
  (336, 'Sleepy_fox'),
  (337, 'theo53'),
  (338, 'nora_lol'),
  (339, 'priya.gg'),
  (340, 'neon_llama'),
  (341, 'sleepy_penguin'),
  (342, 'troy18'),
  (343, 'golden_dino'),
  (344, 'grace.runs'),
  (345, 'crispy_pickle'),
  (346, 'leo67'),
  (347, 'noah_codes'),
  (348, 'quinn52'),
  (349, 'luna.zone'),
  (350, 'reid88'),
  (351, 'jade_life'),
  (352, 'elena.sketch'),
  (353, 'gavin.gg'),
  (354, 'Ryan59'),
  (355, 'mia.daily'),
  (356, 'neonbadger33'),
  (357, 'isaac_fan'),
  (358, 'jonah_life'),
  (359, 'carter84'),
  (360, 'sofia_gg'),
  (361, 'lucky_bagel'),
  (362, 'gavin59'),
  (363, 'cloudy_moose'),
  (364, 'Mason.irl'),
  (365, 'tessa16'),
  (366, 'Sunnybadger97'),
  (367, 'logan.codes'),
  (368, 'ava.beats'),
  (369, 'amara27'),
  (370, 'zoe_beats'),
  (371, 'nora_life'),
  (372, 'Frosty_taco'),
  (373, 'mason.lol'),
  (374, 'troy90'),
  (375, 'mason.codes'),
  (376, 'talia.builds'),
  (377, 'eli.hoops'),
  (378, 'Pixelrocket'),
  (379, 'colt.plays'),
  (380, 'eli_ok'),
  (381, 'jace28'),
  (382, 'luna.tv'),
  (383, 'Kai.lol'),
  (384, 'owen37'),
  (385, 'grace87'),
  (386, 'cloudy_panda'),
  (387, 'zoe90'),
  (388, 'jade_irl'),
  (389, 'leo_lol'),
  (390, 'leo62'),
  (391, 'rapid_koala'),
  (392, 'lowkey_dino'),
  (393, 'aria.hoops'),
  (394, 'amara.tv'),
  (395, 'sleepydino'),
  (396, 'luna.gg'),
  (397, 'rapidpickle97'),
  (398, 'kai_plays'),
  (399, 'Emma34'),
  (400, 'grace_fan'),
  (401, 'aria_sketch'),
  (402, 'Jack.beats'),
  (403, 'miles.sketch'),
  (404, 'talia_ok'),
  (405, 'mia.vibes'),
  (406, 'nora_clips'),
  (407, 'sam_zone'),
  (408, 'ava72'),
  (409, 'Turbopenguin1'),
  (410, 'zoe_sketch'),
  (411, 'Dylan_plays'),
  (412, 'remy.fan'),
  (413, 'emma_clips'),
  (414, 'Logan.beats'),
  (415, 'tessa08'),
  (416, 'quiet_fox'),
  (417, 'caleb52'),
  (418, 'nina.builds'),
  (419, 'Talia_zone'),
  (420, 'Omar.builds'),
  (421, 'amara.gg'),
  (422, 'Troy59'),
  (423, 'Jack_reads'),
  (424, 'lily.art'),
  (425, 'grace_gg'),
  (426, 'gavin.life'),
  (427, 'troy.zone'),
  (428, 'owen69'),
  (429, 'cosmic_tiger'),
  (430, 'sunnyfalcon92'),
  (431, 'reid_zone'),
  (432, 'pixeltiger'),
  (433, 'Sam70'),
  (434, 'zippy_waffle'),
  (435, 'nate34'),
  (436, 'piper_clips'),
  (437, 'zippy_falcon'),
  (438, 'caleb.fan'),
  (439, 'leo.codes'),
  (440, 'Crispyotter'),
  (441, 'Ava.irl'),
  (442, 'pixel_falcon'),
  (443, 'finn95'),
  (444, 'silly_otter'),
  (445, 'Emma23'),
  (446, 'elena_codes'),
  (447, 'ethan.irl'),
  (448, 'cami19'),
  (449, 'mellowpickle44'),
  (450, 'zoe85'),
  (451, 'eli35'),
  (452, 'Quietotter'),
  (453, 'pixelcomet'),
  (454, 'sillypenguin'),
  (455, 'layla.zone'),
  (456, 'lexi99'),
  (457, 'reid.irl'),
  (458, 'Isaac_beats'),
  (459, 'tessa_beats'),
  (460, 'emma37')
) v(id, username)
where not exists (select 1 from public.profiles p where p.username_lower = lower(v.username));

insert into scroll_private.seed_lines (category, line) values
  ('any', 'this is so good'),
  ('any', 'okay this made my day'),
  ('any', 'watched this way too many times'),
  ('any', 'the ending got me'),
  ('any', 'no because why is this so accurate'),
  ('any', 'I need a part 2'),
  ('any', 'how does this not have more views'),
  ('any', 'saving this for later'),
  ('any', 'the timing on this is perfect'),
  ('any', 'this deserves way more views'),
  ('any', 'came back to watch this again'),
  ('any', 'I was not ready for that'),
  ('any', 'sending this to my friend rn'),
  ('any', 'I laughed out loud at this'),
  ('any', 'this is actually so satisfying'),
  ('any', 'who else is watching this at lunch'),
  ('any', 'the editing on this is clean'),
  ('any', 'not me replaying this 5 times'),
  ('any', 'ok but why is this so relatable'),
  ('any', 'this is my new favorite video'),
  ('any', 'I can''t stop watching this'),
  ('any', 'wait this is actually genius'),
  ('any', '10/10 no notes'),
  ('any', 'the effort in this is crazy'),
  ('any', 'underrated fr'),
  ('any', 'this popped up at the perfect time'),
  ('any', 'the music choice is perfect'),
  ('any', 'I didn''t expect that at all'),
  ('any', 'how is nobody talking about this'),
  ('any', 'my whole class needs to see this'),
  ('any', 'best thing I''ve seen all week'),
  ('any', 'this is peak content'),
  ('any', 'can''t believe this is real'),
  ('any', 'I''d watch a whole series of this'),
  ('any', 'this deserves an award'),
  ('any', 'the vibes are immaculate'),
  ('any', 'why is this so wholesome'),
  ('any', 'this is exactly what I needed today'),
  ('any', 'commenting so I can find this again'),
  ('any', 'first time seeing this and I love it'),
  ('any', 'I keep coming back to this one'),
  ('any', 'short but so good'),
  ('any', 'that was smooth'),
  ('any', 'ok this is impressive'),
  ('any', 'love how chill this is'),
  ('any', 'never gets old'),
  ('any', 'this is so creative'),
  ('any', 'bro really did that'),
  ('any', 'my jaw dropped'),
  ('any', 'how do people think of this stuff'),
  ('any', 'the last second though'),
  ('any', 'W video'),
  ('any', 'this one goes hard'),
  ('any', 'lowkey the best one yet'),
  ('any', 'this made me smile'),
  ('any', 'pure talent'),
  ('any', 'big respect for this'),
  ('any', 'showed this to my mom and she laughed too'),
  ('any', 'certified classic'),
  ('any', 'the dedication 👏'),
  ('any', 'this is so clean 🔥'),
  ('any', 'can''t stop laughing 😭'),
  ('any', 'this is gold'),
  ('any', 'the replay value is insane'),
  ('any', 'more of this please'),
  ('any', 'the algorithm finally got it right'),
  ('any', '{channel} never misses'),
  ('any', '{channel} always posts bangers'),
  ('any', 'love {channel}''s videos'),
  ('any', '{channel} keeps getting better'),
  ('any', 'been watching {channel} for a while and this is one of the best'),
  ('reply', 'fr'),
  ('reply', 'same honestly'),
  ('reply', 'LOL'),
  ('reply', 'real'),
  ('reply', 'this ^'),
  ('reply', 'agreed'),
  ('reply', 'no way'),
  ('reply', '😭😭'),
  ('reply', 'exactly'),
  ('reply', 'facts'),
  ('reply', 'right??'),
  ('reply', '100%'),
  ('reply', 'I thought the same thing'),
  ('reply', 'literally'),
  ('reply', 'you''re so right'),
  ('reply', 'haha yes'),
  ('reply', 'true'),
  ('reply', 'same here'),
  ('reply', 'this comment 😂'),
  ('reply', 'underrated comment'),
  ('reply', 'I was about to say that'),
  ('reply', 'yesss'),
  ('reply', 'so true'),
  ('reply', 'omg yes'),
  ('reply', 'big facts'),
  ('gaming', 'that play was clean'),
  ('gaming', 'how did that even work'),
  ('gaming', 'the reaction at the end 😂'),
  ('gaming', 'I tried this and failed so badly'),
  ('gaming', 'the skill gap is real'),
  ('gaming', 'this is why I love this game'),
  ('gaming', 'that timing was perfect'),
  ('gaming', 'I need to try this tonight'),
  ('gaming', 'the controller must be shaking'),
  ('gaming', 'pro gamer move fr'),
  ('gaming', 'this game never gets old'),
  ('gaming', 'I''ve been stuck on this level for days'),
  ('gaming', 'the strategy here is genius'),
  ('gaming', 'unreal reflexes'),
  ('gaming', 'I would have rage quit'),
  ('gaming', 'that clutch though'),
  ('gaming', 'speedrunners are built different'),
  ('gaming', 'my teammates could never'),
  ('gaming', 'teach me your ways'),
  ('gaming', 'GG'),
  ('gaming', 'the comeback 🔥'),
  ('gaming', 'bro is so good at this game'),
  ('gaming', 'lowkey want to play this now'),
  ('gaming', 'the patience this took'),
  ('gaming', 'that was so satisfying to watch'),
  ('memes', 'this meme is so me'),
  ('memes', 'why is this literally my life'),
  ('memes', 'I''m crying 😭'),
  ('memes', 'the accuracy is painful'),
  ('memes', 'this is going in the group chat'),
  ('memes', 'I''ve never related to something more'),
  ('memes', 'the caption sent me'),
  ('memes', 'this is how my brain works'),
  ('memes', 'every time without fail'),
  ('memes', 'my sibling does this every day'),
  ('memes', 'this is peak internet'),
  ('memes', 'the face at the end 😂'),
  ('memes', 'I laughed way too hard'),
  ('memes', 'the internet never disappoints'),
  ('memes', 'this is so random I love it'),
  ('memes', 'I can hear this video'),
  ('memes', 'the format is perfect'),
  ('memes', 'too real'),
  ('memes', 'certified meme moment'),
  ('memes', 'absolutely sent me'),
  ('memes', 'this lives in my head now'),
  ('comedy', 'the delivery is perfect'),
  ('comedy', 'I wasn''t ready 😂'),
  ('comedy', 'the acting is so good'),
  ('comedy', 'this skit is gold'),
  ('comedy', 'I laughed so loud'),
  ('comedy', 'the plot twist 😭'),
  ('comedy', 'comedy genius'),
  ('comedy', 'the facial expressions though'),
  ('comedy', 'I need more skits like this'),
  ('comedy', 'how is this so funny'),
  ('comedy', 'the timing of the joke'),
  ('comedy', 'my stomach hurts from laughing'),
  ('comedy', 'this is my humor exactly'),
  ('comedy', 'the background character 😂'),
  ('comedy', 'rewatched for the punchline'),
  ('comedy', 'the way they said that'),
  ('comedy', 'this needs a sequel'),
  ('comedy', 'best skit this month'),
  ('comedy', 'they never miss'),
  ('comedy', 'I''m still laughing'),
  ('comedy', 'the commitment to the bit'),
  ('comedy', 'funniest thing I''ve seen today'),
  ('sports', 'what a shot'),
  ('sports', 'that athleticism is unreal'),
  ('sports', 'the crowd went wild'),
  ('sports', 'how is that even possible'),
  ('sports', 'this is why I love sports'),
  ('sports', 'the form is perfect'),
  ('sports', 'pure skill'),
  ('sports', 'I''d never make that shot'),
  ('sports', 'the dedication to practice shows'),
  ('sports', 'that save though'),
  ('sports', 'that''s going on the highlight reel'),
  ('sports', 'GOAT behavior'),
  ('sports', 'coach would be proud'),
  ('sports', 'I tried this at practice lol'),
  ('sports', 'the speed is crazy'),
  ('sports', 'unreal teamwork'),
  ('sports', 'that pass was perfect'),
  ('sports', 'watching this before my game'),
  ('sports', 'the confidence 🔥'),
  ('sports', 'absolute legend'),
  ('sports', 'this gave me chills'),
  ('sports', 'trick shot of the year'),
  ('technology', 'this is so useful'),
  ('technology', 'I learned something new today'),
  ('technology', 'how did I not know this'),
  ('technology', 'my setup could never'),
  ('technology', 'the future is now'),
  ('technology', 'trying this on my Chromebook'),
  ('technology', 'this tip actually works'),
  ('technology', 'nerd stuff but I love it'),
  ('technology', 'the engineering is insane'),
  ('technology', 'explained so well'),
  ('technology', 'I need this gadget'),
  ('technology', 'this saved me so much time'),
  ('technology', 'tech videos like this are the best'),
  ('technology', 'wait that''s actually smart'),
  ('technology', 'mind blown'),
  ('technology', 'can you do one on keyboards next'),
  ('technology', 'this should be taught in class'),
  ('technology', 'the build quality looks great'),
  ('technology', 'so clean'),
  ('technology', 'I want to build this'),
  ('technology', 'great explanation'),
  ('animals', 'I need this pet'),
  ('animals', 'so cute I can''t'),
  ('animals', 'the little paws 😭'),
  ('animals', 'protect this animal at all costs'),
  ('animals', 'my dog does this too'),
  ('animals', 'this made my whole day'),
  ('animals', 'the zoomies 😂'),
  ('animals', 'animals are the best'),
  ('animals', 'look at that face'),
  ('animals', 'this is too wholesome'),
  ('animals', 'I''d do anything for this cat'),
  ('animals', 'the sound it made 😂'),
  ('animals', 'pure joy'),
  ('animals', 'the tail wag'),
  ('animals', 'how is it so fluffy'),
  ('animals', 'best friend energy'),
  ('animals', 'this is my comfort video'),
  ('animals', 'nature is amazing'),
  ('animals', 'the way it looked at the camera'),
  ('animals', 'I''m in love'),
  ('animals', '10/10 good boy'),
  ('animals', 'I watched this five times'),
  ('science', 'this is so cool'),
  ('science', 'science is amazing'),
  ('science', 'I learned more here than in class'),
  ('science', 'wait how does that work'),
  ('science', 'my teacher needs to show this'),
  ('science', 'the chemistry is wild'),
  ('science', 'this is why I love science'),
  ('science', 'mind blown 🤯'),
  ('science', 'never knew this before'),
  ('science', 'I want to try this experiment'),
  ('science', 'explained perfectly'),
  ('science', 'space is so cool'),
  ('science', 'this actually makes sense now'),
  ('science', 'physics is crazy'),
  ('science', 'doing this for my science fair'),
  ('science', 'so satisfying'),
  ('science', 'this is fascinating'),
  ('science', 'more science videos please'),
  ('science', 'nature is so smart'),
  ('science', 'the slow motion part though'),
  ('science', 'I could watch this all day'),
  ('music', 'this is stuck in my head now'),
  ('music', 'the vocals are amazing'),
  ('music', 'on repeat'),
  ('music', 'the beat is so good'),
  ('music', 'chills'),
  ('music', 'this deserves to be on the radio'),
  ('music', 'talent like this is rare'),
  ('music', 'the harmony 😍'),
  ('music', 'adding this to my playlist'),
  ('music', 'I can''t stop listening'),
  ('music', 'the drop though'),
  ('music', 'how is this so good'),
  ('music', 'this cover is better than the original'),
  ('music', 'goosebumps'),
  ('music', 'the rhythm is perfect'),
  ('music', 'need the full song'),
  ('music', 'this is so relaxing'),
  ('music', 'insane skill'),
  ('music', 'the way they hit that note'),
  ('music', 'music like this hits different'),
  ('music', 'I need this on Spotify'),
  ('viral', 'this is everywhere right now'),
  ('viral', 'I keep seeing this and I''m not mad'),
  ('viral', 'this deserves to go viral'),
  ('viral', 'the internet''s favorite video'),
  ('viral', 'I saw this on my feed three times'),
  ('viral', 'everyone''s talking about this'),
  ('viral', 'this blew up for a reason'),
  ('viral', 'came here from the trend'),
  ('viral', 'this is history'),
  ('viral', 'the hype is real'),
  ('viral', 'I knew this would go viral'),
  ('viral', 'iconic'),
  ('viral', 'it''s a trend for a reason'),
  ('viral', 'my friends sent me this like 5 times'),
  ('viral', 'worth all the views'),
  ('viral', 'internet gold'),
  ('viral', 'glad I found this'),
  ('viral', 'the original is the best'),
  ('viral', 'this is the moment'),
  ('viral', 'never getting tired of this one'),
  ('internet_humor', 'the internet is undefeated'),
  ('internet_humor', 'this is chaotic in the best way'),
  ('internet_humor', 'I don''t know why this is so funny'),
  ('internet_humor', 'who even thinks of this'),
  ('internet_humor', 'my brain after watching this'),
  ('internet_humor', 'random but I love it'),
  ('internet_humor', 'this is the content I''m here for'),
  ('internet_humor', 'my humor is broken'),
  ('internet_humor', 'absolutely chaotic'),
  ('internet_humor', 'I can''t explain why I''m laughing'),
  ('internet_humor', 'peak internet humor'),
  ('internet_humor', 'this is art'),
  ('internet_humor', 'the chaos is perfect'),
  ('internet_humor', 'so silly it''s genius'),
  ('internet_humor', 'I''m wheezing'),
  ('internet_humor', 'the sound effects 😂'),
  ('internet_humor', 'this made no sense and I loved it'),
  ('internet_humor', 'only the internet could make this'),
  ('internet_humor', 'showing this to everyone'),
  ('internet_humor', 'I need to stop laughing'),
  ('trending_entertainment', 'this is so iconic'),
  ('trending_entertainment', 'I''ve been waiting for this'),
  ('trending_entertainment', 'can''t wait for more'),
  ('trending_entertainment', 'this is everything'),
  ('trending_entertainment', 'everyone needs to see this'),
  ('trending_entertainment', 'the energy is unmatched'),
  ('trending_entertainment', 'this trend is so fun'),
  ('trending_entertainment', 'I love seeing this everywhere'),
  ('trending_entertainment', 'the best part of my day'),
  ('trending_entertainment', 'so entertaining'),
  ('trending_entertainment', 'they nailed it'),
  ('trending_entertainment', 'main character energy'),
  ('trending_entertainment', 'this is so fun to watch'),
  ('trending_entertainment', 'the creativity is insane'),
  ('trending_entertainment', 'obsessed with this'),
  ('trending_entertainment', 'this went so hard'),
  ('trending_entertainment', 'instant favorite'),
  ('trending_entertainment', 'I''d watch this all day'),
  ('trending_entertainment', 'this is entertainment'),
  ('trending_entertainment', 'the hype was worth it');

-- Seed every video that's already approved.
select count(*) as videos, sum(scroll_private.seed_video_comments(video_id)) as comments
from public.scroll_videos where review_status = 'approved';
