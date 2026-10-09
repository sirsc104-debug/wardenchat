/* Brain Rocket — Halloween topics, used only by the limited-time Haunted Flight mode.
   They're level 0, so normal games never pick them. Quiz.halloween() builds a fixed pool of 150
   Halloween questions from them (each topic's plain question, plus "… that starts with B" ones)
   and Haunted Flight asks one of those a quarter of the time. See data.js for the list format. */
'use strict';

const HALLOWEEN = { name: 'Halloween', icon: '🎃', level: 0, halloween: true };

topic({ ...HALLOWEEN, id: 'hw-costumes', noun: 'Halloween costume', q: 'Name a **Halloween costume**.', strip: ['costume', 'outfit', 'a', 'sexy'], list: `
1: Witch, Ghost, Vampire/Dracula, Zombie, Pirate, Princess, Skeleton, Superhero, Mummy, Werewolf, Cat/Black Cat, Clown, Devil, Pumpkin, Spider-Man/Spiderman, Batman, Ninja, Cowboy/Cowgirl, Fairy, Monster
2: Frankenstein/Frankenstein's Monster/Frankensteins Monster, Angel, Wizard, Dinosaur, Robot, Astronaut, Police Officer/Cop/Policeman, Firefighter/Fireman, Doctor, Nurse, Mermaid, Unicorn, Harry Potter, Elsa, Superman, Wonder Woman, Grim Reaper/Reaper/Death, Scarecrow, Alien, Knight, Bat, Spider, Ladybug, Bee/Bumblebee, Dog, Shark, Minion, Pikachu, Mario, Iron Man, Hulk, Joker, Wednesday Addams/Wednesday, Ghostface/Scream, Michael Myers, Jason/Jason Voorhees
3: Bride of Frankenstein, Dorothy, Little Red Riding Hood/Red Riding Hood, Peter Pan, Tinker Bell/Tinkerbell, Captain America, Thor, Black Widow, Elvis, Hot Dog, Taco, Banana, Crayon, M&M/M and M, Lego/Lego Brick, Gnome, Lumberjack, Hippie, Flapper, Greaser, Toga, Chef, Referee, Cheerleader, Hermione/Hermione Granger, Wolverine, Deadpool, Darth Vader, Stormtrooper, Yoda, Chucky, Freddy Krueger/Freddy, Pennywise/IT Clown, Beetlejuice, Jack Skellington, Sally, Ghostbuster/Ghostbusters, Teenage Mutant Ninja Turtle/Ninja Turtle/TMNT, Barbie, Ken, Squid Game, Waldo/Where's Waldo, Inflatable T-Rex/Inflatable Dinosaur
4: Plague Doctor, Medusa, Cleopatra, Pharaoh, Viking, Gladiator, Day of the Dead/Catrina/La Catrina/Sugar Skull, Headless Horseman, Bob Ross, Mr. Bean/Mr Bean, Willy Wonka, Oompa Loompa, Cruella/Cruella de Vil, Maleficent, Edward Scissorhands, Coraline, Mothman, Slender Man/Slenderman, Annabelle, M3GAN/Megan, Morticia Addams/Morticia, Gomez Addams, Cousin Itt, Lurch, Uncle Fester, Ghost Bride, Zombie Bride, Pumpkin Head/Pumpkinhead, Sanderson Sisters/Winifred Sanderson, Elphaba, Glinda, Napoleon Dynamite, Rosie the Riveter
5: Banshee, Krampus, Wendigo, Jersey Devil, La Llorona, Baba Yaga, Nosferatu/Count Orlok, Bigfoot/Sasquatch, Chupacabra, Bloody Mary, Babadook/The Babadook, Art the Clown, Pinhead, Leatherface, Samara/Sadako, Kuchisake-onna/Slit-Mouthed Woman, Jiangshi/Hopping Vampire, Yeti, Loch Ness Monster/Nessie, Kraken, Mothra, Godzilla, Dracula's Bride
` });

topic({ ...HALLOWEEN, id: 'hw-candy', noun: 'Halloween candy', q: 'Name a **candy you might get trick-or-treating**.', strip: ['candy', 'bar', 'bars', 'candies', 'fun', 'size', 'mini', 'minis'], list: `
1: Snickers, Kit Kat/KitKat, Reese's/Reeses/Reese's Peanut Butter Cups/Peanut Butter Cups/Reese's Cups, M&M's/M&Ms/M and Ms, Skittles, Twix, Hershey's/Hersheys/Hershey Bar/Hershey's Bar, Milky Way, Candy Corn, Starburst, Lollipop/Lollipops/Lolly, Tootsie Roll/Tootsie Rolls, Butterfinger
2: 3 Musketeers/Three Musketeers, Sour Patch Kids, Swedish Fish, Nerds, Jolly Rancher/Jolly Ranchers, Laffy Taffy, Airheads, Dum Dums/Dum Dum, Hershey's Kisses/Kisses/Hershey Kiss, Almond Joy, Mounds, Whoppers, Milk Duds, Gummy Bears/Gummies, Gummy Worms, Smarties, Life Savers/Lifesavers, Twizzlers, Pixy Stix/Pixie Stix/Pixy Stick, Tootsie Pop/Tootsie Pops, Blow Pop/Blow Pops, Ring Pop, Baby Ruth, Crunch/Nestle Crunch, Heath/Heath Bar, Payday, Rolo/Rolos, Mike and Ike/Mike & Ike, Hot Tamales, Junior Mints, Sweet Tarts/SweeTarts, Warheads, Trolli, Haribo, Peeps
3: York Peppermint Pattie/York/Peppermint Pattie, Mr. Goodbar/Mr Goodbar, Krackel, 100 Grand/Hundred Grand, Milk Chocolate Bar, Chocolate Coins/Gelt, Candy Necklace, Fun Dip, Lemonheads/Lemon Heads, Jawbreaker/Jawbreakers/Gobstopper/Gobstoppers/Everlasting Gobstopper, Sugar Daddy, Bit-O-Honey/Bit o Honey, Good & Plenty/Good and Plenty, Dots, Charleston Chew, Caramel Apple Pops/Caramel Apple Pop, Milky Way Midnight, Snickers Almond, Twix Cookie, Take 5/Take Five, Zero/Zero Bar, Raisinets, Goobers, Sixlets, Runts, Bottle Caps, Spree, Gushers, Fruit Snacks, Ring Pops, Push Pop, Ferrero Rocher, Lindor/Lindt, Toblerone, Chupa Chups, Chick-O-Stick, Necco Wafers/Necco
4: Mary Jane/Mary Janes, Squirrel Nut Zippers, Abba-Zaba/Abba Zaba, Clark Bar, Mallo Cup, Valomilk, Zagnut, Atomic Fireball/Fireball/Fireballs, Boston Baked Beans, Mexican Hat Dance, Candy Buttons/Button Candy, Wax Lips, Wax Bottles/Nik-L-Nip, Circus Peanuts, Smarties Lollipop, Pop Rocks, Big League Chew, Cow Tales, Caramel Creams/Bulls-Eyes, Banana Split Chews, Tootsie Fruit Chews, Whatchamacallit, Kinder Bueno/Kinder, Cadbury/Cadbury Dairy Milk
5: Peanut Butter Kisses/Halloween Kisses, Black Licorice, Candy Pumpkins/Mellowcreme Pumpkins/Mellow Creme Pumpkins, Chiclets, Bazooka/Bazooka Joe, Charms Blow Pop, Clove Gum, Root Beer Barrels, Butterscotch/Butterscotch Discs, Tootsie Frooties/Frooties, Turkish Delight, Sugar Babies, Chuckles, Swedish Berries, Hershey's Cookies 'n' Creme/Cookies and Creme, Marathon Bar
` });

topic({ ...HALLOWEEN, id: 'hw-monsters', noun: 'monster', q: 'Name a **classic monster**.', strip: ['monster', 'the'], list: `
1: Vampire, Zombie, Werewolf, Ghost, Mummy, Witch, Frankenstein/Frankenstein's Monster/Frankensteins Monster, Skeleton, Dracula, Goblin
2: Ghoul, Banshee, Demon, Troll, Ogre, Gargoyle, Sea Monster, Creature from the Black Lagoon/Gill-man/Gill Man, Invisible Man, Bogeyman/Boogeyman/Boogie Man, Swamp Thing, Blob/The Blob, Poltergeist, Phantom, Specter/Spectre, Wraith, Imp, Ghost Ship
3: Wendigo, Chupacabra, Mothman, Bigfoot/Sasquatch, Yeti/Abominable Snowman, Kraken, Godzilla, King Kong, Lich, Revenant, Succubus, Incubus, Poltergeist, Golem, Basilisk, Hydra, Medusa/Gorgon, Cyclops, Minotaur, Harpy, Siren, Manticore, Cerberus
4: Krampus, Jersey Devil, Slender Man/Slenderman, Bloody Mary, Headless Horseman, Phantom of the Opera, Nosferatu, Kelpie, Selkie, Doppelganger, Changeling, Dullahan, Draugr, Strigoi, Ghast, Shade, Will-o'-the-wisp/Will o the Wisp/Wisp
5: Jiangshi, Kappa, Rokurokubi, Nukekubi, Aswang, Manananggal, Pontianak, Penanggalan, Rakshasa, Vetala, Dybbuk, Nuckelavee, Bunyip, Tokoloshe, Skinwalker, El Cuco/Cuco/Coco, La Llorona, Baba Yaga, Kuchisake-onna, Wanyudo, Gashadokuro, Ccoa
` });

topic({ ...HALLOWEEN, id: 'hw-horror-movies', noun: 'horror movie', q: 'Name a **horror movie**.', strip: ['movie', 'film', 'the'], list: `
1: Halloween, Scream, It, The Exorcist/Exorcist, The Shining/Shining, Friday the 13th, A Nightmare on Elm Street/Nightmare on Elm Street, Saw, The Conjuring/Conjuring, Annabelle, Get Out, Psycho, Jaws, Child's Play/Childs Play/Chucky
2: The Ring/Ring, Insidious, Paranormal Activity, Poltergeist, The Texas Chainsaw Massacre/Texas Chainsaw Massacre, Hereditary, A Quiet Place/Quiet Place, Us, The Nun/Nun, Final Destination, Carrie, Alien, The Blair Witch Project/Blair Witch, Pet Sematary, Jigsaw, Smile, M3GAN/Megan, Five Nights at Freddy's/FNAF, Coraline, Beetlejuice, The Purge/Purge, Sinister, Split, Nope, Talk to Me, Terrifier, The Black Phone/Black Phone, Barbarian
3: Midsommar, The Witch/The VVitch, The Babadook/Babadook, It Follows, The Others, The Sixth Sense/Sixth Sense, Hellraiser, Candyman, The Omen/Omen, Rosemary's Baby, The Grudge/Grudge, The Thing, An American Werewolf in London/American Werewolf in London, Dawn of the Dead, Night of the Living Dead, 28 Days Later, Train to Busan, Evil Dead/The Evil Dead, Cabin in the Woods/The Cabin in the Woods, Scream 2, Ready or Not, Happy Death Day, Freaky, Fear Street, The Menu, X, Pearl, Longlegs, The Substance, Nosferatu, Sinners, Weapons, Late Night with the Devil, Abigail, Speak No Evil
4: The Descent/Descent, The Wicker Man/Wicker Man, Suspiria, The Fly/Fly, Videodrome, Event Horizon, Drag Me to Hell, The Strangers/Strangers, You're Next, Oculus, The Autopsy of Jane Doe/Autopsy of Jane Doe, Hush, Gerald's Game, Doctor Sleep, Annihilation, The Lighthouse/Lighthouse, Saint Maud, Relic, His House, Host, Skinamarink, When Evil Lurks, Infinity Pool, Men, Lake Mungo, Session 9, Trick 'r Treat/Trick r Treat, The Changeling, The Innocents, The Haunting, Kwaidan, Onibaba, Ringu
5: Audition, Pulse/Kairo, Noroi/Noroi The Curse, Martyrs, Inside/A l'interieur, Possession, The Wailing, Kill List, Calvaire, Thirst, Dead Ringers, Häxan/Haxan, Vampyr, Eyes Without a Face, Carnival of Souls, Black Christmas, Phantasm, Tourist Trap, The Beyond, Cure, Hausu/House
1: It Chapter Two/It Chapter 2, A Quiet Place Part II/A Quiet Place 2, The Conjuring 2/Conjuring 2, Smile 2, Terrifier 2, Halloween Kills, Halloween Ends, Saw II/Saw 2, Insidious Chapter 2/Insidious 2
2: Annabelle Comes Home, Terrifier 3, Scream VI/Scream 6, Scream 3, Scream 4, Saw X/Saw 10, Evil Dead Rise, Final Destination 2, Final Destination Bloodlines, Bride of Chucky, Freddy vs Jason/Freddy vs. Jason, Jason X, The Conjuring The Devil Made Me Do It/The Devil Made Me Do It, Bird Box
3: 28 Weeks Later, Cloverfield, 10 Cloverfield Lane, The Mist, Misery, Cujo, Tremors, The Birds, The Fog, Jeepers Creepers, Wrong Turn, The Hills Have Eyes, The Amityville Horror, The Exorcism of Emily Rose
4: Prince of Darkness, In the Mouth of Madness, Re-Animator, The Brood, Scanners, Sleepaway Camp, My Bloody Valentine, Prom Night, Silent Night Deadly Night
5: Basket Case, From Beyond, The Burning, Terror Train
` });

topic({ ...HALLOWEEN, id: 'hw-villains', noun: 'horror movie villain', q: 'Name a **horror movie villain**.', strip: ['the'], list: `
1: Freddy Krueger/Freddy, Jason Voorhees/Jason, Michael Myers, Chucky, Pennywise/It, Ghostface, Dracula, Leatherface
2: Jigsaw/John Kramer, Annabelle, Pinhead, Hannibal Lecter/Hannibal, Norman Bates, Samara/Samara Morgan, Candyman, Damien, Pazuzu/Regan, Valak/The Nun, Art the Clown/Art, M3GAN/Megan, The Grabber, Freddy Fazbear, Jack Torrance, Carrie White/Carrie, Esther, The Babadook/Babadook, Slender Man/Slenderman, Bughuul, The Tall Man
3: Pamela Voorhees/Mrs. Voorhees/Mrs Voorhees, Ghostface, Leatherface, Pumpkinhead, The Creeper/Creeper, Victor Crowley, Candyman, Captain Spaulding, Charles Lee Ray, Tiffany, Kayako, Toshio, Sadako, Count Orlok/Orlok, The Shape, Annie Wilkes, Pearl, Bob Gray, The Collector, Mama, The Crooked Man, La Llorona, Black Phillip, Paimon, The Other Mother/Beldam
4: Sam (Trick 'r Treat)/Sam, Harry Warden, Billy (Black Christmas), Angela Baker, Cropsy, Mick Taylor, Pluto, Bathsheba Sherman, Bathsheba, Rawhead Rex, The Fisherman, Ben Willis, Frank Zito, Pale Man, The Djinn, Damien Thorn, Rhoda Penmark
5: Baby Firefly, Otis Driftwood, Chop Top, Hitchhiker, Madman Marz, Duncan Hellman, Baghead, Asa Vajda, Mother Suspiriorum, Helena Markos, Dr. Phibes, Count Yorga, Blacula
` });

topic({ ...HALLOWEEN, id: 'hw-decorations', noun: 'Halloween decoration', q: 'Name a **Halloween decoration**.', strip: ['decoration', 'decorations', 'fake', 'plastic'], list: `
1: Jack-o'-lantern/Jack o Lantern/Jack-o-Lantern/Carved Pumpkin, Pumpkin/Pumpkins, Skeleton, Spider Web/Spiderweb/Cobweb/Cobwebs/Webs, Ghost, Bat/Bats, Tombstone/Gravestone/Headstone, Spider/Spiders, Witch
2: Fake Spider, Hay Bale/Hay Bales/Haystack, Scarecrow, Cauldron, Skull/Skulls, Black Cat, String Lights/Orange Lights/Halloween Lights, Candles/Candle, Inflatable/Inflatables/Blow-up, Gourd/Gourds, Corn Stalks/Cornstalks, Wreath, Witch Hat, Broom/Broomstick, Fog Machine, Animatronic, Coffin, Zombie Hand/Ground Breaker, Lanterns/Lantern, Banner, Garland, Doormat
3: Crows/Crow/Raven/Ravens, Owl, Mummy, Rat/Rats, Severed Hand, Severed Head, Eyeballs, Bones, Caution Tape, Black Light, Strobe Light, Window Silhouettes/Window Clings, Paper Bats, Pumpkin Lights, Luminaries/Luminarias, Indian Corn/Flint Corn, Mums/Chrysanthemums, Grim Reaper, Hanging Ghost, Crystal Ball, Spell Book, Potion Bottles, Candelabra, Creepy Doll, Ouija Board
4: Twelve-Foot Skeleton/12 Foot Skeleton/Giant Skeleton, Skeleton Dog, Gargoyle, Witch Crashing into Tree, Bleeding Candles, Shrunken Head, Specimen Jar, Haunted Mirror, Tarot Cards, Plague Doctor Mask, Fake Blood, Body Bag, Floating Candles, Ghost Lights, Projector, Smoke Machine
5: Papel Picado, Ofrenda/Altar, Marigolds/Cempasuchil, Turnip Lantern, Bonfire, Mangel-wurzel/Mangelwurzel, Neep Lantern, Calavera, Sugar Skull/Sugar Skulls, Barmbrack
` });

topic({ ...HALLOWEEN, id: 'hw-witch', noun: 'thing a witch uses', q: 'Name **something a witch has or uses**.', strip: ['a', 'her', 'magic'], list: `
1: Broom/Broomstick, Hat/Witch Hat/Pointy Hat, Cauldron, Black Cat/Cat, Wand, Spell/Spells, Potion/Potions, Spell Book/Spellbook/Book of Spells
2: Crystal Ball, Familiar, Cloak/Cape, Robe, Toad/Frog, Owl, Raven/Crow, Candles/Candle, Herbs, Pentagram, Ingredients, Mortar and Pestle, Grimoire, Eye of Newt, Crystals, Tarot Cards/Tarot, Moon, Gingerbread House/Candy House, Poison Apple, Mirror/Magic Mirror
3: Athame, Besom, Book of Shadows, Wolfsbane, Mandrake/Mandrake Root, Nightshade/Belladonna, Bat Wings, Hemlock, Sage, Runes, Pendulum, Ouija Board, Altar, Chalice, Incense, Bones, Skull, Coven, Sabbat, Hex, Curse, Voodoo Doll/Poppet
4: Witch Bottle, Scrying Mirror, Hag Stone, Hand of Glory, Ruby Slippers, Toad Venom, Newt, Moonwater, Witch's Ladder, Familiar Spirit, Flying Ointment, Mugwort, Rue, Henbane, Wormwood, Hellebore
5: Boline, Cingulum, Thurible, Censer, Aspergillum, Gyre, Distaff, Spindle, Philtre/Philter, Alembic, Philosopher's Stone
` });

topic({ ...HALLOWEEN, id: 'hw-creepy-animals', noun: 'spooky animal', q: 'Name a **spooky animal**.', strip: ['the', 'a'], list: `
1: Bat, Black Cat/Cat, Spider, Owl, Crow, Raven, Rat, Snake, Wolf, Vulture
2: Tarantula, Black Widow, Scorpion, Cockroach/Roach, Toad, Frog, Moth, Centipede, Leech, Hyena, Shark, Octopus, Jellyfish, Mouse, Worm, Maggot, Fly, Beetle, Wasp
3: Vampire Bat, Aye-Aye, Anglerfish, Hagfish, Komodo Dragon, Piranha, Death's-Head Hawkmoth/Death's Head Moth/Deaths Head Moth, Fruit Bat/Flying Fox, Coyote, Jackal, Barn Owl, Raccoon, Opossum/Possum, Goblin Shark, Gulper Eel, Viperfish, Fangtooth, Vampire Squid, Naked Mole Rat, Tasmanian Devil
4: Zombie Ant/Zombie-Ant Fungus, Assassin Bug, Camel Spider, Bullet Ant, Botfly, Lamprey, Bone-Eating Worm/Zombie Worm/Osedax, Blobfish, Frilled Shark, Coffinfish, Sea Spider, Goliath Birdeater, Whip Spider/Tailless Whip Scorpion, Cassowary, Ghost Bat, Ghost Crab, Ghost Shrimp, Glass Frog
5: Vampire Finch, Vampire Deer/Tufted Deer, Pumpkin Toadlet, Halloween Crab, Candiru, Skeleton Shrimp, Bone Snail, Barreleye, Dracula Ant, Dracula Fish, Satanic Leaf-Tailed Gecko/Satanic Leaf Gecko, Devil's Flower Mantis, Ghost Slug, Spectral Bat, Mourning Cloak
` });

topic({ ...HALLOWEEN, id: 'hw-vampires', noun: 'famous vampire', q: 'Name a **famous vampire**.', strip: ['count', 'the'], list: `
1: Dracula/Count Dracula, Edward Cullen/Edward, Count Chocula, Count von Count/The Count, Nosferatu
2: Bella Swan/Bella, Lestat/Lestat de Lioncourt, Blade, Vlad the Impaler/Vlad Dracula/Vlad, Count Orlok/Orlok, Damon Salvatore/Damon, Stefan Salvatore/Stefan, Mavis, Drac/Dracula (Hotel Transylvania), Spike, Angel, Alucard, Selene, Marceline
3: Louis/Louis de Pointe du Lac, Claudia, Eric Northman, Bill Compton, Jacob Black, Alice Cullen, Jasper Hale, Carlisle Cullen, Rosalie Hale, Emmett Cullen, Esme Cullen, Renesmee, Aro, Jane, Klaus Mikaelson/Klaus, Elijah Mikaelson, Elena Gilbert, Nandor, Laszlo, Nadja, Colin Robinson, Viago, Vladislav, Deacon, Petyr, Barnabas Collins, David (The Lost Boys), Count Duckula, Bunnicula, Vampirella, Morbius, Edgar Frog, Jerry Dandrige
4: Carmilla, Lord Ruthven, Varney the Vampire/Varney, Armand, Akasha, Marius, Gabrielle/Gabrielle de Lioncourt, Count Yorga, Blacula/Mamuwalde, Kurt Barlow, Eli, Abby, Mina Harker/Mina, Lucy Westenra/Lucy, Brides of Dracula, Miriam Blaylock, Santanico Pandemonium, Max (The Lost Boys), Dr. Acula, Sonja Blue, Kain, Raziel, Dmitri/Dimitri
5: Elizabeth Bathory/Countess Bathory, Count Magnus, Clarimonde, Dracula's Daughter/Countess Zaleska, Marya Zaleska, Sarah (The Hunger), Lamia
` });

topic({ ...HALLOWEEN, id: 'hw-family-movies', noun: 'Halloween movie for kids', q: 'Name a **Halloween movie for kids**.', strip: ['movie', 'film', 'the'], list: `
1: Hocus Pocus, The Nightmare Before Christmas/Nightmare Before Christmas, Coraline, Casper, Hotel Transylvania, Ghostbusters, The Addams Family/Addams Family, Monsters, Inc./Monsters Inc/Monsters Incorporated, Halloweentown, Beetlejuice
2: It's the Great Pumpkin, Charlie Brown/It's the Great Pumpkin Charlie Brown/The Great Pumpkin, Corpse Bride, Frankenweenie, ParaNorman, Goosebumps, Monster House, Scooby-Doo/Scooby Doo, Hocus Pocus 2, Hotel Transylvania 2, The Witches/Witches, Ghostbusters: Afterlife/Ghostbusters Afterlife, Coco, Spooky Buddies, Twitches, Hubie Halloween, Haunted Mansion/The Haunted Mansion, Wendell & Wild/Wendell and Wild, Monster High
3: Halloweentown II/Halloweentown 2, Return to Halloweentown, Halloweentown High, Mr. Boogedy, Under Wraps, Casper Meets Wendy, Scooby-Doo on Zombie Island/Zombie Island, The Legend of Sleepy Hollow/Sleepy Hollow, Room on the Broom, Spookley the Square Pumpkin/Spookley, Garfield's Halloween Adventure, Monster Squad/The Monster Squad, Ernest Scared Stupid, Little Monsters, The Worst Witch/Worst Witch, Addams Family Values, The Book of Life/Book of Life, Igor, Mad Monster Party, Kiki's Delivery Service/Kikis Delivery Service, Spirited Away, Labyrinth, The Little Vampire/Little Vampire, Coco
4: Disney's Halloween Treat, Winnie the Pooh: Boo to You Too/Boo to You Too, Pooh's Heffalump Halloween Movie, Lego Scooby-Doo, Mickey's House of Villains, The Halloween Tree/Halloween Tree, Escape from Witch Mountain, Return to Oz, The Watcher in the Woods, Something Wicked This Way Comes, Teen Witch, Edward Scissorhands, Matilda
5: Which Witch, Phantom of the Megaplex, The Ghost of Dragstrip Hollow, Mom's Got a Date with a Vampire, Don't Look Under the Bed, Johnny and the Sprites, Girl vs. Monster/Girl vs Monster, Zapped, Spooksville, Haunted Lighthouse, Scared Shrekless, Toy Story of Terror
1: Hotel Transylvania 3/Hotel Transylvania 3 Summer Vacation, Hotel Transylvania Transformania/Hotel Transylvania 4, Goosebumps 2/Goosebumps 2 Haunted Halloween, The Addams Family 2, Zombies (Disney)/Zombies, Beetlejuice Beetlejuice/Beetlejuice 2, Ghostbusters Frozen Empire
2: Scooby-Doo 2 Monsters Unleashed/Scooby-Doo 2, The House with a Clock in Its Walls, The Boxtrolls, Scoob!, Zombies 2, Curious George A Halloween Boo Fest, Trick or Treat Scooby-Doo!/Trick or Treat Scooby-Doo, Happy Halloween Scooby-Doo!/Happy Halloween Scooby-Doo, Scooby-Doo and the Ghoul School/Ghoul School, Scooby-Doo and the Witch's Ghost, Monster Family, The Spiderwick Chronicles/Spiderwick, Twitches Too, Under Wraps 2
3: Scooby-Doo and the Reluctant Werewolf, Scooby-Doo Curse of the Lake Monster, Mostly Ghostly, Casper A Spirited Beginning, Casper's Scare School, The Ghost and Mr. Chicken/The Ghost and Mr Chicken, Halloween Is Grinch Night, Scary Godmother, Teen Wolf (1985)/Teen Wolf, The Little Witch, Vampires vs. the Bronx/Vampires vs the Bronx, Monster Mash (2000), The Halloween That Almost Wasn't, Spooky House, Scooby-Doo Frankencreepy/Frankencreepy, Bunnicula, Monsters vs Aliens Mutant Pumpkins from Outer Space/Mutant Pumpkins from Outer Space, Scooby-Doo Return to Zombie Island, Scooby-Doo Abracadabra-Doo, Lego Scooby-Doo Knight Time Terror, Mickey's Monster Musical, Monster High Ghouls Rule, Bride of Boogedy
4: Arthur and the Haunted Tree House, Zombies 3, Monster Hunt, The Little Vampire 3D
5: The Midnight Hour, The Haunted Pumpkin of Sleepy Hollow
` });

topic({ ...HALLOWEEN, id: 'hw-songs', noun: 'Halloween song', q: 'Name a **song you\'d hear at a Halloween party**.', strip: ['song', 'the'], list: `
1: Thriller, Monster Mash, Ghostbusters, This Is Halloween, Spooky Scary Skeletons, The Time Warp/Time Warp
2: Somebody's Watching Me/Somebodys Watching Me, Superstition, I Put a Spell on You, Bad Moon Rising, Werewolves of London, Disturbia, Highway to Hell, Dead Man's Party/Dead Mans Party, Purple People Eater/The Purple People Eater, Addams Family Theme/The Addams Family, Witchy Woman, Psycho Killer, Zombie, Season of the Witch, Monster, Black Magic Woman, Spooky, Haunted, Toxic, Bury a Friend, Calling All the Monsters, Ghost Town, Abracadabra, Sweet Dreams, Halloween Theme, Beat It
3: Tubular Bells, Night on Bald Mountain/Night on Bare Mountain, Danse Macabre, In the Hall of the Mountain King, Toccata and Fugue in D Minor/Toccata and Fugue, Ghost Riders in the Sky, Love Potion No. 9/Love Potion Number 9, People Are Strange, Bark at the Moon, Enter Sandman, Welcome to My Nightmare, Feed My Frankenstein, Don't Fear the Reaper/(Don't Fear) The Reaper, Pet Sematary, Dragula, Thriller (Fall Out Boy), Everybody (Backstreet's Back)/Everybody, Heads Will Roll, Somebody Told Me, Hungry Like the Wolf, Howl, Little Red Riding Hood, Bela Lugosi's Dead, Halloween (Siouxsie), Living Dead Girl, This Is Halloween (Marilyn Manson), Boris the Spider, Teen Wolf, Ghost, I Was Made for Lovin' You, Gimme! Gimme! Gimme!
4: Spellbound, Cry Little Sister, Mr. Sandman, Frankenstein (Edgar Winter), Haunted House, Dead Man's Curve, The Blob, Zombie Jamboree, Clap for the Wolfman, I Walked with a Zombie, Jack the Ripper, The Munsters Theme, Twilight Zone Theme, Tales from the Crypt Theme
5: Funeral March of a Marionette, Grim Grinning Ghosts, Skeleton Dance, Dem Bones/Dry Bones
1: Bad Guy, Vampire, Demons, Bloody Mary, Smooth Criminal, Dark Horse, Witch Doctor
2: Black Magic, Heathens, E.T./ET, She Wolf, Wolves, Godzilla, Bring Me to Life, What's This?/Whats This, Oogie Boogie's Song/Oogie Boogie, Kidnap the Sandy Claws, Jack's Lament, Sally's Song, Come Little Children, Scooby-Doo Where Are You Theme/Scooby-Doo Theme
3: Witchcraft, That Old Black Magic, Twilight Zone (Golden Earring)/Twilight Zone, Sweet Transvestite, O Fortuna, The Phantom of the Opera, Hells Bells, The Number of the Beast, Paranoid, Iron Man (Black Sabbath)/Iron Man, Master of Puppets, Devil Inside, Evil Woman, Cannibal, Animal I Have Become, Ghost of You, Cemetery Drive, Remember Me (Coco)/Remember Me, Black Widow
4: Dig Up Her Bones, Halloween (Misfits)/Halloween, Skulls, Dead Souls, Werewolf (Motionless in White), Vampires Will Never Hurt You, Fear of the Dark
5: Zombie Zoo, Frankenstein (New York Dolls), The Raven (Alan Parsons)
` });

topic({ ...HALLOWEEN, id: 'hw-ghosts', noun: 'famous ghost', q: 'Name a **famous ghost**.', strip: ['ghost', 'the'], list: `
1: Casper/Casper the Friendly Ghost, Slimer, Beetlejuice, Boo/King Boo, Bloody Mary, Headless Horseman
2: Moaning Myrtle, Nearly Headless Nick, Blinky, Pinky, Inky, Clyde, Gengar, Ghost of Christmas Past, Ghost of Christmas Present, Ghost of Christmas Yet to Come/Ghost of Christmas Future, Jacob Marley/Marley, Danny Phantom, Stay Puft Marshmallow Man/Stay Puft, The Grey Lady/Grey Lady, Peeves, Sam Wheat, Lydia Deetz, Hamlet's Father, Canterville Ghost, Ghostly Trio
3: The Fat Friar/Fat Friar, The Bloody Baron/Bloody Baron, Cordelia, Ghost Rider, Phantom of the Opera, Flying Dutchman, Lady in White, Resurrection Mary, Bell Witch, Anne Boleyn, Brown Lady of Raynham Hall/Brown Lady, Madame Leota, Hatbox Ghost, The Hitchhiking Ghosts/Hitchhiking Ghosts, Elise Rainier, Banquo, Ghost Dad, Mr. Boogedy, Kayako, Toshio
4: Bhoot, La Llorona, Yurei, Onryo, Gwisin, Pontianak, The Amityville Ghost, Enfield Poltergeist, Greenbrier Ghost, Myrtles Plantation Ghost/Chloe, Lady Elgin, Nell Crain, The Lady in the Lake/Lady in the Lake, Polterguy, The Ghost of Abraham Lincoln/Lincoln's Ghost
5: Pepper's Ghost, Grey Man of Ben Macdhui, Black Shuck, Hinemoa, Okiku, Oiwa, Banchō Sarayashiki, White Lady of Bezděz, Phantom Coach
` });

topic({ ...HALLOWEEN, id: 'hw-potion', noun: 'potion ingredient', q: 'Name a **spooky potion ingredient**.', strip: ['of', 'a', 'some'], list: `
1: Eye of Newt, Frog Legs/Frog, Bat Wings/Bat Wing, Spider/Spiders, Toad, Snake, Slime, Eyeball/Eyeballs, Worms/Worm
2: Toe of Frog, Wool of Bat, Tongue of Dog, Snake Venom/Venom, Lizard Tail/Lizard Leg, Owl Feather/Owl Feathers, Spider Legs, Rat Tail/Rat Tails, Bones, Blood/Dragon's Blood, Hair, Fingernails/Toenails, Ash/Ashes, Moonlight, Herbs, Mushroom/Mushrooms/Toadstool, Graveyard Dirt, Cobwebs, Pumpkin Seeds
3: Mandrake/Mandrake Root, Wolfsbane, Nightshade/Belladonna, Hemlock, Unicorn Hair, Phoenix Feather, Dragon Scale/Dragon Scales, Troll Snot, Newt, Beetle Eyes/Beetle, Lacewing Flies/Lacewings, Leeches, Fluxweed, Bezoar, Wormwood, Henbane, Sulfur/Brimstone, Mercury, Salamander, Crow Feather, Black Cat Hair
4: Adder's Fork, Blind-Worm's Sting/Blindworm Sting, Howlet's Wing, Fillet of a Fenny Snake, Scale of Dragon, Tooth of Wolf, Witch's Mummy, Maw and Gulf of the Ravined Salt-Sea Shark, Root of Hemlock, Gall of Goat, Slips of Yew, Baboon's Blood, Powdered Bicorn Horn, Boomslang Skin, Shrivelfig, Asphodel
5: Moly, Hellebore, Datura/Jimsonweed, Aconite, Monkshood, Foxglove, Yew Berries, Thornapple, Mugwort, Vervain, Rue, Dittany
` });

topic({ ...HALLOWEEN, id: 'hw-authors', noun: 'horror writer', q: 'Name a **horror or scary-story writer**.', strip: [], list: `
1: Stephen King, Edgar Allan Poe/Poe, R.L. Stine/RL Stine, Mary Shelley, Bram Stoker
2: H.P. Lovecraft/HP Lovecraft/Lovecraft, Shirley Jackson, Anne Rice, Washington Irving, Dean Koontz, Neil Gaiman, Clive Barker, Joe Hill, Alvin Schwartz, Stephenie Meyer, Darcy Coates, Christopher Pike, Peter Straub, Richard Matheson, Ray Bradbury
3: Robert Louis Stevenson, Oscar Wilde, Henry James, Ann Radcliffe, Horace Walpole, M.R. James/MR James, Algernon Blackwood, Sheridan Le Fanu/Le Fanu, Ambrose Bierce, Ira Levin, William Peter Blatty, Thomas Harris, Shirley Jackson, Paul Tremblay, Grady Hendrix, Stephen Graham Jones, Silvia Moreno-Garcia, Junji Ito, Koji Suzuki, Josh Malerman, Tananarive Due, Daphne du Maurier, Susan Hill, John Ajvide Lindqvist, Mariana Enriquez
4: Arthur Machen, Robert W. Chambers/Robert Chambers, Lord Dunsany, Clark Ashton Smith, Robert Bloch, Fritz Leiber, Ramsey Campbell, James Herbert, Thomas Ligotti, Jack Ketchum, Laird Barron, Caitlin R. Kiernan, Adam Nevill, Brian Keene, Tananarive Due, T. Kingfisher/T Kingfisher, Nathan Ballingrud, Victor LaValle
5: Matthew Lewis/Matthew Gregory Lewis, Charles Maturin, William Hope Hodgson, E.F. Benson/EF Benson, Vernon Lee, Edith Wharton, Oliver Onions, Hanns Heinz Ewers, Gustav Meyrink, Edogawa Rampo, Ueda Akinari, Lafcadio Hearn, Kathe Koja
` });

topic({ ...HALLOWEEN, id: 'hw-folklore', noun: 'folklore creature', q: 'Name a **scary creature from folklore** anywhere in the world.', strip: ['the'], list: `
1: Bigfoot/Sasquatch, Loch Ness Monster/Nessie, Yeti, Chupacabra, Werewolf, Vampire, Banshee, Bogeyman/Boogeyman
2: Mothman, Wendigo, Jersey Devil, Krampus, La Llorona, Baba Yaga, Kraken, Golem, Troll, Goblin, Kelpie, Headless Horseman, Skinwalker, Dullahan, Kappa, Kitsune, Will-o'-the-wisp/Will o the Wisp, Changeling, Gremlin
3: Jiangshi, Yuki-onna, Tengu, Oni, Rokurokubi, Draugr, Strigoi, Selkie, Leprechaun, Pooka/Puca, Black Shuck/Black Dog, Rakshasa, Aswang, Manananggal, Pontianak, Duende, El Cuco/Cuco/Coco, Nahuelito, Bunyip, Yowie, Taniwha, Tokoloshe, Dybbuk, Lamia, Strix, Empusa, Mare, Nixie/Nix, Rusalka, Domovoi, Leshy, Kikimora, Encantado, Curupira, Boitata, Wechuge
4: Nuckelavee, Each-uisge, Redcap, Bean Nighe, Fear Gorta, Bunyip, Mngwa, Ninki Nanka, Grootslang, Adze, Asanbosam, Impundulu, Popobawa, Kasa-obake, Nurikabe, Gashadokuro, Nukekubi, Kuchisake-onna, Teke Teke, Hanako-san, Gumiho, Bakeneko, Nue, Krasue, Penanggalan, Toyol, Bhoot, Vetala, Churel/Chudail, Pishacha
5: Ahool, Mapinguari, Patasola, La Tunda, Sombrerón/Sombreron, Cadejo, Nahual/Nagual, Tlahuelpuchi, Ciguapa, Lobisomem, Peuchen, Trauco, Basilisco Chilote, Yacumama, Abaasy, Alkonost, Likho, Bannik, Ovinnik, Psoglav, Stuhać, Bukavac, Ala, Vodyanoy, Huldra, Fossegrim, Myling, Gjenganger, Bäckahäst
` });

topic({ ...HALLOWEEN, id: 'hw-games', noun: 'scary video game', q: 'Name a **scary video game**.', strip: ['game', 'the'], list: `
1: Five Nights at Freddy's/FNAF/Five Nights at Freddys, Resident Evil, Minecraft, Poppy Playtime, Luigi's Mansion/Luigis Mansion, Fortnite, Among Us, Call of Duty Zombies/COD Zombies/Zombies
2: Silent Hill, Dead by Daylight, Phasmophobia, Outlast, Amnesia/Amnesia: The Dark Descent, Little Nightmares, Bendy and the Ink Machine/Bendy, Doors, Lethal Company, The Last of Us/Last of Us, Until Dawn, Alan Wake, Dead Space, Left 4 Dead, Plants vs. Zombies/Plants vs Zombies, Granny, Hello Neighbor, Baldi's Basics/Baldis Basics, Slender/Slender: The Eight Pages, Piggy, Dying Light, State of Decay, Days Gone, The Walking Dead, Evil Within/The Evil Within, Identity V, Fear & Hunger/Fear and Hunger, Content Warning, Garten of Banban, The Mimic, Pressure
3: Alien: Isolation/Alien Isolation, SOMA, Layers of Fear, Visage, The Quarry, The Dark Pictures/Man of Medan/House of Ashes/Little Hope, Inscryption, Darkwood, Iron Lung, Signalis, Mouthwashing, Fatal Frame/Project Zero, Siren/Forbidden Siren, Clock Tower, Condemned, F.E.A.R./FEAR, Call of Cthulhu, Bloodborne, Darkest Dungeon, Don't Starve, Limbo, Inside, Cry of Fear, The Coffin of Andy and Leyley, Mortuary Assistant/The Mortuary Assistant, Dredge, Lunacy, Specimen 8, Ice Scream, Evil Nun, The Callisto Protocol/Callisto Protocol, Killer Klowns, Texas Chain Saw Massacre (game), MiSide, Buckshot Roulette, Dead Island
4: Silent Hill 2, P.T./PT, Eternal Darkness, Haunting Ground, Rule of Rose, Kuon, Echo Night, Sweet Home, Alone in the Dark, Phantasmagoria, I Have No Mouth, and I Must Scream/I Have No Mouth and I Must Scream, System Shock, Penumbra, Faith/FAITH, Doki Doki Literature Club/DDLC, Ib, Corpse Party, Yume Nikki, Mad Father, The Witch's House/Witch's House, OFF, Spooky's Jump Scare Mansion, Pathologic, The Cat Lady, Lone Survivor, Anatomy, Paratopic, World of Horror, Fear the Dark Unknown, Home Safety Hotline, No, I'm Not a Human, The Exit 8/Exit 8
5: Sanitarium, Sweet Home (Famicom), Laplace no Ma, Uninvited, Dark Seed, Harvester, Clive Barker's Undying/Undying, Galerians, Countdown Vampires, Michigan: Report from Hell, Obscure, Cold Fear, Kuon, Overblood, Nanashi no Game, Hotel Dusk
` });

topic({ ...HALLOWEEN, id: 'hw-tv', noun: 'spooky TV show', q: 'Name a **spooky TV show**.', strip: ['show', 'series', 'the', 'tv'], list: `
1: Stranger Things, Wednesday, Scooby-Doo/Scooby Doo/Scooby-Doo Where Are You, The Walking Dead/Walking Dead, Goosebumps, The Addams Family/Addams Family, Supernatural, American Horror Story/AHS
2: The Munsters/Munsters, Are You Afraid of the Dark?/Are You Afraid of the Dark, The Twilight Zone/Twilight Zone, Buffy the Vampire Slayer/Buffy, The Vampire Diaries/Vampire Diaries, Gravity Falls, Courage the Cowardly Dog/Courage, The Haunting of Hill House/Haunting of Hill House, Chilling Adventures of Sabrina/Sabrina, Sabrina the Teenage Witch, Teen Wolf, What We Do in the Shadows, Ghosts, The X-Files/X-Files, Tales from the Crypt, Hilda, Danny Phantom, Grim Adventures of Billy & Mandy/Billy and Mandy, Monster High, Locke & Key/Locke and Key, The Last of Us, Midnight Mass, Interview with the Vampire
3: Twin Peaks, Penny Dreadful, Hannibal, The Haunting of Bly Manor/Bly Manor, From, Yellowjackets, Evil, Castle Rock, The Fall of the House of Usher, Lovecraft Country, Channel Zero, Ash vs Evil Dead, Dark Shadows, Kolchak: The Night Stalker/Kolchak, Night Gallery, The Outer Limits/Outer Limits, Charmed, Grimm, True Blood, The Strain, Fear the Walking Dead, Bates Motel, Scream Queens, Shining Vale, Archive 81, Hellbound, Kingdom, Sweet Home, All of Us Are Dead, Marianne, Over the Garden Wall, Little Witch Academia, Inside No. 9/Inside No 9, The Owl House/Owl House, Ghostwriter, Goosebumps (2023), Wellington Paranormal
4: The Hitchhiker, Tales from the Darkside, Friday the 13th: The Series, Freddy's Nightmares, Monsters, Goosebumps: The Haunting Hour/R.L. Stine's The Haunting Hour/The Haunting Hour, So Weird, Eerie, Indiana/Eerie Indiana, Ghost Hunters, Ghost Adventures, Paranormal State, Kindred Spirits, Mob Psycho 100, Ghost Stories (Gakkou no Kaidan), Another, Higurashi, Parasyte, Shiki, Mononoke, Junji Ito Maniac, Hellsing, Death Note, Ghost Hunt
5: Thriller (1960), One Step Beyond, Way Out, Darkroom, The Evil Touch, Ghost Story/Circle of Fear, The Others (2000), Point Pleasant, American Gothic, Millennium, Brimstone, Carnivàle/Carnivale, Haven, Hemlock Grove, Salem
1: Vampirina, The Walking Dead: Daryl Dixon/Daryl Dixon, Scooby-Doo Mystery Incorporated/Mystery Incorporated, What's New Scooby-Doo?/Whats New Scooby-Doo, Agatha All Along, Chucky (TV series)/Chucky, The Real Ghostbusters/Real Ghostbusters
2: A Pup Named Scooby-Doo, The 13 Ghosts of Scooby-Doo, Velma, Hotel Transylvania The Series, Extreme Ghostbusters, Beetlejuice (cartoon)/Beetlejuice the Animated Series/Beetlejuice, Gargoyles, Count Duckula, Ghost Whisperer, Lucifer, The Originals, Legacies, Shadowhunters, Angel
3: Constantine, Being Human, Moonlight, Mayfair Witches, A Discovery of Witches, Motherland Fort Salem, First Kill, Wolf Pack, The Exorcist (TV series)/The Exorcist, Ratched, Wayward Pines, Servant, Them, The Terror, Z Nation, Black Summer, Two Sentence Horror Stories
4: Tales from the Cryptkeeper, Toonsylvania, Skeleton Warriors, The Ghost and Mrs. Muir/The Ghost and Mrs Muir, Ghostwatch, Hammer House of Horror, Tales of the Unexpected, Les Revenants/The Returned, In the Flesh
5: Destination Truth, Paranormal Witness, Blood Ties
` });

topic({ ...HALLOWEEN, id: 'hw-food', noun: 'Halloween treat', q: 'Name a **Halloween or fall treat**.', strip: ['a', 'some'], list: `
1: Candy Corn, Caramel Apple/Caramel Apples, Pumpkin Pie, Candy, Popcorn, Candy Apple/Candy Apples/Toffee Apple, Apple Cider/Cider, Pumpkin Seeds, Hot Chocolate/Hot Cocoa
2: Pumpkin Bread, Pumpkin Spice Latte/PSL, Apple Pie, Popcorn Balls, Caramel Corn/Kettle Corn, S'mores/Smores, Cupcakes/Halloween Cupcakes, Sugar Cookies/Halloween Cookies, Mummy Dogs/Mummy Hot Dogs, Dirt Cups/Worms in Dirt, Gummy Worms, Pumpkin Muffins, Apple Cider Donuts/Cider Donuts, Pumpkin Roll, Chili, Witch Finger Cookies/Witch Fingers, Spider Cookies, Rice Krispie Treats/Rice Krispies Treats, Brownies, Cheese Ball, Deviled Eggs, Punch/Witch's Brew
3: Pumpkin Soup, Butternut Squash Soup, Roasted Chestnuts/Chestnuts, Mulled Cider, Candied Pecans, Pumpkin Cheesecake, Pumpkin Spice Cookies, Monster Cookies, Eyeball Cake Pops/Cake Pops, Ghost Pizza, Jack-o'-Lantern Quesadillas, Graveyard Cake, Pumpkin Fudge, Maple Taffy, Bat Wings (chicken wings), Pan de Muerto/Bread of the Dead, Sugar Skulls/Calaveras, Hot Apple Cider, Pumpkin Ravioli
4: Soul Cakes, Barmbrack/Barm Brack, Colcannon, Bonfire Toffee/Treacle Toffee, Parkin, Champ, Boxty, Toffee Apples, Calabaza en Tacha, Atole, Champurrado, Tamales, Mole, Hot Buttered Rum
5: Fiambre, Ossi dei Morti/Bones of the Dead, Fave dei Morti, Huesos de Santo, Buñuelos de Viento/Bunuelos de Viento, Panellets, Kolyva, Zerde, Cozonac, Soul Bread, Dumb Supper, Fadge
` });

topic({ ...HALLOWEEN, id: 'hw-witches', noun: 'famous witch', q: 'Name a **famous witch**.', strip: ['the'], list: `
1: Wicked Witch of the West, Glinda/Glinda the Good Witch, Elphaba, Hermione Granger/Hermione, Sabrina/Sabrina Spellman, Winifred Sanderson/Winnie Sanderson, Maleficent
2: Mary Sanderson, Sarah Sanderson, Sanderson Sisters, Kiki, Wanda Maximoff/Scarlet Witch/Wanda, Agatha Harkness/Agatha, Ursula, Morgan le Fay/Morgana, Baba Yaga, Willow Rosenberg/Willow, Bellatrix Lestrange/Bellatrix, Minerva McGonagall/McGonagall, Mildred Hubble, Witch Hazel, Grandmama Addams, The White Witch/Jadis, Madam Mim, Yubaba, Zeena, Marnie Piper/Marnie, Luz Noceda/Luz, Eda Clawthorne/Eda
3: Circe, Hecate, Medea, Morgana Pendragon, The Witch of Endor/Witch of Endor, Nanny Ogg, Granny Weatherwax, Tiffany Aching, Hilda Spellman, Zelda Spellman, Samantha Stephens/Samantha, Endora, Tabitha, Prue Halliwell/Prue, Piper Halliwell/Piper, Phoebe Halliwell/Phoebe, Nancy Downs, Bayonetta, Sylvanas, Lilith, Mother Gothel, Grand High Witch, Miss Minchin, Hazel (Looney Tunes), Agnes Nutter, Akko Kagari, Atsuko
4: Tituba, Bridget Bishop, Sarah Good, Rebecca Nurse, Mother Shipton, Agnes Waterhouse, Isobel Gowdie, Alice Kyteler, Marie Laveau, Moll Dyer, Bell Witch, Black Aggie, Malin Matsdotter, The Pendle Witches/Pendle Witches, Margaret Jones
5: Anna Göldi/Anna Goldi, Agnes Sampson, Elizabeth Sawyer, Ursula Southeil, Katharina Kepler, Joan Wytte, Merga Bien, Grace Sherwood, Mary Webster, Goody Cole
` });

topic({ ...HALLOWEEN, id: 'hw-superstitions', noun: 'superstition', q: 'Name a **bad-luck superstition**.', strip: ['a', 'bad', 'luck'], list: `
1: Black Cat/Black Cat Crossing Your Path, Breaking a Mirror/Broken Mirror, Walking Under a Ladder/Ladder, Friday the 13th, Number 13/Thirteen/13, Opening an Umbrella Indoors/Umbrella Indoors
2: Spilling Salt/Spilled Salt, Stepping on a Crack/Step on a Crack, Knocking on Wood, Crossing Fingers, Rocking an Empty Rocking Chair/Empty Rocking Chair, Shoes on the Table, Saying Macbeth in a Theatre/Macbeth, Tuesday the 13th, Killing a Spider, Bird in the House, Owl Hooting, Itchy Palm, Breaking a Wish Bone, Hat on the Bed, Sleeping with Feet Toward the Door, Number 4/Four
3: Giving Knives as a Gift, Whistling Indoors, Seeing One Magpie/One Magpie, Raven on the Roof, Crow, Putting a Loaf Upside Down, Cutting Nails at Night, Pointing at the Moon, Stepping Over Someone, Leaving Scissors Open, Chopsticks Upright in Rice, Writing Names in Red, Sitting at the Corner of a Table, 666, Three on a Match
4: Hearing a Dog Howl at Night, Death Knock, Covering Mirrors, Holding Your Breath Past a Graveyard, Clock Stopping, Picture Falling Off the Wall, Dropping an Umbrella, Bed Facing the Door, Buying a Broom in May, Getting Out of Bed on the Left Side, Saying Goodbye Three Times
5: Bad Luck to Bring Eggs Aboard, Whistling on a Ship, Bananas on a Boat, Renaming a Boat, Seeing a Nun, Lighting Three Cigarettes, Sweeping After Dark, Shaving on a Friday
` });

topic({ ...HALLOWEEN, id: 'hw-traditions', noun: 'Halloween tradition', q: 'Name a **Halloween tradition or activity**.', strip: ['going', 'a', 'the'], list: `
1: Trick-or-Treating/Trick or Treating/Trick or Treat, Carving Pumpkins/Pumpkin Carving, Costume Party/Halloween Party, Dressing Up/Costumes, Haunted House, Scary Movies/Watching Scary Movies
2: Bobbing for Apples/Apple Bobbing, Hayride/Haunted Hayride, Corn Maze, Pumpkin Patch, Costume Contest, Trunk-or-Treat/Trunk or Treat, Ghost Stories/Telling Ghost Stories, Decorating, Bonfire, Candy Trading/Trading Candy, Pumpkin Picking, Apple Picking, Halloween Parade/Parade, Haunted Walk/Ghost Tour, Escape Room, Fright Night
3: Mischief Night, Devil's Night, Beggars' Night/Beggars Night, Toilet Papering/TPing, Egging, Seance, Ouija Board, Murder Mystery Party, Monster Mash Dance, Glow Stick Walk, Painting Pumpkins, Scavenger Hunt, Mummy Wrap Game, Pin the Wart on the Witch, Booing/You've Been Boo'd, Zombie Walk, Rocky Horror Showing/Rocky Horror, Haunted Corn Maze, Teal Pumpkin Project/Teal Pumpkin
4: Guising, Souling, Snap-Apple Night/Snap Apple Night, Barmbrack Fortune, Divination Games, Apple Peel Fortune, Mirror Divination, Dumb Supper, Mumming, Day of the Dead/Dia de los Muertos/Dia de Muertos, All Saints' Day/All Saints Day, All Souls' Day/All Souls Day, Samhain
5: Punkie Night, Nutcrack Night, Hop-tu-Naa, Allantide, Calan Gaeaf, Kalan Goañv, Ofrenda Building, Allhallowtide, Pangangaluwa, Hungry Ghost Festival, Obon, Chuseok, Pchum Ben, Walpurgis Night, Dziady, Radonitsa, Zaduszki
` });

topic({ ...HALLOWEEN, id: 'hw-pokemon', noun: 'Ghost-type Pokémon', q: 'Name a **Ghost-type Pokémon**.', strip: ['pokemon'], list: `
1: Gengar, Gastly, Haunter, Mimikyu
2: Duskull, Dusclops, Dusknoir, Shuppet, Banette, Misdreavus, Mismagius, Drifloon, Drifblim, Litwick, Lampent, Chandelure, Giratina, Dragapult, Sableye, Spiritomb, Froslass, Rotom, Marshadow, Lunala, Decidueye, Aegislash, Honedge, Doublade
3: Phantump, Trevenant, Pumpkaboo, Gourgeist, Yamask, Cofagrigus, Frillish, Jellicent, Golett, Golurk, Sandygast, Palossand, Dreepy, Drakloak, Sinistea, Polteageist, Cursola, Runerigus, Dhelmise, Blacephalon, Spectrier, Basculegion, Zorua (Hisuian)/Hisuian Zorua, Zoroark (Hisuian)/Hisuian Zoroark, Typhlosion (Hisuian)/Hisuian Typhlosion, Greavard, Houndstone, Ceruledge, Gholdengo, Gimmighoul, Skeledirge, Annihilape, Flutter Mane, Poltchageist, Sinistcha, Marowak (Alolan)/Alolan Marowak
4: Hoopa, Calyrex, Corsola (Galarian)/Galarian Corsola, Yamask (Galarian)/Galarian Yamask, Brambleghast, Bramblin
5: MissingNo/MissingNo., Ghost Marowak
` });

topic({ ...HALLOWEEN, id: 'hw-bugs', noun: 'creepy crawly', q: 'Name a **creepy crawly** (bug, spider or worm).', strip: ['a', 'the'], list: `
1: Spider, Ant, Fly, Cockroach/Roach, Worm, Beetle, Bee, Wasp, Mosquito, Caterpillar
2: Centipede, Millipede, Scorpion, Tarantula, Black Widow, Earwig, Maggot, Slug, Snail, Termite, Flea, Tick, Louse/Lice, Bed Bug/Bedbug, Moth, Cricket, Grasshopper, Praying Mantis/Mantis, Stink Bug, Silverfish, Ladybug/Ladybird, Firefly, Dragonfly, Leech, Earthworm, Hornet, Daddy Long Legs/Daddy Longlegs
3: Brown Recluse, Wolf Spider, Jumping Spider, Huntsman Spider/Huntsman, Funnel-Web Spider/Funnel Web, Orb Weaver, Trapdoor Spider, Camel Spider, Cicada, Weevil, Dung Beetle, Stag Beetle, Rhinoceros Beetle, Hercules Beetle, Goliath Beetle, Bullet Ant, Fire Ant, Army Ant, Mealworm, Woodlouse/Pill Bug/Roly Poly/Rolly Polly, Locust, Cave Cricket/Camel Cricket, Weta, Assassin Bug, Kissing Bug, Botfly, Horsefly, Mayfly, Lacewing, Termite Queen
4: Whip Scorpion, Vinegaroon, Harvestman, Pseudoscorpion, Amblypygi/Tailless Whip Scorpion, Velvet Ant, Tarantula Hawk, Giant Water Bug, Toe-Biter, Bombardier Beetle, Death Watch Beetle/Deathwatch Beetle, Tsetse Fly, Jerusalem Cricket, Giant Centipede, Peacock Spider, Goliath Birdeater, Bird-Dropping Spider, Spitting Spider, Bolas Spider, Diving Bell Spider
5: Ogre-Faced Spider, Assassin Spider/Pelican Spider, Darwin's Bark Spider, Trap-Jaw Ant, Dracula Ant, Zombie Ant, Bone-Eating Worm, Bobbit Worm, Ribbon Worm, Horsehair Worm, Velvet Worm, Bristle Worm, Screwworm, Tongue-Eating Louse
` });

topic({ ...HALLOWEEN, id: 'hw-days-dead', noun: 'holiday for the dead', q: 'Name a **holiday or festival that honours the dead or spirits**.', strip: ['day', 'festival', 'the'], list: `
1: Halloween, Day of the Dead/Dia de los Muertos/Dia de Muertos
2: All Saints' Day/All Saints Day/All Hallows' Day, All Souls' Day/All Souls Day, Samhain, Obon/Bon Festival/Bon, Ghost Festival/Hungry Ghost Festival, Qingming/Qingming Festival/Tomb-Sweeping Day/Tomb Sweeping Day, Chuseok
3: Pchum Ben, Walpurgis Night, Dziady, Radonitsa, Zaduszki, Allhallowtide, Gai Jatra, Pitru Paksha, Famadihana, Fet Gede/Fete Gede, Higan, Ullambana, Yue Lan
4: Lemuria, Parentalia, Anthesteria, Feralia, Awuru Odo, Odo Festival, Pangangaluwa, Undas, Toraja Ma'nene/Ma'nene, Gawai Antu, Kalan Goañv, Calan Gaeaf, Hop-tu-Naa
5: Hanal Pixán/Hanal Pixan, Fiesta de las Ñatitas/Natitas
` });

topic({ ...HALLOWEEN, id: 'hw-addams', noun: 'Addams Family member', q: 'Name a **member of the Addams Family**.', strip: ['addams', 'uncle', 'cousin'], list: `
1: Wednesday/Wednesday Addams/Wednesday Friday Addams, Morticia/Morticia Addams, Gomez/Gomez Addams, Pugsley/Pugsley Addams
2: Uncle Fester/Fester, Lurch, Thing, Grandmama/Grandmama Addams, Cousin Itt/Itt
3: Pubert, Ophelia, Kitty Kat, Cleopatra (plant)/Cleopatra, Debbie Jellinsky/Debbie, Enid Sinclair/Enid, Tyler Galpin, Xavier Thorpe, Larissa Weems, Bianca Barclay
4: Pugsley's Octopus/Aristotle, Aunt Ophelia, Granny Frump, Hester Frump, Margaret Addams, Lumpy
5: Esmeralda
` });

topic({ ...HALLOWEEN, id: 'hw-stephen-king', noun: 'Stephen King book', q: 'Name a **Stephen King book**.', strip: ['the', 'book', 'novel'], list: `
1: It, The Shining/Shining, Carrie, Misery, Pet Sematary
2: Cujo, Christine, The Stand/Stand, 'Salem's Lot/Salems Lot, The Green Mile/Green Mile, Doctor Sleep, The Dark Tower/Dark Tower, Firestarter, The Dead Zone/Dead Zone, 11/22/63, Under the Dome, The Mist/Mist, The Long Walk/Long Walk, The Running Man/Running Man, Rita Hayworth and Shawshank Redemption/Shawshank Redemption/Shawshank, The Body/Stand by Me
3: Needful Things, Dreamcatcher, Thinner, Gerald's Game, Dolores Claiborne, The Outsider/Outsider, The Institute/Institute, Holly, Billy Summers, Fairy Tale, Joyland, Revival, Mr. Mercedes/Mr Mercedes, Duma Key, Lisey's Story, Bag of Bones, Insomnia, Rose Madder, Desperation, The Tommyknockers/Tommyknockers, Cell, Later, Night Shift, Skeleton Crew, Different Seasons, The Talisman/Talisman, The Gunslinger/Gunslinger, 1408, Children of the Corn, Apt Pupil, Never Flinch, Elevation, If It Bleeds, Sleeping Beauties
4: The Eyes of the Dragon/Eyes of the Dragon, The Regulators/Regulators, The Girl Who Loved Tom Gordon, Hearts in Atlantis, From a Buick 8, Blaze, Rage, Roadwork, Cycle of the Werewolf, The Colorado Kid, Finders Keepers, End of Watch, Gwendy's Button Box, The Drawing of the Three, The Waste Lands, Wizard and Glass, Wolves of the Calla, Song of Susannah, Black House, Four Past Midnight, Nightmares & Dreamscapes, Everything's Eventual, Full Dark, No Stars, Just After Sunset, The Bazaar of Bad Dreams
5: The Plant, Faithful, Danse Macabre, On Writing, The Wind Through the Keyhole, Rose Red, Storm of the Century, Golden Years, The Dark Half/Dark Half, Hearts in Suspension, Guns
` });

topic({ ...HALLOWEEN, id: 'hw-haunted-house', noun: 'thing in a haunted house', q: 'Name **something you\'d find in a haunted house**.', strip: ['a', 'an', 'the', 'some', 'creepy', 'old', 'spooky'], list: `
1: Ghost/Ghosts, Cobwebs/Spider Webs/Cobweb, Spiders/Spider, Bats/Bat, Skeleton, Creaky Stairs/Creaky Floor/Creaky Door, Coffin, Candles/Candle, Dust
2: Portrait/Painting/Creepy Painting, Mirror, Chandelier, Rocking Chair, Doll/Creepy Doll, Attic, Basement/Cellar, Secret Passage/Secret Door/Hidden Door, Grandfather Clock/Clock, Piano, Fireplace, Rats/Rat, Skull, Chains, Ouija Board, Music Box, Suit of Armor/Armor, Bookcase/Bookshelf, Candelabra, Trapdoor/Trap Door, Broken Window, Sheets/Dust Sheets
3: Dumbwaiter, Crypt, Tombstone, Raven, Owl, Black Cat, Mannequin, Taxidermy/Stuffed Animal/Mounted Head, Moose Head, Old Photos/Photographs, Cold Spot/Cold Spots, Footsteps, Whispers, Flickering Lights, Poltergeist, Butler, Gargoyle, Organ/Pipe Organ, Gramophone/Phonograph, Wheelchair, Crib, Rocking Horse, Dollhouse, Hidden Room, Iron Gate, Seance Table
4: Spirit Box, EMF Meter/EMF Reader, Ectoplasm, Orb/Orbs, Planchette, Hidden Staircase, Widow's Walk, Servants' Bells/Servant Bells, Speaking Tube, Mourning Portrait, Death Mask, Hair Wreath, Memento Mori
5: Priest Hole, Witch Marks, Apotropaic Marks, Concealed Shoe, Witch Bottle, Bricked-Up Room, Oubliette
` });

topic({ ...HALLOWEEN, id: 'hw-orange', noun: 'orange thing', q: 'Name **something that\'s orange**.', strip: ['a', 'an', 'the', 'orange'], list: `
1: Pumpkin, Carrot, Orange, Basketball, Traffic Cone/Cone, Goldfish, Tiger, Fox, Sunset, Fire, Cheetos, Fanta, Candy Corn
2: Clownfish/Nemo, Garfield, Tangerine/Clementine/Mandarin, Sweet Potato, Mango, Peach, Apricot, Cantaloupe, Monarch Butterfly, Orangutan, Koi, Butternut Squash, Cheddar Cheese/Cheddar, Mac and Cheese, Reese's, Crayon, Life Jacket, Hunter's Vest/Safety Vest/Hi-Vis Vest, Prison Jumpsuit, Nickelodeon Splat, Home Depot, Harley-Davidson, Charmander, Doritos, 
3: Papaya, Persimmon, Kumquat, Marigold, Tiger Lily, Poppy, Bird of Paradise, Fox Squirrel, Red Panda, Robin's Breast, Oriole, Flamingo Chick, Lava, Rust, Copper, Amber, Carnelian, Golden Gate Bridge, Tang, Orange Crush, Irn-Bru/Irn Bru, Aperol Spritz/Aperol, Sriracha, Cheez-Its/Cheez Its, Goldfish Crackers, Orange Soda, Creamsicle, Dreamsicle, Nacho Cheese, Annatto, Turmeric, Paprika, Saffron, Salmon, Lobster (cooked), Shrimp (cooked)
4: Sea Buckthorn, Cloudberry, Physalis/Cape Gooseberry, Sea Urchin/Uni, Fire Salamander, Golden Toad, Cock-of-the-Rock, Orange Roughy, Garibaldi, Monarch Caterpillar, Oregon State Beavers, Clemson, Tennessee Volunteers, Netherlands Football Kit/Dutch Kit, Agent Orange, Orange Julius, Big Bird's Legs
5: Vermilion, Minium, Realgar, Orpiment, Wulfenite, Crocoite, Spessartine, Mandarin Garnet, Sunstone, Fire Opal
` });

topic({ ...HALLOWEEN, id: 'hw-skeleton', noun: 'bone in the body', q: 'Name a **bone in a skeleton**.', strip: ['bone', 'the'], list: `
1: Skull, Rib/Ribs, Spine/Backbone, Femur/Thigh Bone, Jaw/Jawbone
2: Pelvis/Hip Bone/Hips, Collarbone/Clavicle, Shoulder Blade/Scapula, Kneecap/Patella, Tibia/Shin Bone/Shinbone, Humerus/Funny Bone, Vertebra/Vertebrae, Sternum/Breastbone, Fibula, Radius, Ulna, Mandible, Tailbone/Coccyx, Cranium, Phalanges/Finger Bones/Toe Bones, Ankle
3: Metacarpals/Metacarpal, Metatarsals/Metatarsal, Carpals/Carpal, Tarsals/Tarsal, Sacrum, Maxilla, Hyoid, Temporal Bone, Frontal Bone, Parietal Bone, Occipital Bone, Zygomatic/Cheekbone, Nasal Bone, Calcaneus/Heel Bone, Talus, Atlas, Axis, Ilium, Ischium, Pubis
4: Stapes/Stirrup, Incus/Anvil, Malleus/Hammer, Sphenoid, Ethmoid, Vomer, Lacrimal, Palatine, Scaphoid, Lunate, Triquetrum, Pisiform, Trapezium, Trapezoid, Capitate, Hamate, Cuboid, Navicular, Cuneiform
5: Sesamoid, Fabella, Os Trigonum, Wormian Bone, Lunule, Inca Bone, Os Acromiale
` });

topic({ ...HALLOWEEN, id: 'hw-pumpkin-faces', noun: 'jack-o\'-lantern design', q: 'Name **something you could carve into a pumpkin**.', strip: ['a', 'an', 'the', 'face'], list: `
1: Face/Scary Face/Smiley Face, Ghost, Bat, Cat/Black Cat, Witch, Skull, Spider, Moon
2: Spider Web/Web, Owl, Star/Stars, Heart, Vampire, Zombie, Monster, Mummy, Skeleton, Haunted House, Tombstone, Wolf, Name/Your Name, Letters, Pikachu, Mickey Mouse, Jack Skellington, Minion, Batman Logo, Snake, Dog
3: Raven/Crow, Frankenstein, Cauldron, Broomstick/Broom, Coffin, Eyeball/Eyes, Creeper (Minecraft)/Creeper, Ghostface, Pennywise, Stitch, Totoro, Darth Vader, Death Star, Grogu/Baby Yoda, Groot, Michael Myers, Jason Mask, Freddy Krueger, Cheshire Cat, Hogwarts Crest, Harry Potter Scar, Dragon, Kraken/Octopus, Shark, Unicorn
4: Starry Night, Mona Lisa, Medusa, Day of the Dead Skull/Sugar Skull, Plague Doctor, Lighthouse, Constellation, Mandala, Celtic Knot, Chandelier
5: Turnip Lantern, Hokusai Wave/Great Wave, Escher Staircase, Lovecraft's Cthulhu/Cthulhu, Tessellation
` });
