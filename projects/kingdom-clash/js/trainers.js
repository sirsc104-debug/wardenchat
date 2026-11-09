/* Kingdom Clash: the three Training Grounds trainers. They are played in order, and beating all three
   opens the Trophy Road. Each has a bot skill (js/bot.js), how hard their troops hit your towers
   (1 = full strength), a look for their portrait (js/art.js) and what they say during a match. */
'use strict';

const KC_TRAINERS = [
  {
    id: 'owen', name: 'Trainer Owen', short: 'Owen', level: 1, tier: 'Tutorial',
    skill: 'tutorial', towerDamage: 0.25,
    blurb: 'Your first match. Owen goes easy on you while you learn to place cards and take towers.',
    look: { bg: ['#ffd27a', '#ea8b2b'], hair: 'cap', hat: '#2f6fe4', hatSh: '#1d4fb8', hairCol: '#7a4a2a', shirt: '#dc3640', skin: '#f2c4a0', extra: 'whistle', mouth: 'smile' },
    lines: {
      start: ["Let's see what you've got!", "Don't worry, I'll go easy on you.", 'Ready? Put a card on your side!'],
      youTower: ['Whoa, nice hit!', 'Hey! I liked that tower.', 'Not bad at all!'],
      myTower: ['Gotcha!', 'Watch your towers!', "That one's mine!"],
      double: 'Double energy! Things speed up now.',
      overtime: 'Overtime! Whoever takes the next tower wins.',
      youWin: ['You beat Trainer Owen! Romeo is next, and he hits harder.', 'Nice work! Owen says you are ready for Romeo.'],
      youLose: ['Owen got you this time. One more?'],
      draw: 'Dead even. Break the tie?',
    },
  },
  {
    id: 'romeo', name: 'Trainer Romeo', short: 'Romeo', level: 2, tier: 'Mid tier',
    skill: 'romeo', towerDamage: 0.45,
    blurb: 'Quick and cocky. Romeo defends his lanes, backs up his pushes and makes slow players pay.',
    look: { bg: ['#c99bff', '#7440cf'], hair: 'curly', hairCol: '#2a1d18', band: '#ffcd33', shirt: '#2fb36b', skin: '#d9a27a', extra: 'scarf', mouth: 'smirk' },
    lines: {
      start: ['Owen went easy on you. I won’t.', 'Hope you brought your best cards!', 'Let’s make this quick.'],
      youTower: ['Lucky shot!', 'Okay, okay, I saw that.', 'Hey! That was my favorite tower.'],
      myTower: ['Ha! Did you see that?', 'Too slow!', 'One down!'],
      double: 'Double energy, double trouble!',
      overtime: 'Overtime! Don’t blink.',
      youWin: ['Fine, you win. Luc won’t be this nice.', 'You beat Romeo! Luc is the last trainer.'],
      youLose: ['Romeo wins this one. Want a rematch?', 'Too slow! Try backing up your pushes.'],
      draw: 'A tie? Rematch, right now.',
    },
  },
  {
    id: 'luc', name: 'Trainer Luc', short: 'Luc', level: 3, tier: 'Hard',
    skill: 'luc', towerDamage: 0.6,
    blurb: 'The last test before the Trophy Road. Luc hits hard, defends well and uses every card.',
    look: { bg: ['#9fc0e0', '#3c5d8c'], hair: 'beard', hairCol: '#c9ccd6', shirt: '#3d4459', skin: '#efc19c', extra: 'armor', mouth: 'flat' },
    lines: {
      start: ['Show me what you learned.', 'No more practice. This is the real thing.', 'Every card counts. Play carefully.'],
      youTower: ['Hmph. Well played.', 'Good. Again.', 'You found the gap.'],
      myTower: ['I saw that push a mile away.', 'Defend your lanes.', 'Too greedy.'],
      double: 'Double energy. Spend it wisely.',
      overtime: 'Overtime. One tower decides it.',
      youWin: ['You beat Luc! The Trophy Road is open.', 'Well fought. The Trophy Road is yours.'],
      youLose: ['Not yet. Watch how I defend, then try again.', 'Luc wins. Your next try will be better.'],
      draw: 'Even. Again.',
    },
  },
];
const KC_TRAINER = Object.fromEntries(KC_TRAINERS.map(t => [t.id, t]));
