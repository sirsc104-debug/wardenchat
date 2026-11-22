import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Eye, EyeOff, LogIn, LogOut, RotateCcw, ShieldAlert } from 'lucide-react';
import { BrandMark } from '../components/common/Brand';
import { ApiError, recheck, signIn, USERNAME_RE, WARDEN_CHAT_URL, type AuthSnapshot } from '../lib/warden';
import { signOutHere } from '../lib/accounts';

const DEMO = typeof __DEMO_BACKEND__ !== 'undefined' && __DEMO_BACKEND__;

function signInError(e: unknown): string {
  const code = e instanceof ApiError ? e.code : 'error';
  switch (code) {
    case 'bad_username':
      return 'Usernames are 3 to 24 letters, numbers, dots, dashes or underscores.';
    case 'bad_credentials':
      return 'That username and password don’t match a Warden Chat account.';
    case 'rate_limited':
      return 'Too many tries. Wait a minute, then try again.';
    case 'offline':
      return 'Couldn’t reach Warden Chat. Check your connection and try again.';
    case 'not_deployed':
      return 'SirSC Scroll’s sign-in isn’t switched on yet.';
    case 'server_error':
      return 'Warden Chat is having trouble right now. Try again in a minute.';
    case 'session_changed':
      return '';
    default:
      return 'Something went wrong. Try again.';
  }
}

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="auth-page">
      <div className="auth-glow" aria-hidden="true" />
      <main className={`auth-card${wide ? ' wide' : ''}`}>
        <div className="auth-brand">
          <BrandMark size={84} className="auth-logo" />
          <h1 className="auth-title">
            <span className="wm-sirsc">SirSC</span> <span className="wm-scroll">Scroll</span>
          </h1>
          <p className="auth-tag">Your Feed. Your Way.</p>
        </div>
        {children}
      </main>
    </div>
  );
}

/** Everything someone sees before they're signed in: the sign-in form, "checking", or the banned screen. */
export function SignIn({ auth }: { auth: AuthSnapshot }) {
  if (auth.status === 'checking')
    return (
      <Shell>
        <div className="auth-checking" role="status">
          <span className="auth-spinner" aria-hidden="true" /> Signing you in…
        </div>
      </Shell>
    );
  if (auth.status === 'restricted' && auth.restriction) return <Restricted auth={auth} />;
  return <SignInForm notice={auth.notice} />;
}

function SignInForm({ notice }: { notice: string | null }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const userRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    userRef.current?.focus();
  }, []);

  const submit = async () => {
    if (busy) return;
    const name = username.trim();
    if (!name) {
      setError('Enter your Warden Chat username.');
      userRef.current?.focus();
      return;
    }
    if (!USERNAME_RE.test(name)) {
      setError(signInError(new ApiError('bad_username')));
      userRef.current?.focus();
      return;
    }
    if (!password) {
      setError('Enter your password.');
      passRef.current?.focus();
      return;
    }
    setBusy(true);
    setError('');
    try {
      await signIn(name, password);
    } catch (e) {
      const msg = signInError(e);
      if (msg) setError(msg);
      setPassword('');
      passRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <form
        className="auth-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        noValidate
      >
        <h2 className="auth-h">Sign in with Warden Chat</h2>
        <p className="auth-sub">Use the username and password you use on Warden Chat.</p>
        {notice && !error && (
          <p className="auth-note" role="status">
            {notice}
          </p>
        )}
        {DEMO && (
          <p className="auth-note demo" role="note">
            Demo build: nothing here reaches Warden Chat. Sign in with any username (try <b>demo</b>) and a password of 4 or more characters.
          </p>
        )}
        <label className="auth-field">
          <span>Username</span>
          <input
            ref={userRef}
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={24}
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              if (error) setError('');
            }}
            aria-invalid={!!error && !username.trim() ? true : undefined}
          />
        </label>
        <label className="auth-field">
          <span>Password</span>
          <span className="auth-pass">
            <input
              ref={passRef}
              name="password"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError('');
              }}
            />
            <button type="button" className="icon-btn xs" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </span>
        </label>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-accent btn-block auth-submit" disabled={busy}>
          {busy ? (
            <>
              <span className="auth-spinner sm" aria-hidden="true" /> Signing in…
            </>
          ) : (
            <>
              <LogIn size={16} /> Sign in
            </>
          )}
        </button>
        <p className="auth-alt">
          <span>No Warden Chat account?</span>
          <a href={WARDEN_CHAT_URL} target="_blank" rel="noopener noreferrer">
            Create one on Warden Chat <ExternalLink size={12} />
          </a>
          <span>then come back here and sign in.</span>
        </p>
        <p className="auth-fine">Your password only goes to Warden Chat. Change it, or your picture, on Warden Chat.</p>
      </form>
    </Shell>
  );
}

function Restricted({ auth }: { auth: AuthSnapshot }) {
  const r = auth.restriction!;
  const [busy, setBusy] = useState(false);
  const [still, setStill] = useState(false);
  const until = r.until ? new Date(r.until) : null;
  const banned = r.status === 'banned' || !until;
  return (
    <Shell wide>
      <div className="auth-form restricted" role="alert">
        <ShieldAlert size={30} className="auth-alert-ico" />
        <h2 className="auth-h">{banned ? 'Your Warden Chat account is banned' : 'Your Warden Chat account is suspended'}</h2>
        {!banned && until && (
          <p className="auth-sub">
            Until {until.toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.
          </p>
        )}
        {r.reason && (
          <blockquote className="auth-reason">
            <span>Reason from the Warden Chat admins</span>
            {r.reason}
          </blockquote>
        )}
        <p className="auth-sub">SirSC Scroll uses your Warden Chat account, so it isn’t available while the account is {banned ? 'banned' : 'suspended'}.</p>
        {still && <p className="auth-note">Still {banned ? 'banned' : 'suspended'}.</p>}
        <div className="auth-actions">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const s = await recheck();
              setBusy(false);
              setStill(s === 'restricted');
            }}
          >
            <RotateCcw size={14} /> {busy ? 'Checking…' : 'Check again'}
          </button>
          <button type="button" className="btn btn-accent" onClick={() => void signOutHere()}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>
    </Shell>
  );
}
