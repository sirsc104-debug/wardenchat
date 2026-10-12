/* Apples to Oranges — the facts.
 *
 * Every fact is one number. Any two facts from different categories can meet in a matchup.
 * A fact that is a measurement (a height, a weight, a speed, a temperature, a length of time,
 * an amount of liquid) names its unit with `m`, and then also comes up in every other unit that
 * makes sense: the Empire State Building is 1,454 feet, but also 443 meters, 44,318 centimeters,
 * 485 yards and 0.28 miles. So the same question keeps coming back with a different number.
 *
 *   t     what the number is, written to fit mid-sentence ("keys on a piano")
 *   n     the number, in the fact's own unit
 *   m     for a measurement: its unit (a key of UNITS below). It then shows in the other units too.
 *   u     the unit word under the number, for a count ('' for none). A measurement gets its unit's
 *         name unless u gives a better one for its own unit ("Earth days").
 *   x     1 = exact and never changes. Only exact facts can meet in a photo finish (a tie or a gap
 *         of a few), where a slightly-off number would flip the answer. A measurement shown in
 *         another unit is rounded, so it never counts as exact.
 *   note  small print shown on the card after the reveal
 *   show  the number as text, for numbers too big for JavaScript to hold exactly
 *   year  1 = a year: shown without a comma (1995, not 1,995)
 *   src   where the number comes from (for checking; not shown in the game)
 */
'use strict';

const CATS = {
  animal:   { name: 'Animals',         icon: '🐋' },
  body:     { name: 'Human Body',      icon: '🦴' },
  food:     { name: 'Food & Brands',   icon: '🍔' },
  games:    { name: 'Games & Toys',    icon: '🎮' },
  screen:   { name: 'Movies & TV',     icon: '🎬' },
  places:   { name: 'Places',          icon: '🗽' },
  space:    { name: 'Space',           icon: '🪐' },
  time:     { name: 'Time & Math',     icon: '⏰' },
  sports:   { name: 'Sports',          icon: '🏈' },
  usa:      { name: 'USA',             icon: '🏛️' },
  years:    { name: 'Years',           icon: '📅' },
  words:    { name: 'Music & Words',   icon: '🎹' },
  dinos:    { name: 'Dinosaurs',       icon: '🦖' },
  ocean:    { name: 'Ocean',           icon: '🌊' },
  tech:     { name: 'Tech',            icon: '💻' },
  vehicles: { name: 'Vehicles',        icon: '🚗' },
  earth:    { name: 'Earth & Weather', icon: '🌍' }
};

/* Units, grouped by what they measure. Each is [size in the group's base unit, name].
 * Temperature isn't a simple multiple, so it converts through kelvin below. */
const UNITS = {
  len:   { mm: [0.001, 'millimeters'], cm: [0.01, 'centimeters'], m: [1, 'meters'], km: [1000, 'kilometers'],
           in: [0.0254, 'inches'], ft: [0.3048, 'feet'], yd: [0.9144, 'yards'], mi: [1609.344, 'miles'] },
  mass:  { g: [0.001, 'grams'], kg: [1, 'kilograms'], oz: [0.028349523, 'ounces'], lb: [0.45359237, 'pounds'],
           ton: [907.18474, 'tons'], tonne: [1000, 'metric tons'] },
  speed: { mph: [0.44704, 'mph'], kmh: [1 / 3.6, 'km/h'], ms: [1, 'meters per second'], fts: [0.3048, 'feet per second'],
           knots: [0.514444, 'knots'], kms: [1000, 'km per second'] },
  time:  { s: [1, 'seconds'], min: [60, 'minutes'], h: [3600, 'hours'], d: [86400, 'days'], wk: [604800, 'weeks'],
           mo: [2629746, 'months'], yr: [31556952, 'years'] },
  vol:   { ml: [0.001, 'milliliters'], l: [1, 'liters'], floz: [0.0295735296, 'fluid ounces'], cup: [0.2365882365, 'cups'],
           gal: [3.785411784, 'gallons'] },
  temp:  { F: [null, '°F'], C: [null, '°C'], K: [null, 'kelvin'] }
};

const FACTS = [
  // ---- Animals ----
  { id: 'whale', c: 'animal', t: "a blue whale's weight", n: 165, m: 'ton', note: 'The biggest reach about 330,000 lb', src: 'NOAA Fisheries / Alaska Dept. of Fish & Game' },
  { id: 'whalelen', c: 'animal', t: "a blue whale's length", n: 100, m: 'ft', note: 'About, for the biggest' },
  { id: 'spider', c: 'animal', t: 'legs on a spider', n: 8, u: 'legs', x: 1 },
  { id: 'octopus', c: 'animal', t: 'hearts in an octopus', n: 3, u: 'hearts', x: 1 },
  { id: 'dogteeth', c: 'animal', t: "teeth in an adult dog's mouth", n: 42, u: 'teeth', x: 1 },
  { id: 'catteeth', c: 'animal', t: "teeth in an adult cat's mouth", n: 30, u: 'teeth', x: 1 },
  { id: 'giraffe', c: 'animal', t: "bones in a giraffe's neck", n: 7, u: 'bones', x: 1, note: 'The same as in a human neck' },
  { id: 'giraffeheight', c: 'animal', t: "a giraffe's height", n: 18, m: 'ft', note: 'About, for a tall male' },
  { id: 'cheetah', c: 'animal', t: "a cheetah's top speed", n: 70, m: 'mph', note: 'About' },
  { id: 'falcon', c: 'animal', t: "a peregrine falcon's diving speed", n: 240, m: 'mph', note: 'About. The fastest animal on Earth' },
  { id: 'ostrich', c: 'animal', t: "an ostrich's top speed", n: 45, m: 'mph', note: 'About. The fastest bird on land' },
  { id: 'elephant', c: 'animal', t: 'how long an elephant is pregnant', n: 22, m: 'mo', note: 'About' },
  { id: 'elephantweight', c: 'animal', t: "an African elephant's weight", n: 6, m: 'ton', note: 'About, for a big male' },
  { id: 'hummingbird', c: 'animal', t: "a hummingbird's heartbeats per minute", n: 1260, u: 'beats a minute', note: 'A blue-throated hummingbird, at its fastest' },

  // ---- Human body ----
  { id: 'bones', c: 'body', t: 'bones in an adult human body', n: 206, u: 'bones', x: 1 },
  { id: 'handbones', c: 'body', t: 'bones in one human hand', n: 27, u: 'bones', x: 1 },
  { id: 'footbones', c: 'body', t: 'bones in one human foot', n: 26, u: 'bones', x: 1 },
  { id: 'ribs', c: 'body', t: 'ribs in a human body', n: 24, u: 'ribs', x: 1 },
  { id: 'babyteeth', c: 'body', t: 'baby teeth a kid grows', n: 20, u: 'teeth', x: 1 },
  { id: 'teeth', c: 'body', t: 'teeth in an adult human mouth', n: 32, u: 'teeth', x: 1, note: 'Counting wisdom teeth' },
  { id: 'chromosomes', c: 'body', t: 'chromosomes in a human cell', n: 46, u: 'chromosomes', x: 1 },
  { id: 'intestine', c: 'body', t: 'the length of the small intestine', n: 20, m: 'ft', note: 'About, in an adult' },
  { id: 'blood', c: 'body', t: "the blood in an adult's body", n: 5, m: 'l', note: 'About' },
  { id: 'wadlow', c: 'body', t: 'the height of the tallest person ever', n: 272, m: 'cm', note: 'Robert Wadlow: 8 ft 11 in' },

  // ---- Food & brands ----
  { id: 'bigmac', c: 'food', t: 'calories in a Big Mac', n: 580, u: 'calories', note: 'McDonald’s US menu', src: 'mcdonalds.com/us product page, checked Oct 2026' },
  { id: 'coke', c: 'food', t: 'calories in a can of Coke', n: 140, u: 'calories', note: 'A 12 oz can', src: 'Coca-Cola nutrition label' },
  { id: 'cokesugar', c: 'food', t: 'the sugar in a can of Coke', n: 39, m: 'g', note: 'A 12 oz can', src: 'Coca-Cola nutrition label' },
  { id: 'krispy', c: 'food', t: 'calories in a Krispy Kreme Original Glazed', n: 190, u: 'calories', note: 'About', src: 'FatSecret / Fitia nutrition databases' },
  { id: 'banana', c: 'food', t: 'calories in a medium banana', n: 105, u: 'calories', note: 'About', src: 'USDA FoodData Central' },
  { id: 'mms', c: 'food', t: 'colors in a bag of plain M&M’s', n: 6, u: 'colors', x: 1, note: 'Red, orange, yellow, green, blue, brown' },
  { id: 'venti', c: 'food', t: 'how much a Starbucks Venti hot drink holds', n: 20, m: 'floz', x: 1, note: 'Iced Ventis hold 24' },
  { id: 'hershey', c: 'food', t: 'pieces in a Hershey’s milk chocolate bar', n: 12, u: 'pieces', x: 1, note: 'The standard 1.55 oz bar' },
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
  { id: 'friends', c: 'screen', t: 'episodes of Friends', n: 236, u: 'episodes', x: 1 },
  { id: 'hpbooks', c: 'screen', t: 'Harry Potter books', n: 7, u: 'books', x: 1, note: 'The main series' },
  { id: 'dwarfs', c: 'screen', t: 'dwarfs in Snow White', n: 7, u: 'dwarfs', x: 1 },
  { id: 'simpsons', c: 'screen', t: 'fingers on each hand of a Simpsons character', n: 4, u: 'fingers', x: 1 },
  { id: 'toystorymins', c: 'screen', t: 'how long Toy Story is', n: 81, m: 'min', x: 1 },
  { id: 'skywalker', c: 'screen', t: 'movies in the Star Wars Skywalker saga', n: 9, u: 'movies', x: 1 },
  { id: 'spongebob', c: 'screen', t: "SpongeBob's house number", n: 124, u: '', x: 1, note: '124 Conch Street' },
  { id: 'sesame', c: 'screen', t: 'the house number on Sesame Street', n: 123, u: '', x: 1 },
  { id: 'mcqueen', c: 'screen', t: "Lightning McQueen's racing number", n: 95, u: '', x: 1 },
  { id: 'herbie', c: 'screen', t: "Herbie the Love Bug's racing number", n: 53, u: '', x: 1 },

  // ---- Places ----
  { id: 'statue', c: 'places', t: 'the height of the Statue of Liberty (just the statue)', n: 151, m: 'ft', x: 1, note: 'Heel to torch: 151 ft 1 in' },
  { id: 'esbfloors', c: 'places', t: 'floors in the Empire State Building', n: 102, u: 'floors', x: 1 },
  { id: 'esbheight', c: 'places', t: 'the height of the Empire State Building', n: 1454, m: 'ft', x: 1, note: 'To the tip of the antenna' },
  { id: 'burj', c: 'places', t: 'the height of the Burj Khalifa', n: 828, m: 'm', x: 1, note: 'The tallest building in the world' },
  { id: 'burjfloors', c: 'places', t: 'floors in the Burj Khalifa', n: 163, u: 'floors', x: 1 },
  { id: 'eiffel', c: 'places', t: 'the height of the Eiffel Tower', n: 330, m: 'm', note: 'With its antenna, since 2022' },
  { id: 'pyramid', c: 'places', t: 'the original height of the Great Pyramid', n: 481, m: 'ft', note: 'About. It’s a bit shorter today' },
  { id: 'goldengate', c: 'places', t: "the height of the Golden Gate Bridge's towers", n: 746, m: 'ft', note: 'Above the water' },
  { id: 'goldengatelen', c: 'places', t: 'the length of the Golden Gate Bridge', n: 8981, m: 'ft', note: 'End to end' },
  { id: 'rushmore', c: 'places', t: 'the height of each face on Mount Rushmore', n: 60, m: 'ft', note: 'About' },
  { id: 'everest', c: 'places', t: 'the height of Mount Everest', n: 29032, m: 'ft', note: '2020 survey' },
  { id: 'greatwall', c: 'places', t: 'the length of the Great Wall of China', n: 13171, m: 'mi', note: 'Every branch, 2012 survey' },
  { id: 'route66', c: 'places', t: 'the length of Route 66', n: 2448, m: 'mi', note: 'About, Chicago to Santa Monica' },
  { id: 'mnlakes', c: 'places', t: 'lakes in Minnesota', n: 11842, u: 'lakes', note: '10 acres or bigger', src: 'Minnesota DNR' },
  { id: 'texas', c: 'places', t: 'counties in Texas', n: 254, u: 'counties', x: 1 },
  { id: 'cttowns', c: 'places', t: 'towns in Connecticut', n: 169, u: 'towns', x: 1 },
  { id: 'africa', c: 'places', t: 'countries in Africa', n: 54, u: 'countries', x: 1 },
  { id: 'un', c: 'places', t: 'countries in the United Nations', n: 193, u: 'countries', x: 1 },
  { id: 'canada', c: 'places', t: 'US states that touch Canada', n: 13, u: 'states', x: 1 },

  // ---- Space ----
  { id: 'planets', c: 'space', t: 'planets in our solar system', n: 8, u: 'planets', x: 1 },
  { id: 'constellations', c: 'space', t: 'official constellations in the sky', n: 88, u: 'constellations', x: 1 },
  { id: 'marsyear', c: 'space', t: 'how long a year on Mars is', n: 687, m: 'd', u: 'Earth days', note: 'About' },
  { id: 'moonwalkers', c: 'space', t: 'people who have walked on the Moon', n: 12, u: 'people', note: 'As of 2026' },
  { id: 'light', c: 'space', t: 'the speed of light', n: 299792458, m: 'ms', x: 1, note: 'Exactly, by definition' },
  { id: 'moondist', c: 'space', t: 'the distance to the Moon', n: 238855, m: 'mi', note: 'On average' },
  { id: 'moonwidth', c: 'space', t: 'the width of the Moon', n: 2159, m: 'mi', note: 'About' },
  { id: 'pluto', c: 'space', t: 'how long Pluto takes to go around the Sun', n: 248, m: 'yr', note: 'About' },
  { id: 'venus', c: 'space', t: 'the temperature on Venus', n: 867, m: 'F', note: 'About, on average' },
  { id: 'sundist', c: 'space', t: 'the distance to the Sun', n: 93000000, m: 'mi', note: 'About' },
  { id: 'sunwidth', c: 'space', t: 'the width of the Sun', n: 864000, m: 'mi', note: 'About' },
  { id: 'saturnv', c: 'space', t: 'the height of the Saturn V moon rocket', n: 363, m: 'ft', note: 'About' },
  { id: 'iss', c: 'space', t: 'the speed of the International Space Station', n: 17500, m: 'mph', note: 'About' },

  // ---- Time & math ----
  { id: 'weekhours', c: 'time', t: 'hours in a week', n: 168, u: 'hours', x: 1 },
  { id: 'daymins', c: 'time', t: 'minutes in a day', n: 1440, u: 'minutes', x: 1 },
  { id: 'daysecs', c: 'time', t: 'seconds in a day', n: 86400, u: 'seconds', x: 1 },
  { id: 'leapyear', c: 'time', t: 'days in a leap year', n: 366, u: 'days', x: 1 },
  { id: 'weeks', c: 'time', t: 'full weeks in a year', n: 52, u: 'weeks', x: 1 },
  { id: 'circle', c: 'time', t: 'degrees in a circle', n: 360, u: 'degrees', x: 1 },
  { id: 'boil', c: 'time', t: 'the temperature water boils at', n: 212, m: 'F', x: 1, note: 'At sea level' },
  { id: 'freeze', c: 'time', t: 'the temperature water freezes at', n: 32, m: 'F', x: 1 },
  { id: 'mile', c: 'time', t: 'feet in a mile', n: 5280, u: 'feet', x: 1 },
  { id: 'primes', c: 'time', t: 'prime numbers below 100', n: 25, u: 'primes', x: 1 },

  // ---- Sports ----
  { id: 'bowling', c: 'sports', t: 'a perfect score in bowling', n: 300, u: 'points', x: 1 },
  { id: 'snooker', c: 'sports', t: 'a maximum break in snooker', n: 147, u: 'points', x: 1 },
  { id: 'darts', c: 'sports', t: 'the top score with three darts', n: 180, u: 'points', x: 1 },
  { id: 'stitches', c: 'sports', t: 'stitches on an MLB baseball', n: 108, u: 'stitches', x: 1, note: 'Double stitches' },
  { id: 'bases', c: 'sports', t: 'the distance between the bases in baseball', n: 90, m: 'ft', x: 1 },
  { id: 'nfl', c: 'sports', t: 'teams in the NFL', n: 32, u: 'teams', note: 'As of 2026' },
  { id: 'golf', c: 'sports', t: 'holes in a round of golf', n: 18, u: 'holes', x: 1 },
  { id: 'soccer', c: 'sports', t: 'players per team on a soccer field', n: 11, u: 'players', x: 1 },
  { id: 'rings', c: 'sports', t: 'Olympic rings', n: 5, u: 'rings', x: 1 },
  { id: 'hoop', c: 'sports', t: 'the height of a basketball hoop', n: 10, m: 'ft', x: 1 },
  { id: 'freethrow', c: 'sports', t: 'the distance to the free-throw line', n: 15, m: 'ft', x: 1 },
  { id: 'marathon', c: 'sports', t: 'the length of a marathon', n: 26.2, m: 'mi', note: '26 miles 385 yards' },
  { id: 'footballfield', c: 'sports', t: 'the length of a football field', n: 120, m: 'yd', x: 1, note: 'Counting both end zones' },
  { id: 'pool', c: 'sports', t: 'the length of an Olympic pool', n: 50, m: 'm', x: 1 },
  { id: 'bolt', c: 'sports', t: "Usain Bolt's 100 m world record", n: 9.58, m: 's', note: 'Set in 2009' },
  { id: 'bowllane', c: 'sports', t: 'the length of a bowling lane', n: 60, m: 'ft', x: 1, note: 'Foul line to the head pin' },

  // ---- USA ----
  { id: 'states', c: 'usa', t: 'US states', n: 50, u: 'states', x: 1 },
  { id: 'stripes', c: 'usa', t: 'stripes on the US flag', n: 13, u: 'stripes', x: 1 },
  { id: 'amendments', c: 'usa', t: 'amendments to the US Constitution', n: 27, u: 'amendments', x: 1 },
  { id: 'senators', c: 'usa', t: 'US senators', n: 100, u: 'senators', x: 1 },
  { id: 'house', c: 'usa', t: 'members of the US House', n: 435, u: 'members', x: 1, note: 'Voting members' },
  { id: 'justices', c: 'usa', t: 'Supreme Court justices', n: 9, u: 'justices', x: 1 },
  { id: 'rushmorefaces', c: 'usa', t: 'presidents carved into Mount Rushmore', n: 4, u: 'presidents', x: 1 },
  { id: 'senateterm', c: 'usa', t: "years in a US senator's term", n: 6, u: 'years', x: 1 },
  { id: 'presage', c: 'usa', t: 'the youngest age you can be US president', n: 35, u: 'years old', x: 1 },
  { id: 'electoral', c: 'usa', t: 'votes in the Electoral College', n: 538, u: 'votes', x: 1 },

  // ---- Years ----
  { id: 'y-declaration', c: 'years', t: 'the year the Declaration of Independence was signed', n: 1776, u: '', year: 1, x: 1 },
  { id: 'y-columbus', c: 'years', t: 'the year Columbus reached the Americas', n: 1492, u: '', year: 1, x: 1 },
  { id: 'y-statue', c: 'years', t: 'the year the Statue of Liberty opened', n: 1886, u: '', year: 1, x: 1 },
  { id: 'y-coke', c: 'years', t: 'the year Coca-Cola was invented', n: 1886, u: '', year: 1, x: 1 },
  { id: 'y-eiffel', c: 'years', t: 'the year the Eiffel Tower opened', n: 1889, u: '', year: 1, x: 1 },
  { id: 'y-nintendo', c: 'years', t: 'the year Nintendo was founded', n: 1889, u: '', year: 1, x: 1, note: 'It started out making playing cards' },
  { id: 'y-wright', c: 'years', t: "the year of the Wright brothers' first flight", n: 1903, u: '', year: 1, x: 1 },
  { id: 'y-titanic', c: 'years', t: 'the year the Titanic sank', n: 1912, u: '', year: 1, x: 1 },
  { id: 'y-lego', c: 'years', t: 'the year LEGO was founded', n: 1932, u: '', year: 1, x: 1 },
  { id: 'y-mcdonalds', c: 'years', t: 'the year the first McDonald’s opened', n: 1940, u: '', year: 1, x: 1 },
  { id: 'y-disneyland', c: 'years', t: 'the year Disneyland opened', n: 1955, u: '', year: 1, x: 1 },
  { id: 'y-superbowl', c: 'years', t: 'the year of the first Super Bowl', n: 1967, u: '', year: 1, x: 1 },
  { id: 'y-moon', c: 'years', t: 'the year people first walked on the Moon', n: 1969, u: '', year: 1, x: 1 },
  { id: 'y-pacman', c: 'years', t: 'the year Pac-Man came out', n: 1980, u: '', year: 1, x: 1 },
  { id: 'y-tetris', c: 'years', t: 'the year Tetris was invented', n: 1984, u: '', year: 1, x: 1 },
  { id: 'y-toystory', c: 'years', t: 'the year Toy Story came out', n: 1995, u: '', year: 1, x: 1 },
  { id: 'y-pokemon', c: 'years', t: 'the year the first Pokémon games came out', n: 1996, u: '', year: 1, x: 1, note: 'In Japan' },
  { id: 'y-google', c: 'years', t: 'the year Google was founded', n: 1998, u: '', year: 1, x: 1 },
  { id: 'y-youtube', c: 'years', t: 'the year YouTube started', n: 2005, u: '', year: 1, x: 1 },
  { id: 'y-iphone', c: 'years', t: 'the year the first iPhone came out', n: 2007, u: '', year: 1, x: 1 },

  // ---- Music & words ----
  { id: 'piano', c: 'words', t: 'keys on a piano', n: 88, u: 'keys', x: 1 },
  { id: 'octave', c: 'words', t: 'keys in one octave of a piano', n: 12, u: 'keys', x: 1, note: 'White and black' },
  { id: 'guitar', c: 'words', t: 'strings on a guitar', n: 6, u: 'strings', x: 1 },
  { id: 'harp', c: 'words', t: 'strings on a concert harp', n: 47, u: 'strings', x: 1 },
  { id: 'beethoven', c: 'words', t: 'symphonies Beethoven wrote', n: 9, u: 'symphonies', x: 1 },
  { id: 'alphabet', c: 'words', t: 'letters in the English alphabet', n: 26, u: 'letters', x: 1 },
  { id: 'sonnet', c: 'words', t: 'lines in a sonnet', n: 14, u: 'lines', x: 1 },
  { id: 'haiku', c: 'words', t: 'syllables in a haiku', n: 17, u: 'syllables', x: 1 },
  { id: 'longestword', c: 'words', t: 'letters in the longest word in the dictionary', n: 45, u: 'letters', x: 1, note: 'Pneumonoultramicroscopicsilicovolcanoconiosis' },

  // ---- Dinosaurs ----
  { id: 'trexlen', c: 'dinos', t: 'the length of a T. rex', n: 40, m: 'ft', note: 'About, nose to tail' },
  { id: 'trexweight', c: 'dinos', t: "a T. rex's weight", n: 8, m: 'ton', note: 'About' },
  { id: 'extinct', c: 'dinos', t: 'how long ago the dinosaurs died out', n: 66000000, m: 'yr', note: 'About' },
  { id: 'raptor', c: 'dinos', t: "a Velociraptor's length", n: 2, m: 'm', note: 'About. Much smaller than in the movies' },
  { id: 'trihorns', c: 'dinos', t: 'horns on a Triceratops', n: 3, u: 'horns', x: 1 },
  { id: 'stego', c: 'dinos', t: "spikes on a Stegosaurus's tail", n: 4, u: 'spikes', note: 'Usually' },

  // ---- Ocean ----
  { id: 'trench', c: 'ocean', t: 'the depth of the Mariana Trench', n: 10935, m: 'm', note: 'About, at its deepest point' },
  { id: 'oceans', c: 'ocean', t: 'oceans on Earth', n: 5, u: 'oceans', x: 1 },
  { id: 'covered', c: 'ocean', t: "how much of Earth's surface is ocean", n: 71, u: 'percent', note: 'About' },
  { id: 'titanicdepth', c: 'ocean', t: 'how deep the Titanic wreck lies', n: 12500, m: 'ft', note: 'About' },
  { id: 'titaniclen', c: 'ocean', t: 'the length of the Titanic', n: 882, m: 'ft', note: '882 ft 9 in' },
  { id: 'whaleheart', c: 'ocean', t: "the weight of a blue whale's heart", n: 400, m: 'lb', note: 'About' },
  { id: 'greatwhite', c: 'ocean', t: "a great white shark's length", n: 20, m: 'ft', note: 'About, for the biggest' },

  // ---- Tech ----
  { id: 'byte', c: 'tech', t: 'bits in a byte', n: 8, u: 'bits', x: 1 },
  { id: 'tweet', c: 'tech', t: 'characters allowed in a tweet before 2017', n: 140, u: 'characters', x: 1 },
  { id: 'pixels', c: 'tech', t: 'pixels on a 1080p screen', n: 2073600, u: 'pixels', x: 1, note: '1920 × 1080' },
  { id: 'ipv4', c: 'tech', t: 'possible IPv4 internet addresses', n: 4294967296, u: 'addresses', x: 1 },
  { id: 'keyboard', c: 'tech', t: 'keys on a full-size keyboard', n: 104, u: 'keys', note: 'US layout' },
  { id: 'qwerty', c: 'tech', t: 'letters in the top row of a keyboard', n: 10, u: 'letters', x: 1, note: 'Q W E R T Y U I O P' },

  // ---- Vehicles ----
  { id: 'semi', c: 'vehicles', t: 'wheels on a semi truck', n: 18, u: 'wheels', x: 1 },
  { id: 'bugatti', c: 'vehicles', t: "a Bugatti Chiron's record speed", n: 304, m: 'mph', note: '2019 record run' },
  { id: 'concorde', c: 'vehicles', t: "the Concorde's cruising speed", n: 1354, m: 'mph', note: 'About twice the speed of sound' },
  { id: 'maglev', c: 'vehicles', t: 'the speed of the fastest train ever', n: 603, m: 'kmh', note: 'A Japanese maglev, 2015' },
  { id: 'wrightdist', c: 'vehicles', t: "how far the Wright brothers' first flight went", n: 120, m: 'ft', x: 1 },
  { id: 'wrighttime', c: 'vehicles', t: "how long the Wright brothers' first flight lasted", n: 12, m: 's', x: 1 },

  // ---- Earth & weather ----
  { id: 'hottest', c: 'earth', t: 'the hottest temperature ever recorded', n: 134, m: 'F', note: 'Death Valley, 1913' },
  { id: 'circumference', c: 'earth', t: 'the distance around Earth', n: 24901, m: 'mi', note: 'At the equator' },
  { id: 'earthage', c: 'earth', t: 'how old Earth is', n: 4540000000, m: 'yr', note: 'About' },
  { id: 'hyperion', c: 'earth', t: 'the height of the tallest tree', n: 380, m: 'ft', note: 'Hyperion, a redwood in California' },
  { id: 'nile', c: 'earth', t: 'the length of the Nile', n: 4132, m: 'mi', note: 'About' },
  { id: 'angelfalls', c: 'earth', t: 'the height of Angel Falls', n: 3212, m: 'ft', note: 'The tallest waterfall' },
  { id: 'continents', c: 'earth', t: 'continents', n: 7, u: 'continents', x: 1 },
  { id: 'lightning', c: 'earth', t: 'the temperature of a lightning bolt', n: 50000, m: 'F', note: 'About' },
  { id: 'sound', c: 'earth', t: 'the speed of sound', n: 343, m: 'ms', note: 'In air at 68°F' },
  { id: 'baikal', c: 'earth', t: 'the depth of Lake Baikal', n: 1642, m: 'm', note: 'The deepest lake' }
];
