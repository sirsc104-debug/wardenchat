import type { Category, Video } from '../state/types';
import { CATEGORIES, categoryInfo } from './categories';
import { USER_MAP } from './users';
import { between, intBetween, pick, rng } from '../lib/rng';

// [creatorId, title, on-screen caption ("TOP|BOTTOM" for memes), glyph, extra hashtags]
type Entry = [string, string, string, string, string[]];

const CATALOG: Record<Category, Entry[]> = {
  gaming: [
    ['pixelvault', '1v4 clutch with 3 HP left', 'CLUTCH 1v4', '🎯', ['clutch', 'ranked']],
    ['noscope', "When your teammate says 'trust me' one more time", 'TRUST ME BRO', '🫠', ['teammates', 'ranked']],
    ['lagspike', 'The lag spike that cost us the whole tournament', 'CONNECTION LOST', '📶', ['fail', 'lag']],
    ['speedrunsol', 'New personal best: Any% in 14:03.21', 'PB 14:03.21', '⏱️', ['speedrun', 'pb']],
    ['pixelvault', "Patch 4.2 broke the grappling hook and it's beautiful", 'PATCH 4.2', '🪝', ['patchnotes', 'glitch']],
    ['noscope', 'Ranking every controller grip from worst to claw', 'CLAW GRIP?', '🎮', ['controller', 'tierlist']],
    ['lagspike', 'Speedrunning the tutorial and still failing', 'TUTORIAL FAILED', '💀', ['fail', 'tutorial']],
    ['pixelvault', 'Building a $400 gaming PC from spare parts', '$400 BUILD', '🖥️', ['pcbuild', 'budget']],
    ['speedrunsol', 'This wall clip saves 0.4 seconds and took 3 weeks', 'WALL CLIP', '🧱', ['speedrun', 'glitch']],
    ['noscope', 'Spectating a bronze lobby with live commentary', 'BRONZE LOBBY', '🥉', ['ranked', 'commentary']],
    ['lagspike', "Every gamer's mom calling them for dinner mid-match", "DINNER'S READY", '🍝', ['relatable', 'gamer']],
    ['pixelvault', 'The hidden room in Skyforge Ruins nobody found for 2 years', 'SECRET ROOM', '🗝️', ['secrets', 'indiegames']],
    ['speedrunsol', 'Teaching my little brother to speedrun (he beat me)', 'HE BEAT ME', '👶', ['speedrun', 'siblings']],
    ['noscope', 'Last-second revive into a full team wipe', 'REVIVED', '🩹', ['clutch', 'teamwork']],
  ],
  memes: [
    ['memeorbit', 'Me pretending to understand the group chat lore', 'WHEN THE GROUP CHAT|HAS LORE I MISSED', '🙂', ['groupchat', 'relatable']],
    ['goblinmode', 'Sunday at 11:59 PM hits different', 'SUNDAY 11:59 PM|HOMEWORK: 0%', '😶', ['homework', 'mood']],
    ['deadpan', "My code works and I don't know why", 'IT WORKS|DO NOT TOUCH IT', '🫥', ['coding', 'devhumor']],
    ['memeorbit', "Nobody: / Me at 2 AM: let's reorganize my entire room", 'NOBODY:|ME AT 2 AM', '🧹', ['nobody', 'relatable']],
    ['goblinmode', 'Practicing my food order 40 times before the counter', 'PRACTICING MY ORDER|FOR THE 40TH TIME', '🍔', ['anxiety', 'relatable']],
    ['dailydrop', 'The cat that stares at nothing went viral again', 'WHAT IS HE|LOOKING AT', '🐈‍⬛', ['cats', 'viral']],
    ['deadpan', 'When the Wi-Fi drops for 0.2 seconds', 'WI-FI: GONE|ME: PANIC', '📡', ['wifi', 'techmemes']],
    ['memeorbit', "That one friend who says 'I'm 5 minutes away'", '5 MINUTES AWAY|(HAS NOT LEFT)', '⏳', ['friends', 'relatable']],
    ['goblinmode', 'Me after one productive hour: I deserve a nap', 'ONE TASK DONE|TIME FOR A NAP', '😴', ['productivity', 'mood']],
    ['dailydrop', 'The rubber duck debate of 2026, explained', 'THE DUCK|DISCOURSE', '🦆', ['discourse', 'explained']],
    ['memeorbit', 'When you hear your name across the room', 'SOMEONE SAID|MY NAME', '👂', ['relatable', 'awkward']],
    ['deadpan', "Autocorrect really said 'no'", 'AUTOCORRECT|HAS OPINIONS', '⌨️', ['autocorrect', 'techmemes']],
    ['goblinmode', 'Me explaining a meme to my parents', 'SO BASICALLY|IT IS A FROG', '🐸', ['parents', 'memes']],
    ['memeorbit', 'Waking up 1 minute before the alarm', 'WOKE UP 1 MIN EARLY|BETRAYED', '⏰', ['mornings', 'mood']],
  ],
  sports: [
    ['courtvision', 'Half-court buzzer beater in the state semifinal', 'BUZZER BEATER', '🏀', ['basketball', 'buzzerbeater']],
    ['finalwhistle', 'Bicycle kick in the 93rd minute', "93' GOAL", '⚽', ['soccer', 'goals']],
    ['trickshot', 'Bottle flip off a moving skateboard', 'FLIP CITY', '🛹', ['trickshot', 'bottleflip']],
    ['courtvision', 'Breaking down the perfect pick-and-roll', 'PICK & ROLL', '🏀', ['basketball', 'breakdown']],
    ['finalwhistle', 'Goalkeeper scores from his own box', 'KEEPER GOAL?!', '🧤', ['soccer', 'goalkeeper']],
    ['trickshot', 'Ping pong ball into a cup from 40 feet', '40 FT', '🏓', ['trickshot', 'pingpong']],
    ['courtvision', 'Ankle breaker of the week, slowed down', 'ANKLES: GONE', '👟', ['basketball', 'crossover']],
    ['finalwhistle', 'Every penalty from the shootout, ranked', 'PENALTIES', '🥅', ['soccer', 'penalties']],
    ['trickshot', 'Basketball off the water tower, first try', 'FIRST TRY', '🗼', ['trickshot', 'basketball']],
    ['courtvision', 'JV game, varsity energy', 'VARSITY ENERGY', '🔥', ['highschool', 'basketball']],
    ['finalwhistle', "The fastest hat trick we've ever clipped", 'HAT TRICK', '🎩', ['soccer', 'hattrick']],
    ['trickshot', "Frisbee through a tire swing while it's swinging", 'THREAD IT', '🥏', ['trickshot', 'frisbee']],
    ['courtvision', 'Free throw routines, ranked by superstition', 'ROUTINE CHECK', '🧦', ['basketball', 'freethrows']],
    ['finalwhistle', 'Last-minute equalizer straight from a corner', 'OLIMPICO', '📐', ['soccer', 'gameday']],
  ],
  comedy: [
    ['sketchy', "POV: You're the group project member who did everything", 'POV: YOU DID IT ALL', '🙃', ['pov', 'groupproject']],
    ['mayajokes', 'Being the oldest sibling is an unpaid internship', 'UNPAID INTERNSHIP', '🎤', ['standup', 'siblings']],
    ['bitlab', 'Improv, but every line has to rhyme', 'RHYME TIME', '🎭', ['improv', 'challenge']],
    ['sketchy', 'If customer service calls were honest', 'PLEASE HOLD FOREVER', '☎️', ['sketch', 'honest']],
    ['mayajokes', "My mom's four different phone voices", 'THE PHONE VOICE', '📞', ['standup', 'parents']],
    ['bitlab', "Narrating my cat's day like a nature documentary", 'NATURE DOC', '🐈', ['bit', 'cats']],
    ['sketchy', "The substitute who's way too into the lesson", 'SUB MODE: MAX', '📚', ['sketch', 'substitute']],
    ['mayajokes', 'Explaining Wi-Fi passwords to my grandparents', "IT'S ON THE ROUTER", '👵', ['standup', 'family']],
    ['bitlab', "A commercial for a product that doesn't need to exist", 'NEW! SOCK FINDER', '🧦', ['sketch', 'ads']],
    ['sketchy', 'Every person at the movie theater', 'SHHH', '🍿', ['sketch', 'types']],
    ['mayajokes', 'Crowd work went wrong (in the best way)', 'CROWD WORK', '😂', ['standup', 'crowdwork']],
    ['bitlab', 'A dramatic reading of the cafeteria menu', "TODAY'S SPECIAL", '🍕', ['bit', 'lunchbreak']],
    ['sketchy', "Waving back at someone who wasn't waving at you", 'WAVE FAIL', '👋', ['relatable', 'sketch']],
    ['bitlab', 'Sports commentators, but for folding laundry', 'AND HE FOLDS!', '🧺', ['bit', 'commentary']],
  ],
  school: [
    ['hallpass', 'Types of students during a fire drill', 'FIRE DRILL TYPES', '🚨', ['types', 'firedrill']],
    ['fieldtrip', 'Teaching photosynthesis with a plant named Gerald', 'MEET GERALD', '🌱', ['teachersoftiktok', 'biology']],
    ['studyloop', 'The 25-5 study method, tested for a week', '25 / 5', '⏲️', ['studytok', 'pomodoro']],
    ['hallpass', "When the teacher says 'pick your own groups'", 'PICK YOUR GROUPS', '😰', ['groupproject', 'relatable']],
    ['fieldtrip', "Rating my students' excuses for late homework", 'EXCUSE RATING', '📝', ['teachersoftiktok', 'homework']],
    ['studyloop', 'How I color-code notes without wasting an hour', 'COLOR CODE', '🖍️', ['studytok', 'notes']],
    ['hallpass', 'The kid who reminds the teacher about homework', 'YOU FORGOT HW', '🙋', ['classroom', 'types']],
    ['fieldtrip', 'Elephant toothpaste in 4th period', 'ELEPHANT TOOTHPASTE', '🧪', ['experiment', 'chemistry']],
    ['studyloop', 'Finals week survival kit for under $10', 'FINALS KIT', '🎒', ['finals', 'studytok']],
    ['hallpass', 'The lunch table hierarchy, explained', 'LUNCH TABLE MAP', '🍱', ['lunchbreak', 'explained']],
    ['fieldtrip', 'Field trip permission slip speedrun', 'PERMISSION SLIP', '🚌', ['fieldtrip', 'teachersoftiktok']],
    ['studyloop', 'Flashcards vs. practice tests: which wins?', 'VS', '🃏', ['studytok', 'studytips']],
    ['hallpass', 'Substitute teacher roll call chaos', 'ROLL CALL', '📋', ['substitute', 'comedy']],
    ['fieldtrip', 'Students explain the water cycle (incorrectly)', 'WATER CYCLE?', '💧', ['science', 'classroom']],
  ],
  technology: [
    ['circuit', "Chromebook tricks your school didn't tell you", 'CHROMEBOOK TIPS', '💻', ['chromebook', 'tips']],
    ['bytesize', 'Recursion explained with nesting dolls', 'RECURSION', '🪆', ['coding', 'explained']],
    ['circuit', 'I built a keyboard out of a cereal box', 'CEREAL KEYBOARD', '⌨️', ['keyboards', 'diy']],
    ['bytesize', 'Your first website in 60 seconds', 'HELLO, WORLD', '🌐', ['coding', 'webdev']],
    ['circuit', 'Budget desk setup under $150', '$150 SETUP', '🖥️', ['setup', 'budget']],
    ['bytesize', 'Why your code only works on your machine', 'WORKS ON MY MACHINE', '🤷', ['coding', 'debugging']],
    ['circuit', 'Tearing down a 10-year-old phone', 'TEAR-DOWN', '📱', ['gadgets', 'teardown']],
    ['bytesize', 'Binary counting on your fingers (up to 1,023)', '1023 ON 10 FINGERS', '✋', ['binary', 'howto']],
    ['circuit', 'Cable management for people who hate cable management', 'CABLE CHAOS', '🔌', ['setup', 'cables']],
    ['bytesize', 'What actually happens when you press Enter on a URL', 'PRESS ENTER', '↩️', ['internet', 'explained']],
    ['circuit', 'Testing the cheapest smartwatch I could find', '$9 WATCH', '⌚', ['gadgets', 'review']],
    ['bytesize', 'Variables explained with lunchboxes', 'LET LUNCH = 🥪', '🥪', ['coding', 'beginners']],
    ['circuit', 'A robot arm from cardboard and syringes', 'HYDRAULIC ARM', '🦾', ['diy', 'robotics']],
    ['bytesize', 'How AI image upscaling (sort of) works', 'UPSCALE', '🔍', ['ai', 'explained']],
  ],
  music: [
    ['loopstation', 'Building a whole song from one beatbox loop', 'LOOP 1 / 12', '🎙️', ['looper', 'beatbox']],
    ['kenjikeys', 'The cafeteria jingle, but make it a ballad', 'CAFETERIA BALLAD', '🎹', ['piano', 'cover']],
    ['bassment', 'The bass line that made our neighbor knock', 'KNOCK KNOCK', '🎸', ['bass', 'band']],
    ['loopstation', 'Layering 30 harmonies in one take', '30 HARMONIES', '🎶', ['vocals', 'looper']],
    ['kenjikeys', 'A ringtone medley on a grand piano', 'RINGTONE MEDLEY', '📲', ['piano', 'medley']],
    ['bassment', 'Our drummer only plays pots and pans now', 'POTS & PANS', '🥁', ['drums', 'band']],
    ['loopstation', 'Making a beat out of classroom sounds', 'CLASSROOM BEAT', '✏️', ['producer', 'beats']],
    ['kenjikeys', 'The same song in 5 different moods', '5 MOODS', '🎼', ['piano', 'moods']],
    ['bassment', 'First gig at the pizza place: the full set', 'LIVE @ PIZZA', '🍕', ['band', 'live']],
    ['loopstation', 'Turning the school bell into a lo-fi track', 'LO-FI BELL', '🔔', ['lofi', 'producer']],
    ['kenjikeys', 'You hum it, I play it (viewer requests)', 'HUM IT', '🎵', ['requests', 'piano']],
    ['bassment', 'Slap bass tutorial for absolute beginners', 'SLAP 101', '👋', ['bass', 'tutorial']],
    ['loopstation', 'Midnight Drive: the full loop', 'MIDNIGHT DRIVE', '🌙', ['newmusic', 'synth']],
    ['kenjikeys', "Sight-reading a song I've never heard", 'SIGHT-READ', '👀', ['piano', 'challenge']],
  ],
  animals: [
    ['pawseffect', 'Biscuit learned to open the fridge', 'FRIDGE: OPENED', '🐕', ['dogs', 'smartdog']],
    ['critterclub', "A baby owl's first flight test", 'FIRST FLIGHT', '🦉', ['wildlife', 'rescue']],
    ['pawseffect', 'The parrot imitates the microwave now', 'BEEP BEEP BEEP', '🦜', ['parrot', 'pets']],
    ['critterclub', 'Hedgehog bath time, narrated', 'BATH TIME', '🦔', ['hedgehog', 'cute']],
    ['pawseffect', 'Cats vs. the new cardboard box', 'THE BOX', '🐈', ['cats', 'catsoftiktok']],
    ['critterclub', 'Releasing a rehabbed sea turtle', 'BACK TO SEA', '🐢', ['wildlife', 'rescue']],
    ['pawseffect', 'Golden retriever meets a snowman', 'SNOWMAN?', '☃️', ['dogs', 'snow']],
    ['critterclub', 'This squirrel solved our bird feeder puzzle', 'PUZZLE SOLVED', '🐿️', ['wildlife', 'squirrels']],
    ['pawseffect', "My dog's reaction when I say 'walk' in Spanish", '¿PASEO?', '🦮', ['dogs', 'funny']],
    ['critterclub', 'An otter pup learns to float', 'FLOAT MODE', '🦦', ['otters', 'cute']],
    ['pawseffect', 'Ranking the things my cat knocked off the table', 'GRAVITY TEST', '🐾', ['cats', 'funny']],
    ['critterclub', 'Raccoon tries grapes for the first time', 'GRAPE REVIEW', '🦝', ['raccoon', 'wildlife']],
    ['pawseffect', 'Puppy vs. its own reflection', 'WHO IS THAT', '🐶', ['puppy', 'dogs']],
    ['critterclub', 'Bunny binkies at full speed', 'BINKY!', '🐇', ['bunny', 'cute']],
  ],
  science: [
    ['labrat', 'Making a cloud in a bottle', 'CLOUD IN A BOTTLE', '☁️', ['experiment', 'weather']],
    ['orbitlab', 'How big is the Sun, really?', '1.3M EARTHS', '☀️', ['space', 'scale']],
    ['fizz', 'Why mixing these two makes foam', 'FOAM!', '🫧', ['chemistry', 'reactions']],
    ['labrat', 'Non-Newtonian fluid: can you run across it?', 'OOBLECK', '🥣', ['physics', 'experiment']],
    ['orbitlab', 'A day on Venus is longer than its year', 'DAY > YEAR', '🪐', ['space', 'didyouknow']],
    ['fizz', 'Rainbow flames with metal salts (with an adult!)', 'FLAME TEST', '🔥', ['chemistry', 'safety']],
    ['labrat', 'Egg drop challenge: 3 designs, 1 survivor', 'EGG DROP', '🥚', ['physics', 'challenge']],
    ['orbitlab', 'A rocket launch, frame by frame', 'T-MINUS 10', '🚀', ['space', 'rockets']],
    ['fizz', 'The mitochondria is the powerhouse of the... why?', 'POWERHOUSE', '⚡', ['biology', 'cells']],
    ['labrat', 'Magnet tricks that look like magic', 'MAGNETS', '🧲', ['physics', 'magnets']],
    ['orbitlab', 'Why the Moon always shows the same face', 'TIDAL LOCK', '🌕', ['space', 'moon']],
    ['fizz', 'A pH rainbow from red cabbage juice', 'pH RAINBOW', '🌈', ['chemistry', 'ph']],
    ['labrat', 'Pendulum wave: 15 pendulums, one pattern', 'PENDULUM WAVE', '〰️', ['physics', 'waves']],
    ['orbitlab', 'What a black hole would do to spaghetti', 'SPAGHETTIFIED', '🍝', ['space', 'blackholes']],
  ],
  trending: [
    ['trendcast', 'The Mirror Step challenge, slowed down', '#MIRRORSTEP', '🕺', ['challenge', 'mirrorstep']],
    ['dailydrop', "Everyone is doing the 'freeze frame' transition", 'FREEZE FRAME', '🧊', ['transition', 'viral']],
    ['trendcast', 'Learn the Hallway Shuffle in 30 seconds', 'HALLWAY SHUFFLE', '👟', ['dance', 'hallwayshuffle']],
    ['dailydrop', "Today's top 5 trends in one clip", 'TOP 5 TODAY', '📈', ['trending', 'recap']],
    ['trendcast', 'Duet chain: 12 people, one song', 'DUET CHAIN', '🎤', ['duet', 'challenge']],
    ['dailydrop', "The 'one color outfit' challenge", 'ONE COLOR FIT', '🎨', ['fashion', 'challenge']],
    ['trendcast', 'The sneaker squeak beat drop', 'SQUEAK DROP', '🔊', ['dance', 'beatdrop']],
    ['dailydrop', 'Speed-cleaning trend: a 1-minute room reset', '1 MIN RESET', '🧽', ['challenge', 'cleaning']],
    ['trendcast', 'Teachers attempt the Mirror Step', 'TEACHERS TRY IT', '🧑‍🏫', ['mirrorstep', 'teachers']],
    ['dailydrop', "Why everyone is saying 'it's giving'", "IT'S GIVING", '💬', ['slang', 'explained']],
    ['trendcast', 'The backwards walk challenge (we fell)', 'WALK BACKWARDS', '🔄', ['challenge', 'fail']],
    ['dailydrop', 'The lip-sync relay going around schools', 'LIP-SYNC RELAY', '👄', ['lipsync', 'school']],
    ['trendcast', 'Slow-motion hair flip transition', 'HAIR FLIP', '💇', ['transition', 'slowmo']],
    ['dailydrop', "Trend forecast: what's next week?", "NEXT WEEK'S TREND", '🔮', ['trending', 'forecast']],
  ],
  community: [
    ['sirsc', 'Welcome to SirSC Scroll: Your Feed. Your Way.', 'SIRSC SCROLL', '▶', ['sirscscroll', 'launch']],
    ['sirscgames', 'Wildcard Chess: the Bomber piece in action', 'WILDCARD CHESS', '♟️', ['wildcardchess', 'devlog']],
    ['wardenchat', 'Warden Chat voice rooms are here', 'VOICE ROOMS', '🎧', ['wardenchat', 'update']],
    ['sirscgames', 'Apples to Oranges: can you beat Ultra mode?', 'APPLES TO ORANGES', '🍊', ['applestooranges', 'challenge']],
    ['sirsc', 'SirSC AI study helper: a sneak peek', 'SIRSC AI', '✨', ['sirscai', 'sneakpeek']],
    ['wardenchat', "5 Warden Chat shortcuts you didn't know", '5 SHORTCUTS', '⌨️', ['wardenchat', 'tips']],
    ['sirscgames', 'Fruit Dash race highlights: 8 racers, 60 seconds', 'FRUIT DASH', '🍓', ['fruitdash', 'highlights']],
    ['sirsc', 'How we design SirSC apps for school Chromebooks', 'BUILT FOR CHROMEBOOKS', '💻', ['devlog', 'design']],
    ['sirscgames', 'Community tournament bracket reveal', 'BRACKET REVEAL', '🏆', ['tournament', 'community']],
    ['wardenchat', 'Friend groups in Warden Chat, explained', 'FRIEND GROUPS', '👥', ['wardenchat', 'howto']],
    ['sirsc', 'Your feed, your rules: tuning recommendations', 'TUNE YOUR FEED', '🎛️', ['sirscscroll', 'howto']],
    ['sirscgames', 'Wildcard Chess: the 5 legendary pieces, ranked', 'LEGENDARIES', '👑', ['wildcardchess', 'tierlist']],
    ['sirsc', 'Community spotlight: fan art week', 'FAN ART WEEK', '🖌️', ['community', 'art']],
    ['wardenchat', 'Safety settings every student should turn on', 'STAY SAFE', '🛡️', ['wardenchat', 'safety']],
  ],
};

// A few clips from the demo accounts themselves, so their profiles aren't empty.
const DEMO_CLIPS: [Category, ...Entry][] = [
  ['gaming', 'alex', 'My first PC build boot-up (it posted!)', 'IT POSTED!', '🖥️', ['pcbuild', 'firstbuild']],
  ['memes', 'alex', 'When the Chromebook cart is empty on test day', 'CART: EMPTY|TEST: TODAY', '🛒', ['chromebook', 'relatable']],
  ['sports', 'jordan', 'Game winner from the elbow (JV home opener)', 'GAME WINNER', '🏀', ['basketball', 'jv']],
  ['comedy', 'jordan', "Coach's pregame speech, but it's 90% snack talk", 'PREGAME SPEECH', '📣', ['sketch', 'coach']],
  ['music', 'sam', 'Our bus route playlist, ranked by stop', 'BUS ROUTE MIX', '🚌', ['playlist', 'busride']],
  ['trending', 'sam', 'Attempting the Hallway Shuffle (day 3)', 'DAY 3', '👟', ['hallwayshuffle', 'dance']],
  ['science', 'taylor', 'My science fair volcano, but geologically accurate', 'ACCURATE VOLCANO', '🌋', ['sciencefair', 'geology']],
  ['school', 'taylor', 'Lab partner tier list', 'LAB PARTNERS', '🥽', ['lab', 'tierlist']],
];

const OPENERS: Record<Category, string[]> = {
  gaming: ['Clipped this from last night\'s session.', 'Recorded on stream, cleaned up for you.', 'I still can\'t believe this worked.', 'Third attempt was the charm.', 'The lobby went silent after this.', 'Pulled this from a 4-hour VOD.'],
  memes: ['I feel personally attacked.', 'Tag the friend who does this.', 'This one lives rent free.', 'Made this at 3 AM, no regrets.', 'Accurate down to the second.', 'Be honest, it\'s you.'],
  sports: ['Watch it twice, then watch it again.', 'Crowd went absolutely silent.', 'Shot from the stands on a phone.', 'This is why we stay until the end.', 'The replay angle is even better.', 'Our camera guy almost dropped the phone.'],
  comedy: ['Based on a true story (unfortunately).', 'We wrote this in ten minutes.', 'One take. No script. Pure chaos.', 'Part 2 if this gets weird enough.', 'My family is not thrilled about this one.', 'Inspired by a comment on our last video.'],
  school: ['Every school has one.', 'Tell me this isn\'t your school.', 'Filmed after the bell, I promise.', 'Teachers, this one\'s for you.', 'Day 47 of surviving the semester.', 'Save this before finals.'],
  technology: ['Quick one today.', 'You asked, so here it is.', 'This took way longer than 60 seconds.', 'Bookmark this for later.', 'Nothing was harmed except my patience.', 'Tested so you don\'t have to.'],
  music: ['Headphones on for this one.', 'Recorded in one take at midnight.', 'Turn it up (the neighbors already know).', 'Started as a joke, ended as a banger.', 'Full version if this hits 10K.', 'Every sound here is real.'],
  animals: ['No animals were bothered for this video.', 'He does this every single morning.', 'Our rescue team cried a little.', 'She knows exactly what she did.', 'Volume up for the tiny noises.', 'Pure, unfiltered chaos.'],
  science: ['Try this one at home (with an adult).', 'The physics here is wild.', 'I did the math so you don\'t have to.', 'Science teachers, steal this.', 'It looks fake but it isn\'t.', 'Explained in under a minute.'],
  trending: ['Everyone is doing it, so we did too.', 'Learn it before it\'s everywhere.', 'Day one of this trend and it\'s already chaos.', 'The original sound is linked.', 'Duet this, I dare you.', 'Tag someone who can actually do this.'],
  community: ['Fresh from the SirSC team.', 'Big update for the SirSC community.', 'Straight from the devlog.', 'A peek behind the scenes.', 'You asked, we built it.', 'Made with the community, for the community.'],
};

const MIDDLES: Record<Category, string[]> = {
  gaming: ['Settings and sensitivity are pinned in the comments.', 'Full VOD is up on the channel.', 'Running it back on Friday\'s stream.', 'No mods, no cheats, just bad decisions.', 'My hands were shaking for the last ten seconds.', 'Shoutout to the squad for the setup.'],
  memes: ['Inspired by literally everyone I know.', 'The second half is the best part.', 'Sound on for maximum damage.', 'Peer reviewed by my group chat.', 'Template is free, go wild.', 'Certified relatable by 9 out of 10 teens.'],
  sports: ['Final score in the comments.', 'Slowed down so you can see the footwork.', 'That defender is still looking for his shoe.', 'Coach has watched this 400 times.', 'Rate the celebration out of 10.', 'Full game highlights drop tomorrow.'],
  comedy: ['Cast list in the bio.', 'The blooper reel is somehow worse.', 'If you laughed, that counts as a follow.', 'We\'re taking suggestions for the next bit.', 'No props were returned to the store.', 'The cat actually improvised that.'],
  school: ['Which one are you?', 'My teacher saw this, wish me luck.', 'Real study tips at the end.', 'Shared by a student who shall remain nameless.', 'Notes template in the comments.', 'Group project survivors, unite.'],
  technology: ['Parts list in the comments.', 'Works on most school Chromebooks.', 'Code is on the screen if you pause.', 'Step-by-step in part 2.', 'Spoiler: the cheap one won.', 'Ask your questions below and I\'ll answer.'],
  music: ['Sheet music in the comments.', 'Made with a looper and a pair of socks.', 'Feel free to use the sound.', 'Duet the harmony part.', 'Gear list in the bio.', 'The bridge at the end is my favorite.'],
  animals: ['Treats were provided afterwards.', 'Adoption info for our rescues in the bio.', 'She has her own fan club now.', 'Our vet approved this one.', 'Part 2 coming because he did it again.', 'Name suggestions welcome.'],
  science: ['Supplies list in the comments.', 'Sources at the end of the clip.', 'Wear goggles. Seriously.', 'The slow-motion part is the best part.', 'Teachers: free worksheet in the bio.', 'Next week: you vote on the experiment.'],
  trending: ['Tutorial version is up too.', 'Our version has a twist at the end.', 'We practiced this for two whole hours.', 'Sound by our favorite creator.', 'Stitch this with your attempt.', 'The fail at the end is real.'],
  community: ['Try it now in the SirSC ecosystem.', 'Feedback welcome in the comments.', 'Patch notes are pinned.', 'Thank you for 10,000 players.', 'More news in the next devlog.', 'Built by a small team of students and friends.'],
};

const CLOSERS = [
  'Would you have done it differently?',
  'Drop your best one below.',
  'Follow for part 2.',
  'Save this for later.',
  'Share it with the group chat.',
  'Rate it 1 to 10.',
  'Tell me I\'m not the only one.',
  'Comment your guess before the end.',
];

const SOUNDS = [
  'Neon Hallway — Loop Station',
  'Sunday Static — The Bassment',
  'Lunch Bell Lo-Fi — Loop Station',
  'Pocket Thunder — Trendcast Sounds',
  'Mirror Step (Official Sound) — Trendcast',
  'Cardboard Robots — Byte Size Beats',
  'Chalk Dust — Kenji Mori',
  'Half-Court Hype — Court Vision',
  'Kitchen Table Theme — Leo Park',
  'Victory Lap (8-bit) — Pixel Vault',
  'Midnight Drive — Loop Station',
  'Paper Planes — Kenji Mori',
];

const DURATIONS: Record<Category, [number, number]> = {
  memes: [7, 18],
  gaming: [15, 58],
  sports: [10, 34],
  comedy: [20, 72],
  school: [15, 55],
  technology: [25, 88],
  music: [15, 60],
  animals: [8, 30],
  science: [20, 78],
  trending: [10, 28],
  community: [20, 55],
};

const RELATED: Record<Category, Category[]> = {
  gaming: ['technology', 'memes', 'comedy'],
  memes: ['comedy', 'trending', 'school'],
  sports: ['trending', 'comedy'],
  comedy: ['memes', 'school', 'trending'],
  school: ['comedy', 'science', 'memes'],
  technology: ['gaming', 'science'],
  music: ['trending', 'comedy'],
  animals: ['memes', 'science'],
  science: ['school', 'technology', 'animals'],
  trending: ['music', 'memes', 'sports'],
  community: ['gaming', 'technology'],
};

const DAY = 86_400_000;
const NOW = Date.now();

function build(category: Category, entry: Entry, index: number, id: string): Video {
  const [creatorId, title, caption, glyph, extra] = entry;
  const r = rng(`${id}:${title}`);
  const creator = USER_MAP.get(creatorId);
  const info = categoryInfo(category);
  const reach = creator ? creator.followers : 2000;
  const momentum = Math.pow(r(), 1.6);
  const viral = r() < 0.12 ? between(r, 3, 9) : 1;
  const views = Math.round(reach * between(r, 0.18, 2.4) * viral * (0.7 + momentum) + between(r, 800, 9000));
  const likeRate = between(r, 0.045, 0.14);
  const likes = Math.round(views * likeRate);
  const comments = Math.round(likes * between(r, 0.012, 0.05));
  const shares = Math.round(likes * between(r, 0.02, 0.09));
  const saves = Math.round(likes * between(r, 0.025, 0.1));
  const [dlo, dhi] = DURATIONS[category];
  const ageDays = category === 'community' && index === 0 ? 0.4 : Math.pow(r(), 1.4) * 45 + 0.05;
  const hue = (info.hue + intBetween(r, -28, 28) + 360) % 360;
  const tags = Array.from(new Set([info.tags[0], ...extra, pick(r, info.tags)])).slice(0, 5);
  const description = `${pick(r, OPENERS[category])} ${pick(r, MIDDLES[category])} ${pick(r, CLOSERS)}`;
  const original = category !== 'music' && r() < 0.55;
  const also = creator?.categories.filter((c) => c !== category) ?? [];
  return {
    id,
    creatorId,
    title,
    description,
    hashtags: tags,
    category,
    duration: intBetween(r, dlo, dhi),
    views,
    likes,
    comments,
    shares,
    saves,
    uploadedAt: Math.round(NOW - ageDays * DAY),
    template: info.template,
    palette: { h1: hue, h2: (hue + intBetween(r, 28, 80)) % 360, ac: (hue + 180 + intBetween(r, -35, 35)) % 360 },
    caption,
    glyph,
    variant: intBetween(r, 0, 3),
    frame: between(r, 0.2, 0.8),
    sound: original ? `Original sound — @${creator?.handle ?? creatorId}` : pick(r, SOUNDS),
    meta: {
      quality: Number(between(r, 0.45, 1).toFixed(2)),
      momentum: Number(momentum.toFixed(2)),
      alsoFor: Array.from(new Set([...also, ...RELATED[category].slice(0, 1)])),
    },
    visibility: 'public',
    allowComments: true,
  };
}

function generate(): Video[] {
  const out: Video[] = [];
  let n = 1;
  const order = CATEGORIES.map((c) => c.id);
  // Interleave categories so ids don't cluster by topic.
  const longest = Math.max(...order.map((c) => CATALOG[c].length));
  for (let i = 0; i < longest; i++) {
    for (const cat of order) {
      const entry = CATALOG[cat][i];
      if (entry) out.push(build(cat, entry, i, `v${String(n++).padStart(3, '0')}`));
    }
  }
  DEMO_CLIPS.forEach(([cat, ...entry], i) => {
    const v = build(cat, entry, i + 1, `v${String(n++).padStart(3, '0')}`);
    // Small accounts: small numbers.
    const scale = between(rng(v.id), 0.002, 0.006);
    v.views = Math.round(v.views * scale) + 300;
    v.likes = Math.round(v.views * 0.11);
    v.comments = Math.round(v.likes * 0.06);
    v.shares = Math.round(v.likes * 0.05);
    v.saves = Math.round(v.likes * 0.04);
    out.push(v);
  });
  return out;
}

export const SEED_VIDEOS: Video[] = generate();
export const SEED_VIDEO_MAP = new Map(SEED_VIDEOS.map((v) => [v.id, v]));
export { RELATED as RELATED_CATEGORIES, SOUNDS };
