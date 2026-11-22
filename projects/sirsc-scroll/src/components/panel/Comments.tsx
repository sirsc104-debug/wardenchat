import { Fragment, memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Heart, MessageCircleOff, MessageSquare, Pin, Send, Trash2, X } from 'lucide-react';
import type { Comment, Persisted, Video } from '../../state/types';
import { Avatar } from '../common/Avatar';
import { Verified } from '../common/Verified';
import { useAcct, usePersisted, useS } from '../../state/store';
import { addComment, deleteComment, toggleCommentLike } from '../../state/actions';
import { commentCount, commentLikes, commentsFor, getUser } from '../../lib/catalog';
import { ago, compact, full } from '../../lib/format';
import { href } from '../../lib/router';
import { useHeightTween, useNow } from '../../lib/hooks';
import { exitThen } from '../../lib/motion';
import { HANDLE_MAP } from '../../data/users';

/** Turns @handles and #tags into links. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/([@#][\p{L}\p{N}._]+)/u);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('@') && HANDLE_MAP.has(part.slice(1).toLowerCase()))
          return (
            <a key={i} className="mention" href={href.profile(part.slice(1).toLowerCase())}>
              {part}
            </a>
          );
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

type Sort = 'top' | 'new';

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

function sortComments(p: Persisted, list: Comment[], sort: Sort, me: string): Comment[] {
  const top = list.filter((c) => !c.parentId);
  if (sort === 'new') return top.sort((a, b) => b.at - a.at);
  const fresh = Date.now() - 10 * 60_000;
  return top.sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    const am = a.authorId === me && a.at > fresh;
    const bm = b.authorId === me && b.at > fresh;
    if (am !== bm) return am ? -1 : 1;
    return commentLikes(p, b) - commentLikes(p, a);
  });
}

interface Props {
  video: Video;
  /** preview: the top three, read-only replies. full: everything plus the composer. */
  mode: 'preview' | 'full';
  onExpand?: () => void;
  /** Bumping this focuses the composer. */
  autoFocus?: boolean;
  /** How many comments the preview shows. */
  previewCount?: number;
  /** Widget layout: sort bar, a thread that scrolls on its own, composer pinned underneath. */
  variant?: 'widget';
}

export const Comments = memo(function Comments({ video, mode, onExpand, autoFocus, previewCount = 3, variant }: Props) {
  const p = usePersisted();
  const me = p.activeId;
  const [sort, setSort] = useState<Sort>('top');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const all = useMemo(() => commentsFor(p, video), [p, video]);
  const sorted = useMemo(() => sortComments(p, all, sort, me), [p, all, sort, me]);
  const replies = useMemo(() => {
    const m = new Map<string, Comment[]>();
    for (const c of all) if (c.parentId) m.set(c.parentId, [...(m.get(c.parentId) ?? []), c].sort((a, b) => a.at - b.at));
    return m;
  }, [all]);
  const total = commentCount(p, video);
  const shown = mode === 'preview' ? sorted.slice(0, previewCount) : sorted;
  const composerFocus = useS((s) => s.composerFocus);

  useEffect(() => setReplyTo(null), [video.id]);

  if (video.allowComments === false) {
    return (
      <div className="comments">
        <div className="comments-off">
          <MessageCircleOff size={18} /> The creator turned off comments for this video.
        </div>
      </div>
    );
  }

  const list = (
    <ul className="comment-list">
      {shown.map((c) => {
        const reps = replies.get(c.id) ?? [];
        const isOpen = open.has(c.id) || reps.some((r) => r.authorId === me && r.local);
        return (
          <li key={c.id}>
            <CommentRow c={c} video={video} onReply={() => setReplyTo(c)} />
            {reps.length > 0 && (
              <Replies open={isOpen}>
                {isOpen && reps.map((r) => <CommentRow key={r.id} c={r} video={video} reply onReply={() => setReplyTo(c)} />)}
                <button
                  type="button"
                  className="link-btn replies-toggle"
                  onClick={() =>
                    setOpen((s) => {
                      const n = new Set(s);
                      if (n.has(c.id)) n.delete(c.id);
                      else n.add(c.id);
                      return n;
                    })
                  }
                >
                  {isOpen ? 'Hide replies' : `View ${reps.length} ${reps.length === 1 ? 'reply' : 'replies'}`}
                </button>
              </Replies>
            )}
          </li>
        );
      })}
    </ul>
  );

  if (variant === 'widget') {
    return (
      <div className="comments comments-widget">
        <div className="cw-bar">
          <span className="cw-count">{full(total)} comments</span>
          <div className="seg seg-sm" role="tablist" aria-label="Sort comments">
            <button type="button" role="tab" aria-selected={sort === 'top'} onClick={() => setSort('top')}>
              Top
            </button>
            <button type="button" role="tab" aria-selected={sort === 'new'} onClick={() => setSort('new')}>
              Newest
            </button>
          </div>
        </div>
        <div className="cw-scroll">
          {list}
          {!shown.length && (
            <div className="comments-empty">
              <MessageSquare size={18} /> No comments yet. Start the conversation.
            </div>
          )}
          {sorted.length > 0 && <p className="comments-foot">Showing {sorted.length} of {full(total)} · sample comments are simulated</p>}
        </div>
        <Composer video={video} replyTo={replyTo} clearReply={() => setReplyTo(null)} focusKey={0} onPosted={(c) => c.parentId && setOpen((s) => new Set(s).add(c.parentId!))} />
      </div>
    );
  }

  return (
    <div className={`comments comments-${mode}`}>
      <div className="comments-head">
        <h3>
          Comments <span>{full(total)}</span>
        </h3>
        {mode === 'full' ? (
          <div className="seg seg-sm" role="tablist" aria-label="Sort comments">
            <button type="button" role="tab" aria-selected={sort === 'top'} onClick={() => setSort('top')}>
              Top
            </button>
            <button type="button" role="tab" aria-selected={sort === 'new'} onClick={() => setSort('new')}>
              Newest
            </button>
          </div>
        ) : (
          onExpand && (
            <button type="button" className="link-btn" onClick={onExpand}>
              Open all <kbd>C</kbd>
            </button>
          )
        )}
      </div>
      {mode === 'full' && <Composer video={video} replyTo={replyTo} clearReply={() => setReplyTo(null)} focusKey={autoFocus ? composerFocus : 0} onPosted={(c) => c.parentId && setOpen((s) => new Set(s).add(c.parentId!))} />}
      <ul className="comment-list">
        {shown.map((c) => {
          const reps = replies.get(c.id) ?? [];
          const isOpen = open.has(c.id) || (mode === 'preview' ? false : reps.some((r) => r.authorId === me && r.local));
          return (
            <li key={c.id}>
              <CommentRow c={c} video={video} onReply={mode === 'full' ? () => setReplyTo(c) : onExpand} />
              {reps.length > 0 && (
                <Replies open={isOpen}>
                  {isOpen && reps.map((r) => <CommentRow key={r.id} c={r} video={video} reply onReply={mode === 'full' ? () => setReplyTo(c) : onExpand} />)}
                  <button
                    type="button"
                    className="link-btn replies-toggle"
                    onClick={() => (mode === 'preview' && onExpand ? onExpand() : setOpen((s) => {
                      const n = new Set(s);
                      if (n.has(c.id)) n.delete(c.id);
                      else n.add(c.id);
                      return n;
                    }))}
                  >
                    {isOpen ? 'Hide replies' : `View ${reps.length} ${reps.length === 1 ? 'reply' : 'replies'}`}
                  </button>
                </Replies>
              )}
            </li>
          );
        })}
      </ul>
      {!shown.length && (
        <div className="comments-empty">
          <MessageSquare size={18} /> No comments yet. Start the conversation.
        </div>
      )}
      {mode === 'preview' && sorted.length > previewCount && onExpand && (
        <button type="button" className="btn btn-ghost btn-block" onClick={onExpand}>
          View all {full(total)} comments
        </button>
      )}
      {mode === 'full' && sorted.length > 0 && <p className="comments-foot">Showing {sorted.length} of {full(total)} · sample comments are simulated</p>}
    </div>
  );
});

function CommentRow({ c, video, reply, onReply }: { c: Comment; video: Video; reply?: boolean; onReply?: () => void }) {
  const p = usePersisted();
  const now = useNow();
  const liked = useAcct((a) => a.likedComments.includes(c.id));
  const author = getUser(p, c.authorId);
  const isCreator = c.authorId === video.creatorId;
  const isMe = c.authorId === p.activeId;
  return (
    <div className={`comment${reply ? ' reply' : ''}${c.local ? ' local' : ''}`}>
      <a href={href.profile(author?.handle ?? '')} className="comment-av" tabIndex={-1} aria-hidden="true">
        <Avatar user={author} size={reply ? 24 : 30} />
      </a>
      <div className="comment-main">
        <div className="comment-meta">
          <a href={href.profile(author?.handle ?? '')} className="comment-name">
            {author?.name}
          </a>
          {author?.verified && <Verified size={12} />}
          {isCreator && <span className="pill pill-creator">Creator</span>}
          {isMe && <span className="pill pill-you">You</span>}
          {c.pinned && (
            <span className="pill pill-pin">
              <Pin size={10} /> Pinned
            </span>
          )}
          <span className="comment-time">{ago(c.at, now)}</span>
        </div>
        <p className="comment-text">
          <RichText text={c.text} />
        </p>
        <div className="comment-actions">
          {onReply && (
            <button type="button" className="link-btn" onClick={onReply}>
              Reply
            </button>
          )}
          {isMe && c.local && (
            <button type="button" className="link-btn" onClick={(e) => exitThen(e.currentTarget.closest('.comment'), () => deleteComment(c.id))} aria-label="Delete comment">
              <Trash2 size={12} /> Delete
            </button>
          )}
        </div>
      </div>
      <button type="button" className={`comment-like${liked ? ' on' : ''}`} onClick={() => toggleCommentLike(c.id)} aria-pressed={liked} aria-label={`Like comment, ${commentLikes(p, c)} likes`}>
        <Heart size={14} fill={liked ? 'currentColor' : 'none'} />
        <span>{compact(commentLikes(p, c))}</span>
      </button>
    </div>
  );
}

function Composer({ video, replyTo, clearReply, focusKey, onPosted }: { video: Video; replyTo: Comment | null; clearReply: () => void; focusKey: number; onPosted: (c: Comment) => void }) {
  const p = usePersisted();
  const meUser = getUser(p, p.activeId);
  const [text, setText] = useState('');
  const ta = useRef<HTMLTextAreaElement>(null);
  const replyName = replyTo ? getUser(p, replyTo.authorId)?.handle : null;

  useEffect(() => {
    if (focusKey) ta.current?.focus({ preventScroll: true });
  }, [focusKey]);
  useEffect(() => {
    if (replyTo) ta.current?.focus({ preventScroll: true });
  }, [replyTo]);

  const post = () => {
    const c = addComment(video.id, text, replyTo?.id);
    if (!c) return;
    setText('');
    clearReply();
    onPosted(c);
  };

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        post();
      }}
    >
      <Avatar user={meUser} size={30} />
      <div className="composer-box">
        {replyTo && (
          <div className="composer-reply">
            Replying to <b>@{replyName}</b>
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
          placeholder={replyTo ? 'Write a reply…' : `Comment as @${meUser?.handle}…`}
          aria-label="Write a comment"
          onChange={(e) => {
            setText(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(96, e.target.scrollHeight)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              post();
            }
            if (e.key === 'Escape' && replyTo) {
              e.stopPropagation();
              clearReply();
            }
          }}
        />
        <div className="composer-foot">
          <span className={text.length > 270 ? 'warn' : ''}>{text.length}/300</span>
          <button type="submit" className="btn btn-accent btn-sm" disabled={!text.trim()}>
            <Send size={13} /> Post
          </button>
        </div>
      </div>
    </form>
  );
}
