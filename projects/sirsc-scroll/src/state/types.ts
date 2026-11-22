// Shared data shapes. Videos come from the real catalog (or the demo clips), accounts are Warden Chat
// accounts, likes and comments live in Warden Chat's database (lib/social.ts), and everything else an
// account does (follows, saves, history, interests) is kept in this browser per account.

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

/** A real video from the SirSC Scroll catalog, played with YouTube's official embedded player. */
export interface YouTubeSource {
  kind: 'youtube';
  youtubeId: string;
  thumbnailUrl: string | null;
  /** From the embed size YouTube reports; vertical alone doesn't prove it's a YouTube Short. */
  orientation: 'vertical' | 'horizontal' | 'square' | null;
  aspectRatio: number | null;
  channelId: string | null;
  channelTitle: string | null;
}

/** How a video plays: demo clips (no source) use the animated placeholder. */
export type VideoSource = YouTubeSource;

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
  /** Set for real catalog videos; absent for the demo clips. */
  source?: VideoSource;
}

/** creator: a channel or demo-clip creator. member: a Warden Chat account (you, or a commenter). */
export type UserKind = 'creator' | 'demo' | 'friend' | 'member';

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
  followers: number;
  following: number;
  likes: number;
  verified?: boolean;
  categories: Category[];
  kind: UserKind;
  joined: number;
  location?: string;
}

/** A made-up sample comment on a demo clip (real comments are RemoteComment in lib/social.ts). */
export interface Comment {
  id: string;
  videoId: string;
  authorId: string;
  text: string;
  at: number;
  likes: number;
  parentId?: string;
  pinned?: boolean;
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

export type ActivityType =
  | 'like'
  | 'unlike'
  | 'save'
  | 'comment'
  | 'reply'
  | 'follow'
  | 'unfollow'
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

export interface Signals {
  likes: number;
  saves: number;
  follows: number;
  comments: number;
  completions: number;
  replays: number;
  skips: number;
  notInterested: number;
}

export interface AccountState {
  following: string[];
  /** Videos this account liked. Real videos follow the server (lib/social.ts); this copy drives recommendations. */
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
  activity: ActivityEntry[];
  recentSearches: string[];
  /** Bumped by Refresh Feed so the For You shuffle changes. */
  nonce: number;
  /** When this browser first saw the account (ms). */
  createdAt: number;
}

export type ThemeName = 'dark' | 'dim' | 'contrast';
export type Density = 'compact' | 'standard' | 'expanded';

export type WidgetId = 'info' | 'creator' | 'stats' | 'comments' | 'upnext' | 'related' | 'discovery';

export interface WidgetSnapshot {
  visible: Record<WidgetId, boolean>;
  expanded: WidgetId | null;
}

/** Desktop widget workspace: which information widgets show beside the player, and how. */
export interface WidgetPrefs extends WidgetSnapshot {
  /** Display order (also the order inside each column). */
  order: WidgetId[];
  /** The layout before the last Focus Mode / Show all / Default, for one-click restore. */
  previous: WidgetSnapshot | null;
}

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
  /** Separate preference for screens under 1100px, where the sidebar starts collapsed. */
  sidebarCollapsedNarrow: boolean;
  /** Real YouTube videos from the SirSC Scroll catalog, or the animated demo clips. */
  videoSource: 'catalog' | 'demo';
  /** Embed address for real videos. */
  playerHost: 'nocookie' | 'youtube';
  /** Owner preview key (from Vault). Lets this browser also see videos still pending review. */
  catalogPreviewKey: string;
  /** Owner review key (from Vault). Lets the review page shortlist, approve and reject videos. */
  catalogReviewKey: string;
}

export interface Persisted {
  v: number;
  /** "w:<Warden Chat user id>" while signed in; "signed-out" otherwise (an empty placeholder account). */
  activeId: string;
  accounts: Record<string, AccountState>;
  settings: Settings;
  widgets: WidgetPrefs;
}

export type FeedKind = 'foryou' | 'following' | 'trending' | 'list';

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
  | { type: 'collection'; videoId: string }
  | { type: 'report'; videoId: string }
  | { type: 'report-comment'; commentId: number; videoId: string; author: string; text: string }
  | { type: 'shortcuts' }
  | { type: 'interests'; welcome?: boolean }
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
  /** Bumped to draw attention to a widget (scroll into view, highlight, maybe focus its input). */
  widgetFocus: { id: WidgetId; n: number; input: boolean } | null;
  /** Desktop "Customize widgets" popover. */
  customizeOpen: boolean;
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
