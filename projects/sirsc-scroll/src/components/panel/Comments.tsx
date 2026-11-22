import { Fragment, memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Flag, Heart, Lock, MessageSquare, RotateCcw, Send, Trash2, X } from 'lucide-react';
import type { Comment, Video } from '../../state/types';
import { Avatar } from '../common/Avatar';
import { Verified } from '../common/Verified';
import { usePersisted, useS } from '../../state/store';
import { confirmAction, notePosted, openModal, toast } from '../../state/actions';
import { getUser, sampleComments } from '../../lib/catalog';
import { ago, compact, full } from '../../lib/format';
import { href } from '../../lib/router';
import { useHeightTween, useNow } from '../../lib/hooks';
import { HANDLE_MAP, memberUser, signedInUser } from '../../data/users';
import { useAuth } from '../../lib/warden';
import {
  deleteComment,
  loadReplies,
  loadThread,
  postComment,
  repliesFor,
  setCommentLiked,
  socialErrorText,
  useSocialVersion,
  useThread,
  type CommentSort,
  type RemoteComment,
} from '../../lib/social';

/** Turns @handles and #tags into links (or highlights, for Warden Chat usernames). */
export function RichText({ text }: { text: string }) {
  const parts = (text ?? '').split(/([@#][\p{L}\p{N}._-]+)/u);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('@') && part.length > 1) {
          const handle = part.slice(1).toLowerCase().replace(/[.]+$/, '');
          return HANDLE_MAP.has(handle) ? (
            <a key={i} className="mention" href={href.profile(handle)}>
              {part}
            </a>
          ) : (
            <span key={i} className="mention">
              {part}
            </span>
          );
        }
        if (part.startsWith('#') && part.length > 1)
          return (
            <a key={i} className="mention" href={href.tag(part.slice(1).toLowerCase())}>
              {part}
            </a>
          );
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

/** The replies under a comment; opening and closing them animates the height. */
function Replies({ open, children }: { open: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useHeightTween(ref, open);
  return (
    <div className="replies" ref={ref}>
      {children}
    </div>
  );
}

function SortTabs({ sort, setSort }: { sort: CommentSort; setSort: (s: CommentSort) => void }) {
  return (
    <div className="seg seg-sm" role="tablist" aria-label="Sort comments">
      <button type="button" role="tab" aria-selected={sort === 'top'} onClick={() => setSort('top')}>
        Top
      </button>
      <button type="button" role="tab" aria-selected={sort === 'new'} onClick={() => setSort('new')}>
        Newest
      </button>
    </div>
  );
}

interface Props {
  video: Video;
  /** Bumping the composer-focus counter focuses the composer (the C shortcut). */
  autoFocus?: boolean;
  /** Widget layout: sort bar, a thread that scrolls on its own, composer pinned underneath. */
  variant?: 'widget';
}

/** Comments on a video: real ones from Warden Chat's database, or sample ones on a demo clip. */
export const Comments = memo(function Comments({ video, autoFocus, variant }: Props) {
  const [sort, setSort] = useState<CommentSort>('top');
  const thread = useThread(video.id, sort);
  if (thread.status === 'closed') return video.source ? <ClosedNote variant={variant} /> : <SampleComments video={video} variant={variant} />;
  return <LiveComments video={video} sort={sort} setSort={setSort} autoFocus={autoFocus} variant={variant} />;
});

function ClosedNote({ variant }: { variant?: 'widget' }) {
  return (
    <div className={`comments${variant === 'widget' ? ' comments-widget' : ''}`}>
      <div className="comments-off">
        <Lock size={16} /> Likes and comments open once this video is approved.
      </div>
    </div>
  );
}

function LiveComments({ video, sort, setSort, autoFocus, variant }: { video: Video; sort: CommentSort; setSort: (s: CommentSort) => void; autoFocus?: boolean; variant?: 'widget' }) {
  useSocialVersion();
  const thread = useThread(video.id, sort);
  const [replyTo, setReplyTo] = useState<RemoteComment | null>(null);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const composerFocus = useS((s) => s.composerFocus);

  useEffect(() => {
    setReplyTo(null);
    setOpen(new Set());
  }, [video.id]);

  const toggleThread = (c: RemoteComment) => {
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(c.id)) n.delete(c.id);
      else {
        n.add(c.id);
        if (repliesFor(c.id)?.status !== 'ready') void loadReplies(c.id, video.id);
      }
      return n;
    });
  };

  const list = (
    <ul className="comment-list">
      {thread.items.map((c) => {
        const isOpen = open.has(c.id);
        const reps = repliesFor(c.id);
        return (
          <li key={c.id}>
            <CommentRow c={c} onReply={() => setReplyTo(c)} />
            {c.replies > 0 && (
              <Replies open={isOpen}>
                {isOpen && reps?.items.map((r) => <CommentRow key={r.id} c={r} reply onReply={() => setReplyTo(r)} />)}
                {isOpen && reps?.status === 'loading' && !reps.items.length && <p className="comments-loading small">Loading replies…</p>}
                {isOpen && reps?.status === 'error' && (
                  <button type="button" className="link-btn replies-toggle" onClick={() => void loadReplies(c.id, video.id)}>
                    Couldn’t load replies. Try again
                  </button>
                )}
                <button type="button" className="link-btn replies-toggle" onClick={() => toggleThread(c)}>
                  {isOpen ? 'Hide replies' : `View ${c.replies} ${c.replies === 1 ? 'reply' : 'replies'}`}
                </button>
              </Replies>
            )}
          </li>
        );
      })}
    </ul>
  );

  const body = (
    <>
      {thread.status === 'loading' && !thread.items.length && <p className="comments-loading">Loading comments…</p>}
      {thread.status === 'error' && (
        <div className="comments-empty">
          <span>{thread.error}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void loadThread(video.id, sort)}>
            <RotateCcw size={13} /> Try again
          </button>
        </div>
      )}
      {list}
      {thread.status === 'ready' && !thread.items.length && (
        <div className="comments-empty">
          <MessageSquare size={18} /> No comments yet. Start the conversation.
        </div>
      )}
      {thread.status === 'ready' && thread.items.length < thread.topLevel && (
        <button type="button" className="btn btn-ghost btn-block btn-sm" disabled={thread.loadingMore} onClick={() => void loadThread(video.id, sort, true)}>
          {thread.loadingMore ? 'Loading…' : 'Show more comments'}
        </button>
      )}
    </>
  );

  const composer = (
    <Composer
      video={video}
      replyTo={replyTo}
      clearReply={() => setReplyTo(null)}
      focusKey={variant === 'widget' || autoFocus ? composerFocus : 0}
      onPosted={(c) => {
        if (c.parentId != null) setOpen((s) => new Set(s).add(c.parentId!));
      }}
    />
  );

  if (variant === 'widget') {
    return (
      <div className="comments comments-widget">
        <div className="cw-bar">
          <span className="cw-count">{full(thread.total)} comments</span>
          <SortTabs sort={sort} setSort={setSort} />
        </div>
        <div className="cw-scroll">{body}</div>
        {composer}
      </div>
    );
  }

  return (
    <div className="comments comments-full">
      <div className="comments-head">
        <h3>
          Comments <span>{full(thread.total)}</span>
        </h3>
        <SortTabs sort={sort} setSort={setSort} />
      </div>
      {composer}
      {body}
    </div>
  );
}

function CommentRow({ c, reply, onReply }: { c: RemoteComment; reply?: boolean; onReply: () => void }) {
  const now = useNow();
  const author = useMemo(() => memberUser(c.author.id, c.author.username), [c.author.id, c.author.username]);
  const [busy, setBusy] = useState(false);
  return (
    <div className={`comment${reply ? ' reply' : ''}${c.mine ? ' mine' : ''}`} data-comment={c.id}>
      <span className="comment-av" aria-hidden="true">
        <Avatar user={author} size={reply ? 24 : 30} />
      </span>
      <div className="comment-main">
        <div className="comment-meta">
          <span className="comment-name">{c.author.username}</span>
          {c.mine && <span className="pill pill-you">You</span>}
          <span className="comment-time">{ago(c.at, now)}</span>
        </div>
        <p className="comment-text">
          {c.replyTo && <span className="reply-to">@{c.replyTo} </span>}
          <RichText text={c.body} />
        </p>
        <div className="comment-actions">
          <button type="button" className="link-btn" onClick={onReply}>
            Reply
          </button>
          {c.mine ? (
            <button
              type="button"
              className="link-btn"
              disabled={busy}
              onClick={() => {
                confirmAction('Delete this comment?', c.replies ? 'Its replies go with it. Nobody will see it anymore.' : 'Nobody will see it anymore.', 'Delete', () => {
                  setBusy(true);
                  deleteComment(c)
                    .then(() => toast('Comment deleted'))
                    .catch((err) => toast(socialErrorText(err)))
                    .finally(() => setBusy(false));
                });
              }}
              aria-label="Delete comment"
            >
              <Trash2 size={12} /> Delete
            </button>
          ) : (
            <button type="button" className="link-btn" onClick={() => openModal({ type: 'report-comment', commentId: c.id, videoId: c.videoId, author: c.author.username, text: c.body })} aria-label={`Report comment by ${c.author.username}`}>
              <Flag size={12} /> Report
            </button>
          )}
        </div>
      </div>
      <button
        type="button"
        className={`comment-like${c.liked ? ' on' : ''}`}
        onClick={() => setCommentLiked(c, !c.liked).catch((err) => toast(socialErrorText(err)))}
        aria-pressed={c.liked}
        aria-label={`Like comment, ${c.likes} likes`}
      >
        <Heart size={14} fill={c.liked ? 'currentColor' : 'none'} />
        <span>{compact(c.likes)}</span>
      </button>
    </div>
  );
}

function Composer({ video, replyTo, clearReply, focusKey, onPosted }: { video: Video; replyTo: RemoteComment | null; clearReply: () => void; focusKey: number; onPosted: (c: RemoteComment) => void }) {
  const auth = useAuth();
  const me = signedInUser();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (focusKey) ta.current?.focus({ preventScroll: true });
  }, [focusKey]);
  useEffect(() => {
    if (replyTo) ta.current?.focus({ preventScroll: true });
  }, [replyTo]);

  if (auth.standing?.banned || auth.standing?.muted) {
    return (
      <div className="composer composer-locked">
        <Lock size={15} />
        <span>{auth.standing.banned ? 'Your account can’t comment on SirSC Scroll right now.' : 'A Warden Chat admin muted your account, so you can’t comment right now.'}</span>
      </div>
    );
  }

  const post = async () => {
    const clean = text.trim();
    if (!clean || sending) return;
    setSending(true);
    try {
      const c = await postComment(video.id, clean, replyTo);
      notePosted(video.id, !!replyTo, clean);
      setText('');
      if (ta.current) ta.current.style.height = 'auto';
      clearReply();
      onPosted(c);
    } catch (e) {
      toast(socialErrorText(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        void post();
      }}
    >
      <Avatar user={me ?? undefined} size={30} />
      <div className="composer-box">
        {replyTo && (
          <div className="composer-reply">
            Replying to <b>@{replyTo.author.username}</b>
            <button type="button" className="icon-btn xs" onClick={clearReply} aria-label="Cancel reply">
              <X size={12} />
            </button>
          </div>
        )}
        <textarea
          ref={ta}
          rows={1}
          value={text}
          maxLength={300}
          placeholder={replyTo ? 'Write a reply…' : `Comment as ${me?.name ?? 'you'}…`}
          aria-label="Write a comment"
          onChange={(e) => {
            setText(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(96, e.target.scrollHeight)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void post();
            }
            if (e.key === 'Escape' && replyTo) {
              e.stopPropagation();
              clearReply();
            }
          }}
        />
        <div className="composer-foot">
          <span className={text.length > 270 ? 'warn' : ''}>{text.length}/300</span>
          <button type="submit" className="btn btn-accent btn-sm" disabled={!text.trim() || sending}>
            <Send size={13} /> {sending ? 'Posting…' : 'Post'}
          </button>
        </div>
      </div>
    </form>
  );
}

/* ---------------------------------------------------------------- demo clips */

/** Made-up comments on a demo clip: read-only, so it's clear they aren't real. */
function SampleComments({ video, variant }: { video: Video; variant?: 'widget' }) {
  const p = usePersisted();
  const now = useNow();
  const all = useMemo(() => sampleComments(video), [video]);
  const top = useMemo(() => all.filter((c) => !c.parentId).sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.likes - a.likes), [all]);
  const replyCount = (c: Comment) => all.filter((r) => r.parentId === c.id).length;
  const note = <p className="comments-foot">Sample comments on a demo clip. Likes and comments work on real videos.</p>;
  const list = (
    <ul className="comment-list">
      {top.map((c) => {
        const author = getUser(p, c.authorId);
        const n = replyCount(c);
        return (
          <li key={c.id}>
            <div className="comment sample">
              <a href={href.profile(author?.handle ?? '')} className="comment-av" tabIndex={-1} aria-hidden="true">
                <Avatar user={author} size={30} />
              </a>
              <div className="comment-main">
                <div className="comment-meta">
                  <a href={href.profile(author?.handle ?? '')} className="comment-name">
                    {author?.name}
                  </a>
                  {author?.verified && <Verified size={12} />}
                  {c.authorId === video.creatorId && <span className="pill pill-creator">Creator</span>}
                  <span className="comment-time">{ago(c.at, now)}</span>
                </div>
                <p className="comment-text">
                  <RichText text={c.text} />
                </p>
                {n > 0 && <p className="comment-sub">{n === 1 ? '1 reply' : `${n} replies`}</p>}
              </div>
              <span className="comment-like" aria-label={`${c.likes} likes`}>
                <Heart size={14} />
                <span>{compact(c.likes)}</span>
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
  if (variant === 'widget') {
    return (
      <div className="comments comments-widget">
        <div className="cw-bar">
          <span className="cw-count">{full(video.comments)} comments</span>
        </div>
        <div className="cw-scroll">
          {list}
          {note}
        </div>
      </div>
    );
  }
  return (
    <div className="comments comments-full">
      <div className="comments-head">
        <h3>
          Comments <span>{full(video.comments)}</span>
        </h3>
      </div>
      {note}
      {list}
    </div>
  );
}
