import { useEffect, useState } from 'react';
import { useExit } from '../../lib/hooks';
import { Flag, FolderPlus } from 'lucide-react';
import type { ModalState } from '../../state/types';
import { Modal } from '../common/Modal';
import { VideoArt } from '../common/VideoArt';
import { InterestEditor } from './InterestEditor';
import { ShortcutTable } from '../../pages/Settings';
import { useAcct, usePersisted, useS } from '../../state/store';
import { applyInterestChanges, closeModal, createCollection, reportVideo, resetRecommendations, toast, toggleInCollection } from '../../state/actions';
import { getUser, getVideo } from '../../lib/catalog';
import { reportComment, socialErrorText, type ReportReason } from '../../lib/social';

function VideoChip({ id }: { id: string }) {
  const p = usePersisted();
  const v = getVideo(p, id);
  if (!v) return null;
  return (
    <div className="video-chip">
      <span className="mini-thumb">
        <VideoArt video={v} running={false} />
      </span>
      <span>
        <b>{v.title}</b>
        <span className="muted small">@{getUser(p, v.creatorId)?.handle}</span>
      </span>
    </div>
  );
}

function CollectionDialog({ videoId }: { videoId: string }) {
  const cols = useAcct((a) => a.collections);
  const [name, setName] = useState('');
  return (
    <Modal title="Add to collection" width={420} footer={<button type="button" className="btn btn-accent btn-sm" onClick={closeModal}>Done</button>}>
      <VideoChip id={videoId} />
      <ul className="col-picks">
        {cols.map((c) => {
          const on = c.videoIds.includes(videoId);
          return (
            <li key={c.id}>
              <label className="check-row">
                <input type="checkbox" checked={on} onChange={() => toggleInCollection(c.id, videoId)} />
                <span>{c.name}</span>
                <span className="muted small">{c.videoIds.length}</span>
              </label>
            </li>
          );
        })}
        {!cols.length && <li className="muted small">No collections yet. Create one below.</li>}
      </ul>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          createCollection(name, videoId);
          setName('');
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New collection name" maxLength={40} aria-label="New collection name" />
        <button type="submit" className="btn btn-ghost btn-sm" disabled={!name.trim()}>
          <FolderPlus size={14} /> Create
        </button>
      </form>
      <p className="muted small">Adding a video to a collection also saves it.</p>
    </Modal>
  );
}

const REASONS = ['Spam or misleading', 'Bullying or harassment', 'Not appropriate for school', 'Dangerous activity', 'Hateful content', 'Something else'];

function ReportDialog({ videoId }: { videoId: string }) {
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  return (
    <Modal
      title="Report video"
      width={460}
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={closeModal}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            disabled={!reason}
            onClick={() => {
              reportVideo(videoId, detail ? `${reason}: ${detail}` : reason);
              closeModal();
            }}
          >
            <Flag size={14} /> Submit report
          </button>
        </>
      }
    >
      <VideoChip id={videoId} />
      <p className="notice">The video leaves your feeds right away. Video reports stay in this browser for now: to get a video taken down for everyone, tell the SirSC Scroll owner.</p>
      <div className="radio-list" role="radiogroup" aria-label="Reason">
        {REASONS.map((r) => (
          <label key={r} className="check-row">
            <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} />
            <span>{r}</span>
          </label>
        ))}
      </div>
      <label className="field">
        <span>Details (optional)</span>
        <textarea rows={2} value={detail} maxLength={200} onChange={(e) => setDetail(e.target.value)} />
      </label>
    </Modal>
  );
}

function NewCollection({ videoId }: { videoId?: string }) {
  const [name, setName] = useState('');
  return (
    <Modal
      title="New collection"
      width={400}
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={closeModal}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-accent btn-sm"
            disabled={!name.trim()}
            onClick={() => {
              createCollection(name, videoId);
              closeModal();
            }}
          >
            Create
          </button>
        </>
      }
    >
      {videoId && <VideoChip id={videoId} />}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          createCollection(name, videoId);
          closeModal();
        }}
      >
        <label className="field">
          <span>Name</span>
          <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tricks to learn" data-autofocus />
        </label>
      </form>
    </Modal>
  );
}

const COMMENT_REASONS: [ReportReason, string][] = [
  ['bullying', 'Bullying or harassment'],
  ['hate', 'Hateful'],
  ['inappropriate', 'Not appropriate for school'],
  ['spam', 'Spam'],
  ['other', 'Something else'],
];

function ReportCommentDialog({ m }: { m: Extract<ModalState, { type: 'report-comment' }> }) {
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title="Report comment"
      width={440}
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={closeModal}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            disabled={!reason || busy}
            onClick={async () => {
              if (!reason) return;
              setBusy(true);
              try {
                await reportComment(m.commentId, reason);
                closeModal();
                toast('Thanks. The SirSC Scroll owner will look at it.');
              } catch (e) {
                toast(socialErrorText(e));
                setBusy(false);
              }
            }}
          >
            <Flag size={14} /> {busy ? 'Sending…' : 'Send report'}
          </button>
        </>
      }
    >
      <blockquote className="quote-chip">
        <b>@{m.author}</b> {m.text}
      </blockquote>
      <p className="notice">Reports go to the SirSC Scroll owner. They see who reported it, but {m.author} doesn’t.</p>
      <div className="radio-list" role="radiogroup" aria-label="Reason">
        {COMMENT_REASONS.map(([id, label]) => (
          <label key={id} className="check-row">
            <input type="radio" name="comment-reason" checked={reason === id} onChange={() => setReason(id)} />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </Modal>
  );
}

function Interests({ welcome }: { welcome?: boolean }) {
  return (
    <Modal
      title={welcome ? 'Welcome to SirSC Scroll' : 'Feed preferences'}
      width={560}
      onClose={() => {
        applyInterestChanges();
        closeModal();
      }}
      footer={
        <>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              resetRecommendations();
              closeModal();
            }}
          >
            Reset recommendations
          </button>
          <span className="foot-spacer" />
          <button
            type="button"
            className="btn btn-accent btn-sm"
            onClick={() => {
              applyInterestChanges();
              closeModal();
            }}
          >
            Apply to feeds
          </button>
        </>
      }
    >
      <p className="muted small">
        {welcome
          ? 'Tell For You what you’re into: raise the topics you like and lower the ones you don’t. It keeps learning from what you watch, like and save, and you can change this any time in Settings.'
          : 'Your strongest interests are on top. Raise or lower any category and For You re-ranks what comes next.'}
      </p>
      <InterestEditor />
    </Modal>
  );
}

function Confirm({ m }: { m: Extract<ModalState, { type: 'confirm' }> }) {
  return (
    <Modal
      title={m.title}
      width={420}
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={closeModal}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn btn-sm ${m.danger ? 'btn-danger' : 'btn-accent'}`}
            data-autofocus
            onClick={() => {
              closeModal();
              m.action();
            }}
          >
            {m.confirm}
          </button>
        </>
      }
    >
      <p>{m.body}</p>
    </Modal>
  );
}

export function ModalHost() {
  const current = useS((s) => s.modal);
  const [last, setLast] = useState(current);
  useEffect(() => {
    if (current) setLast(current);
  }, [current]);
  const { mounted, closing } = useExit(!!current, 180);
  const m = current ?? last;
  if (!mounted || !m) return null;
  return <div className={`modal-layer${closing ? ' closing' : ''}`}>{renderModal(m)}</div>;
}

function renderModal(m: ModalState) {
  switch (m.type) {
    case 'collection':
      return <CollectionDialog videoId={m.videoId} />;
    case 'report':
      return <ReportDialog videoId={m.videoId} />;
    case 'shortcuts':
      return (
        <Modal title="Keyboard shortcuts" width={460}>
          <ShortcutTable />
        </Modal>
      );
    case 'report-comment':
      return <ReportCommentDialog m={m} />;
    case 'interests':
      return <Interests welcome={m.welcome} />;
    case 'new-collection':
      return <NewCollection videoId={m.videoId} />;
    case 'confirm':
      return <Confirm m={m} />;
  }
}
