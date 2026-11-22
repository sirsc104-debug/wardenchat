// Shared data shapes. The fake catalog, the local store and the UI all speak these types, so a real
// backend can later replace src/data + src/state/persist.ts without touching the components.

export type Category =
  | 'memes'
  | 'gaming'
  | 'sports'
  | 'comedy'
  | 'school'
  | 'technology'
  | 'music'
  | 'animals'
  | 'science'
  | 'trending'
  | 'community';

export type TemplateKind =
  | 'gaming'
  | 'meme'
  | 'sports'
  | 'science'
  | 'school'
  | 'music'
  | 'tech'
  | 'animals'
  | 'comedy'
  | 'trend'
  | 'sirsc';

export interface Palette {
  /** Background hue 1 (0-360). */
  h1: number;
  /** Background hue 2. */
  h2: number;
  /** Accent hue for on-screen graphics. */
  ac: number;
}

export interface RecoMeta {
  /** 0-1 production quality used as a mild ranking boost. */
  quality: number;
  /** 0-1 how fast it is gaining engagement right now. */
  momentum: number;
  /** Secondary categories the clip also appeals to. */
  alsoFor: Category[];
}

export type Visibility = 'public' | 'friends' | 'private';

export interface Video {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  hashtags: string[];
  category: Category;
  /** Seconds. */
  duration: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  /** ms since epoch. */
  uploadedAt: number;
  template: TemplateKind;
  palette: Palette;
  /** Big on-screen text inside the animated placeholder. */
  caption: string;
  /** Emoji or short glyph some templates feature. */
  glyph: string;
  /** Layout variation 0-3. */
  variant: number;
  /** 0-1: which moment of the loop the thumbnail shows. */
  frame: number;
  sound: string;
  meta: RecoMeta;
  /** Published from Creator Studio on this device. */
  local?: boolean;
  visibility?: Visibility;
  allowComments?: boolean;
}

export type UserKind = 'creator' | 'demo' | 'friend';

export interface Avatar {
  h1: number;
  h2: number;
}

export interface User {
  id: string;
  handle: string;
  name: string;
  bio: string;
  avatar: Avatar;
  /** Base counts before demo-account follows are added. */
  followers: number;
  following: number;
  likes: number;
  verified?: boolean;
  categories: Category[];
  kind: UserKind;
  joined: number;
  location?: string;
}

export interface Comment {
  id: string;
  videoId: string;
  authorId: string;
  text: string;
  at: number;
  likes: number;
  parentId?: string;
  pinned?: boolean;
  /** Posted from this device by a demo account. */
  local?: boolean;
}

export interface Collection {
  id: string;
  name: string;
  videoIds: string[];
  createdAt: number;
}

export interface HistoryEntry {
  videoId: string;
  at: number;
  /** 0-1 furthest point reached. */
  progress: number;
  /** Times finished (including loops). */
  completions: number;
}

export type NotificationType = 'follow' | 'like' | 'reply' | 'mention' | 'share' | 'trending' | 'comment' | 'post' | 'system';

export interface AppNotification {
  id: string;
  type: NotificationType;
  actorId?: string;
  videoId?: string;
  text: string;
  /** Quoted snippet, for replies and mentions. */
  quote?: string;
  at: number;
  read: boolean;
}

export type ActivityType =
  | 'like'
  | 'unlike'
  | 'save'
  | 'comment'
  | 'reply'
  | 'follow'
  | 'unfollow'
  | 'share'
  | 'publish'
  | 'not-interested'
  | 'hide-creator'
  | 'report'
  | 'collection';

export interface ActivityEntry {
  id: string;
  type: ActivityType;
  videoId?: string;
  userId?: string;
  detail?: string;
  at: number;
}

export interface Draft {
  id: string;
  title: string;
  caption: string;
  category: Category;
  hashtags: string[];
  template: TemplateKind;
  palette: Palette;
  glyph: string;
  variant: number;
  frame: number;
  duration: number;
  visibility: Visibility;
  allowComments: boolean;
  updatedAt: number;
}

export interface ShareEntry {
  videoId: string;
  to: string;
  at: number;
}

export interface Signals {
  likes: number;
  saves: number;
  follows: number;
  comments: number;
  shares: number;
  completions: number;
  replays: number;
  skips: number;
  notInterested: number;
}

export interface ProfileEdits {
  name: string;
  bio: string;
  avatar: Avatar;
}

export interface AccountState {
  profile: ProfileEdits;
  following: string[];
  liked: string[];
  saved: string[];
  collections: Collection[];
  history: HistoryEntry[];
  historyPaused: boolean;
  notInterested: string[];
  hiddenCreators: string[];
  reported: string[];
  interests: Record<Category, number>;
  tagAffinity: Record<string, number>;
  signals: Signals;
  likedComments: string[];
  notifications: AppNotification[];
  activity: ActivityEntry[];
  drafts: Draft[];
  recentSearches: string[];
  shares: ShareEntry[];
  /** Bumped by Refresh Feed so the For You shuffle changes. */
  nonce: number;
}

export type ThemeName = 'dark' | 'dim' | 'contrast';
export type Density = 'compact' | 'standard' | 'expanded';

export interface Settings {
  autoplay: boolean;
  autoAdvance: boolean;
  loop: boolean;
  startMuted: boolean;
  speed: number;
  volume: number;
  reducedMotion: boolean;
  theme: ThemeName;
  density: Density;
  sidebarCollapsed: boolean;
  /** Show the right-hand discovery column on wide screens. */
  showDiscovery: boolean;
}

export interface Persisted {
  v: number;
  activeId: string;
  accounts: Record<string, AccountState>;
  userVideos: Video[];
  userComments: Comment[];
  settings: Settings;
}

export type FeedKind = 'foryou' | 'following' | 'trending' | 'friends' | 'list';

export type SortKey = 'recommended' | 'newest' | 'liked' | 'viewed' | 'shortest';

export interface FeedItem {
  id: string;
  reason: string;
}

export interface FeedState {
  kind: FeedKind;
  items: FeedItem[];
  index: number;
  /** For list feeds: what the list is and where Back goes. */
  label?: string;
  back?: string;
}

export type ModalState =
  | { type: 'share'; videoId: string }
  | { type: 'collection'; videoId: string }
  | { type: 'report'; videoId: string }
  | { type: 'shortcuts' }
  | { type: 'upload'; draftId?: string }
  | { type: 'interests' }
  | { type: 'edit-profile' }
  | { type: 'new-collection'; videoId?: string }
  | { type: 'confirm'; title: string; body: string; confirm: string; danger?: boolean; action: () => void };

export interface Toast {
  id: number;
  text: string;
  actionLabel?: string;
  action?: () => void;
}

export interface Session {
  feeds: Record<FeedKind, FeedState>;
  activeFeed: FeedKind;
  category: Category | 'all';
  sort: SortKey;
  playing: boolean;
  muted: boolean;
  /** Desktop panel: comments expanded to the full column. */
  commentsOpen: boolean;
  /** Mobile sheets. */
  sheet: 'comments' | 'creator' | null;
  modal: ModalState | null;
  toasts: Toast[];
  /** Bumped to ask the search box to take focus. */
  searchFocus: number;
  /** Bumped to ask the comment composer to take focus. */
  composerFocus: number;
}

export interface RootState {
  p: Persisted;
  s: Session;
}
