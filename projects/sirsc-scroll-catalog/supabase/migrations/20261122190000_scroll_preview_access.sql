-- SirSC Scroll: owner preview of unreviewed videos, and lookup by ID.
--
-- Review status keeps one meaning: 'approved' = approved for students. Until the school has approved a
-- list, the site's owner previews the catalog with a private preview key:
--   * the key is random, generated here and kept in Vault (read it in the SQL editor:
--       select decrypted_secret from vault.decrypted_secrets where name = 'scroll_preview_key';)
--   * it is typed into SirSC Scroll's Settings on the owner's device and kept only in that browser
--   * with it, scroll_feed / scroll_categories / scroll_videos_lookup also return pending videos
--     (never rejected or inactive ones); without it, only approved ones
-- These three functions are security definer so they can apply that rule; each filters explicitly on
-- is_active and review_status. Direct table reads still go through RLS (approved only).

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'scroll_preview_key') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(24), 'hex'),
      'scroll_preview_key',
      'Owner preview key for SirSC Scroll: a browser that has it also sees pending (unreviewed) catalog videos.'
    );
  end if;
end $$;

create function scroll_private.preview_ok(p_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_key is not null and length(p_key) between 32 and 128 and exists (
    select 1 from vault.decrypted_secrets s where s.name = 'scroll_preview_key' and s.decrypted_secret = p_key
  )
$$;
revoke all on function scroll_private.preview_ok(text) from public;

drop function public.scroll_feed(text, text, text, integer, text[], text[]);
drop function public.scroll_categories();

create function public.scroll_feed(
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
      and (v.review_status = 'approved' or (v_preview and v.review_status = 'pending'))
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

create function public.scroll_categories(p_preview_key text default null) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('category', c.category, 'videos', c.videos) order by c.videos desc, c.category), '[]'::jsonb)
  from (
    select v.category, count(*) as videos
    from public.scroll_videos v
    where v.is_active
      and (v.review_status = 'approved' or (scroll_private.preview_ok(p_preview_key) and v.review_status = 'pending'))
    group by v.category
  ) c
$$;

-- Details for specific IDs (saved, liked, history...), at most 200 per call, same visibility rule.
create function public.scroll_videos_lookup(p_ids text[], p_preview_key text default null) returns jsonb
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
      and (v.review_status = 'approved' or (v_preview and v.review_status = 'pending'))
  ), '[]'::jsonb));
end $$;

revoke all on function public.scroll_feed(text, text, text, integer, text[], text[], text) from public;
revoke all on function public.scroll_categories(text) from public;
revoke all on function public.scroll_videos_lookup(text[], text) from public;
grant execute on function public.scroll_feed(text, text, text, integer, text[], text[], text) to anon, authenticated, service_role;
grant execute on function public.scroll_categories(text) to anon, authenticated, service_role;
grant execute on function public.scroll_videos_lookup(text[], text) to anon, authenticated, service_role;
