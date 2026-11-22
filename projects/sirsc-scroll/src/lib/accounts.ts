// Ties the Warden Chat sign-in (lib/warden.ts) to the app's per-account data (state/actions.ts):
// signing in switches to that account's data in this browser, signing out (or an account being
// suspended) puts the empty placeholder back behind the sign-in screen.
import { authSnapshot, onSignedIn, signOut, startAuth } from './warden';
import { enterAccount, leaveAccount } from '../state/actions';
import { startNoticePolling } from './social';

let stopPolling: (() => void) | null = null;

export function startAccounts() {
  onSignedIn((u) => {
    enterAccount(u);
    stopPolling?.();
    stopPolling = startNoticePolling();
  });
  void startAuth();
}

/** The sign-in ended (signed out, expired, or the account was suspended): hide the account's data. */
export function accountEnded() {
  stopPolling?.();
  stopPolling = null;
  leaveAccount();
}

/** Sign out on this browser. With forget, also remove this account's follows, saves and history here. */
export async function signOutHere(forget = false) {
  stopPolling?.();
  stopPolling = null;
  leaveAccount(forget);
  if (authSnapshot().status !== 'signed-out') await signOut();
}
