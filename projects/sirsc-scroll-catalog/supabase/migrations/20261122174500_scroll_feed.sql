-- SirSC Scroll: read-only feed API over public.scroll_videos.
--
-- Both functions run with the caller's rights (security invoker), so Row Level Security still applies:
-- anonymous and signed-in visitors only ever see approved, active videos.
--
--   select public.scroll_feed('for_you');                          -- first page
--   select public.scroll_feed('for_you', null, '<next_cursor>');   -- next page
--   select public.scroll_feed('category', 'animals');
--   select public.scroll_feed('random', p_exclude => array['abc123def45']);
--
-- Feeds
--   for_you   popularity (log of views per day) + preferred length (<= 90 s) + vertical + optional
--             category boosts from the client's local recommender + seeded randomness
--   trending  views per day since publishing (as of the last metadata refresh)
--   newest    published date
--   category  trending order within one category (p_category required)
--   random    seeded shuffle
-- Pagination is keyset-based. The cursor is opaque; it carries the feed's random seed so pages of
-- for_you / random stay consistent. p_exclude drops IDs the client has already shown (max 1000).

create function public.scroll_feed(
  p_feed text default 'for_you',
  p_category text default null,
  p_cursor text default null,
  p_limit integer default 20,
  p_exclude text[] default '{}',
  p_boost_categories text[] default '{}'
) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_feed text := lower(coalesce(p_feed, 'for_you'));
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_exclude text[] := coalesce(p_exclude[1:1000], '{}');
  v_boost text[] := coalesce(p_boost_categories[1:20], '{}');
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
    where v.is_active and v.review_status = 'approved'
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
    'items', v_items,
    'next_cursor', case when v_count = v_limit then
      replace(encode(convert_to(jsonb_build_object('f', v_feed, 'c', p_category, 's', v_last_score, 'id', v_last_id, 'seed', v_seed)::text, 'UTF8'), 'base64'), E'\n', '')
    end
  );
end $$;

create function public.scroll_categories() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('category', c.category, 'videos', c.videos) order by c.videos desc, c.category), '[]'::jsonb)
  from (
    select v.category, count(*) as videos
    from public.scroll_videos v
    where v.is_active and v.review_status = 'approved'
    group by v.category
  ) c
$$;

revoke all on function public.scroll_feed(text, text, text, integer, text[], text[]) from public;
revoke all on function public.scroll_categories() from public;
grant execute on function public.scroll_feed(text, text, text, integer, text[], text[]) to anon, authenticated, service_role;
grant execute on function public.scroll_categories() to anon, authenticated, service_role;
