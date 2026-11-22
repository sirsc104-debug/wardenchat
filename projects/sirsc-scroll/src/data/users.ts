import type { Category, User } from '../state/types';

const DAY = 86_400_000;
const NOW = Date.now();

type Row = [id: string, handle: string, name: string, h1: number, h2: number, followers: number, cats: Category[], bio: string, verified?: boolean, location?: string];

// Fictional creators. Any resemblance to real accounts is accidental.
const CREATORS: Row[] = [
  ['pixelvault', 'pixelvault', 'Pixel Vault', 265, 205, 412_000, ['gaming', 'technology'], 'Daily clutch clips and patch-day breakdowns. Controller in one hand, snacks in the other.', true, 'Portland'],
  ['noscope', 'noscope.nia', 'Nia Okafor', 290, 330, 186_000, ['gaming', 'comedy'], 'Ranked grinder, part-time comedian, full-time button masher.', false, 'Atlanta'],
  ['lagspike', 'lagspike', 'Lag Spike', 230, 280, 97_400, ['gaming', 'memes'], 'Every fail clip you were too embarrassed to post. We post them for you.'],
  ['speedrunsol', 'speedrun.sol', 'Sol Reyes', 20, 260, 58_900, ['gaming'], 'Shaving milliseconds off games nobody else plays. World record #7 incoming.', false, 'Austin'],
  ['memeorbit', 'memeorbit', 'Meme Orbit', 48, 18, 655_000, ['memes', 'trending'], 'Orbiting the internet so you do not have to. Fresh memes every hour.', true],
  ['goblinmode', 'goblinmode.daily', 'Goblin Mode Daily', 80, 40, 233_000, ['memes', 'comedy'], 'Unhinged, unbothered, unemployed (we are 15).'],
  ['deadpan', 'deadpan.dot', 'Deadpan Dot', 0, 210, 71_200, ['memes', 'technology'], 'Tech memes with zero facial expressions.'],
  ['courtvision', 'courtvision', 'Court Vision', 140, 30, 318_000, ['sports'], 'Hoops highlights, breakdowns and the plays the broadcast missed.', true, 'Chicago'],
  ['finalwhistle', 'thefinalwhistle', 'The Final Whistle', 160, 210, 144_000, ['sports'], 'Soccer goals, saves and stoppage-time drama from every league we can find.'],
  ['trickshot', 'trickshot.tre', 'Tre Walker', 120, 50, 509_000, ['sports', 'trending'], 'If it can be thrown, I can make it in a cup from the roof.', true, 'Phoenix'],
  ['sketchy', 'sketchyhours', 'Sketchy Hours', 350, 20, 276_000, ['comedy'], 'A sketch comedy troupe with one camera and no budget.'],
  ['mayajokes', 'maya.makes.jokes', 'Maya Lin', 330, 10, 129_000, ['comedy', 'school'], 'Stand-up about being the oldest sibling. Tour dates: my living room.', false, 'Seattle'],
  ['bitlab', 'thebitlab', 'The Bit Lab', 5, 300, 88_300, ['comedy', 'trending'], 'Improv experiments. Results may vary.'],
  ['hallpass', 'hallpass.diaries', 'Hall Pass Diaries', 32, 0, 402_000, ['school', 'comedy'], 'Every type of student, teacher and substitute, played by one guy.', true],
  ['fieldtrip', 'mr.fieldtrip', 'Mr. Fieldtrip', 38, 190, 167_000, ['school', 'science'], 'Middle school science teacher. Yes, my students know about this account.', false, 'Denver'],
  ['studyloop', 'studyloop', 'Study Loop', 200, 150, 91_000, ['school', 'technology'], 'Study hacks that actually work. Pomodoro timers and lo-fi included.'],
  ['circuit', 'circuitbreaker', 'Circuit Breaker', 200, 250, 344_000, ['technology'], 'Gadget tear-downs, budget setups and honest reviews.', true],
  ['bytesize', 'byte.size', 'Byte Size', 190, 160, 152_000, ['technology', 'science'], 'Coding explained in 60 seconds or less. Usually less.'],
  ['loopstation', 'loopstation', 'Loop Station', 315, 260, 289_000, ['music', 'trending'], 'One looper, one mic, a thousand layers.', true, 'Nashville'],
  ['kenjikeys', 'kenji.keys', 'Kenji Mori', 280, 330, 133_000, ['music'], 'Piano covers of songs that should never be piano covers.'],
  ['bassment', 'thebassment', 'The Bassment', 300, 230, 76_500, ['music'], 'Basement band. Neighbors hate us. Subscribe anyway.'],
  ['pawseffect', 'pawsandeffect', 'Paws & Effect', 95, 40, 521_000, ['animals'], 'A golden retriever, two cats and a parrot that runs the house.', true],
  ['critterclub', 'critterclub', 'Critter Club', 110, 170, 118_000, ['animals', 'science'], 'Wildlife rescue volunteers sharing patients you can root for.'],
  ['labrat', 'labrat.leo', 'Leo Park', 175, 210, 207_000, ['science'], 'Kitchen-table experiments. Safety goggles are a lifestyle.', true],
  ['orbitlab', 'orbitlab', 'Orbit Lab', 220, 190, 99_800, ['science', 'technology'], 'Space news without the jargon. Launch countdowns every Friday.'],
  ['fizz', 'professor.fizz', 'Professor Fizz', 160, 60, 64_000, ['science', 'comedy'], 'Chemistry with extra bubbles.'],
  ['trendcast', 'trendcast', 'Trendcast', 12, 330, 377_000, ['trending', 'music'], 'Every trend, tracked. Learn the dance before your little cousin does.', true],
  ['dailydrop', 'dailydrop', 'Daily Drop', 25, 60, 142_000, ['trending', 'memes'], 'What blew up today, in one scroll.'],
  ['sirsc', 'sirsc', 'SirSC', 188, 215, 88_000, ['community'], 'Official account for SirSC Games, Warden Chat, SirSC AI and SirSC Scroll. Your Feed. Your Way.', true],
  ['wardenchat', 'wardenchat', 'Warden Chat', 200, 175, 41_000, ['community', 'technology'], 'Chat, voice and friends for the SirSC ecosystem. Release notes live here.', true],
  ['sirscgames', 'sirsc.games', 'SirSC Games', 210, 280, 36_500, ['community', 'gaming'], 'Wildcard Chess, Apples to Oranges and more. Devlogs, sneak peeks and tournaments.', true],
];

// Fictional students who posted a few of the demo clips (they used to be the switchable demo accounts).
const DEMO: Row[] = [
  ['alex', 'alex', 'Alex Rivera', 188, 230, 1_284, ['gaming', 'memes', 'technology'], 'Building a PC one allowance at a time. Gaming, memes and gadgets.', false, 'Room 214'],
  ['jordan', 'jordan', 'Jordan Brooks', 140, 25, 2_031, ['sports', 'comedy', 'gaming'], 'JV point guard. Will trade snacks for highlight clips.', false, 'Gym, probably'],
  ['sam', 'sam', 'Sam Patel', 315, 265, 3_412, ['music', 'trending', 'comedy'], 'Playlist curator for the entire bus route. Learning bass, badly.', false, 'Band room'],
  ['taylor', 'taylor', 'Taylor Kim', 175, 45, 967, ['school', 'science', 'memes'], 'Science fair survivor. Mitochondria enthusiast. Memes between labs.', false, 'Chem lab'],
];

// Fictional people who wrote the sample comments on demo clips.
const FRIENDS: Row[] = [
  ['riley', 'riley.q', 'Riley Quinn', 30, 340, 402, ['memes', 'gaming', 'animals'], 'Professional lurker.'],
  ['max', 'maxwell.b', 'Max Bennett', 220, 120, 655, ['technology', 'gaming', 'science'], 'I fix the school printers. Nobody asked me to.'],
  ['casey', 'casey.b', 'Casey Bell', 130, 40, 511, ['sports', 'trending', 'comedy'], 'Soccer, sleep, repeat.'],
  ['eli', 'eli.writes', 'Eli Moreno', 260, 10, 288, ['comedy', 'gaming', 'school'], 'Writing a novel. It is going great (it is not).'],
  ['nova', 'nova.sky', 'Nova Ahmed', 300, 190, 1_120, ['music', 'trending', 'animals'], 'Choir kid. Cat person. Taking requests.'],
  ['priya', 'priya.k', 'Priya Kapoor', 170, 320, 734, ['science', 'music', 'school'], 'Future astronaut. Present homework haver.'],
];

function make(row: Row, kind: User['kind'], i: number): User {
  const [id, handle, name, h1, h2, followers, categories, bio, verified, location] = row;
  const r = (i * 7919) % 97;
  return {
    id,
    handle,
    name,
    bio,
    avatar: { h1, h2 },
    followers,
    following: kind === 'creator' ? 40 + ((r * 13) % 400) : 80 + ((r * 7) % 300),
    likes: kind === 'creator' ? Math.round(followers * (6 + (r % 9))) : Math.round(followers * 3.2),
    verified,
    categories,
    kind,
    joined: NOW - (kind === 'creator' ? 300 + r * 9 : 120 + r * 3) * DAY,
    location,
  };
}

export const USERS: User[] = [
  ...CREATORS.map((r, i) => make(r, 'creator', i)),
  ...DEMO.map((r, i) => make(r, 'creator', i + 40)),
  ...FRIENDS.map((r, i) => make(r, 'friend', i + 60)),
];

export const USER_MAP = new Map(USERS.map((u) => [u.id, u]));
export const HANDLE_MAP = new Map(USERS.map((u) => [u.handle, u]));

export const CREATOR_IDS = CREATORS.map((r) => r[0]);
export const FRIEND_IDS = FRIENDS.map((r) => r[0]);

/** Avatar colours for a Warden Chat account, picked from its id so they stay the same everywhere. */
function huesFor(id: string): { h1: number; h2: number } {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  const h1 = (h >>> 0) % 360;
  return { h1, h2: (h1 + 40 + ((h >>> 9) % 80)) % 360 };
}

/** The app's user record for a Warden Chat account ("w:<id>"). Not registered anywhere. */
export function memberUser(userId: string, username: string): User {
  return {
    id: `w:${userId}`,
    handle: username.toLowerCase(),
    name: username,
    bio: '',
    avatar: huesFor(userId),
    followers: 0,
    following: 0,
    likes: 0,
    categories: [],
    kind: 'member',
    joined: Date.now(),
  };
}

let signedIn: User | null = null;

/** Register the signed-in Warden Chat account so profiles, avatars and the composer can find it. */
export function setSignedInUser(u: User | null) {
  if (signedIn) {
    USER_MAP.delete(signedIn.id);
    if (HANDLE_MAP.get(signedIn.handle) === signedIn) HANDLE_MAP.delete(signedIn.handle);
  }
  signedIn = u;
  if (u) {
    USER_MAP.set(u.id, u);
    // A creator with the same handle keeps it; your profile is still reachable as #/profile/me.
    if (!HANDLE_MAP.has(u.handle)) HANDLE_MAP.set(u.handle, u);
  }
}

export function signedInUser(): User | null {
  return signedIn;
}

export function getUser(id: string): User | undefined {
  return USER_MAP.get(id);
}
