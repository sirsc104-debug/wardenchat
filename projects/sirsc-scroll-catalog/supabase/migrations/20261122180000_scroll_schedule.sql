-- SirSC Scroll: daily discovery and metadata refresh with pg_cron.
--
-- Times are UTC. YouTube resets the daily quota at midnight Pacific time, so both jobs run shortly after:
--   10:17 UTC = 2:17 AM PST (3:17 AM PDT)  discovery, scroll_private.settings.scheduled_searches_per_day searches
--   10:47 UTC = 2:47 AM PST (3:47 AM PDT)  refresh metadata older than refresh_after_days, expire anything
--                                          older than max_metadata_age_days
-- The Edge Function's own lock means a run never overlaps another, and every API call is checked against
-- daily_unit_limit first.
--
-- Change the volume:   update scroll_private.settings set scheduled_searches_per_day = 10;
-- Change the weights:  update scroll_private.settings set category_weights = category_weights || '{"science": 2}';
-- Pause discovery:     update scroll_private.settings set discovery_enabled = false;
-- Change the time:     select cron.alter_job((select jobid from cron.job where jobname = 'scroll-discover-daily'), schedule := '17 11 * * *');

select cron.schedule('scroll-discover-daily', '17 10 * * *', $$select scroll_private.run_discovery(null, 'schedule')$$);
select cron.schedule('scroll-refresh-daily', '47 10 * * *', $$select scroll_private.run_refresh('schedule')$$);
