import { EyeOff, Flag, FolderPlus, ThumbsDown, UserRound, Bookmark } from 'lucide-react';
import type { MenuItem } from '../common/Menu';
import type { Video } from '../../state/types';
import { hideCreator, notInterested, openModal, toggleSave } from '../../state/actions';
import { getState } from '../../state/store';
import { navigate, href } from '../../lib/router';
import { USER_MAP } from '../../data/users';

/** The "More options" menu shared by the player rail, side panel and cards. */
export function videoMenuItems(video: Video, activeId: string, opts: { includeSave?: boolean } = {}): MenuItem[] {
  const handle = USER_MAP.get(video.creatorId)?.handle ?? video.creatorId;
  const own = video.creatorId === activeId;
  const items: MenuItem[] = [];
  if (opts.includeSave) {
    const saved = getState().p.accounts[activeId].saved.includes(video.id);
    items.push({ label: saved ? 'Remove from Saved' : 'Save', icon: Bookmark, onSelect: () => toggleSave(video.id), hint: 'S' });
  }
  items.push(
    { label: 'Add to collection', icon: FolderPlus, onSelect: () => openModal({ type: 'collection', videoId: video.id }) },
    { label: `View @${handle}`, icon: UserRound, onSelect: () => navigate(href.profile(handle)) },
  );
  if (own) return items;
  items.push(
    { label: 'Not interested', icon: ThumbsDown, onSelect: () => notInterested(video.id), divider: true },
    { label: `Hide @${handle}`, icon: EyeOff, onSelect: () => hideCreator(video.creatorId) },
    { label: 'Report video', icon: Flag, danger: true, onSelect: () => openModal({ type: 'report', videoId: video.id }) },
  );
  return items;
}

