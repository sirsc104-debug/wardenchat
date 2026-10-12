/* Apples to Oranges — the facts.
 *
 * Every fact is one number. Any two facts from different categories can meet in a matchup,
 * so the list grows the game fast: 110 facts make over 5,000 pairs.
 *
 *   t     what the number counts, written to fit mid-sentence ("keys on a piano")
 *   n     the number
 *   u     the unit shown under the number ('' for none)
 *   x     1 = exact and never changes. Only exact facts can meet in a photo finish
 *         (a tie or a gap of a few), where a slightly-off number would flip the answer.
 *   note  small print shown on the card after the reveal
 *   show  the number as text, for numbers too big for JavaScript to hold exactly
 *   year  1 = a year: shown without a comma (1995, not 1,995)
 *   src   where the number comes from (for checking; not shown in the game)
 */
'use strict';

const CATS = {
  animal: { name: 'Animals',       icon: '🐋' },
  body:   { name: 'Human Body',    icon: '🦴' },
  food:   { name: 'Food & Brands', icon: '🍔' },
  games:  { name: 'Games & Toys',  icon: '🎮' },
  screen: { name: 'Movies & TV',   icon: '🎬' },
  places: { name: 'Places',        icon: '🗽' },
  space:  { name: 'Space',         icon: '🪐' },
  time:   { name: 'Time & Math',   icon: '⏰' },
  sports: { name: 'Sports',        icon: '🏈' },
  usa:    { name: 'USA',           icon: '🏛️' },
  years:  { name: 'Years',         icon: '📅' },
  words:  { name: 'Music & Words', icon: '🎹' }
};

const FACTS = [
  // ---- Animals ----
  { id: 'whale', c: 'animal', t: "a blue whale's weight", n: 165, u: 'tons', note: 'The biggest reach about 330,000 lb', src: 'NOAA Fisheries / Alaska Dept. of Fish & Game' },
  { id: 'spider', c: 'animal', t: 'legs on a spider', n: 8, u: 'legs', x: 1 },
  { id: 'octopus', c: 'animal', t: 'hearts in an octopus', n: 3, u: 'hearts', x: 1 },
  { id: 'dogteeth', c: 'animal', t: "teeth in an adult dog's mouth", n: 42, u: 'teeth', x: 1 },
  { id: 'catteeth', c: 'animal', t: "teeth in an adult cat's mouth", n: 30, u: 'teeth', x: 1 },
  { id: 'giraffe', c: 'animal', t: "bones in a giraffe's neck", n: 7, u: 'bones', x: 1, note: 'The same as in a human neck' },
  { id: 'cheetah', c: 'animal', t: "a cheetah's top speed", n: 70, u: 'mph', note: 'About' },
  { id: 'falcon', c: 'animal', t: "a peregrine falcon's diving speed", n: 240, u: 'mph', note: 'About. The fastest animal on Earth' },
  { id: 'elephant', c: 'animal', t: 'months an elephant is pregnant', n: 22, u: 'months', note: 'About' },
  { id: 'hummingbird', c: 'animal', t: "a hummingbird's heartbeats per minute", n: 1260, u: 'beats a minute', note: 'A blue-throated hummingbird, at its fastest' },

  // ---- Human body ----
  { id: 'bones', c: 'body', t: 'bones in an adult human body', n: 206, u: 'bones', x: 1 },
  { id: 'handbones', c: 'body', t: 'bones in one human hand', n: 27, u: 'bones', x: 1 },
  { id: 'footbones', c: 'body', t: 'bones in one human foot', n: 26, u: 'bones', x: 1 },
  { id: 'ribs', c: 'body', t: 'ribs in a human body', n: 24, u: 'ribs', x: 1 },
  { id: 'babyteeth', c: 'body', t: 'baby teeth a kid grows', n: 20, u: 'teeth', x: 1 },
  { id: 'teeth', c: 'body', t: 'teeth in an adult human mouth', n: 32, u: 'teeth', x: 1, note: 'Counting wisdom teeth' },
  { id: 'chromosomes', c: 'body', t: 'chromosomes in a human cell', n: 46, u: 'chromosomes', x: 1 },

  // ---- Food & brands ----
  { id: 'bigmac', c: 'food', t: 'calories in a Big Mac', n: 580, u: 'calories', note: 'McDonald’s US menu', src: 'mcdonalds.com/us product page, checked Oct 2026' },
  { id: 'coke', c: 'food', t: 'calories in a can of Coke', n: 140, u: 'calories', note: 'A 12 oz can', src: 'Coca-Cola nutrition label' },
  { id: 'cokesugar', c: 'food', t: 'grams of sugar in a can of Coke', n: 39, u: 'grams', note: 'A 12 oz can', src: 'Coca-Cola nutrition label' },
  { id: 'krispy', c: 'food', t: 'calories in a Krispy Kreme Original Glazed', n: 190, u: 'calories', note: 'About', src: 'FatSecret / Fitia nutrition databases' },
  { id: 'banana', c: 'food', t: 'calories in a medium banana', n: 105, u: 'calories', note: 'About', src: 'USDA FoodData Central' },
  { id: 'heinz', c: 'food', t: 'the number in “Heinz 57”', n: 57, u: 'varieties', x: 1 },
  { id: 'baskin', c: 'food', t: 'flavors in Baskin-Robbins’ famous “31 flavors”', n: 31, u: 'flavors', x: 1 },
  { id: 'wd40', c: 'food', t: 'tries it took to invent WD-40', n: 40, u: 'tries', x: 1, note: 'That’s the “40”' },
  { id: 'jerseymikes', c: 'food', t: "Jersey Mike's locations in New Jersey", n: 145, u: 'locations', note: 'About, as of 2025', src: 'Jersey Mike’s store finder via Yahoo News / Tasting Table, 2025' },
  { id: 'reaper', c: 'food', t: 'the heat of a Carolina Reaper pepper', n: 1641183, u: 'Scoville units', note: 'Guinness record average, 2013' },
  { id: 'chestnut', c: 'food', t: "hot dogs in Joey Chestnut's record", n: 76, u: 'hot dogs', x: 1, note: 'In 10 minutes, Nathan’s contest, 2021' },

  // ---- Games & toys ----
  { id: 'pokemon', c: 'games', t: 'Pokémon in the original Red & Blue', n: 151, u: 'Pokémon', x: 1 },
  { id: 'mcstack', c: 'games', t: 'blocks in a full Minecraft stack', n: 64, u: 'blocks', x: 1 },
  { id: 'rubik', c: 'games', t: "colored squares on a Rubik's Cube", n: 54, u: 'squares', x: 1 },
  { id: 'rubikways', c: 'games', t: "ways to mix up a Rubik's Cube", n: 43252003274489856000, show: '43,252,003,274,489,856,000', u: 'ways', x: 1, note: 'About 43 quintillion' },
  { id: 'pacman', c: 'games', t: 'a perfect Pac-Man score', n: 3333360, u: 'points', x: 1 },
  { id: 'monopoly', c: 'games', t: 'spaces on a Monopoly board', n: 40, u: 'spaces', x: 1 },
  { id: 'scrabble', c: 'games', t: 'tiles in an English Scrabble set', n: 100, u: 'tiles', x: 1 },
  { id: 'chess', c: 'games', t: 'squares on a chessboard', n: 64, u: 'squares', x: 1 },
  { id: 'cards', c: 'games', t: 'cards in a deck', n: 52, u: 'cards', x: 1, note: 'Not counting jokers' },
  { id: 'legofalcon', c: 'games', t: 'pieces in the LEGO UCS Millennium Falcon', n: 7541, u: 'pieces', x: 1, note: 'Set 75192' },
  { id: 'legoeiffel', c: 'games', t: 'pieces in the LEGO Eiffel Tower', n: 10001, u: 'pieces', x: 1, note: 'Set 10307' },
  { id: 'legotitanic', c: 'games', t: 'pieces in the LEGO Titanic', n: 9090, u: 'pieces', x: 1, note: 'Set 10294' },

  // ---- Movies & TV ----
  { id: 'dalmatians', c: 'screen', t: 'Dalmatians in “101 Dalmatians”', n: 101, u: 'Dalmatians', x: 1 },
  { id: 'friends', c: 'screen', t: 'episodes of Friends', n: 236, u: 'episodes', x: 1 },
  { id: 'hpbooks', c: 'screen', t: 'Harry Potter books', n: 7, u: 'books', x: 1, note: 'The main series' },
  { id: 'dwarfs', c: 'screen', t: 'dwarfs in Snow White', n: 7, u: 'dwarfs', x: 1 },
  { id: 'simpsons', c: 'screen', t: 'fingers on each hand of a Simpsons character', n: 4, u: 'fingers', x: 1 },

  // ---- Places ----
  { id: 'statue', c: 'places', t: 'the height of the Statue of Liberty (just the statue)', n: 151, u: 'feet', x: 1, note: 'Heel to torch: 151 ft 1 in' },
  { id: 'esbfloors', c: 'places', t: 'floors in the Empire State Building', n: 102, u: 'floors', x: 1 },
  { id: 'esbheight', c: 'places', t: 'the height of the Empire State Building', n: 1454, u: 'feet', x: 1, note: 'To the tip of the antenna' },
  { id: 'burj', c: 'places', t: 'the height of the Burj Khalifa', n: 828, u: 'meters', x: 1, note: 'The tallest building in the world' },
  { id: 'burjfloors', c: 'places', t: 'floors in the Burj Khalifa', n: 163, u: 'floors', x: 1 },
  { id: 'pyramid', c: 'places', t: 'the original height of the Great Pyramid', n: 481, u: 'feet', note: 'About. It’s a bit shorter today' },
  { id: 'goldengate', c: 'places', t: "the height of the Golden Gate Bridge's towers", n: 746, u: 'feet', note: 'Above the water' },
  { id: 'rushmore', c: 'places', t: 'the height of each face on Mount Rushmore', n: 60, u: 'feet', note: 'About' },
  { id: 'everest', c: 'places', t: 'the height of Mount Everest', n: 29032, u: 'feet', note: '2020 survey' },
  { id: 'greatwall', c: 'places', t: 'the length of the Great Wall of China', n: 13171, u: 'miles', note: 'Every branch, 2012 survey' },
  { id: 'route66', c: 'places', t: 'the number of Route 66', n: 66, u: '', x: 1, note: 'Chicago to Santa Monica' },
  { id: 'mnlakes', c: 'places', t: 'lakes in Minnesota', n: 11842, u: 'lakes', note: '10 acres or bigger', src: 'Minnesota DNR' },
  { id: 'texas', c: 'places', t: 'counties in Texas', n: 254, u: 'counties', x: 1 },
  { id: 'cttowns', c: 'places', t: 'towns in Connecticut', n: 169, u: 'towns', x: 1 },
  { id: 'africa', c: 'places', t: 'countries in Africa', n: 54, u: 'countries', x: 1 },
  { id: 'un', c: 'places', t: 'countries in the United Nations', n: 193, u: 'countries', x: 1 },
  { id: 'canada', c: 'places', t: 'US states that touch Canada', n: 13, u: 'states', x: 1 },

  // ---- Space ----
  { id: 'planets', c: 'space', t: 'planets in our solar system', n: 8, u: 'planets', x: 1 },
  { id: 'constellations', c: 'space', t: 'official constellations in the sky', n: 88, u: 'constellations', x: 1 },
  { id: 'marsyear', c: 'space', t: 'days in a year on Mars', n: 687, u: 'Earth days', note: 'About' },
  { id: 'moonwalkers', c: 'space', t: 'people who have walked on the Moon', n: 12, u: 'people', note: 'As of 2026' },
  { id: 'light', c: 'space', t: 'the speed of light', n: 299792, u: 'km per second', x: 1 },
  { id: 'moondist', c: 'space', t: 'the distance to the Moon', n: 238855, u: 'miles', note: 'On average' },
  { id: 'pluto', c: 'space', t: 'years for Pluto to go around the Sun', n: 248, u: 'Earth years', note: 'About' },
  { id: 'venus', c: 'space', t: 'the temperature on Venus', n: 867, u: '°F', note: 'About, on average' },
  { id: 'sundist', c: 'space', t: 'the distance to the Sun', n: 93000000, u: 'miles', note: 'About' },

  // ---- Time & math ----
  { id: 'weekhours', c: 'time', t: 'hours in a week', n: 168, u: 'hours', x: 1 },
  { id: 'daymins', c: 'time', t: 'minutes in a day', n: 1440, u: 'minutes', x: 1 },
  { id: 'daysecs', c: 'time', t: 'seconds in a day', n: 86400, u: 'seconds', x: 1 },
  { id: 'leapyear', c: 'time', t: 'days in a leap year', n: 366, u: 'days', x: 1 },
  { id: 'weeks', c: 'time', t: 'full weeks in a year', n: 52, u: 'weeks', x: 1 },
  { id: 'circle', c: 'time', t: 'degrees in a circle', n: 360, u: 'degrees', x: 1 },
  { id: 'boil', c: 'time', t: 'the temperature water boils at', n: 212, u: '°F', x: 1, note: 'At sea level' },
  { id: 'freeze', c: 'time', t: 'the temperature water freezes at', n: 32, u: '°F', x: 1 },
  { id: 'mile', c: 'time', t: 'feet in a mile', n: 5280, u: 'feet', x: 1 },
  { id: 'primes', c: 'time', t: 'prime numbers below 100', n: 25, u: 'primes', x: 1 },

  // ---- Sports ----
  { id: 'bowling', c: 'sports', t: 'a perfect score in bowling', n: 300, u: 'points', x: 1 },
  { id: 'snooker', c: 'sports', t: 'a maximum break in snooker', n: 147, u: 'points', x: 1 },
  { id: 'darts', c: 'sports', t: 'the top score with three darts', n: 180, u: 'points', x: 1 },
  { id: 'stitches', c: 'sports', t: 'stitches on an MLB baseball', n: 108, u: 'stitches', x: 1, note: 'Double stitches' },
  { id: 'bases', c: 'sports', t: 'feet between the bases in baseball', n: 90, u: 'feet', x: 1 },
  { id: 'nfl', c: 'sports', t: 'teams in the NFL', n: 32, u: 'teams', note: 'As of 2026' },
  { id: 'golf', c: 'sports', t: 'holes in a round of golf', n: 18, u: 'holes', x: 1 },
  { id: 'soccer', c: 'sports', t: 'players per team on a soccer field', n: 11, u: 'players', x: 1 },
  { id: 'rings', c: 'sports', t: 'Olympic rings', n: 5, u: 'rings', x: 1 },

  // ---- USA ----
  { id: 'states', c: 'usa', t: 'US states', n: 50, u: 'states', x: 1 },
  { id: 'stripes', c: 'usa', t: 'stripes on the US flag', n: 13, u: 'stripes', x: 1 },
  { id: 'amendments', c: 'usa', t: 'amendments to the US Constitution', n: 27, u: 'amendments', x: 1 },
  { id: 'senators', c: 'usa', t: 'US senators', n: 100, u: 'senators', x: 1 },
  { id: 'house', c: 'usa', t: 'members of the US House', n: 435, u: 'members', x: 1, note: 'Voting members' },
  { id: 'justices', c: 'usa', t: 'Supreme Court justices', n: 9, u: 'justices', x: 1 },

  // ---- Years ----
  { id: 'y-declaration', c: 'years', t: 'the year the Declaration of Independence was signed', n: 1776, u: '', year: 1, x: 1 },
  { id: 'y-columbus', c: 'years', t: 'the year Columbus reached the Americas', n: 1492, u: '', year: 1, x: 1 },
  { id: 'y-statue', c: 'years', t: 'the year the Statue of Liberty opened', n: 1886, u: '', year: 1, x: 1 },
  { id: 'y-eiffel', c: 'years', t: 'the year the Eiffel Tower opened', n: 1889, u: '', year: 1, x: 1 },
  { id: 'y-titanic', c: 'years', t: 'the year the Titanic sank', n: 1912, u: '', year: 1, x: 1 },
  { id: 'y-moon', c: 'years', t: 'the year people first walked on the Moon', n: 1969, u: '', year: 1, x: 1 },
  { id: 'y-pacman', c: 'years', t: 'the year Pac-Man came out', n: 1980, u: '', year: 1, x: 1 },
  { id: 'y-tetris', c: 'years', t: 'the year Tetris was invented', n: 1984, u: '', year: 1, x: 1 },
  { id: 'y-toystory', c: 'years', t: 'the year Toy Story came out', n: 1995, u: '', year: 1, x: 1 },
  { id: 'y-pokemon', c: 'years', t: 'the year the first Pokémon games came out', n: 1996, u: '', year: 1, x: 1, note: 'In Japan' },
  { id: 'y-iphone', c: 'years', t: 'the year the first iPhone came out', n: 2007, u: '', year: 1, x: 1 },

  // ---- Music & words ----
  { id: 'piano', c: 'words', t: 'keys on a piano', n: 88, u: 'keys', x: 1 },
  { id: 'alphabet', c: 'words', t: 'letters in the English alphabet', n: 26, u: 'letters', x: 1 },
  { id: 'sonnet', c: 'words', t: 'lines in a sonnet', n: 14, u: 'lines', x: 1 }
];
