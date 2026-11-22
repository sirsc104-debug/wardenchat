import { useMemo, useState } from 'react';
import { Bookmark, BookmarkX, Check, Ellipsis, FolderInput, FolderOpen, FolderPlus, Pencil, Play, Trash2, X } from 'lucide-react';
import type { Video } from '../state/types';
import { PageShell } from './PageShell';
import { useOpenList } from './Explore';
import { VideoCard } from '../components/common/VideoCard';
import { Menu, type MenuItem } from '../components/common/Menu';
import { Empty } from '../components/common/Empty';
import { useAcct, usePersisted } from '../state/store';
import { confirmAction, deleteCollection, moveToCollection, openModal, renameCollection, toggleInCollection, toggleSave } from '../state/actions';
import { getVideo } from '../lib/catalog';
import { href, navigate, type Route } from '../lib/router';

export function Saved({ route }: { route: Route }) {
  const p = usePersisted();
  const acct = useAcct((a) => a);
  const colId = route.path[1] ?? null;
  const col = colId ? acct.collections.find((c) => c.id === colId) : null;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');

  const ids = col ? col.videoIds : acct.saved;
  const videos = useMemo(() => ids.map((id) => getVideo(p, id)).filter((v): v is Video => !!v), [ids, p]);
  const label = col ? col.name : 'All saved';
  const open = useOpenList(videos, `Saved · ${label}`);

  const itemMenu = (v: Video): MenuItem[] => {
    const items: MenuItem[] = [];
    for (const c of acct.collections) {
      if (c.id === colId) continue;
      items.push(
        col
          ? { label: `Move to “${c.name}”`, icon: FolderInput, onSelect: () => moveToCollection(col.id, c.id, v.id) }
          : { label: c.videoIds.includes(v.id) ? `In “${c.name}”` : `Add to “${c.name}”`, icon: c.videoIds.includes(v.id) ? Check : FolderPlus, onSelect: () => toggleInCollection(c.id, v.id) },
      );
    }
    items.push({ label: 'New collection…', icon: FolderPlus, onSelect: () => openModal({ type: 'new-collection', videoId: v.id }) });
    if (col) items.push({ label: `Remove from “${col.name}”`, icon: X, onSelect: () => toggleInCollection(col.id, v.id), divider: true });
    items.push({ label: 'Unsave', icon: BookmarkX, danger: true, onSelect: () => toggleSave(v.id), divider: !col });
    return items;
  };

  return (
    <PageShell className="saved">
      <div className="saved-layout">
        <nav className="saved-nav" aria-label="Collections">
          <a href="#/saved" className={`saved-nav-item${!col ? ' on' : ''}`}>
            <Bookmark size={16} /> <span>All saved</span> <span className="seg-n">{acct.saved.length}</span>
          </a>
          {acct.collections.map((c) => (
            <a key={c.id} href={href.saved(c.id)} className={`saved-nav-item${col?.id === c.id ? ' on' : ''}`}>
              <FolderOpen size={16} /> <span>{c.name}</span> <span className="seg-n">{c.videoIds.length}</span>
            </a>
          ))}
          <button type="button" className="saved-nav-item add" onClick={() => openModal({ type: 'new-collection' })}>
            <FolderPlus size={16} /> <span>New collection</span>
          </button>
        </nav>
        <section className="saved-main">
          <div className="page-head">
            {editing && col ? (
              <form
                className="rename"
                onSubmit={(e) => {
                  e.preventDefault();
                  renameCollection(col.id, name);
                  setEditing(false);
                }}
              >
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus aria-label="Collection name" />
                <button type="submit" className="btn btn-accent btn-sm">
                  Save
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </form>
            ) : (
              <h1>
                {label} <span className="muted">· {videos.length}</span>
              </h1>
            )}
            <div className="page-actions">
              {videos.length > 0 && (
                <button type="button" className="btn btn-accent btn-sm" onClick={() => open(videos[0])}>
                  <Play size={14} fill="currentColor" /> Play all
                </button>
              )}
              {col && !editing && (
                <>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => (setName(col.name), setEditing(true))}>
                    <Pencil size={14} /> Rename
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      confirmAction(`Delete “${col.name}”?`, 'The collection goes away; its videos stay in All saved.', 'Delete collection', () => {
                        deleteCollection(col.id);
                        navigate('#/saved');
                      })
                    }
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </>
              )}
            </div>
          </div>
          {colId && !col ? (
            <Empty icon={FolderOpen} title="Collection not found" action={<a className="btn btn-accent btn-sm" href="#/saved">All saved</a>}>
              It may have been deleted, or it belongs to another demo account.
            </Empty>
          ) : videos.length ? (
            <div className="vgrid">
              {videos.map((v) => (
                <VideoCard
                  key={v.id}
                  video={v}
                  onOpen={open}
                  actions={
                    <Menu className="icon-btn glass xs" label="Collection options" items={itemMenu(v)}>
                      <Ellipsis size={15} />
                    </Menu>
                  }
                />
              ))}
            </div>
          ) : (
            <Empty icon={Bookmark} title={col ? 'This collection is empty' : 'Nothing saved yet'} action={<a className="btn btn-accent btn-sm" href="#/">Browse For You</a>}>
              {col ? 'Add videos from the ••• menu on any saved video, or from the player.' : 'Press S or tap the bookmark on any video to save it here.'}
            </Empty>
          )}
        </section>
      </div>
    </PageShell>
  );
}
