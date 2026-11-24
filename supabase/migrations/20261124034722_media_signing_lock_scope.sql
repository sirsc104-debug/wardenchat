-- Stop media signing from serializing a user's requests behind the slow part of
-- authorize_media_signing.
--
-- Before: authorize_media_signing called take_operation('media-sign',120,60)
-- before its storage.objects lookup and permission checks. take_operation takes
-- pg_advisory_xact_lock on (user, 'media-sign'), and an xact lock is held until
-- commit, so the lock covered all of those lookups. Every signing request from
-- one user ran one at a time. On the morning of 2026-11-23 one account made
-- about 20 signing calls a minute from 3 sessions; under load each call took
-- seconds, the queue reached 257 lock waits in two hours, and every waiting
-- request held one of PostgREST's connections (max_connections is 60), which
-- slowed unrelated chat, login and game requests.
--
-- After:
-- * The storage and permission checks run first, with no lock.
-- * take_operation runs last, so its lock is held only for the bookkeeping
--   (delete, count, insert on operation_limits) and the commit.
-- * A user already at the limit is still turned away before the storage and
--   permission lookups, by an unlocked count. It is only an early exit; the
--   exact check is still take_operation's, under the lock.
--
-- Unchanged: the limit (120 per 60 seconds), the error messages and codes,
-- and what gets counted. An exception rolls back take_operation's insert, so
-- denied requests were never counted before and still aren't. The one visible
-- difference: a request that is both over the limit and not permitted may now
-- get 'Media unavailable.' instead of 'Too many requests.'.

do $guard$
begin
  if md5(pg_get_functiondef('public.authorize_media_signing(text,text)'::regprocedure))
      is distinct from 'dff0c50584be27dd0ed8b162aee11448' then
    raise exception 'authorize_media_signing changed since this migration was written; re-check it before applying';
  end if;
  if md5(pg_get_functiondef('warden_private.take_operation(text,integer,integer)'::regprocedure))
      is distinct from '95881481c2728e825ca02b2567f9b31f' then
    raise exception 'take_operation changed since this migration was written; re-check it before applying';
  end if;
end $guard$;

set local lock_timeout = '3s';
set local statement_timeout = '20s';

create or replace function public.authorize_media_signing(media_bucket text, object_path text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare session_end timestamptz; token_end timestamptz; valid_until timestamptz;
begin
  if not public.launcher_client_access('warden-native') then
    raise exception 'Client access denied.' using errcode='42501';
  end if;

  perform warden_private.assert_active();
  select s.not_after into session_end from auth.sessions s where s.user_id=auth.uid()
    and s.id::text=auth.jwt()->>'session_id' and (s.not_after is null or s.not_after>now());
  if not found or coalesce(auth.jwt()->>'exp','') !~ '^[0-9]{1,12}$' then
    raise exception 'Media unavailable.' using errcode='42501'; end if;
  token_end:=to_timestamp((auth.jwt()->>'exp')::bigint);
  valid_until:=least(clock_timestamp()+interval '60 seconds',token_end,coalesce(session_end,'infinity'::timestamptz));
  if valid_until<=clock_timestamp() then raise exception 'Media unavailable.' using errcode='42501'; end if;
  if media_bucket is null or media_bucket not in('chat-images','avatars') or object_path is null
    or char_length(object_path) not between 1 and 512 or object_path !~ '^[A-Za-z0-9][A-Za-z0-9._/-]*$'
    or object_path ~ '(^|/)(\.|\.\.)(/|$)' or object_path like '%//%' or right(object_path,1)='/' then
    raise exception 'Invalid media request.' using errcode='22023'; end if;

  -- Early exit for a user who is already at the limit, so they don't get the
  -- storage and permission lookups below. No lock, so it can miss requests
  -- that are still in flight; take_operation below makes the exact check.
  -- Same window as take_operation: rows older than 60 seconds don't count.
  if (select count(*) from warden_private.operation_limits l
        where l.user_id=auth.uid() and l.action='media-sign'
          and l.occurred_at > clock_timestamp() - interval '60 seconds') >= 120 then
    raise exception 'Too many requests. Please wait before trying again.' using errcode='P0001';
  end if;

  if not exists(select 1 from storage.objects where bucket_id=media_bucket and name=object_path)
    or not (case media_bucket
      when 'chat-images' then public.can_read_chat_image(object_path)
      when 'avatars' then public.user_id_from_path(object_path)=auth.uid()
        or public.can_interact_with(public.user_id_from_path(object_path))
      else false end) then
    raise exception 'Media unavailable.' using errcode='42501'; end if;

  -- Count the request last. take_operation's per-user lock is held until
  -- commit, so from here on it covers only the bookkeeping and the commit.
  perform warden_private.take_operation('media-sign',120,60);

  return jsonb_build_object('bucket',media_bucket,'path',object_path,'viewerId',auth.uid(),
    'validUntil',valid_until);
end $function$;
