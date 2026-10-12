/* Apples to Oranges — more facts, mostly measurements, so Real Size (the dragon ride) has plenty
 * of heights, lengths, weights, speeds, temperatures, times and amounts to compare. They come up
 * in every mode. Same format as facts.js. Checked online: the Parker Solar Probe's top speed
 * (about 430,000 mph, NASA via ScienceAlert). */
'use strict';

FACTS.push(
  // ---- Buildings & landmarks (heights) ----
  { id: 'm-willis', c: 'places', t: 'the height of the Willis Tower in Chicago', n: 1451, m: 'ft', x: 1, note: 'To the roof' },
  { id: 'm-onewtc', c: 'places', t: 'the height of One World Trade Center', n: 1776, m: 'ft', x: 1, note: 'Picked to match the year 1776' },
  { id: 'm-chrysler', c: 'places', t: 'the height of the Chrysler Building', n: 1046, m: 'ft', x: 1 },
  { id: 'm-shanghai', c: 'places', t: 'the height of the Shanghai Tower', n: 632, m: 'm', x: 1 },
  { id: 'm-skytree', c: 'places', t: 'the height of the Tokyo Skytree', n: 634, m: 'm', x: 1 },
  { id: 'm-cntower', c: 'places', t: 'the height of the CN Tower in Toronto', n: 553, m: 'm', note: '553.3 m' },
  { id: 'm-petronas', c: 'places', t: 'the height of the Petronas Towers', n: 452, m: 'm', note: 'About' },
  { id: 'm-bigben', c: 'places', t: 'the height of the Big Ben tower', n: 316, m: 'ft', note: 'About' },
  { id: 'm-pisa', c: 'places', t: 'the height of the Leaning Tower of Pisa', n: 56, m: 'm', note: 'About' },
  { id: 'm-redeemer', c: 'places', t: 'the height of the Christ the Redeemer statue', n: 30, m: 'm', note: 'About, not counting its base' },
  { id: 'm-taj', c: 'places', t: 'the height of the Taj Mahal', n: 73, m: 'm', note: 'About' },
  { id: 'm-sphinx', c: 'places', t: 'the height of the Great Sphinx of Giza', n: 20, m: 'm', note: 'About' },
  { id: 'm-libertyfinger', c: 'places', t: "the length of the Statue of Liberty's index finger", n: 8, m: 'ft', note: 'About' },
  { id: 'm-libertyweight', c: 'places', t: 'the weight of the Statue of Liberty', n: 225, m: 'ton', note: 'About' },
  { id: 'm-eiffelweight', c: 'places', t: 'the weight of the Eiffel Tower', n: 10100, m: 'tonne', note: 'About' },
  { id: 'm-libertybell', c: 'places', t: 'the weight of the Liberty Bell', n: 2080, m: 'lb', note: 'About' },
  { id: 'm-brooklyn', c: 'places', t: 'the main span of the Brooklyn Bridge', n: 1595, m: 'ft', note: 'About' },
  { id: 'm-panama', c: 'places', t: 'the length of the Panama Canal', n: 50, m: 'mi', note: 'About' },
  { id: 'm-channel', c: 'places', t: 'the English Channel at its narrowest', n: 21, m: 'mi', note: 'About' },
  { id: 'm-manhattan', c: 'places', t: 'the length of Manhattan', n: 13.4, m: 'mi', note: 'About' },
  { id: 'm-hoover', c: 'places', t: 'the height of the Hoover Dam', n: 726, m: 'ft', note: 'About' },
  { id: 'm-hollywood', c: 'places', t: 'the height of each letter in the Hollywood sign', n: 45, m: 'ft', note: 'About' },
  { id: 'm-appalachian', c: 'places', t: 'the length of the Appalachian Trail', n: 2190, m: 'mi', note: 'About' },

  // ---- Earth & weather ----
  { id: 'm-fuji', c: 'earth', t: 'the height of Mount Fuji', n: 3776, m: 'm', note: 'About' },
  { id: 'm-k2', c: 'earth', t: 'the height of K2', n: 8611, m: 'm', note: 'About. The second-tallest mountain' },
  { id: 'm-kilimanjaro', c: 'earth', t: 'the height of Mount Kilimanjaro', n: 19341, m: 'ft', note: 'About' },
  { id: 'm-denali', c: 'earth', t: 'the height of Denali', n: 20310, m: 'ft', note: '2015 survey' },
  { id: 'm-mtwashington', c: 'earth', t: 'the height of Mount Washington in New Hampshire', n: 6288, m: 'ft', note: 'About' },
  { id: 'm-grandcanyon', c: 'earth', t: 'the depth of the Grand Canyon', n: 6000, m: 'ft', note: 'About, at its deepest' },
  { id: 'm-victoria', c: 'earth', t: 'the height of Victoria Falls', n: 108, m: 'm', note: 'About' },
  { id: 'm-yosemite', c: 'earth', t: 'the height of Yosemite Falls', n: 2425, m: 'ft', note: 'About, all three drops' },
  { id: 'm-mississippi', c: 'earth', t: 'the length of the Mississippi River', n: 2340, m: 'mi', note: 'About' },
  { id: 'm-amazon', c: 'earth', t: 'the length of the Amazon River', n: 4000, m: 'mi', note: 'About' },
  { id: 'm-gust', c: 'earth', t: 'the fastest wind gust ever measured', n: 253, m: 'mph', note: 'Barrow Island, Australia, 1996' },
  { id: 'm-cat5', c: 'earth', t: 'the wind speed where a hurricane becomes Category 5', n: 157, m: 'mph', x: 1 },
  { id: 'm-orbit', c: 'earth', t: 'how fast Earth moves around the Sun', n: 67000, m: 'mph', note: 'About' },
  { id: 'm-spin', c: 'earth', t: 'how fast Earth spins at the equator', n: 1040, m: 'mph', note: 'About' },
  { id: 'm-lava', c: 'earth', t: 'the temperature of lava', n: 2000, m: 'F', note: 'About' },
  { id: 'm-everestboil', c: 'earth', t: 'the temperature water boils at on top of Everest', n: 160, m: 'F', note: 'About' },
  { id: 'm-ironmelt', c: 'earth', t: 'the temperature iron melts at', n: 1538, m: 'C', x: 1 },
  { id: 'm-goldmelt', c: 'earth', t: 'the temperature gold melts at', n: 1064, m: 'C', x: 1 },
  { id: 'm-nitrogen', c: 'earth', t: 'the temperature liquid nitrogen boils at', n: 77, m: 'K', x: 1 },

  // ---- Space ----
  { id: 'm-sunsurface', c: 'space', t: 'the temperature of the surface of the Sun', n: 10000, m: 'F', note: 'About' },
  { id: 'm-mercury', c: 'space', t: 'the daytime temperature on Mercury', n: 800, m: 'F', note: 'About' },
  { id: 'm-moonorbit', c: 'space', t: 'how long the Moon takes to go around Earth', n: 27.3, m: 'd', note: 'About' },
  { id: 'm-sunlight', c: 'space', t: 'how long sunlight takes to reach Earth', n: 8.3, m: 'min', note: 'About' },
  { id: 'm-marsday', c: 'space', t: 'how long a day on Mars is', n: 24.6, m: 'h', note: 'About' },
  { id: 'm-jupiterday', c: 'space', t: 'how long a day on Jupiter is', n: 9.9, m: 'h', note: 'About. The shortest day of any planet' },
  { id: 'm-venusday', c: 'space', t: 'how long a day on Venus is', n: 243, m: 'd', note: 'About. Longer than its year' },
  { id: 'm-halley', c: 'space', t: "how often Halley's Comet comes back", n: 76, m: 'yr', note: 'About' },
  { id: 'm-apollotrip', c: 'space', t: 'how long Apollo 11 took to reach the Moon', n: 76, m: 'h', note: 'About' },
  { id: 'm-parker', c: 'space', t: 'the top speed of the Parker Solar Probe', n: 430000, m: 'mph', note: 'About. The fastest thing people have ever built', src: 'NASA, via ScienceAlert' },

  // ---- Animals (sizes, weights, speeds) ----
  { id: 'm-giraffetongue', c: 'animal', t: "the length of a giraffe's tongue", n: 20, m: 'in', note: 'About' },
  { id: 'm-albatross', c: 'animal', t: "a wandering albatross's wingspan", n: 11, m: 'ft', note: 'About, for the biggest' },
  { id: 'm-eagle', c: 'animal', t: "a bald eagle's wingspan", n: 7, m: 'ft', note: 'About' },
  { id: 'm-cobra', c: 'animal', t: "a king cobra's length", n: 18, m: 'ft', note: 'About, for the longest' },
  { id: 'm-giantsquid', c: 'animal', t: "a giant squid's length", n: 43, m: 'ft', note: 'About, for the biggest' },
  { id: 'm-ostrichheight', c: 'animal', t: "an ostrich's height", n: 9, m: 'ft', note: 'About' },
  { id: 'm-grizzly', c: 'animal', t: 'a grizzly bear standing up', n: 8, m: 'ft', note: 'About' },
  { id: 'm-polarbear', c: 'animal', t: "a male polar bear's weight", n: 1000, m: 'lb', note: 'About' },
  { id: 'm-giraffeweight', c: 'animal', t: "a giraffe's weight", n: 2600, m: 'lb', note: 'About, for a male' },
  { id: 'm-ostrichegg', c: 'animal', t: 'the weight of an ostrich egg', n: 3, m: 'lb', note: 'About' },
  { id: 'm-hummingweight', c: 'animal', t: 'the weight of a ruby-throated hummingbird', n: 3, m: 'g', note: 'About' },
  { id: 'm-sloth', c: 'animal', t: "a three-toed sloth's top speed", n: 0.15, m: 'mph', note: 'About. On the ground' },
  { id: 'm-horse', c: 'animal', t: "a racehorse's top speed", n: 55, m: 'mph', note: 'About, for a quarter horse' },
  { id: 'm-greyhound', c: 'animal', t: "a greyhound's top speed", n: 45, m: 'mph', note: 'About' },
  { id: 'm-tortoise', c: 'animal', t: 'how long a Galápagos tortoise can live', n: 100, m: 'yr', note: 'Over 100' },
  { id: 'm-elephantdrink', c: 'animal', t: 'water an elephant can drink in a day', n: 50, m: 'gal', note: 'About' },
  { id: 'm-camel', c: 'animal', t: 'water a thirsty camel can drink in one go', n: 30, m: 'gal', note: 'About, in around 13 minutes' },
  { id: 'm-cowmilk', c: 'animal', t: 'milk a dairy cow gives in a day', n: 7, m: 'gal', note: 'About' },

  // ---- Human body ----
  { id: 'm-brain', c: 'body', t: 'the weight of an adult human brain', n: 3, m: 'lb', note: 'About' },
  { id: 'm-heartweight', c: 'body', t: 'the weight of an adult human heart', n: 10, m: 'oz', note: 'About' },
  { id: 'm-fever', c: 'body', t: 'the temperature where a fever starts', n: 100.4, m: 'F', x: 1 },
  { id: 'm-pregnancy', c: 'body', t: 'how long a human pregnancy lasts', n: 40, m: 'wk', note: 'About' },
  { id: 'm-walk', c: 'body', t: 'how fast people walk', n: 3, m: 'mph', note: 'About' },
  { id: 'm-bolttop', c: 'body', t: "Usain Bolt's top running speed", n: 27.8, m: 'mph', note: 'About, in his 2009 world record' },

  // ---- Sports equipment ----
  { id: 'm-bowlingball', c: 'sports', t: 'the heaviest a bowling ball can be', n: 16, m: 'lb', x: 1 },
  { id: 'm-basketball', c: 'sports', t: 'the weight of an NBA basketball', n: 22, m: 'oz', note: 'About' },
  { id: 'm-baseball', c: 'sports', t: 'the weight of a baseball', n: 5, m: 'oz', note: 'About' },
  { id: 'm-golfball', c: 'sports', t: 'the heaviest a golf ball can be', n: 1.62, m: 'oz', x: 1 },
  { id: 'm-tennisball', c: 'sports', t: 'the weight of a tennis ball', n: 2, m: 'oz', note: 'About' },
  { id: 'm-pitch', c: 'sports', t: 'the fastest baseball pitch on record', n: 105.8, m: 'mph', note: 'Aroldis Chapman, 2010' },
  { id: 'm-hoopwidth', c: 'sports', t: 'the width of a basketball hoop', n: 18, m: 'in', x: 1 },
  { id: 'm-dartboard', c: 'sports', t: 'the height of a dartboard’s bullseye off the floor', n: 68, m: 'in', x: 1, note: '5 ft 8 in' },

  // ---- Vehicles ----
  { id: 'm-schoolbus', c: 'vehicles', t: 'the length of a full-size school bus', n: 40, m: 'ft', note: 'About' },
  { id: 'm-carrier', c: 'vehicles', t: 'the length of a Nimitz-class aircraft carrier', n: 1092, m: 'ft', note: 'About' },
  { id: 'm-747', c: 'vehicles', t: 'the length of a Boeing 747-8', n: 250, m: 'ft', note: 'About' },
  { id: 'm-747wing', c: 'vehicles', t: 'the wingspan of a Boeing 747-8', n: 224, m: 'ft', note: 'About' },
  { id: 'm-jet', c: 'vehicles', t: "a passenger jet's cruising speed", n: 575, m: 'mph', note: 'About' },
  { id: 'm-shinkansen', c: 'vehicles', t: "the top speed of Japan's fastest bullet trains in service", n: 320, m: 'kmh', note: 'About' },
  { id: 'm-kingdaka', c: 'vehicles', t: 'the top speed of the Kingda Ka roller coaster', n: 128, m: 'mph', note: 'It closed in 2024' },
  { id: 'm-formularossa', c: 'vehicles', t: 'the top speed of Formula Rossa, the fastest roller coaster', n: 149, m: 'mph', note: 'About. In Abu Dhabi' },
  { id: 'm-nyclax', c: 'vehicles', t: 'a flight from New York to Los Angeles', n: 6, m: 'h', note: 'About' },

  // ---- Food & home ----
  { id: 'm-sodacan', c: 'food', t: 'how much a can of soda holds', n: 12, m: 'floz', x: 1 },
  { id: 'm-waterbottle', c: 'food', t: 'how much a regular bottle of water holds', n: 16.9, m: 'floz', x: 1, note: 'Half a liter' },
  { id: 'm-gallonweight', c: 'food', t: 'the weight of a gallon of water', n: 8.34, m: 'lb', x: 1 },
  { id: 'm-cookies', c: 'food', t: 'the oven temperature for baking most cookies', n: 350, m: 'F', note: 'About' },
  { id: 'm-flush', c: 'food', t: 'water one toilet flush can use in the US', n: 1.6, m: 'gal', x: 1, note: 'The most allowed since 1994' },
  { id: 'm-shower', c: 'food', t: 'water a US shower head can use in a minute', n: 2.5, m: 'gal', x: 1, note: 'The most allowed' },
  { id: 'm-bathtub', c: 'food', t: 'how much a regular bathtub holds', n: 42, m: 'gal', note: 'About' },
  { id: 'm-olympicpool', c: 'food', t: 'how much an Olympic swimming pool holds', n: 660000, m: 'gal', note: 'About' },
  { id: 'm-hottub', c: 'food', t: 'the hottest a hot tub should be', n: 104, m: 'F', x: 1 },
  { id: 'm-penny', c: 'food', t: 'the weight of a US penny', n: 2.5, m: 'g', x: 1 },
  { id: 'm-nickel', c: 'food', t: 'the weight of a US nickel', n: 5, m: 'g', x: 1 },
  { id: 'm-quarter', c: 'food', t: 'the weight of a US quarter', n: 5.67, m: 'g', x: 1 },
  { id: 'm-dollarbill', c: 'food', t: 'the weight of a dollar bill', n: 1, m: 'g', note: 'About' },

  // ---- Movies & music (how long) ----
  { id: 'm-titanicmovie', c: 'screen', t: 'how long the movie Titanic is', n: 194, m: 'min', x: 1 },
  { id: 'm-endgame', c: 'screen', t: 'how long Avengers: Endgame is', n: 181, m: 'min', x: 1 },
  { id: 'm-lionking', c: 'screen', t: 'how long The Lion King (1994) is', n: 88, m: 'min', x: 1 },
  { id: 'm-frozen', c: 'screen', t: 'how long Frozen is', n: 102, m: 'min', x: 1 },
  { id: 'm-shrek', c: 'screen', t: 'how long Shrek is', n: 90, m: 'min', x: 1 },
  { id: 'm-bohemian', c: 'words', t: 'how long "Bohemian Rhapsody" is', n: 355, m: 's', x: 1, note: '5 minutes 55 seconds' },

  // ---- History ----
  { id: 'm-hundredyears', c: 'time', t: "how long the Hundred Years' War really lasted", n: 116, m: 'yr', x: 1, note: '1337 to 1453' }
);
