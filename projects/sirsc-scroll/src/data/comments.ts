import type { Category, Comment, Video } from '../state/types';
import { CREATOR_IDS, FRIEND_IDS } from './users';
import { between, intBetween, pick, pickN, rng } from '../lib/rng';

const GENERAL = [
  'the ending got me 😭',
  'why is this so accurate',
  'watched this 6 times already',
  'okay this deserves way more views',
  'not me sending this to everyone I know',
  'the editing on this is so clean',
  'this is my roman empire now',
  'I need a part 2 immediately',
  'came back to watch this again',
  'the timing at 0:07 is perfect',
  'who else is watching this in class 👀',
  'this unlocked a memory',
  'every single time 😂',
  'certified banger',
  'how does this only have this many likes',
  'saving this for later',
  'my brain needed this today',
  'the way I gasped',
  'okay but the sound choice is elite',
  'I showed my whole family',
];

const BY_CATEGORY: Record<Category, string[]> = {
  gaming: ['that flick was disgusting (compliment)', 'what sensitivity do you run??', 'my teammates could never', 'the comms at the end 😭', 'patch notes did NOT mention this', 'I would have panicked so hard', 'rank reveal at the end?'],
  memes: ['this is literally me', 'sending this to the group chat rn', 'I feel so seen', 'the zoom at the end 💀', 'who made this, I need to thank them', 'this is so specific and so real'],
  sports: ['the crowd reaction is everything', 'replay it in slow mo!!', 'that defender needs a hug', 'this should be on the highlight reel', 'coach is definitely watching this', 'clean form too'],
  comedy: ['the delivery is perfect', 'I can hear this video', 'the background guy 😂', 'cast this in a movie already', 'I laughed out loud in the library', 'the pause before the punchline'],
  school: ['every school has this kid', 'my teacher does EXACTLY this', 'this is too real', 'filming this during lunch is crazy', 'which one is me tho', 'sending to my lab partner'],
  technology: ['wait this actually works', 'parts list please!', 'my Chromebook is shaking', 'explained better than my teacher', 'trying this tonight', 'this saved me so much time'],
  music: ['the harmony at the end 😮', 'is this on any playlist?', 'I need the full version', 'chills. actual chills.', 'please drop this as a song', 'that bass line though'],
  animals: ['protect him at all costs', 'the little noise!!', 'she knows she\'s famous', 'I would die for this animal', 'give him a treat immediately', 'the head tilt 🥺'],
  science: ['this is cooler than any class I\'ve had', 'wait how does this work', 'doing this for my science fair', 'the slow mo is unreal', 'my teacher needs to see this', 'learned more here than in a week'],
  trending: ['the transition is so smooth', 'I tried this and fell', 'teaching this to my friends tomorrow', 'you nailed it', 'best version I\'ve seen', 'okay this trend is fun'],
  community: ['can\'t wait to try this', 'SirSC never misses', 'is this coming to Chromebooks too?', 'the devs actually listen 🙏', 'been waiting for this', 'see you all in the tournament'],
};

const REPLIES = [
  'fr fr',
  'this is so true',
  'LMAO same',
  'you\'re so right',
  'no because why is this me',
  'came here to say this',
  'facts',
  'honestly yes',
  'wait I didn\'t notice that 😂',
  'this comment > the video',
];

const CREATOR_REPLIES = ['thank you!! 🙏', 'part 2 is coming soon 👀', 'you get it', 'this made my day', 'more on Friday!'];

const HOUR = 3_600_000;
const cache = new Map<string, Comment[]>();

/** Fictional comments for a video, generated the same way every time. */
export function seedComments(video: Video): Comment[] {
  const hit = cache.get(video.id);
  if (hit) return hit;
  const r = rng(`comments:${video.id}`);
  const authors = [...CREATOR_IDS.filter((id) => id !== video.creatorId), ...FRIEND_IDS];
  const count = Math.min(16, Math.max(5, Math.round(Math.log10(video.comments + 10) * 3.4)));
  const pool = [...BY_CATEGORY[video.category], ...pickN(r, GENERAL, 10)];
  const texts = pickN(r, pool, count);
  const age = Math.max(HOUR, Date.now() - video.uploadedAt);
  const out: Comment[] = [];
  texts.forEach((text, i) => {
    const id = `${video.id}c${i}`;
    const likes = Math.round(Math.pow(r(), 3) * video.likes * 0.04) + intBetween(r, 0, 40);
    out.push({
      id,
      videoId: video.id,
      authorId: pick(r, authors),
      text,
      at: Math.round(video.uploadedAt + between(r, 0.02, 1) * age),
      likes,
    });
    if (r() < 0.35) {
      const n = intBetween(r, 1, 3);
      for (let j = 0; j < n; j++) {
        const fromCreator = j === 0 && r() < 0.35;
        out.push({
          id: `${id}r${j}`,
          videoId: video.id,
          authorId: fromCreator ? video.creatorId : pick(r, authors),
          text: fromCreator ? pick(r, CREATOR_REPLIES) : pick(r, REPLIES),
          at: Math.round(video.uploadedAt + between(r, 0.3, 1) * age),
          likes: intBetween(r, 0, Math.max(3, Math.round(likes / 6))),
          parentId: id,
        });
      }
    }
  });
  // The creator pins the most-liked top-level comment on popular clips.
  if (video.likes > 20000) {
    const top = out.filter((c) => !c.parentId).sort((a, b) => b.likes - a.likes)[0];
    if (top) top.pinned = true;
  }
  cache.set(video.id, out);
  return out;
}
