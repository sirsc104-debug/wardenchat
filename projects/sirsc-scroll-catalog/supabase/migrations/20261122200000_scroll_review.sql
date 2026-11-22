-- SirSC Scroll: owner review page.
--
-- Review flow:  pending (to review) -> shortlisted (owner picked it for the school's list)
--               -> approved (the school agreed; public)   or   rejected (at any point)
-- Only approved, active videos are readable by the public. The owner's preview (and review) key also
-- shows pending and shortlisted ones in the feed, never rejected ones.
--
-- Review actions need the review key: a separate random value in Vault ('scroll_review_key'), because
-- approving makes a video public, which the preview key must not be able to do. The review key also
-- works as a preview key. Read it in the SQL editor:
--   select decrypted_secret from vault.decrypted_secrets where name = 'scroll_review_key';
-- Every review change is logged in scroll_private.review_log.

alter table public.scroll_videos drop constraint scroll_videos_review_status_check;
alter table public.scroll_videos add constraint scroll_videos_review_status_check
  check (review_status in ('pending', 'shortlisted', 'approved', 'rejected'));
comment on column public.scroll_videos.review_status is
  'pending -> shortlisted (owner picked it for the school''s list) -> approved (the school agreed; public), or rejected. Only approved and active videos are publicly readable.';

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'scroll_review_key') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(24), 'hex'),
      'scroll_review_key',
      'Owner review key for SirSC Scroll: lets the review page shortlist, approve and reject catalog videos. Also works as a preview key.'
    );
  end if;
end $$;

create function scroll_private.review_ok(p_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_key is not null and length(p_key) between 32 and 128 and exists (
    select 1 from vault.decrypted_secrets s where s.name = 'scroll_review_key' and s.decrypted_secret = p_key
  )
$$;
revoke all on function scroll_private.review_ok(text) from public;

create or replace function scroll_private.preview_ok(p_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_key is not null and length(p_key) between 32 and 128 and exists (
    select 1 from vault.decrypted_secrets s
    where s.name in ('scroll_preview_key', 'scroll_review_key') and s.decrypted_secret = p_key
  )
$$;

create table scroll_private.review_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  status text not null,
  video_ids text[] not null,
  note text
);
alter table scroll_private.review_log enable row level security;
revoke all on scroll_private.review_log from public, anon, authenticated;

create or replace function scroll_private.set_review_status(p_ids text[], p_status text, p_note text default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if p_status not in ('pending', 'shortlisted', 'approved', 'rejected') then
    raise exception 'review status must be pending, shortlisted, approved or rejected';
  end if;
  update public.scroll_videos
     set review_status = p_status, reviewed_at = case when p_status = 'pending' then null else now() end,
         review_note = p_note
   where video_id = any(p_ids);
  get diagnostics v_count = row_count;
  insert into scroll_private.review_log (status, video_ids, note) values (p_status, p_ids, coalesce(p_note, 'SQL editor'));
  return v_count;
end $$;
revoke all on function scroll_private.set_review_status(text[], text, text) from public;

-- ------------------------------------------------------------------ feeds: owner sees pending + shortlisted

create or replace function public.scroll_feed(
  p_feed text default 'for_you',
  p_category text default null,
  p_cursor text default null,
  p_limit integer default 20,
  p_exclude text[] default '{}',
  p_boost_categories text[] default '{}',
  p_preview_key text default null
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_feed text := lower(coalesce(p_feed, 'for_you'));
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_exclude text[] := coalesce(p_exclude[1:1000], '{}');
  v_boost text[] := coalesce(p_boost_categories[1:20], '{}');
  v_preview boolean := scroll_private.preview_ok(p_preview_key);
  v_cur jsonb;
  v_seed text;
  v_after_score double precision;
  v_after_id text;
  v_items jsonb;
  v_count integer;
  v_last_score double precision;
  v_last_id text;
begin
  if v_feed not in ('for_you', 'trending', 'newest', 'category', 'random') then
    raise exception 'unknown feed "%": use for_you, trending, newest, category or random', p_feed using errcode = '22023';
  end if;
  if v_feed = 'category' and p_category is null then
    raise exception 'the category feed needs p_category' using errcode = '22023';
  end if;
  if p_cursor is not null then
    begin
      v_cur := convert_from(decode(p_cursor, 'base64'), 'UTF8')::jsonb;
      v_after_score := (v_cur ->> 's')::double precision;
      v_after_id := v_cur ->> 'id';
      v_seed := v_cur ->> 'seed';
    exception when others then
      raise exception 'invalid cursor' using errcode = '22023';
    end;
    if v_cur ->> 'f' is distinct from v_feed or v_cur ->> 'c' is distinct from p_category then
      raise exception 'the cursor belongs to a different feed' using errcode = '22023';
    end if;
  end if;
  v_seed := coalesce(v_seed, md5(random()::text || clock_timestamp()::text));

  with scored as (
    select v.video_id, v.title, left(v.description, 300) as description, v.channel_title, v.channel_id,
           v.thumbnail_url, v.duration_seconds, v.published_at, v.view_count, v.category, v.hashtags,
           v.orientation, v.aspect_ratio, v.made_for_kids,
           case v_feed
             when 'newest' then coalesce(extract(epoch from v.published_at)::double precision, 0)
             when 'trending' then v.trend_score
             when 'category' then v.trend_score
             when 'random' then ('x' || substr(md5(v_seed || v.video_id), 1, 8))::bit(32)::bigint::double precision
             else ln(1 + greatest(v.trend_score, 0)) * 0.35
                  + case when v.duration_seconds <= 90 then 1.0 else 0 end
                  + case when v.orientation = 'vertical' then 1.0 else 0 end
                  + case when v.category = any(v_boost) then 1.5 else 0 end
                  + ('x' || substr(md5(v_seed || v.video_id), 1, 8))::bit(32)::bigint::double precision / 4294967295.0 * 3.0
           end as score
    from public.scroll_videos v
    where v.is_active
      and (v.review_status = 'approved' or (v_preview and v.review_status in ('pending', 'shortlisted')))
      and (v_feed <> 'category' or v.category = p_category)
      and not (v.video_id = any(v_exclude))
  ), page as (
    select * from scored s
    where v_after_id is null or (s.score, s.video_id) < (v_after_score, v_after_id)
    order by s.score desc, s.video_id desc
    limit v_limit
  )
  select coalesce(jsonb_agg(to_jsonb(p) - 'score' order by p.score desc, p.video_id desc), '[]'::jsonb),
         count(*),
         (array_agg(p.score order by p.score asc, p.video_id asc))[1],
         (array_agg(p.video_id order by p.score asc, p.video_id asc))[1]
    into v_items, v_count, v_last_score, v_last_id
  from page p;

  return jsonb_build_object(
    'feed', v_feed,
    'category', p_category,
    'preview', v_preview,
    'items', v_items,
    'next_cursor', case when v_count = v_limit then
      replace(encode(convert_to(jsonb_build_object('f', v_feed, 'c', p_category, 's', v_last_score, 'id', v_last_id, 'seed', v_seed)::text, 'UTF8'), 'base64'), E'\n', '')
    end
  );
end $$;

create or replace function public.scroll_categories(p_preview_key text default null) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('category', c.category, 'videos', c.videos) order by c.videos desc, c.category), '[]'::jsonb)
  from (
    select v.category, count(*) as videos
    from public.scroll_videos v
    where v.is_active
      and (v.review_status = 'approved' or (scroll_private.preview_ok(p_preview_key) and v.review_status in ('pending', 'shortlisted')))
    group by v.category
  ) c
$$;

create or replace function public.scroll_videos_lookup(p_ids text[], p_preview_key text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_preview boolean := scroll_private.preview_ok(p_preview_key);
begin
  return jsonb_build_object('preview', v_preview, 'items', coalesce((
    select jsonb_agg(jsonb_build_object(
      'video_id', v.video_id, 'title', v.title, 'description', left(v.description, 300),
      'channel_title', v.channel_title, 'channel_id', v.channel_id, 'thumbnail_url', v.thumbnail_url,
      'duration_seconds', v.duration_seconds, 'published_at', v.published_at, 'view_count', v.view_count,
      'category', v.category, 'hashtags', v.hashtags, 'orientation', v.orientation,
      'aspect_ratio', v.aspect_ratio, 'made_for_kids', v.made_for_kids))
    from public.scroll_videos v
    where v.video_id = any(coalesce(p_ids[1:200], '{}'))
      and v.is_active
      and (v.review_status = 'approved' or (v_preview and v.review_status in ('pending', 'shortlisted')))
  ), '[]'::jsonb));
end $$;

-- ------------------------------------------------------------------ review API (review key required)

-- One page of videos with a given review status, newest decisions first (to-review: most popular first).
create function public.scroll_review_list(
  p_key text,
  p_status text default 'pending',
  p_category text default null,
  p_search text default null,
  p_offset integer default 0,
  p_limit integer default 60
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 60), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_q text := nullif(trim(coalesce(p_search, '')), '');
  v_like text;
  v_total integer;
  v_items jsonb;
  v_counts jsonb;
  v_cats jsonb;
begin
  if not scroll_private.review_ok(p_key) then
    raise exception 'review key not accepted' using errcode = '42501';
  end if;
  if p_status not in ('pending', 'shortlisted', 'approved', 'rejected') then
    raise exception 'unknown review status "%"', p_status using errcode = '22023';
  end if;
  v_like := case when v_q is null then null
    else '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%' end;

  select count(*) into v_total
  from public.scroll_videos v
  where v.is_active and v.review_status = p_status
    and (p_category is null or v.category = p_category)
    and (v_like is null or v.title ilike v_like or v.channel_title ilike v_like);

  select coalesce(jsonb_agg(to_jsonb(x) - 'sort_key' order by x.sort_key desc, x.video_id), '[]'::jsonb) into v_items
  from (
    select v.video_id, v.title, v.channel_title, v.channel_id, v.thumbnail_url, v.duration_seconds, v.view_count,
           v.published_at, v.category, v.hashtags, v.orientation, v.made_for_kids, v.review_status,
           v.reviewed_at, v.review_note, v.discovered_at,
           case when p_status = 'pending' then v.trend_score
                else extract(epoch from coalesce(v.reviewed_at, v.discovered_at))::double precision end as sort_key
    from public.scroll_videos v
    where v.is_active and v.review_status = p_status
      and (p_category is null or v.category = p_category)
      and (v_like is null or v.title ilike v_like or v.channel_title ilike v_like)
    order by sort_key desc, v.video_id
    offset v_offset limit v_limit
  ) x;

  select coalesce(jsonb_object_agg(s.review_status, s.n), '{}'::jsonb) into v_counts
  from (select review_status, count(*) as n from public.scroll_videos where is_active group by review_status) s;

  select coalesce(jsonb_agg(jsonb_build_object('category', c.category, 'videos', c.n) order by c.n desc, c.category), '[]'::jsonb) into v_cats
  from (select category, count(*) as n from public.scroll_videos where is_active and review_status = p_status group by category) c;

  return jsonb_build_object('status', p_status, 'total', v_total, 'offset', v_offset, 'items', v_items,
                            'counts', v_counts, 'categories', v_cats);
end $$;

-- Set the review status of up to 1000 videos at once. Returns how many changed.
create function public.scroll_review_set(p_key text, p_ids text[], p_status text, p_note text default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if not scroll_private.review_ok(p_key) then
    raise exception 'review key not accepted' using errcode = '42501';
  end if;
  if p_status not in ('pending', 'shortlisted', 'approved', 'rejected') then
    raise exception 'unknown review status "%"', p_status using errcode = '22023';
  end if;
  if cardinality(p_ids) > 1000 then
    raise exception 'at most 1000 videos at a time' using errcode = '22023';
  end if;
  update public.scroll_videos
     set review_status = p_status,
         reviewed_at = case when p_status = 'pending' then null else now() end,
         review_note = left(p_note, 500)
   where video_id = any(p_ids) and review_status is distinct from p_status;
  get diagnostics v_count = row_count;
  if v_count > 0 then
    insert into scroll_private.review_log (status, video_ids, note) values (p_status, p_ids, left(p_note, 500));
  end if;
  return v_count;
end $$;

-- Every video with one review status (for the school's list), by category then title. At most 5000.
create function public.scroll_review_export(p_key text, p_status text default 'shortlisted') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not scroll_private.review_ok(p_key) then
    raise exception 'review key not accepted' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'video_id', x.video_id, 'title', x.title, 'channel_title', x.channel_title, 'category', x.category,
      'duration_seconds', x.duration_seconds, 'view_count', x.view_count, 'made_for_kids', x.made_for_kids,
      'url', 'https://www.youtube.com/watch?v=' || x.video_id) order by x.category, x.title)
    from (
      select * from public.scroll_videos v
      where v.is_active and v.review_status = p_status
      order by v.category, v.title
      limit 5000
    ) x
  ), '[]'::jsonb);
end $$;

revoke all on function public.scroll_review_list(text, text, text, text, integer, integer) from public;
revoke all on function public.scroll_review_set(text, text[], text, text) from public;
revoke all on function public.scroll_review_export(text, text) from public;
grant execute on function public.scroll_review_list(text, text, text, text, integer, integer) to anon, authenticated, service_role;
grant execute on function public.scroll_review_set(text, text[], text, text) to anon, authenticated, service_role;
grant execute on function public.scroll_review_export(text, text) to anon, authenticated, service_role;
