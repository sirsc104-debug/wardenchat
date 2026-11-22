import { useEffect, useState } from 'react';
import { useExit } from '../../lib/hooks';
import { Check, Copy, Flag, FolderPlus, Hash, MessagesSquare, Send, Users } from 'lucide-react';
import type { ModalState } from '../../state/types';
import { Modal } from '../common/Modal';
import { Avatar } from '../common/Avatar';
import { VideoArt } from '../common/VideoArt';
import { UploadDialog } from './UploadDialog';
import { InterestEditor } from './InterestEditor';
import { ShortcutTable } from '../../pages/Settings';
import { ProfileEditor } from '../../pages/Profile';
import { useAcct, usePersisted, useS } from '../../state/store';
import { applyInterestChanges, closeModal, copyLink, createCollection, recordShare, reportVideo, resetRecommendations, shareTo, toast, toggleInCollection } from '../../state/actions';
import { getUser, getVideo, shareLink } from '../../lib/catalog';
import { FRIENDS_OF } from '../../data/users';

const CHATS = [
  { id: 'warden:squad', name: 'The Squad', icon: '🎮', members: 6 },
  { id: 'warden:study', name: 'Bio study group', icon: '🧪', members: 4 },
  { id: 'warden:general', name: '#sirsc-general', icon: '#', members: 1280 },
  { id: 'warden:memes', name: '#memes-only', icon: '😂', members: 342 },
];

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

function ShareDialog({ videoId }: { videoId: string }) {
  const p = usePersisted();
  const friends = FRIENDS_OF[p.activeId] ?? [];
  const [picked, setPicked] = useState<string[]>([]);
  const [chat, setChat] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const toggle = (id: string) => setPicked((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  const send = () => {
    const names = picked.map((id) => getUser(p, id)?.name.split(' ')[0]);
    if (picked.length) shareTo(videoId, picked, note);
    if (chat) {
      recordShare(videoId, 'warden');
    }
    const parts = [names.length ? `Sent to ${names.join(', ')}` : '', chat ? `shared to “${CHATS.find((c) => c.id === chat)?.name}” in Warden Chat (simulated)` : ''].filter(Boolean);
    toast(parts.join(' and ') || 'Nothing selected');
    closeModal();
  };
  return (
    <Modal
      title="Share video"
      width={520}
      footer={
        <>
          <span className="muted small foot-spacer">Demo only: nothing is sent outside this browser.</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={closeModal}>
            Cancel
          </button>
          <button type="button" className="btn btn-accent btn-sm" disabled={!picked.length && !chat} onClick={send}>
            <Send size={14} /> Send
          </button>
        </>
      }
    >
      <VideoChip id={videoId} />
      <h3 className="sub">
        <Users size={14} /> Send to friends
      </h3>
      <div className="friend-picks">
        {friends.map((f) => {
          const u = getUser(p, f)!;
          const on = picked.includes(f);
          return (
            <button key={f} type="button" className={`friend-pick${on ? ' on' : ''}`} onClick={() => toggle(f)} aria-pressed={on}>
              <Avatar user={u} size={40} />
              <span>{u.name.split(' ')[0]}</span>
              {on && (
                <span className="pick-check">
                  <Check size={11} strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <h3 className="sub">
        <MessagesSquare size={14} /> Warden Chat <span className="pill pill-sim">simulated</span>
      </h3>
      <ul className="chat-picks" role="radiogroup" aria-label="Warden Chat conversation">
        {CHATS.map((c) => (
          <li key={c.id}>
            <button type="button" role="radio" aria-checked={chat === c.id} className={`chat-pick${chat === c.id ? ' on' : ''}`} onClick={() => setChat(chat === c.id ? null : c.id)}>
              <span className="chat-ico">{c.icon === '#' ? <Hash size={15} /> : c.icon}</span>
              <span className="chat-name">{c.name}</span>
              <span className="muted small">{c.members} members</span>
              {chat === c.id && <Check size={15} className="chat-check" />}
            </button>
          </li>
        ))}
      </ul>
      <label className="field">
        <span>Add a message (optional)</span>
        <input value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder="you have to see this" />
      </label>
      <div className="link-field">
        <input readOnly value={shareLink(videoId)} aria-label="Video link" onFocus={(e) => e.target.select()} />
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void copyLink(videoId)}>
          <Copy size={14} /> Copy link
        </button>
      </div>
    </Modal>
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
      <p className="notice">Demo only. The report is recorded on this device and the video is removed from your feeds. Nothing is sent to a moderator.</p>
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

function Interests() {
  return (
    <Modal
      title="Feed preferences"
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
      <p className="muted small">Your strongest interests are on top. Raise or lower any category and For You re-ranks what comes next.</p>
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

function EditProfile() {
  const p = usePersisted();
  const user = getUser(p, p.activeId)!;
  return (
    <Modal title="Edit profile" width={480}>
      <ProfileEditor key={p.activeId} user={user} />
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
    case 'share':
      return <ShareDialog videoId={m.videoId} />;
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
    case 'upload':
      return <UploadDialog draftId={m.draftId} />;
    case 'interests':
      return <Interests />;
    case 'edit-profile':
      return <EditProfile />;
    case 'new-collection':
      return <NewCollection videoId={m.videoId} />;
    case 'confirm':
      return <Confirm m={m} />;
  }
}
