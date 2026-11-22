// Warden Chat's Supabase project: Warden Chat accounts, the video catalog and SirSC Scroll's likes and
// comments all live there. The publishable key is public by design (every Warden Chat page ships it);
// what it can do is decided by the database: read approved videos, and call functions that check the
// signed-in person's session themselves.
export const SUPABASE = {
  url: 'https://djmyvnaragfwoaljzexn.supabase.co',
  publishableKey: 'sb_publishable_cKmFKnmgDTlUNm9hGui2mQ_j_rs0oni',
};
