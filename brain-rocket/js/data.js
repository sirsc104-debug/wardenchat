/* Brain Rocket — question topics and answer lists.
 *
 * Each topic: { id, name, icon, level, q, list, strip? }
 *   level  1 = everyday (Owen/Easy), 2 = mixed, 3 = expert
 *   q      the question; **double stars** mark the highlighted words
 *   noun   used for letter questions: "Name a <noun> that starts with B"
 *   strip  extra words players may add that should be ignored ("dog" in "beagle dog")
 *   list   one answer per line as "<tier> Name/alias/alias", or a whole tier per line
 *          as "<tier>: Name/alias, Name, Name".
 * Tier 1 = everyone says it (Common) … 5 = very niche (Legendary).
 * The other topic files add to TOPICS with topic({...}).
 */
'use strict';

const TOPICS = [];
const topic = t => TOPICS.push(t);

const BASE_TOPICS = {
  countries: {
    name: 'Countries', noun: 'country', icon: '🌍', level: 1, q: 'Name a **country**.',
    list: `
1 United States/America/USA/US/United States of America
1 China
1 Canada
1 Mexico
1 Brazil
1 France
1 Germany
1 Italy
1 Spain
1 Japan
1 India
1 Russia
1 Australia
1 United Kingdom/UK/Britain/Great Britain
1 England
2 Scotland
2 Wales
2 Ireland
2 Egypt
2 Argentina
2 Portugal
2 Greece
2 Sweden
2 Norway
2 Netherlands/Holland
2 Switzerland
2 South Korea/Korea
2 North Korea
2 Turkey/Turkiye
2 Israel
2 Iran
2 Iraq
2 Saudi Arabia
2 South Africa
2 Nigeria
2 Kenya
2 Peru
2 Chile
2 Colombia
2 Cuba
2 Jamaica
2 Poland
2 Ukraine
2 Vietnam
2 Thailand
2 Philippines
2 Indonesia
2 Pakistan
2 Afghanistan
2 New Zealand
2 Denmark
2 Finland
2 Belgium
2 Austria
2 Iceland
2 Morocco
2 Venezuela
2 Singapore
3 Ethiopia
3 Bangladesh
3 Nepal
3 Sri Lanka
3 Malaysia
3 Cambodia
3 Laos
3 Myanmar/Burma
3 Mongolia
3 Kazakhstan
3 Uzbekistan
3 Syria
3 Lebanon
3 Jordan
3 Kuwait
3 Qatar
3 United Arab Emirates/UAE
3 Oman
3 Yemen
3 Hungary
3 Czech Republic/Czechia
3 Slovakia
3 Romania
3 Bulgaria
3 Serbia
3 Croatia
3 Bosnia and Herzegovina/Bosnia
3 Albania
3 Slovenia
3 Estonia
3 Latvia
3 Lithuania
3 Belarus
3 Moldova
3 Georgia
3 Armenia
3 Azerbaijan
3 Luxembourg
3 Monaco
3 Malta
3 Cyprus
3 Ecuador
3 Bolivia
3 Paraguay
3 Uruguay
3 Panama
3 Costa Rica
3 Honduras
3 Guatemala
3 Nicaragua
3 El Salvador
3 Haiti
3 Dominican Republic
3 Bahamas
3 Algeria
3 Tunisia
3 Libya
3 Sudan
3 Ghana
3 Senegal
3 Tanzania
3 Uganda
3 Rwanda
3 Somalia
3 Zimbabwe
3 Zambia
3 Madagascar
3 Angola
3 Cameroon
3 Republic of the Congo/Congo
3 Fiji
3 Taiwan
3 Northern Ireland
4 Kyrgyzstan
4 Tajikistan
4 Turkmenistan
4 Bhutan
4 Brunei
4 East Timor/Timor Leste
4 Maldives
4 Bahrain
4 North Macedonia/Macedonia
4 Montenegro
4 Kosovo
4 Andorra
4 Liechtenstein
4 San Marino
4 Vatican City/Vatican/Holy See
4 Belize
4 Guyana
4 Suriname
4 Trinidad and Tobago/Trinidad
4 Barbados
4 Grenada
4 Mali
4 Niger
4 Chad
4 Mauritania
4 Burkina Faso
4 Benin
4 Togo
4 Ivory Coast/Cote d'Ivoire
4 Liberia
4 Sierra Leone
4 Guinea
4 Gambia
4 Gabon
4 Botswana
4 Namibia
4 Mozambique
4 Malawi
4 Lesotho
4 Eswatini/Swaziland
4 Eritrea
4 Djibouti
4 South Sudan
4 Central African Republic
4 Democratic Republic of the Congo/DR Congo/DRC
4 Papua New Guinea
4 Samoa
4 Tonga
4 Mauritius
4 Seychelles
4 Cape Verde/Cabo Verde
4 Equatorial Guinea
4 Burundi
5 Guinea-Bissau
5 Sao Tome and Principe
5 Comoros
5 Kiribati
5 Tuvalu
5 Nauru
5 Palau
5 Marshall Islands
5 Micronesia
5 Vanuatu
5 Solomon Islands
5 Saint Kitts and Nevis/St Kitts and Nevis
5 Saint Lucia/St Lucia
5 Saint Vincent and the Grenadines/St Vincent and the Grenadines
5 Antigua and Barbuda
5 Dominica
`
  },

  animals: {
    name: 'Animals', noun: 'animal', icon: '🐾', level: 1, q: 'Name an **animal**.',
    list: `
1 Dog/Puppy
1 Cat/Kitten
1 Cow
1 Pig
1 Horse
1 Sheep
1 Chicken/Hen/Rooster
1 Duck
1 Lion
1 Tiger
1 Bear
1 Elephant
1 Monkey
1 Giraffe
1 Zebra
1 Rabbit/Bunny
1 Mouse
1 Fish
1 Bird
1 Snake
1 Frog
1 Shark
1 Whale
1 Dolphin
1 Fox
1 Wolf
1 Deer
1 Goat
1 Owl
1 Eagle
1 Penguin
1 Kangaroo
1 Panda
1 Crocodile
1 Turtle
1 Spider
1 Bee
1 Butterfly
1 Ant
1 Donkey/Ass
1 Camel
1 Gorilla
1 Hippopotamus/Hippo
1 Rhinoceros/Rhino
1 Squirrel
1 Parrot
2 Alligator
2 Cheetah
2 Leopard
2 Jaguar
2 Koala
2 Sloth
2 Octopus
2 Jellyfish
2 Seal
2 Walrus
2 Otter
2 Beaver
2 Raccoon
2 Skunk
2 Hedgehog
2 Hamster
2 Guinea Pig
2 Bat
2 Flamingo
2 Swan
2 Goose
2 Turkey
2 Peacock
2 Pigeon
2 Crow
2 Robin
2 Hawk
2 Falcon
2 Lizard
2 Chameleon
2 Iguana
2 Gecko
2 Toad
2 Salmon
2 Tuna
2 Goldfish
2 Crab
2 Lobster
2 Shrimp/Prawn
2 Starfish
2 Snail
2 Worm
2 Ladybug/Ladybird
2 Dragonfly
2 Mosquito
2 Fly
2 Beetle
2 Moose
2 Elk
2 Buffalo
2 Bison
2 Llama
2 Alpaca
2 Ostrich
2 Polar Bear
2 Chimpanzee/Chimp
2 Orangutan
2 Hyena
2 Lynx
2 Panther
2 Puma/Cougar/Mountain Lion
2 Coyote
2 Mole
2 Rat
2 Badger
2 Seahorse
2 Stingray
2 Pelican
2 Woodpecker
2 Hummingbird
2 Scorpion
2 Grasshopper
2 Caterpillar
2 Reindeer
2 Ox
2 Emu
2 Pony
2 Lamb
2 Blue Whale
3 Armadillo
3 Anteater
3 Porcupine
3 Platypus
3 Meerkat
3 Mongoose
3 Wombat
3 Wallaby
3 Tapir
3 Warthog
3 Antelope
3 Gazelle
3 Impala
3 Wildebeest/Gnu
3 Okapi
3 Lemur
3 Baboon
3 Gibbon
3 Mandrill
3 Narwhal
3 Manatee
3 Orca/Killer Whale
3 Barracuda
3 Piranha
3 Eel
3 Catfish
3 Swordfish
3 Pufferfish/Blowfish
3 Clownfish
3 Squid
3 Cuttlefish
3 Oyster
3 Clam
3 Mussel
3 Sea Urchin
3 Cobra
3 Python
3 Rattlesnake
3 Viper
3 Anaconda
3 Boa/Boa Constrictor
3 Tortoise
3 Komodo Dragon
3 Salamander
3 Newt
3 Axolotl
3 Vulture
3 Condor
3 Albatross
3 Toucan
3 Macaw
3 Cockatoo
3 Crane
3 Heron
3 Stork
3 Puffin
3 Seagull/Gull
3 Sparrow
3 Finch
3 Canary
3 Magpie
3 Raven
3 Blue Jay/Jay
3 Cardinal
3 Ferret
3 Chinchilla
3 Weasel
3 Stoat
3 Mink
3 Yak
3 Hare
3 Chipmunk
3 Opossum/Possum
3 Red Panda
3 Snow Leopard
3 Ocelot
3 Bobcat
3 Jackal
3 Dingo
3 Termite
3 Wasp
3 Hornet
3 Moth
3 Cricket
3 Cockroach
3 Flea
3 Tick
3 Centipede
3 Millipede
3 Slug
3 Tarantula
3 Praying Mantis/Mantis
3 Firefly
3 Mule
3 Quail
3 Pheasant
3 Partridge
3 Ibex
3 Capybara
3 Koi
3 Trout
3 Cod
3 Sardine
3 Herring
3 Mackerel
3 Halibut
3 Flounder
3 Hammerhead/Hammerhead Shark
3 Manta Ray
3 Sea Lion
3 Beluga
3 Humpback Whale/Humpback
3 Locust
3 Gerbil
3 Kiwi
3 Muskox/Musk Ox
4 Aardvark
4 Pangolin
4 Echidna
4 Quokka
4 Quoll
4 Tarsier
4 Loris
4 Marmoset
4 Capuchin
4 Kinkajou
4 Coati
4 Binturong
4 Fossa
4 Civet
4 Genet
4 Serval
4 Caracal
4 Margay
4 Dik-dik
4 Kudu
4 Eland
4 Oryx
4 Springbok
4 Gerenuk
4 Bongo
4 Nilgai
4 Gaur
4 Dugong
4 Dhole
4 Cassowary
4 Kookaburra
4 Shoebill
4 Secretary Bird
4 Lyrebird
4 Bowerbird
4 Frigatebird
4 Booby
4 Cormorant
4 Kingfisher
4 Hoopoe
4 Nightingale
4 Wren
4 Starling
4 Oriole
4 Warbler
4 Egret
4 Ibis
4 Spoonbill
4 Roadrunner
4 Gharial
4 Caiman
4 Monitor Lizard
4 Basilisk
4 Skink
4 Mamba
4 Adder
4 Krait
4 Gila Monster
4 Mudskipper
4 Lamprey
4 Hagfish
4 Sturgeon
4 Grouper
4 Marlin
4 Nautilus
4 Krill
4 Barnacle
4 Sea Anemone/Anemone
4 Weevil
4 Cicada
4 Earwig
4 Silverfish
4 Damselfly
4 Katydid
4 Peccary
4 Agouti
4 Hyrax
4 Jerboa
4 Vole
4 Shrew
4 Lemming
4 Marmot
4 Pika
4 Wolverine
4 Ermine
4 Marten
4 Chamois
4 Bandicoot
4 Fennec Fox/Fennec
4 Zebu
4 Blobfish
4 Sunfish/Mola
4 Tamarin
4 Mandarin Duck
4 Bilby
4 Numbat
4 Anchovy
5 Solenodon
5 Olm
5 Saola
5 Babirusa
5 Markhor
5 Zorilla
5 Kakapo
5 Takahe
5 Quetzal
5 Potoo
5 Hoatzin
5 Aye-aye
5 Tenrec
5 Cuscus
5 Colugo
5 Uakari
5 Gelada
5 Sifaka
5 Indri
5 Frogfish
5 Wobbegong
5 Oarfish
5 Hellbender
5 Caecilian
5 Tuatara
5 Coelacanth
5 Takin
5 Saiga
5 Banteng
5 Vaquita
5 Xerus
5 Jabiru
5 Umbrellabird
5 Yapok
5 Zokor
5 Dibbler
5 Gundi
`
  },

  fruitveg: {
    name: 'Fruit & Veg', noun: 'fruit or vegetable', icon: '🍓', level: 1, q: 'Name a **fruit or vegetable**.',
    list: `
1 Apple
1 Banana
1 Orange
1 Grape
1 Strawberry
1 Watermelon
1 Lemon
1 Pear
1 Peach
1 Cherry
1 Pineapple
1 Carrot
1 Potato
1 Tomato
1 Corn/Sweetcorn
1 Lettuce
1 Broccoli
1 Onion
1 Cucumber
1 Pea
1 Mango
1 Blueberry
1 Lime
1 Pumpkin
1 Bean
1 Coconut
2 Raspberry
2 Blackberry
2 Plum
2 Kiwi/Kiwi Fruit
2 Melon
2 Cantaloupe
2 Honeydew
2 Apricot
2 Grapefruit
2 Papaya
2 Avocado
2 Pomegranate
2 Cranberry
2 Fig
2 Date
2 Nectarine
2 Tangerine
2 Clementine
2 Mandarin
2 Spinach
2 Cabbage
2 Cauliflower
2 Celery
2 Garlic
2 Pepper/Bell Pepper
2 Mushroom
2 Zucchini/Courgette
2 Eggplant/Aubergine
2 Sweet Potato
2 Radish
2 Beet/Beetroot
2 Asparagus
2 Kale
2 Green Bean
2 Olive
2 Chili/Chilli/Chile
2 Squash
2 Ginger
3 Passion Fruit
3 Dragon Fruit/Pitaya
3 Lychee
3 Guava
3 Persimmon
3 Quince
3 Gooseberry
3 Elderberry
3 Mulberry
3 Boysenberry
3 Currant/Blackcurrant/Redcurrant
3 Kumquat
3 Starfruit/Carambola
3 Jackfruit
3 Plantain
3 Rhubarb
3 Artichoke
3 Brussels Sprout/Sprout
3 Leek
3 Parsnip
3 Turnip
3 Rutabaga/Swede
3 Shallot
3 Scallion/Spring Onion/Green Onion
3 Okra
3 Bok Choy/Pak Choi
3 Arugula/Rocket
3 Endive
3 Watercress
3 Chard/Swiss Chard
3 Fennel
3 Yam
3 Cassava/Yuca
3 Taro
3 Jalapeno
3 Habanero
3 Edamame
3 Chickpea/Garbanzo
3 Lentil
3 Butternut Squash
3 Horseradish
3 Pomelo
3 Prune
3 Raisin
3 Sultana
3 Huckleberry
3 Black Bean
3 Kidney Bean
3 Cherry Tomato
4 Durian
4 Rambutan
4 Mangosteen
4 Longan
4 Loquat
4 Feijoa
4 Salak/Snake Fruit
4 Tamarind
4 Ackee
4 Breadfruit
4 Soursop
4 Cherimoya
4 Sapodilla
4 Pawpaw
4 Medlar
4 Yuzu
4 Bergamot
4 Calamansi
4 Ugli Fruit
4 Jabuticaba
4 Lingonberry
4 Cloudberry
4 Physalis
4 Tomatillo
4 Jicama
4 Celeriac
4 Salsify
4 Sunchoke/Jerusalem Artichoke
4 Daikon
4 Romanesco
4 Radicchio
4 Mizuna
4 Tatsoi
4 Samphire
4 Fiddlehead
4 Chayote
4 Kabocha
4 Lotus Root
4 Burdock
4 Galangal
4 Wasabi
4 Nopal/Nopales
4 Mung Bean
4 Fava Bean/Broad Bean
4 Lima Bean
4 Kohlrabi
4 Acorn Squash
4 Kiwano/Horned Melon
5 Cupuacu
5 Lucuma
5 Mamey/Mamey Sapote
5 Pitanga/Surinam Cherry
5 Salal
5 Akebia
5 Santol
5 Langsat
5 Marang
5 Bael
5 Miracle Fruit/Miracle Berry
5 Cardoon
5 Oca
5 Ulluco
5 Mashua
5 Yacon
5 Skirret
5 Scorzonera
5 Crosne
5 Kai Lan/Gai Lan
5 Etrog
5 Ximenia
5 Jujube
5 Quandong
5 Babaco
5 Naranjilla
5 Wineberry
`
  },

  sports: {
    name: 'Sports', noun: 'sport', icon: '🏅', level: 1, q: 'Name a **sport**.',
    list: `
1 Soccer/Football
1 Basketball
1 Baseball
1 Tennis
1 Golf
1 Swimming
1 Running
1 Hockey/Ice Hockey
1 Volleyball
1 Boxing
1 Cycling
1 Skiing
1 Skateboarding
1 Surfing
1 Bowling
2 Rugby
2 Cricket
2 Badminton
2 Table Tennis/Ping Pong
2 Wrestling
2 Gymnastics
2 Karate
2 Judo
2 Taekwondo
2 Snowboarding
2 Ice Skating/Skating
2 Figure Skating
2 Softball
2 Lacrosse
2 Archery
2 Fencing
2 Rowing
2 Sailing
2 Diving
2 Rock Climbing/Climbing
2 Dodgeball
2 Kickball
2 Handball
2 Water Polo
2 Motocross
2 Formula One/Formula 1/F1/Motor Racing/Car Racing
2 Horse Racing
2 Darts
2 Snooker
2 Pool/Billiards
2 Chess
2 Triathlon
2 Polo
2 Netball
2 American Football
2 Marathon
2 Track and Field/Athletics
3 Curling
3 Bobsled/Bobsleigh
3 Luge
3 Skeleton
3 Biathlon
3 Pentathlon/Modern Pentathlon
3 Decathlon
3 Heptathlon
3 Javelin
3 Discus
3 Shot Put
3 Pole Vault
3 High Jump
3 Long Jump
3 Triple Jump
3 Hurdles
3 Weightlifting
3 Powerlifting
3 Bodybuilding
3 Squash
3 Racquetball
3 Pickleball
3 Croquet
3 Kayaking
3 Canoeing
3 Rafting/White Water Rafting
3 Kitesurfing
3 Windsurfing
3 Wakeboarding
3 Parkour
3 Ultimate Frisbee/Ultimate/Frisbee
3 Disc Golf
3 BMX
3 Mountain Biking
3 Trampolining/Trampoline
3 Kickboxing
3 MMA/Mixed Martial Arts
3 Sumo/Sumo Wrestling
3 Aikido
3 Kung Fu
3 Jiu Jitsu/Brazilian Jiu Jitsu
3 Muay Thai
3 Capoeira
3 Hurling
3 Gaelic Football
3 Australian Rules Football/Aussie Rules/AFL
3 Field Hockey
3 Orienteering
3 Paragliding
3 Skydiving
3 Bungee Jumping
3 Snorkeling/Snorkelling
3 Scuba Diving
3 Roller Derby
3 Ski Jumping
3 Cross Country Skiing
3 Rodeo
3 Dressage
3 Show Jumping
3 Steeplechase
3 Beach Volleyball
3 Petanque/Boules
3 Bocce
3 Cornhole
3 Synchronized Swimming/Artistic Swimming
3 Speed Skating
3 Water Skiing
3 Sprinting
4 Sepak Takraw
4 Kabaddi
4 Shinty
4 Camogie
4 Korfball
4 Floorball
4 Bandy
4 Jai Alai/Pelota
4 Buzkashi
4 Teqball
4 Footvolley
4 Underwater Hockey
4 Quidditch/Quadball
4 Sambo
4 Savate
4 Canyoning
4 Caving/Spelunking
4 Coasteering
4 Sandboarding
4 Zorbing
4 Tchoukball
4 Kendo
4 Wushu
4 Hapkido
4 Bossaball
4 Kho Kho
4 Lawn Bowls
4 Skijoring
4 Hang Gliding
4 Slacklining
4 Freediving
5 Fives
5 Real Tennis
5 Rackets
5 Pato
5 Gilli Danda
5 Cheese Rolling
5 Toe Wrestling
5 Bog Snorkelling
5 Wife Carrying
5 Chess Boxing/Chessboxing
5 Underwater Rugby
5 Octopush
5 Bo Taoshi
5 Yukigassen
5 Eton Wall Game
5 Pesapallo
5 Calcio Storico
5 Hornussen
5 Kinball
5 Xare
`
  },

  capitals: {
    name: 'Capital Cities', noun: 'capital city', icon: '🏛️', level: 2, q: 'Name the **capital city** of any country.',
    list: `
1 London
1 Paris
1 Washington/Washington DC
1 Tokyo
1 Rome
1 Berlin
1 Madrid
1 Beijing
1 Moscow
1 Ottawa
1 Mexico City
1 Cairo
2 Dublin
2 Lisbon
2 Athens
2 Amsterdam
2 Brussels
2 Vienna
2 Stockholm
2 Oslo
2 Copenhagen
2 Helsinki
2 Warsaw
2 Prague
2 Budapest
2 New Delhi/Delhi
2 Seoul
2 Bangkok
2 Canberra
2 Wellington
2 Buenos Aires
2 Lima
2 Santiago
2 Havana
2 Jerusalem
2 Nairobi
2 Edinburgh
2 Cardiff
3 Bern
3 Ankara
3 Tehran
3 Baghdad
3 Riyadh
3 Doha
3 Abu Dhabi
3 Muscat
3 Kabul
3 Islamabad
3 Kathmandu
3 Dhaka
3 Hanoi
3 Manila
3 Jakarta
3 Kuala Lumpur
3 Taipei
3 Bogota
3 Caracas
3 Quito
3 La Paz/Sucre
3 Montevideo
3 Asuncion
3 Brasilia
3 Panama City
3 San Jose
3 Kingston
3 Nassau
3 Reykjavik
3 Bucharest
3 Sofia
3 Belgrade
3 Zagreb
3 Kyiv/Kiev
3 Minsk
3 Vilnius
3 Riga
3 Tallinn
3 Bratislava
3 Ljubljana
3 Valletta
3 Nicosia
3 Luxembourg
3 Monaco
3 Damascus
3 Beirut
3 Amman
3 Algiers
3 Tunis
3 Rabat
3 Tripoli
3 Khartoum
3 Addis Ababa
3 Accra
3 Abuja
3 Dakar
3 Pretoria/Cape Town/Bloemfontein
3 Kampala
3 Kigali
3 Harare
3 Luanda
3 Belfast
3 Tbilisi
3 Yerevan
3 Baku
3 Phnom Penh
3 Colombo
3 Singapore
3 Kuwait City
3 Pyongyang
4 Ulaanbaatar/Ulan Bator
4 Astana
4 Tashkent
4 Bishkek
4 Dushanbe
4 Ashgabat
4 Thimphu
4 Bandar Seri Begawan
4 Dili
4 Male
4 Manama
4 Sanaa
4 Skopje
4 Podgorica
4 Pristina
4 Tirana
4 Sarajevo
4 Chisinau
4 Andorra la Vella
4 Vaduz
4 San Marino
4 Vatican City
4 Belmopan
4 Georgetown
4 Paramaribo
4 Port of Spain
4 Bridgetown
4 Tegucigalpa
4 Managua
4 Guatemala City
4 San Salvador
4 Port au Prince
4 Santo Domingo
4 Bamako
4 Niamey
4 Ndjamena
4 Nouakchott
4 Ouagadougou
4 Porto Novo
4 Lome
4 Yamoussoukro
4 Monrovia
4 Freetown
4 Conakry
4 Banjul
4 Libreville
4 Gaborone
4 Windhoek
4 Maputo
4 Lilongwe
4 Maseru
4 Mbabane
4 Asmara
4 Djibouti
4 Juba
4 Bangui
4 Kinshasa
4 Brazzaville
4 Yaounde
4 Antananarivo
4 Mogadishu
4 Lusaka
4 Dodoma
4 Port Moresby
4 Suva
4 Apia
4 Nukualofa
4 Port Louis
4 Victoria
4 Praia
4 Malabo
4 Gitega
4 Naypyidaw
4 Vientiane
5 Bissau
5 Sao Tome
5 Moroni
5 Tarawa/South Tarawa
5 Funafuti
5 Yaren
5 Ngerulmud
5 Majuro
5 Palikir
5 Port Vila
5 Honiara
5 Basseterre
5 Castries
5 Kingstown
5 Saint Johns/St Johns
5 Roseau
5 Sri Jayawardenepura Kotte/Kotte
5 Saint Georges/St Georges
`
  },

  elements: {
    name: 'Chemical Elements', noun: 'chemical element', icon: '⚗️', level: 3, q: 'Name a **chemical element**.',
    list: `
1 Hydrogen
1 Helium
1 Carbon
1 Oxygen
1 Nitrogen
1 Iron
1 Gold
1 Silver
1 Copper
1 Aluminum/Aluminium
2 Lead
2 Zinc
2 Tin
2 Sodium
2 Calcium
2 Potassium
2 Chlorine
2 Neon
2 Uranium
2 Platinum
2 Mercury
2 Nickel
2 Sulfur/Sulphur
2 Silicon
2 Magnesium
2 Lithium
2 Plutonium
2 Titanium
2 Fluorine
2 Iodine
2 Phosphorus
2 Argon
3 Boron
3 Beryllium
3 Krypton
3 Xenon
3 Radon
3 Cobalt
3 Chromium
3 Manganese
3 Tungsten
3 Arsenic
3 Bromine
3 Radium
3 Barium
3 Bismuth
3 Cadmium
3 Palladium
3 Iridium
3 Cesium/Caesium
3 Strontium
3 Selenium
3 Antimony
3 Vanadium
3 Zirconium
3 Molybdenum
3 Polonium
3 Francium
3 Americium
3 Einsteinium
3 Nobelium
3 Gallium
3 Germanium
3 Thorium
3 Neptunium
4 Scandium
4 Rubidium
4 Yttrium
4 Niobium
4 Technetium
4 Ruthenium
4 Rhodium
4 Indium
4 Tellurium
4 Lanthanum
4 Cerium
4 Neodymium
4 Europium
4 Gadolinium
4 Hafnium
4 Tantalum
4 Rhenium
4 Osmium
4 Thallium
4 Astatine
4 Actinium
4 Curium
4 Berkelium
4 Californium
4 Fermium
4 Mendelevium
4 Lawrencium
4 Promethium
4 Samarium
4 Dysprosium
4 Ytterbium
4 Oganesson
4 Tennessine
4 Copernicium
4 Flerovium
5 Terbium
5 Holmium
5 Erbium
5 Thulium
5 Lutetium
5 Praseodymium
5 Protactinium
5 Rutherfordium
5 Dubnium
5 Seaborgium
5 Bohrium
5 Hassium
5 Meitnerium
5 Darmstadtium
5 Roentgenium
5 Nihonium
5 Moscovium
5 Livermorium
`
  }
};

Object.entries(BASE_TOPICS).forEach(([id, t]) => topic({ id, ...t }));

/* Places the rocket passes. `pts` is the score needed to reach it; `alt` is where it sits
 * in the scene (the game maps score to altitude between these pairs). */
const MILESTONES = [
  { alt: 0,     pts: 0,      name: 'Launch Pad',            icon: '🏁', km: 0 },
  { alt: 120,   pts: 150,    name: 'The Clouds',            icon: '☁️', km: 10 },
  { alt: 330,   pts: 450,    name: 'Outer Space',           icon: '🌌', km: 100 },
  { alt: 460,   pts: 750,    name: 'Space Station',         icon: '🛰️', km: 408, body: 'iss', bx: 820, r: 120 },
  { alt: 700,   pts: 1400,   name: 'The Moon',              icon: '🌕', km: 384400, body: 'moon', bx: 250, r: 170 },
  { alt: 1800,  pts: 3200,   name: 'Mars',                  icon: '🔴', km: 225e6, body: 'mars', bx: 300, r: 150 },
  { alt: 2800,  pts: 5000,   name: 'Asteroid Belt',         icon: '🪨', km: 4.1e8 },
  { alt: 3800,  pts: 7000,   name: 'Jupiter',               icon: '🟠', km: 6.28e8, body: 'jupiter', bx: 200, r: 250 },
  { alt: 5200,  pts: 9500,   name: 'Saturn',                icon: '🪐', km: 1.28e9, body: 'saturn', bx: 280, r: 160 },
  { alt: 6800,  pts: 12500,  name: 'Uranus',                icon: '🧊', km: 2.72e9, body: 'uranus', bx: 260, r: 125 },
  { alt: 8400,  pts: 15500,  name: 'Neptune',               icon: '🔵', km: 4.35e9, body: 'neptune', bx: 270, r: 125 },
  { alt: 10200, pts: 19000,  name: 'Pluto',                 icon: '🤍', km: 5.9e9, body: 'pluto', bx: 300, r: 70 },
  { alt: 12500, pts: 23000,  name: 'Edge of the Solar System', icon: '🌠', km: 1.8e10, body: 'helio' },
  { alt: 16000, pts: 28000,  name: 'Orion Nebula',          icon: '🌸', km: 1.27e16, body: 'nebula', bx: 380, r: 420 },
  { alt: 20000, pts: 34000,  name: 'Galactic Core',         icon: '✨', km: 2.46e17, body: 'core', bx: 420, r: 380 },
  { alt: 25000, pts: 41000,  name: 'Andromeda Galaxy',      icon: '🌀', km: 2.4e19, body: 'andromeda', bx: 360, r: 330 },
  { alt: 32000, pts: 50000,  name: 'Edge of the Universe',  icon: '♾️', km: 4.4e23, body: 'edge', bx: 480, r: 360 }
];

/* Places the submarine passes on its dive. Same fields as MILESTONES; `km` is depth. */
const DEPTHS = [
  { alt: 0,    pts: 0,    name: 'The Surface',             icon: '🌊', km: 0 },
  { alt: 60,   pts: 60,   name: 'Coral Reef',              icon: '🪸', km: 0.03, body: 'reef' },
  { alt: 150,  pts: 150,  name: 'The Twilight Zone',       icon: '🌆', km: 0.2 },
  { alt: 260,  pts: 260,  name: 'Deepest Scuba Dive',      icon: '🤿', km: 0.332, body: 'diver' },
  { alt: 400,  pts: 400,  name: 'The Midnight Zone',       icon: '🌑', km: 1 },
  { alt: 550,  pts: 550,  name: 'Sperm Whale Depths',      icon: '🐋', km: 2, body: 'spermwhale' },
  { alt: 700,  pts: 700,  name: 'Hydrothermal Vents',      icon: '♨️', km: 2.5, body: 'vents' },
  { alt: 850,  pts: 850,  name: 'Wreck of the Titanic',    icon: '🚢', km: 3.8, body: 'titanic' },
  { alt: 1000, pts: 1000, name: 'The Abyss',               icon: '🕳️', km: 4 },
  { alt: 1300, pts: 1300, name: 'The Hadal Zone',          icon: '🦐', km: 6 },
  { alt: 1700, pts: 1700, name: 'Challenger Deep',         icon: '📍', km: 10.935, body: 'seabed' },
  { alt: 2200, pts: 2200, name: 'Deepest Hole Ever Dug',   icon: '🕳️', km: 12.262, body: 'borehole' },
  { alt: 2700, pts: 2700, name: "Earth's Mantle",          icon: '🔥', km: 50 },
  { alt: 3500, pts: 3500, name: 'Diamond Zone',            icon: '💎', km: 160, body: 'diamonds' },
  { alt: 4500, pts: 4500, name: 'The Outer Core',          icon: '🟠', km: 2890 },
  { alt: 5600, pts: 5600, name: 'The Inner Core',          icon: '🟡', km: 5150 },
  { alt: 7000, pts: 7000, name: 'Centre of the Earth',     icon: '🌕', km: 6371, body: 'centre' },
  { alt: 9000, pts: 9000, name: 'Other Side of the World', icon: '🌏', km: 12742 }
];

/* Places the drill passes on its way to the centre of the Earth (Drill Challenge). `km` is depth. */
const DRILL_STOPS = [
  { alt: 0,    pts: 0,    name: 'The Surface',             icon: '🌱', km: 0 },
  { alt: 50,   pts: 50,   name: 'Worm Burrows',            icon: '🪱', km: 0.0005 },
  { alt: 110,  pts: 110,  name: 'City Pipes',              icon: '🚰', km: 0.003 },
  { alt: 180,  pts: 180,  name: 'Subway Tunnel',           icon: '🚇', km: 0.03, body: 'subway' },
  { alt: 270,  pts: 270,  name: 'Dinosaur Fossils',        icon: '🦖', km: 0.1, body: 'dino' },
  { alt: 390,  pts: 390,  name: 'Crystal Caves',           icon: '💠', km: 0.4, body: 'cave' },
  { alt: 540,  pts: 540,  name: 'Deepest Gold Mine',       icon: '⛏️', km: 4, body: 'mine' },
  { alt: 700,  pts: 700,  name: 'Solid Bedrock',           icon: '🪨', km: 8 },
  { alt: 880,  pts: 880,  name: 'Deepest Hole Ever Dug',   icon: '🕳️', km: 12.262, body: 'borehole' },
  { alt: 1080, pts: 1080, name: 'Bottom of the Crust',     icon: '🧱', km: 35 },
  { alt: 1350, pts: 1350, name: 'The Upper Mantle',        icon: '🔥', km: 100 },
  { alt: 1650, pts: 1650, name: 'Diamond Zone',            icon: '💎', km: 160, body: 'diamonds' },
  { alt: 2050, pts: 2050, name: 'The Lower Mantle',        icon: '🌋', km: 660 },
  { alt: 2650, pts: 2650, name: 'The Outer Core',          icon: '🟠', km: 2890 },
  { alt: 3350, pts: 3350, name: 'The Inner Core',          icon: '🟡', km: 5150 },
  { alt: 4200, pts: 4200, name: 'Centre of the Earth',     icon: '🎯', km: 6371, body: 'centre' },
  { alt: 6000, pts: 6000, name: 'Other Side of the World', icon: '🌏', km: 12742 }
];
