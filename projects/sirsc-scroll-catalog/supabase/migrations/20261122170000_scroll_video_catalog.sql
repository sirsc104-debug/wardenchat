-- SirSC Scroll: YouTube video catalog (discovery, review, retention, quota protection).
--
-- Everything here is new and prefixed: public.scroll_videos, public.scroll_import_runs,
-- public.scroll_admin_* / scroll_feed / scroll_categories functions, and the scroll_private schema.
-- Nothing belonging to other SirSC apps is read or changed.
--
-- Access model
--   * Anonymous / signed-in visitors: SELECT on approved, active videos only (RLS + column grants),
--     plus the read-only scroll_feed / scroll_categories functions. No writes of any kind.
--   * The scroll-discover-videos Edge Function: service_role, through the scroll_admin_* functions.
--   * Triggering a run: a random secret generated here and kept in Vault. pg_cron and admin SQL send
--     it; the Edge Function asks the database to check it. It never appears in code or the browser.
--   * New videos are review_status = 'pending' and invisible to the public until approved.

create extension if not exists pg_net with schema extensions;

create schema if not exists scroll_private;
revoke all on schema scroll_private from public;
comment on schema scroll_private is 'SirSC Scroll catalog internals (settings, quota, search queries, admin helpers). Not exposed through the API.';

-- ------------------------------------------------------------------ settings

create table scroll_private.settings (
  id smallint primary key default 1 check (id = 1),
  discovery_enabled boolean not null default true,
  -- Safety limit in YouTube API units per Pacific-time day (Google's default allowance is 10,000).
  daily_unit_limit integer not null default 3000 check (daily_unit_limit between 0 and 10000),
  scheduled_searches_per_day integer not null default 15 check (scheduled_searches_per_day between 0 and 50),
  max_searches_per_run integer not null default 20 check (max_searches_per_run between 1 and 50),
  max_results_per_search integer not null default 50 check (max_results_per_search between 1 and 50),
  max_duration_seconds integer not null default 180 check (max_duration_seconds > 0),
  preferred_max_seconds integer not null default 90 check (preferred_max_seconds > 0),
  region_code text not null default 'US',
  relevance_language text not null default 'en',
  refresh_after_days integer not null default 14 check (refresh_after_days between 1 and 29),
  refresh_batch_limit integer not null default 1000 check (refresh_batch_limit between 0 and 5000),
  max_metadata_age_days integer not null default 30 check (max_metadata_age_days between 1 and 30),
  category_weights jsonb not null default '{
    "gaming": 1, "memes": 1, "comedy": 1, "sports": 1, "technology": 1, "animals": 1,
    "science": 1, "music": 1, "viral": 1, "internet_humor": 1, "trending_entertainment": 1
  }'::jsonb,
  function_url text not null,
  updated_at timestamptz not null default now()
);
insert into scroll_private.settings (function_url)
values ('https://djmyvnaragfwoaljzexn.supabase.co/functions/v1/scroll-discover-videos');

-- YouTube resets the daily quota at midnight Pacific time, so usage is kept per Pacific date.
create table scroll_private.quota_usage (
  quota_day date primary key,
  units_used integer not null default 0,
  search_calls integer not null default 0,
  videos_calls integer not null default 0,
  google_quota_exceeded boolean not null default false,
  updated_at timestamptz not null default now()
);

create table scroll_private.search_queries (
  id bigint generated always as identity primary key,
  category text not null,
  query text not null,
  order_by text not null default 'relevance' check (order_by in ('relevance', 'viewCount', 'date', 'rating')),
  published_within_days integer check (published_within_days is null or published_within_days > 0),
  active boolean not null default true,
  next_page_token text,
  times_searched integer not null default 0,
  last_searched_at timestamptz,
  last_result_count integer,
  unique (category, query, order_by)
);

insert into scroll_private.search_queries (category, query, order_by, published_within_days) values
  ('gaming', 'gaming #shorts', 'relevance', null),
  ('gaming', 'funny gaming moments #shorts', 'relevance', null),
  ('gaming', 'minecraft #shorts', 'relevance', null),
  ('memes', 'clean memes #shorts', 'relevance', null),
  ('memes', 'meme #shorts', 'relevance', null),
  ('comedy', 'comedy skit #shorts', 'relevance', null),
  ('comedy', 'funny #shorts', 'relevance', null),
  ('sports', 'sports highlights #shorts', 'relevance', null),
  ('sports', 'basketball #shorts', 'relevance', null),
  ('sports', 'soccer skills #shorts', 'relevance', null),
  ('technology', 'tech #shorts', 'relevance', null),
  ('technology', 'gadgets #shorts', 'relevance', null),
  ('technology', 'coding #shorts', 'relevance', null),
  ('animals', 'funny animals #shorts', 'relevance', null),
  ('animals', 'cute dog #shorts', 'relevance', null),
  ('animals', 'cat #shorts', 'relevance', null),
  ('science', 'science experiment #shorts', 'relevance', null),
  ('science', 'space facts #shorts', 'relevance', null),
  ('science', 'physics #shorts', 'relevance', null),
  ('music', 'music #shorts', 'relevance', null),
  ('music', 'piano cover #shorts', 'relevance', null),
  ('music', 'drum cover #shorts', 'relevance', null),
  ('viral', 'viral #shorts', 'viewCount', 30),
  ('viral', 'satisfying #shorts', 'relevance', null),
  ('internet_humor', 'internet humor #shorts', 'relevance', null),
  ('internet_humor', 'funny fails #shorts', 'relevance', null),
  ('trending_entertainment', 'trending #shorts', 'viewCount', 14),
  ('trending_entertainment', 'entertainment #shorts', 'viewCount', 30);

-- ------------------------------------------------------------------ public tables

create table public.scroll_videos (
  video_id text primary key check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  title text not null,
  description text,
  channel_title text,
  channel_id text,
  thumbnail_url text,
  duration_seconds integer check (duration_seconds >= 0),
  published_at timestamptz,
  view_count bigint,
  category text not null,
  youtube_category_id text,
  hashtags text[] not null default '{}',
  embeddable boolean not null default true,
  made_for_kids boolean,
  orientation text check (orientation in ('vertical', 'horizontal', 'square')),
  aspect_ratio real,
  is_active boolean not null default true,
  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  review_note text,
  trend_score double precision not null default 0,
  discovered_at timestamptz not null default now(),
  discovered_query text,
  discovered_run_id bigint,
  metadata_refreshed_at timestamptz not null default now(),
  deactivated_reason text
);
comment on table public.scroll_videos is 'SirSC Scroll catalog of YouTube video IDs and metadata from the YouTube Data API. Public can read approved, active rows only.';
comment on column public.scroll_videos.category is 'SirSC Scroll discovery category (the search category that found it), not YouTube''s own category.';
comment on column public.scroll_videos.orientation is 'From the embed size YouTube reports for the video''s aspect ratio (videos.list part=player with maxHeight). Null when not reported. Vertical alone does not prove the video is a YouTube Short.';
comment on column public.scroll_videos.embeddable is 'status.embeddable from the YouTube Data API. It does not mean the video plays on a school Chromebook; school restrictions must be tested separately.';
comment on column public.scroll_videos.review_status is 'pending until a person approves it. Only approved and active videos are publicly readable.';
comment on column public.scroll_videos.trend_score is 'view_count per day since publishing, as of the last metadata refresh.';

create index scroll_videos_public_newest on public.scroll_videos (published_at desc, video_id desc) where is_active and review_status = 'approved';
create index scroll_videos_public_trending on public.scroll_videos (trend_score desc, video_id desc) where is_active and review_status = 'approved';
create index scroll_videos_public_category on public.scroll_videos (category, trend_score desc) where is_active and review_status = 'approved';
create index scroll_videos_review on public.scroll_videos (review_status, discovered_at);
create index scroll_videos_refresh on public.scroll_videos (metadata_refreshed_at);

create table public.scroll_import_runs (
  id bigint generated always as identity primary key,
  mode text not null check (mode in ('discover', 'refresh')),
  trigger_source text not null check (trigger_source in ('manual', 'schedule', 'test')),
  status text not null default 'running' check (status in ('running', 'succeeded', 'partial', 'failed', 'skipped', 'abandoned')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  params jsonb not null default '{}'::jsonb,
  searches_planned integer not null default 0,
  searches_done integer not null default 0,
  videos_list_calls integer not null default 0,
  api_units_used integer not null default 0,
  candidates_found integer not null default 0,
  duplicates_in_run integer not null default 0,
  already_in_catalog integer not null default 0,
  validated integer not null default 0,
  rejected integer not null default 0,
  rejected_by_reason jsonb not null default '{}'::jsonb,
  inserted integer not null default 0,
  refreshed integer not null default 0,
  removed integer not null default 0,
  quota_stop_reason text,
  errors jsonb not null default '[]'::jsonb
);
comment on table public.scroll_import_runs is 'One row per discovery or refresh run of scroll-discover-videos. Not readable by the public.';
-- At most one run at a time.
create unique index scroll_import_runs_single_running on public.scroll_import_runs ((true)) where status = 'running';
create index scroll_import_runs_started on public.scroll_import_runs (started_at desc);

create function scroll_private.set_trend_score() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.trend_score := case
    when new.view_count is null or new.published_at is null then 0
    else new.view_count::double precision
         / greatest(1.0, extract(epoch from (coalesce(new.metadata_refreshed_at, now()) - new.published_at)) / 86400.0)
  end;
  return new;
end $$;
create trigger scroll_videos_trend_score before insert or update of view_count, published_at, metadata_refreshed_at
  on public.scroll_videos for each row execute function scroll_private.set_trend_score();

-- ------------------------------------------------------------------ RLS and grants

alter table public.scroll_videos enable row level security;
alter table public.scroll_import_runs enable row level security;
alter table scroll_private.settings enable row level security;
alter table scroll_private.quota_usage enable row level security;
alter table scroll_private.search_queries enable row level security;

create policy scroll_videos_public_read on public.scroll_videos
  for select to anon, authenticated
  using (is_active and review_status = 'approved');

-- Supabase grants everything on new public tables to anon/authenticated by default; take it back.
revoke all on public.scroll_videos from anon, authenticated;
grant select (video_id, title, description, channel_title, channel_id, thumbnail_url, duration_seconds,
              published_at, view_count, category, hashtags, embeddable, made_for_kids, orientation,
              aspect_ratio, is_active, review_status, trend_score, discovered_at, metadata_refreshed_at)
  on public.scroll_videos to anon, authenticated;
revoke all on public.scroll_import_runs from anon, authenticated;
revoke all on sequence public.scroll_import_runs_id_seq from anon, authenticated;

-- ------------------------------------------------------------------ trigger secret (Vault)

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'scroll_discovery_trigger_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'scroll_discovery_trigger_secret',
      'Sent by pg_cron and admin SQL to the scroll-discover-videos Edge Function, which asks the database to check it.'
    );
  end if;
end $$;

-- ------------------------------------------------------------------ admin functions (service_role only)

create function public.scroll_admin_verify_trigger(p_candidate text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select s.decrypted_secret = p_candidate
    from vault.decrypted_secrets s
    where s.name = 'scroll_discovery_trigger_secret'
    limit 1
  ), false)
$$;

create function public.scroll_admin_get_settings() returns jsonb
language sql stable security definer set search_path = '' as $$
  select to_jsonb(s) - 'function_url' from scroll_private.settings s where s.id = 1
$$;

create function public.scroll_admin_get_queries() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', q.id, 'category', q.category, 'query', q.query, 'order_by', q.order_by,
    'published_within_days', q.published_within_days, 'next_page_token', q.next_page_token,
    'last_searched_at', q.last_searched_at,
    'weight', coalesce((s.category_weights ->> q.category)::numeric, 1)
  ) order by q.last_searched_at nulls first, q.id), '[]'::jsonb)
  from scroll_private.search_queries q
  cross join scroll_private.settings s
  where q.active and s.id = 1
$$;

create function public.scroll_admin_start_run(p_mode text, p_trigger text, p_params jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  update public.scroll_import_runs
     set status = 'abandoned', finished_at = now(),
         errors = errors || jsonb_build_array(jsonb_build_object('stage', 'lock', 'message', 'Run exceeded 15 minutes and was marked abandoned.'))
   where status = 'running' and started_at < now() - interval '15 minutes';
  begin
    insert into public.scroll_import_runs (mode, trigger_source, params)
    values (p_mode, p_trigger, coalesce(p_params, '{}'::jsonb))
    returning id into v_id;
  exception when unique_violation then
    insert into public.scroll_import_runs (mode, trigger_source, params, status, finished_at, duration_ms, errors)
    values (p_mode, p_trigger, coalesce(p_params, '{}'::jsonb), 'skipped', now(), 0,
            jsonb_build_array(jsonb_build_object('stage', 'lock', 'message', 'Another run was still in progress.')));
    return null;
  end;
  return v_id;
end $$;

create function public.scroll_admin_reserve_units(p_units integer, p_kind text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_day date := (now() at time zone 'America/Los_Angeles')::date;
  v_limit integer;
  v_used integer;
  v_exceeded boolean;
begin
  select daily_unit_limit into v_limit from scroll_private.settings where id = 1;
  insert into scroll_private.quota_usage (quota_day) values (v_day) on conflict (quota_day) do nothing;
  update scroll_private.quota_usage
     set units_used = units_used + p_units,
         search_calls = search_calls + (case when p_kind = 'search' then 1 else 0 end),
         videos_calls = videos_calls + (case when p_kind = 'videos' then 1 else 0 end),
         updated_at = now()
   where quota_day = v_day and not google_quota_exceeded and units_used + p_units <= v_limit
  returning units_used into v_used;
  if v_used is null then
    select units_used, google_quota_exceeded into v_used, v_exceeded from scroll_private.quota_usage where quota_day = v_day;
    return jsonb_build_object('ok', false, 'used', v_used, 'limit', v_limit, 'day', v_day,
                              'reason', case when v_exceeded then 'google_quota_exceeded' else 'safety_limit' end);
  end if;
  return jsonb_build_object('ok', true, 'used', v_used, 'limit', v_limit, 'day', v_day);
end $$;

create function public.scroll_admin_mark_quota_exceeded() returns void
language sql security definer set search_path = '' as $$
  insert into scroll_private.quota_usage (quota_day, google_quota_exceeded)
  values ((now() at time zone 'America/Los_Angeles')::date, true)
  on conflict (quota_day) do update set google_quota_exceeded = true, updated_at = now()
$$;

create function public.scroll_admin_record_search(p_query_id bigint, p_next_page_token text, p_result_count integer) returns void
language sql security definer set search_path = '' as $$
  update scroll_private.search_queries
     set next_page_token = p_next_page_token, times_searched = times_searched + 1,
         last_searched_at = now(), last_result_count = p_result_count
   where id = p_query_id
$$;

create function public.scroll_admin_existing_ids(p_ids text[]) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(v.video_id), '{}') from public.scroll_videos v where v.video_id = any(p_ids)
$$;

create function public.scroll_admin_insert_videos(p_rows jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  insert into public.scroll_videos (
    video_id, title, description, channel_title, channel_id, thumbnail_url, duration_seconds, published_at,
    view_count, category, youtube_category_id, hashtags, embeddable, made_for_kids, orientation, aspect_ratio,
    discovered_query, discovered_run_id, metadata_refreshed_at)
  select r.video_id, r.title, r.description, r.channel_title, r.channel_id, r.thumbnail_url, r.duration_seconds,
         r.published_at, r.view_count, r.category, r.youtube_category_id, coalesce(r.hashtags, '{}'), r.embeddable,
         r.made_for_kids, r.orientation, r.aspect_ratio, r.discovered_query, r.discovered_run_id, now()
  from jsonb_to_recordset(p_rows) as r(
    video_id text, title text, description text, channel_title text, channel_id text, thumbnail_url text,
    duration_seconds integer, published_at timestamptz, view_count bigint, category text, youtube_category_id text,
    hashtags text[], embeddable boolean, made_for_kids boolean, orientation text, aspect_ratio real,
    discovered_query text, discovered_run_id bigint)
  on conflict (video_id) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create function public.scroll_admin_refresh_candidates(p_limit integer) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(x.video_id), '{}') from (
    select v.video_id from public.scroll_videos v, scroll_private.settings s
    where s.id = 1 and v.metadata_refreshed_at < now() - make_interval(days => s.refresh_after_days)
    order by v.metadata_refreshed_at
    limit greatest(0, least(coalesce(p_limit, 0), 5000))
  ) x
$$;

create function public.scroll_admin_apply_refresh(p_rows jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  update public.scroll_videos v set
    title = r.title, description = r.description, channel_title = r.channel_title, channel_id = r.channel_id,
    thumbnail_url = r.thumbnail_url, duration_seconds = r.duration_seconds, published_at = r.published_at,
    view_count = r.view_count, youtube_category_id = r.youtube_category_id, hashtags = coalesce(r.hashtags, '{}'),
    embeddable = r.embeddable, made_for_kids = r.made_for_kids, orientation = r.orientation,
    aspect_ratio = r.aspect_ratio, metadata_refreshed_at = now(),
    is_active = case when v.deactivated_reason = 'metadata_expired' then true else v.is_active end,
    deactivated_reason = case when v.deactivated_reason = 'metadata_expired' then null else v.deactivated_reason end
  from jsonb_to_recordset(p_rows) as r(
    video_id text, title text, description text, channel_title text, channel_id text, thumbnail_url text,
    duration_seconds integer, published_at timestamptz, view_count bigint, youtube_category_id text,
    hashtags text[], embeddable boolean, made_for_kids boolean, orientation text, aspect_ratio real)
  where v.video_id = r.video_id;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Videos that are gone, private, no longer embeddable or otherwise invalid on refresh are deleted.
create function public.scroll_admin_remove_videos(p_ids text[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  delete from public.scroll_videos where video_id = any(p_ids);
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Retention: metadata that could not be refreshed within max_metadata_age_days is blanked and the
-- video hidden until a later refresh succeeds (the ID and review decision are kept).
create function public.scroll_admin_expire_stale() returns integer
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  update public.scroll_videos v set
    title = '', description = null, channel_title = null, thumbnail_url = null, view_count = null,
    hashtags = '{}', is_active = false, deactivated_reason = 'metadata_expired'
  from scroll_private.settings s
  where s.id = 1
    and v.metadata_refreshed_at < now() - make_interval(days => s.max_metadata_age_days)
    and v.deactivated_reason is distinct from 'metadata_expired';
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create function public.scroll_admin_finish_run(p_run_id bigint, p_status text, p_stats jsonb) returns void
language sql security definer set search_path = '' as $$
  update public.scroll_import_runs r set
    status = p_status,
    finished_at = now(),
    duration_ms = (extract(epoch from (now() - r.started_at)) * 1000)::integer,
    searches_planned = coalesce((p_stats ->> 'searches_planned')::integer, r.searches_planned),
    searches_done = coalesce((p_stats ->> 'searches_done')::integer, r.searches_done),
    videos_list_calls = coalesce((p_stats ->> 'videos_list_calls')::integer, r.videos_list_calls),
    api_units_used = coalesce((p_stats ->> 'api_units_used')::integer, r.api_units_used),
    candidates_found = coalesce((p_stats ->> 'candidates_found')::integer, r.candidates_found),
    duplicates_in_run = coalesce((p_stats ->> 'duplicates_in_run')::integer, r.duplicates_in_run),
    already_in_catalog = coalesce((p_stats ->> 'already_in_catalog')::integer, r.already_in_catalog),
    validated = coalesce((p_stats ->> 'validated')::integer, r.validated),
    rejected = coalesce((p_stats ->> 'rejected')::integer, r.rejected),
    rejected_by_reason = coalesce(p_stats -> 'rejected_by_reason', r.rejected_by_reason),
    inserted = coalesce((p_stats ->> 'inserted')::integer, r.inserted),
    refreshed = coalesce((p_stats ->> 'refreshed')::integer, r.refreshed),
    removed = coalesce((p_stats ->> 'removed')::integer, r.removed),
    quota_stop_reason = coalesce(p_stats ->> 'quota_stop_reason', r.quota_stop_reason),
    errors = coalesce(p_stats -> 'errors', r.errors)
  where r.id = p_run_id
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'scroll_admin_verify_trigger(text)', 'scroll_admin_get_settings()', 'scroll_admin_get_queries()',
    'scroll_admin_start_run(text, text, jsonb)', 'scroll_admin_reserve_units(integer, text)',
    'scroll_admin_mark_quota_exceeded()', 'scroll_admin_record_search(bigint, text, integer)',
    'scroll_admin_existing_ids(text[])', 'scroll_admin_insert_videos(jsonb)',
    'scroll_admin_refresh_candidates(integer)', 'scroll_admin_apply_refresh(jsonb)',
    'scroll_admin_remove_videos(text[])', 'scroll_admin_expire_stale()',
    'scroll_admin_finish_run(bigint, text, jsonb)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- ------------------------------------------------------------------ admin helpers (SQL editor / pg_cron)

-- Calls the Edge Function with the Vault secret. Asynchronous: the response lands in net._http_response.
create function scroll_private.invoke(p_body jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_url text; v_secret text; v_id bigint;
begin
  select function_url into v_url from scroll_private.settings where id = 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'scroll_discovery_trigger_secret';
  select net.http_post(
    url := v_url,
    body := p_body,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-scroll-trigger-secret', v_secret),
    timeout_milliseconds := 30000
  ) into v_id;
  return v_id;
end $$;

create function scroll_private.run_discovery(p_searches integer default null, p_trigger text default 'manual') returns bigint
language sql security definer set search_path = '' as $$
  select scroll_private.invoke(jsonb_build_object('mode', 'discover', 'searches', p_searches, 'trigger', p_trigger))
$$;

create function scroll_private.run_refresh(p_trigger text default 'manual') returns bigint
language sql security definer set search_path = '' as $$
  select scroll_private.invoke(jsonb_build_object('mode', 'refresh', 'trigger', p_trigger))
$$;

create function scroll_private.set_review_status(p_ids text[], p_status text, p_note text default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if p_status not in ('pending', 'approved', 'rejected') then
    raise exception 'review status must be pending, approved or rejected';
  end if;
  update public.scroll_videos
     set review_status = p_status, reviewed_at = case when p_status = 'pending' then null else now() end,
         review_note = p_note
   where video_id = any(p_ids);
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create view scroll_private.review_queue as
  select video_id, 'https://www.youtube.com/watch?v=' || video_id as watch_url, title, channel_title, category,
         duration_seconds, orientation, view_count, published_at, made_for_kids, discovered_at
  from public.scroll_videos
  where review_status = 'pending' and is_active
  order by category, discovered_at;

create view scroll_private.quota_today as
  select * from scroll_private.quota_usage where quota_day = (now() at time zone 'America/Los_Angeles')::date;

revoke all on all functions in schema scroll_private from public;
revoke all on all tables in schema scroll_private from public, anon, authenticated;
