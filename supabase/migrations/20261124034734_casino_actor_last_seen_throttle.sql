-- Stop casino_actor from row-locking the caller's casino_accounts row on every
-- casino request.
--
-- Before: casino_actor upserted casino_accounts.last_seen on every call. It
-- runs at the start of casino_room_state, casino_settle, casino_round_act,
-- casino_round_start, casino_round_state, casino_hello, casino_refill and every
-- room RPC that goes through casino_room_actor. Each upsert row-locks the
-- user's casino_accounts row until commit, so two casino requests from the same
-- user at once queued on that row. On the morning of 2026-11-23 the logs show
-- these waits ("while inserting index tuple ... in relation casino_accounts").
--
-- After: the upsert runs only when the row is missing or last_seen is more
-- than 30 seconds old. The check is a plain read, which takes no row lock, so
-- most calls touch nothing.
--
-- Why 30 seconds is safe: the only reader of last_seen is casino_friends,
-- which shows a friend as online when last_seen is within the last 2 minutes.
-- Nothing relies on the upsert's row lock for correctness: casino_hello,
-- casino_refill and casino_settle serialize balance changes with
-- sirsc_lock_wallet, and the welcomed and refill_day updates take their own
-- row locks.
--
-- Not changed here: casino_room_clean still takes pg_advisory_xact_lock(104,
-- 61103) exclusively, but since 20261123144756 and 20261123180226 the polled
-- callers (casino_room_invites, casino_room_state) no longer run it on every
-- call. The remaining callers are membership and host actions (create, join,
-- leave, ready, start, game, lobby, invite, decline, friends), which need that
-- lock to stay exclusive against PvP requests.

do $guard$
begin
  if md5(pg_get_functiondef('warden_private.casino_actor()'::regprocedure))
      is distinct from '703b288a68c23426181e842cbfb3f108' then
    raise exception 'casino_actor changed since this migration was written; re-check it before applying';
  end if;
end $guard$;

set local lock_timeout = '3s';
set local statement_timeout = '20s';

create or replace function warden_private.casino_actor()
 returns uuid
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
declare actor uuid := auth.uid();
begin
  if actor is null or not coalesce(warden_private.game_session_valid(), false) then
    raise exception 'casino_not_signed_in' using errcode = 'P0001';
  end if;
  -- Only write when the row is missing or last_seen is stale. The read takes
  -- no lock, so most casino calls skip the row lock that the upsert takes.
  if not exists (select from warden_private.casino_accounts a
      where a.user_id = actor and a.last_seen >= clock_timestamp() - interval '30 seconds') then
    insert into warden_private.casino_accounts(user_id,last_seen) values(actor,clock_timestamp())
      on conflict (user_id) do update set last_seen = excluded.last_seen;
  end if;
  return actor;
end $function$;
