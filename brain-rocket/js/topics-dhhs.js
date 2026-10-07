/* Brain Rocket — Daniel Hand High School (DHHS, Madison CT) topics, from the 2026–27 student handbook.
   Level 1 so they come up in every mode, but at a tenth of the usual rate. `letters: true` lets a smaller topic also get letter questions
   ("Name a room or place at DHHS that starts with C"). Nicknames go in as aliases after a slash. */
'use strict';

// weight 0.075: DHHS questions come up 90% less often than a normal topic.
const DHHS = { name: 'DHHS', icon: '🐯', level: 1, weight: 0.075 };

topic({ ...DHHS, id: 'dhhs-depts', noun: 'department at DHHS', letters: true, q: 'Name a **department at DHHS**.', strip: ['department', 'dept'], list: `
1: Math/Maths/Mathematics, English/ELA, Science
2: Art/Arts, Music, Social Studies/History/SS, World Languages/World Language/Languages/Foreign Language/Foreign Languages
3: Special Education/Special Ed/SPED, Physical Education and Health/PE/Gym/Phys Ed/Physical Education/Health/Health and Wellness, Library Media/Library/LMC/Library Media Center, Technology/Tech/IT, School Counseling/Counseling/Guidance
4: Career and Technical Education/CTE/Career and Tech/Career and Tech Ed, Fab Lab/FabLab/Fabrication Lab
5: Effective School Solutions/ESS
` });

topic({ ...DHHS, id: 'dhhs-ap', noun: 'AP or UConn ECE class at DHHS', q: 'Name an **AP or UConn ECE class at DHHS**.', strip: ['class', 'course', 'uconn', 'ece'], list: `
1: AP Biology/AP Bio/APBio, AP Psychology/AP Psych, AP Calculus AB/AP Calc AB/AP Calc/AP Calculus/Calc AB/AB Calc/AP Calculus 1, AP US History/APUSH/AP United States History/AP American History
2: AP Calculus BC/AP Calc BC/Calc BC/BC Calc/AP Calculus 2, AP Chemistry/AP Chem, AP Statistics/AP Stats/AP Stat, AP Physics 1/AP Physics/AP Phys/AP Physics One, AP Computer Science/AP CS/AP Comp Sci/AP CSA/AP Computer Science A, AP English/AP Lang/AP Lit/AP English Language/AP English Literature
3: AP Macroeconomics/AP Macro/AP Econ/AP Economics, AP European History/AP Euro/AP Euro History, AP Music Theory, AP Spanish/AP Spanish 5/AP Spanish Language, AP Physics C/AP Physics C Mechanics
4: AP French/AP French 5, AP Latin/AP Latin 4, Discrete Math/Discrete Mathematics/Discrete, Mandarin Chinese 4/Mandarin 4/Chinese 4, Spanish 6 Honors/Spanish 6
5: Individual and Family Development/IFD, Spanish Cinema and Conversation/Spanish Cinema
` });

topic({ ...DHHS, id: 'dhhs-classes', noun: 'class at DHHS', letters: true, q: 'Name a **class you can take at DHHS** (not AP).', strip: ['class', 'course'], list: `
1: English/ELA, Math/Maths/Mathematics, Gym/PE/Physical Education/Phys Ed, Health/Health and Wellness/Wellness, Science, Spanish/Espanol, Biology/Bio, Chemistry/Chem, Algebra/Algebra 1/Algebra 2/Alg
2: US History/USH/United States History/American History, Personal Finance/Pers Fin/Finance, Creative Writing/CW, French, Study Hall/Study, Geometry/Geo, Precalculus/Precalc/Pre-Calc/Pre Calculus, Physics, Art
3: Civics/Civics and American Government/Government/Gov, Biotechnology/Biotech, Independent Project/IP, Latin, Mandarin/Chinese/Mandarin Chinese, Advisory, Modern Middle East/Middle East, Theater/Theatre/Drama
4: Intro to Music Technology/Music Technology/Music Tech, Piano and Digital Audio/Piano/Digital Audio
5: Music Theory and Composition/Music Theory/Composition
` });

topic({ ...DHHS, id: 'dhhs-langs', noun: 'world language taught at DHHS', q: 'Name a **world language taught at DHHS**.', list: `
1: Spanish/Espanol
2: French/Francais
3: Latin
4: Mandarin/Chinese/Mandarin Chinese
` });

topic({ ...DHHS, id: 'dhhs-credits', noun: 'subject you need credits in to graduate from DHHS', q: 'Name a **subject you need credits in to graduate from DHHS**.', strip: ['credits', 'credit', 'class'], list: `
1: English/ELA, Math/Maths/Mathematics, Science
2: Social Studies/History, PE/Physical Education/Gym/Phys Ed, Health/Wellness/Health and Wellness, World Language/Language/Foreign Language/World Languages
3: Art, Music, Theater/Theatre/Drama, CTE/Career and Technical Education, STEM, Humanities
4: Personal Finance/Finance, Civics/Civics and American Government/Government, US History/USH/American History/United States History
5: Independent Project/IP, Mastery Based Diploma/Mastery Based/Mastery
` });

topic({ ...DHHS, id: 'dhhs-grades', noun: 'grade or code on a DHHS report card', q: 'Name a **grade or code that can show up on a DHHS report card**.', strip: ['grade'], list: `
1: A, B, C
2: A+/A plus, A-/A minus, B+/B plus, B-/B minus, D, F
3: C+/C plus, C-/C minus, I/Incomplete/Inc
4: WP/Withdrawn Passing/Withdrew Passing
5: WF/Withdrawn Failing/Withdrew Failing
` });

topic({ ...DHHS, id: 'dhhs-honors', noun: 'academic honour at DHHS', q: 'Name an **academic honour at DHHS**.', list: `
1: Honor Roll/Honour Roll/Honors/Honours, National Honor Society/NHS/National Honour Society
2: High Honors/High Honours/High Honor Roll, Valedictorian/Val/Valedictorian
3: Salutatorian/Sal
4: Senior Scholar/Senior Scholars, Senior Honors/Senior Honours
5: Class Essayist/Essayist, Co-Valedictorian/Co-Val/Co Valedictorian
` });

topic({ ...DHHS, id: 'dhhs-nhs', noun: 'National Honor Society pillar at DHHS', q: 'Name one of the four **National Honor Society pillars at DHHS**.', list: `
1: Leadership, Service/Community Service
2: Character
3: Scholarship
` });

topic({ ...DHHS, id: 'dhhs-periods', noun: 'period or lunch wave at DHHS', q: 'Name a **period or lunch wave in the DHHS daily schedule**.', list: `
1: Period 1/1/First Period/1st Period/P1/Period One, Period 2/2/Second Period/2nd Period/P2/Period Two, Period 3/3/Third Period/3rd Period/P3/Period Three, Period 4/4/Fourth Period/4th Period/P4/Period Four, Period 5/5/Fifth Period/5th Period/P5/Period Five, Period 6/6/Sixth Period/6th Period/P6/Period Six
3: 4A/4A Lunch/Lunch 4A, 4B/4B Lunch/Lunch 4B, 5A/5A Lunch/Lunch 5A, 5B/5B Lunch/Lunch 5B
4: 3B/3B Lunch/Lunch 3B
` });

topic({ ...DHHS, id: 'dhhs-dress', noun: 'thing the DHHS dress code bans', q: "Name something **the DHHS dress code doesn't allow** during the school day.", list: `
1: Hats/Hat/Cap/Caps/Baseball Cap/Beanie, Coats/Coat, Sunglasses/Shades
2: Jackets/Jacket, Shorts, Crop Tops/Crop Top
3: Miniskirts/Miniskirt/Mini Skirt, Outerwear, Head Coverings/Head Covering, Offensive Shirts/Vulgar Shirts/Offensive Clothes
4: See-Through Clothing/See Through Clothes/Sheer Clothing, Drug Logos/Alcohol Logos/Vape Logos
` });

topic({ ...DHHS, id: 'dhhs-devices', noun: 'device that must be put away at DHHS', letters: true, q: 'Name a **device that has to be put away during the school day at DHHS**.', list: `
1: Phone/Cell Phone/Cellphone/iPhone/Smartphone/Mobile, Earbuds/AirPods/Headphones/Earphones/Ear Buds
2: Smartwatch/Smart Watch/Apple Watch/Watch, Tablet/iPad, Laptop/Personal Laptop/MacBook
3: Bluetooth Speaker/Speaker/JBL, Gaming System/Game Console/Nintendo Switch/Switch/Game Boy
4: Radio, Walkie-Talkie/Walkie Talkie, Personal Audio Player/MP3 Player/iPod
5: PDA/Personal Data Assistant
` });

topic({ ...DHHS, id: 'dhhs-sick', noun: 'reason to stay home sick from DHHS', letters: true, q: 'Name a **symptom that means you should stay home sick from DHHS**.', list: `
1: Fever/Temperature/High Temperature, Vomiting/Throwing Up/Puking/Vomit, Cough/Coughing/Bad Cough
2: Rash, Earache/Ear Ache/Ear Infection, Diarrhea/Diarrhoea
3: Pink Eye/Pinkeye, Head Lice/Lice, Runny Nose/Snot/Green Snot
4: Conjunctivitis
5: Communicable Illness/Contagious Illness/Contagious
` });

topic({ ...DHHS, id: 'dhhs-throw', noun: "thing you can't throw at DHHS", q: 'Name something **you can get in trouble for throwing at DHHS**.', list: `
1: Snowballs/Snowball, Frisbees/Frisbee, Footballs/Football
2: Food, Rocks/Rock/Stones
3: Bottles/Bottle/Water Bottle
4: Milk/Milk Carton
` });

topic({ ...DHHS, id: 'dhhs-snow', noun: 'place to hear about a DHHS snow day', q: 'Name a **place to find out about a DHHS snow day**.', list: `
1: District Website/Madison Website/School Website/Website, Channel 8/WTNH/News 8
2: NBC 30/NBC Connecticut/Channel 30, Fox CT/Fox 61/Fox
3: WFSB/Channel 3
4: eNotify/E-Notify/E Notify
` });

topic({ ...DHHS, id: 'dhhs-parking', noun: "place DHHS students can't park", q: "Name a **place DHHS students can't park** during school hours.", list: `
1: Handicapped Spot/Handicapped Space/Handicap Spot/Accessible Parking, Fire Lane, No Parking Zone/No Parking
2: Polson/Polson Middle School/Polson Middle, Reserved Space/Reserved Spot/Staff Parking/Teacher Parking
3: Jeffrey Elementary/Jeffrey/Jeffrey School
4: Bauer Park/Bauer
` });

topic({ ...DHHS, id: 'dhhs-fees', noun: 'student fee at DHHS', q: 'Name a **student fee or fine at DHHS**.', strip: ['fee', 'fine'], list: `
1: Parking/Parking Pass/Parking Permit, Field Trips/Field Trip
2: Cap and Gown/Graduation Gown/Gown, Class Dues/Dues
3: Athletic Registration/Athletic Fee/Sports Fee/Pay to Play
4: Lost Textbook/Lost Book/Textbook, Lost Chromebook/Chromebook/Chromebook Repair, Parking Ticket/Parking Fine, Lunch Balance/Negative Lunch Balance
` });

topic({ ...DHHS, id: 'dhhs-rooms', noun: 'room or place at DHHS', letters: true, q: 'Name a **room or place at DHHS**.', list: `
1: Main Office/Office/Front Office, Library/Library Media Center/LMC, Cafeteria/Caf/Cafe/Lunchroom/Lunch Room/Dining Hall, Nurse's Office/Nurse/Nurses Office, Bathroom/Bathrooms/Restroom/Lavatory, Hallway/Hallways/Hall, Classroom/Classrooms
2: Attendance Office/Attendance, Counseling Office/Guidance/Guidance Office/School Counseling/Counseling, Gym/Gymnasium, Auditorium, Stairwell/Stairs/Stairwells, Parking Lot/Student Parking
3: Health Office/Athletic Training Office/Trainer's Room/Trainers Room, Career Center/College and Career Center, Courtyard, Locker Room/Lockers/Locker Rooms, Ramp
4: Dining and Assembly Hall/DAH, Security Desk/Security, East Building/East Wing
5: Small Group Rooms/Small Group Room, West Parking Lot/West Lot, Circulation Desk
` });

topic({ ...DHHS, id: 'dhhs-leaders', noun: 'student leadership role at DHHS', q: 'Name a **student leadership role or group at DHHS**.', list: `
1: Student Council/StuCo/Stu Co/Student Government/Student Gov, Class President/President, Team Captain/Captain/Captains
2: Class Officer/Class Officers/Officer, NHS/National Honor Society, Vice President/VP/Class VP, Class Secretary/Secretary, Class Treasurer/Treasurer
3: Student Leadership Team/SLT
4: Board of Education Student Representative/BOE Rep/Student Rep/BOE Student Rep/Board Rep/Student Representative
` });

topic({ ...DHHS, id: 'dhhs-apps', noun: 'app or system DHHS students use', q: 'Name an **app or system students use at DHHS**.', list: `
1: Chromebook/Chromebooks, Infinite Campus/IC/Campus
2: Naviance, Google Classroom/Classroom, Google Docs/Docs
3: eNotify/E-Notify
4: Parent Portal/Infinite Campus Parent Portal
` });

topic({ ...DHHS, id: 'dhhs-discipline', noun: 'discipline or attendance word at DHHS', letters: true, q: 'Name a **discipline or attendance word at DHHS**.', list: `
1: Detention/Det, Tardy/Late/Tardies, Suspension/Suspended
2: Saturday Detention/Saturday School, Unexcused Absence/Unexcused, Truant/Truancy, Expulsion/Expelled, Absence/Absent, Excused Absence/Excused
3: Early Dismissal, Probation/Academic Probation, Office Detention, Cut/Cutting/Skipping Class/Skipping
4: Loss of Credit, Late Admittance, Write Up/Written Up/Referral
5: Appeals Board/Appeal, Teacher Detention
` });

// Two teacher questions, added at a DHHS student's request.
topic({ ...DHHS, id: 'dhhs-quirk', noun: 'class Mr. Quirk teaches', q: 'What **classes does Mr. Quirk teach** at DHHS?', strip: ['class'], list: `
1: AP US History/APUSH/AP United States History/AP American History, US History/USH/United States History/American History, Modern Middle East/Middle East/Modern Middle Eastern Studies
2: AP European History/AP Euro/AP Euro History
5: Study Hall/Study, Advisory
` });

topic({ ...DHHS, id: 'dhhs-sayin', noun: 'class Mrs. Sayin teaches', q: 'What **classes does Mrs. Sayin teach** at DHHS?', strip: ['class'], list: `
1: AP Calculus/AP Calc/Calculus/Calc, AP Calculus BC/AP Calc BC/Calc BC/BC Calc/BC, AP Calculus AB/AP Calc AB/Calc AB/AB Calc/AB
4: Computer Science/Comp Sci/CS/Coding
5: Advisory
` });
