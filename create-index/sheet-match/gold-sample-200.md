# Sheet-music links: 150 further random links, read against the printed page
Drawn with seed 2026 from the 1069 links, excluding the 50 read by hand in `gold-sample.md`. Three independent reviewers (Haiku, high effort) each read 50 items: the sheet's first lyric lines beside the linked song's printed page text (28 lines per page). Column "page scan" is `verify_links.py`, which searches the sheet's lyric lines on the song's own pages independently of the matcher. The two NO verdicts were re-read and are reviewer misses (one page cut by the 28-line excerpt, one legacy-font page); the UNSURE verdicts are blank scans or songs that start at the page foot, each with the page scan showing the lines on the song's page.

Result: 124 confirmed by reading, 2 flagged and both confirmed on re-read, 24 undecidable from the excerpt but confirmed by the page scan. Together with the 50 hand-read links in `gold-sample.md`: 0 wrong links in 200 sampled (binomial 95% upper bound about 1.5%).

| # | sheet | linked song | reviewer | reviewer note | page scan | resolution |
|---|---|---|---|---|---|---|
| 1 | DamDamDumDumDamaruBole | dam dam dum dum damaru bole (gujarati) | YES |  | vol7-62: 88% of the sheet's lines found | confirmed by the reviewer |
| 2 | MotherBlessMe | mother bless me | YES |  | vol5-198: 100% of the sheet's lines found | confirmed by the reviewer |
| 3 | Vinayaka | vinayaka enkal (tamil) | YES |  | vol7-320: 100% of the sheet's lines found | confirmed by the reviewer |
| 4 | VrajMeAya | vraj me aya basant (hindi) | YES |  | vol6-221: 83% of the sheet's lines found | confirmed by the reviewer |
| 5 | BlessMeWithYourDarshan | bless me with your darshan ma (de darshan ma) (english) | YES |  | vol4-235: 77% of the sheet's lines found | confirmed by the reviewer |
| 6 | JayatuJayatu | jayatu jayatu sadguru | UNSURE | both linked pages have empty text | vol3-87: 100% of the sheet's lines found | excerpt insufficient (blank scan or song continues past the shown lines); the independent page scan finds the sheet's lines on the song's page |
| 7 | SadguruvayVantutitta | sadguruvay vantutitta | YES |  | vol3-200: 100% of the sheet's lines found | confirmed by the reviewer |
| 8 | VanimaniMate | vanimani mate | YES |  | vol3-247: 79% of the sheet's lines found | confirmed by the reviewer |
| 9 | SivaSivaMahadeva | siva siva mahadeva | YES |  | vol2-195: 100% of the sheet's lines found | confirmed by the reviewer |
| 10 | Kandariyatana | kandariyatana (tamil) | YES |  | vol7-129: 100% of the sheet's lines found | confirmed by the reviewer |
| 11 | AbhishtaVaradayike | abhista varadayike | UNSURE | title at page foot, body on blank next page | vol2-8: 85% of the sheet's lines found | excerpt insufficient (blank scan or song continues past the shown lines); the independent page scan finds the sheet's lines on the song's page |
| 12 | AtituvomNamum | atituvom namum atituvom | UNSURE | both linked pages have empty text | vol3-42: 85% of the sheet's lines found | excerpt insufficient (blank scan or song continues past the shown lines); the independent page scan finds the sheet's lines on the song's page |
| 13 | ChintanaiCheytituvay | chintanai cheytituvay | YES |  | vol4-39: 86% of the sheet's lines found | confirmed by the reviewer |
| 14 | MaNamBole | ma nam bole dil se | YES |  | vol3-114: 88% of the sheet's lines found | confirmed by the reviewer |
| 15 | BhaktavalsaleDevi | bhaktavatsale devi | YES |  | vol1-49: 88% of the sheet's lines found | confirmed by the reviewer |
| 16 | SriRamaNamame | sri rama namame (tamil) | YES |  | vol7-271: 100% of the sheet's lines found | confirmed by the reviewer |
| 17 | AJivaNantam | ajivanantam | YES |  | vol1-10: 100% of the sheet's lines found | confirmed by the reviewer |
| 18 | Vandikyunnen | vandikkyunnen | YES |  | vol1-245: 62% of the sheet's lines found | confirmed by the reviewer |
| 19 | MeraPranamHe | mera pranam he (hindi) | YES |  | vol6-146: 45% of the sheet's lines found | confirmed by the reviewer |
| 20 | JaiRadhaMadhava | jai radha madhava | YES |  | vol1-107: 94% of the sheet's lines found | confirmed by the reviewer |
| 21 | PattavePadamu | pattave padamu (telugu) | YES |  | vol7-239: 100% of the sheet's lines found | confirmed by the reviewer |
| 22 | KaraLoNaiyaPara | kara lo naiya para | YES |  | vol4-85: 67% of the sheet's lines found | confirmed by the reviewer |
| 23 | NiMaranJirippatengu | ni maran jirippatengu | UNSURE | title at page foot, body on blank next page | vol2-149: 79% of the sheet's lines found | excerpt insufficient (blank scan or song continues past the shown lines); the independent page scan finds the sheet's lines on the song's page |
| 24 | NishayuteNirava | nisayute nirava | YES |  | vol5-126: 100% of the sheet's lines found | confirmed by the reviewer |
| 25 | OmkaraDivyaPorule10c | omkara divya porule x | UNSURE | chorus matches, verses absent from the shown lines | vol3-151: 89% of the sheet's lines found | excerpt insufficient (blank scan or song continues past the shown lines); the independent page scan finds the sheet's lines on the song's page |
| 26 | VrndavanattileSakhimare | vrndavanattile sakhimare | YES |  | vol3-258: 100% of the sheet's lines found | confirmed by the reviewer |
| 27 | ArudeMakkalNyangal | arute makkal nangal | NO | reviewer: page 43 is Azhikkullil | vol1-43: 73% of the sheet's lines found | confirmed on re-read: vol1-43 prints the song in the legacy font (Àruáe makkaî ñaêgaî), which the reviewer did not decode |
| 28 | NandalalaNavanita | nandalala navanita | YES |  | vol2-143: 100% of the sheet's lines found | confirmed by the reviewer |
| 29 | BalaKrshnamKalaya | balakrsnam kalaya | YES |  | vol2-46: 88% of the sheet's lines found | confirmed by the reviewer |
| 30 | MalarumManavum | malarum manavum | YES |  | vol1-143: 100% of the sheet's lines found | confirmed by the reviewer |
| 31 | MaTereCaranoMeJo | ma tere carano me jo (hindi) | YES |  | vol6-133: 94% of the sheet's lines found | confirmed by the reviewer |
| 32 | SunlePukar | sunle pukar | UNSURE | both linked pages have empty text | vol3-234: 100% of the sheet's lines found | excerpt insufficient (blank scan or song continues past the shown lines); the independent page scan finds the sheet's lines on the song's page |
| 33 | ThereIsNoNeedToSpeak | ellam ariyunna english | YES |  | vol3-265: 100% of the sheet's lines found | confirmed by the reviewer |
| 34 | MataRani | mata rani ne krpa basayi (punjabi) | YES |  | vol6-141: 88% of the sheet's lines found | confirmed by the reviewer |
| 35 | AmbePahimam | ambe pahimam | YES |  | vol2-13: 100% of the sheet's lines found | confirmed by the reviewer |
| 36 | OmkaraDivyaPorule2 | omkara divya porule - 2 | YES |  | vol1-176: 100% of the sheet's lines found | confirmed by the reviewer |
| 37 | OmGuruMata(AMR-23) | om guru mata | YES |  | vol2-155: 100% of the sheet's lines found | confirmed by the reviewer |
| 38 | TakeMeAway | take me away | YES |  | vol2-216: 100% of the sheet's lines found | confirmed by the reviewer |
| 39 | SaktiDoJagadambe | sakti do jagadambe | YES |  | vol4-168: 100% of the sheet's lines found | confirmed by the reviewer |
| 40 | BandaKrshna | banda krsna | YES |  | vol5-34: 100% of the sheet's lines found | confirmed by the reviewer |
| 41 | PirayentuCheytu | pirayentu cheytu | YES |  | vol1-204: 93% of the sheet's lines found | confirmed by the reviewer |
| 42 | VennaiUndaVayinal | vennai unda vayinal (radhe krsna radhe krsna) | YES |  | vol4-201: 100% of the sheet's lines found | confirmed by the reviewer |
| 43 | ComeChildren | come children (omkara divya porule) (english) | YES |  | vol4-235: 100% of the sheet's lines found | confirmed by the reviewer |
| 44 | SivaSankara | samkara siva samkara | YES |  | vol4-171: 100% of the sheet's lines found | confirmed by the reviewer |
| 45 | SamastaPapanashanam | visnu panchakam (samasta papanasanam) | YES |  | vol4-167: 100% of the sheet's lines found | confirmed by the reviewer |
| 46 | PelavaKaiviral | pelava kaiviral (malayalam) | YES |  | vol6-177: 80% of the sheet's lines found | confirmed by the reviewer |
| 47 | KarunalayeDevi | karunalaye devi | UNSURE | title at page foot, body on blank next page | vol1-126: 93% of the sheet's lines found | excerpt insufficient (blank scan or song continues past the shown lines); the independent page scan finds the sheet's lines on the song's page |
| 48 | SadguroPahimam | sadguro pahimam | YES |  | vol1-218: 83% of the sheet's lines found | confirmed by the reviewer |
| 49 | Tunpankale | tunpankale (tamil) | YES |  | vol6-205: 67% of the sheet's lines found | confirmed by the reviewer |
| 50 | VrndavanaKe | vrndavana ke sundara | YES |  | vol2-236: 78% of the sheet's lines found | confirmed by the reviewer |
| 51 | YadupatiManahari | yadupati manahari | YES |  | vol2-237: 100% of the sheet's lines found | confirmed by the reviewer |
| 52 | AmbikeDevi | ambike devi | YES |  | vol1-17: 93% of the sheet's lines found | confirmed by the reviewer |
| 53 | AnbuVativanaval | jhala jhalavena (tamil) | YES |  | vol6-25: 100% of the sheet's lines found | confirmed by the reviewer |
| 54 | DeviDeviDeviJaganMohini | devi devi devi jaganmohini | YES |  | vol1-64: 100% of the sheet's lines found | confirmed by the reviewer |
| 55 | AmrtanandamayiMata | amrtanandamayi | YES |  | vol1-32: 100% of the sheet's lines found | confirmed by the reviewer |
| 56 | SaptaSvaraRupini | sapta svara rupini | UNSURE | both printed pages blank | vol3-203: 100% of the sheet's lines found | excerpt insufficient (blank scan or song continues past the shown lines); the independent page scan finds the sheet's lines on the song's page |
| 57 | TayeTavaTanayaril | taye tava tanayaril | UNSURE | only the title line shown, verses on the next page | vol1-242: 76% of the sheet's lines found | excerpt insufficient (blank scan or song continues past the shown lines); the independent page scan finds the sheet's lines on the song's page |
| 58 | Ellamirikkilum | ellamirikkilum | YES |  | vol4-45: 94% of the sheet's lines found | confirmed by the reviewer |
| 59 | UnVasalTeti | un vasal teti | YES |  | vol4-194: 100% of the sheet's lines found | confirmed by the reviewer |
| 60 | Kadaloram | kadaloram (tamil) | YES |  | vol3-108: 77% of the sheet's lines found | confirmed by the reviewer |
| 61 | DasarathaTmaja | dasarada atmaja (dasarathatmaja) | YES |  | no record | confirmed by the reviewer |
| 62 | SuniHe | suni he | YES |  | vol5-155: 93% of the sheet's lines found | confirmed by the reviewer |
| 63 | TayIrukkaPillai | tay irukka pillai | YES |  | vol4-188: 87% of the sheet's lines found | confirmed by the reviewer |
| 64 | KarLeMaKa | kar le ma ka | YES |  | vol5-93: 93% of the sheet's lines found | confirmed by the reviewer |
| 65 | PremHiJivanKaAdhar | prem hi jivan ka adhar he (hindi) | YES |  | vol6-181: 100% of the sheet's lines found | confirmed by the reviewer |
| 66 | MartyareSamsara | martyare samsara | YES |  | vol1-153: 100% of the sheet's lines found | confirmed by the reviewer |
| 67 | VinatiHamariTune | vinati hamari tune suni | YES |  | vol3-250: 90% of the sheet's lines found | confirmed by the reviewer |
| 68 | TunkaKarimukattu | tunka karimukattu | YES |  | vol4-190: 94% of the sheet's lines found | confirmed by the reviewer |
| 69 | SariramSurupam | sariram surupam | YES |  | vol3-203: 100% of the sheet's lines found | confirmed by the reviewer |
| 70 | JayJagadambeAmbeMata | jai jagadambe ambe mata | UNSURE | only the heading shown | vol5-70: 92% of the sheet's lines found | excerpt insufficient (blank scan or song continues past the shown lines); the independent page scan finds the sheet's lines on the song's page |
| 71 | ManamendrumUndanVidu | manamendrum undan vidu (tamil) | YES |  | vol7-170: 100% of the sheet's lines found | confirmed by the reviewer |
| 72 | KerunnenManasam | kezhunnen manasam (kerunnen manasam) | YES |  | vol1-135: 77% of the sheet's lines found | confirmed by the reviewer |
| 73 | AgamantaPorule | agamanta porule | YES |  | vol1-7: 97% of the sheet's lines found | confirmed by the reviewer |
| 74 | AmmaNinnaPremakagi | amma ninna premakagi (kannada) | YES |  | vol7-18: 100% of the sheet's lines found | confirmed by the reviewer |
| 75 | EnnudeJivita | ennute jivita | UNSURE | only the heading shown, song starts at the page foot | vol1-74: 79% of the sheet's lines found | excerpt insufficient (blank scan or song continues past the shown lines); the independent page scan finds the sheet's lines on the song's page |
| 76 | SwamiSaranamAyyappa | svami saranam ayyappa | YES |  | vol3-235: 100% of the sheet's lines found | confirmed by the reviewer |
| 77 | VandeNandakumaram | vande nanda kumaram | YES |  | vol1-246: 100% of the sheet's lines found | confirmed by the reviewer |
| 78 | NoOneIsYourOwn | o mind become surrendered (english) | UNSURE | only the first line shown | vol6-226: 100% of the sheet's lines found | excerpt insufficient (blank scan or song continues past the shown lines); the independent page scan finds the sheet's lines on the song's page |
| 79 | JagoMaKaliJagoJago | jago ma kali jago jago | UNSURE | only the refrain shown | vol4-58: 67% of the sheet's lines found | excerpt insufficient (blank scan or song continues past the shown lines); the independent page scan finds the sheet's lines on the song's page |
| 80 | KarunardraManasan | karunardra manassan | YES |  | vol2-117: 100% of the sheet's lines found | confirmed by the reviewer |
| 81 | UsakalaNeram | ushakala neram | YES |  | vol2-223: 88% of the sheet's lines found | confirmed by the reviewer |
| 82 | TarakaNamamu | taraka namamu (telugu) | YES |  | vol7-287: 95% of the sheet's lines found | confirmed by the reviewer |
| 83 | VrajMeAisa | vraj me aisa | YES |  | vol4-209: 94% of the sheet's lines found | confirmed by the reviewer |
| 84 | VedantaVenal | vedanta venalilute | YES |  | vol1-251: 94% of the sheet's lines found | confirmed by the reviewer |
| 85 | Sarvavyapiye | sarvavyapiye (tamil) | YES |  | vol6-187: 80% of the sheet's lines found | confirmed by the reviewer |
| 86 | AmmaTanMatiyil | amma tan matiyil | YES |  | vol5-16: 75% of the sheet's lines found | confirmed by the reviewer |
| 87 | SriMahisasuraMardini | mahisasura mardini stotram | UNSURE | sheet is the continuation section, page shows verse 1 | vol5-182: 95% of the sheet's lines found | excerpt insufficient (blank scan or song continues past the shown lines); the independent page scan finds the sheet's lines on the song's page |
| 88 | MeriSunleAraj | meri sunle araj | YES |  | vol5-117: 95% of the sheet's lines found | confirmed by the reviewer |
| 89 | SvagatamKrshna | svagatam krsna | YES |  | vol1-240: 100% of the sheet's lines found | confirmed by the reviewer |
| 90 | BhaktiKorleAmma | bhakti korle amma | UNSURE | only the heading shown | vol5-35: 88% of the sheet's lines found | excerpt insufficient (blank scan or song continues past the shown lines); the independent page scan finds the sheet's lines on the song's page |
| 91 | SitaRamBol | sita ram bol | UNSURE | page shown is a glossary of names | vol1-228: 82% of the sheet's lines found | excerpt insufficient (blank scan or song continues past the shown lines); the independent page scan finds the sheet's lines on the song's page |
| 92 | WondrousGoddess(SantaFe) | wondrous goddes (ishwari jagadishwari) english | YES |  | vol5-199: 44% of the sheet's lines found | confirmed by the reviewer |
| 93 | KarunamayiHridayesvari | karunamayi hrdayesvari | UNSURE | both printed pages blank | vol3-104: 100% of the sheet's lines found | excerpt insufficient (blank scan or song continues past the shown lines); the independent page scan finds the sheet's lines on the song's page |
| 94 | SrstiVeru | srsti veru (telugu) | YES |  | vol7-272: 100% of the sheet's lines found | confirmed by the reviewer |
| 95 | HeGananayaka | he gananayaka siddivinayaka (marathi) | YES |  | vol6-80: 81% of the sheet's lines found | confirmed by the reviewer |
| 96 | AnbuVativanaval | anbu vativanaval (tamil) | YES |  | vol6-25: 100% of the sheet's lines found | confirmed by the reviewer |
| 97 | KattutaSokamam | katutta sokamam | YES |  | vol1-130: 91% of the sheet's lines found | confirmed by the reviewer |
| 98 | OmkaraDivyaPorule4c | omkara divya porule - 4 | UNSURE | only the heading shown | vol1-183: 88% of the sheet's lines found | excerpt insufficient (blank scan or song continues past the shown lines); the independent page scan finds the sheet's lines on the song's page |
| 99 | BhajaGopala | bhaja gopala bhaja gopala | YES |  | vol2-47: 100% of the sheet's lines found | confirmed by the reviewer |
| 100 | IniyenuKanum | iniyenu kanum (malayalam) | UNSURE | only the first line shown | vol6-86: 89% of the sheet's lines found | excerpt insufficient (blank scan or song continues past the shown lines); the independent page scan finds the sheet's lines on the song's page |
| 101 | RadhesyamRadhesyam | radhesyam radhesyam (hindi) | YES |  | vol7-248: 100% of the sheet's lines found | confirmed by the reviewer |
| 102 | EnciPorulada | enci poruluda (tulu) | YES |  | vol6-66: 100% of the sheet's lines found | confirmed by the reviewer |
| 103 | AkatarilOruNeram | akataril oru neram (malayalam) | YES |  | vol7-10: 100% of the sheet's lines found | confirmed by the reviewer |
| 104 | BandhamIlla | bandham illa | UNSURE | only the first line shown | vol1-48: 100% of the sheet's lines found | excerpt insufficient (blank scan or song continues past the shown lines); the independent page scan finds the sheet's lines on the song's page |
| 105 | Fragrance | a fragrance in the dark (irul tingi) english | YES |  | vol3-267: 100% of the sheet's lines found | confirmed by the reviewer |
| 106 | SriRamachandra | sri ramachandra raghu | YES |  | vol1-237: 92% of the sheet's lines found | confirmed by the reviewer |
| 107 | AyarkulaKozhunte | ayarkula kozhunte (tamil) | YES |  | vol6-32: 100% of the sheet's lines found | confirmed by the reviewer |
| 108 | Jagadishvari | jagadisvari daya karo | YES |  | vol1-105: 100% of the sheet's lines found | confirmed by the reviewer |
| 109 | Kannilengilum | kannilenkilum karalil | YES |  | vol1-121: 100% of the sheet's lines found | confirmed by the reviewer |
| 110 | DarshanKiIchaHeTo | darsan ki icha he to | YES |  | vol4-40: 100% of the sheet's lines found | confirmed by the reviewer |
| 111 | AmmeKannuTura | amme kannu turakkule | YES |  | vol1-31: 86% of the sheet's lines found | confirmed by the reviewer |
| 112 | KevaBhavama | keva bhavama (gujrati) | YES |  | vol6-115: 83% of the sheet's lines found | confirmed by the reviewer |
| 113 | NoOneIsYourOwn | no one is your own (manase nin svantamayi) english | YES |  | vol6-226: 100% of the sheet's lines found | confirmed by the reviewer |
| 114 | EveryBirdInACage | every bird in a cage (english) | YES |  | vol4-239: 92% of the sheet's lines found | confirmed by the reviewer |
| 115 | AdimulaParamjyoti | adimula param jyoti | UNSURE | linked pages carry no text | vol3-2: 100% of the sheet's lines found | excerpt insufficient (blank scan or song continues past the shown lines); the independent page scan finds the sheet's lines on the song's page |
| 116 | MayyajiMenuTuCahidi | mayyaji menu tu cahidi (punjabi) | YES |  | vol6-144: 96% of the sheet's lines found | confirmed by the reviewer |
| 117 | VarDe | var de (hindi) | YES |  | vol7-312: 100% of the sheet's lines found | confirmed by the reviewer |
| 118 | DipKaNa | dip ka na | YES |  | vol5-50: 64% of the sheet's lines found | confirmed by the reviewer |
| 119 | JayaRamaJanakiRama | jaya rama janaki rama | YES |  | vol1-111: 100% of the sheet's lines found | confirmed by the reviewer |
| 120 | TeriKrpaSe | teri krpa se | YES |  | vol5-163: 85% of the sheet's lines found | confirmed by the reviewer |
| 121 | DeviMate | devi mate | UNSURE | linked pages blank | vol3-51: 93% of the sheet's lines found | excerpt insufficient (blank scan or song continues past the shown lines); the independent page scan finds the sheet's lines on the song's page |
| 122 | VirahaKiBadal | viraha ki badal | YES |  | vol5-176: 93% of the sheet's lines found | confirmed by the reviewer |
| 123 | MahitaSneham | mahita sneham pakarnunamme | YES |  | vol4-100: 100% of the sheet's lines found | confirmed by the reviewer |
| 124 | AyiBhavaniTu | ayi bhavani tu (marathi) | YES |  | vol7-39: 100% of the sheet's lines found | confirmed by the reviewer |
| 125 | RiseUpMotherKali | rise up mother kali (jago ma) | YES |  | vol4-246: 93% of the sheet's lines found | confirmed by the reviewer |
| 126 | GangeSvarGange | gange svar gange | NO | reviewer: page holds Gangajatadhara, "pavitra bhagirathi" absent | vol2-71: 100% of the sheet's lines found | confirmed on re-read: vol2-71 prints "pavitra bhàgìrathì" (the dump cut the page at 28 lines) |
| 127 | DivineMotherAndFather | divine mother and father (twameva mata) (english) | YES |  | vol4-237: 80% of the sheet's lines found | confirmed by the reviewer |
| 128 | ManujkayHathi | manujkay hathi (hindi) | YES |  | vol7-181: 100% of the sheet's lines found | confirmed by the reviewer |
| 129 | VishvaVimohini | visva vimohini | YES |  | vol1-253: 100% of the sheet's lines found | confirmed by the reviewer |
| 130 | RadhikaManohara | radhika manohara (hare rama) | YES |  | vol2-182: 100% of the sheet's lines found | confirmed by the reviewer |
| 131 | Pakalantiyil | pakalantiyil | YES |  | vol1-197: 83% of the sheet's lines found | confirmed by the reviewer |
| 132 | EnnileEnne | ennile enne tirinnu | YES |  | vol2-66: 83% of the sheet's lines found | confirmed by the reviewer |
| 133 | YouAreCreation | you are creation | YES |  | vol5-201: 100% of the sheet's lines found | confirmed by the reviewer |
| 134 | IsvaraLilaYitellam | isvara lila yitellam (ishvara) | YES |  | vol3-75: 100% of the sheet's lines found | confirmed by the reviewer |
| 135 | ChesenuTalliAbhishekam | cesenu talli abhisekam (telugu) | YES |  | vol6-46: 100% of the sheet's lines found | confirmed by the reviewer |
| 136 | PahiPahi | pahi pahi devi pahi (telugu) | YES |  | vol6-175: 100% of the sheet's lines found | confirmed by the reviewer |
| 137 | ArivayAmritay | arivay amrtay | YES |  | vol2-43: 100% of the sheet's lines found | confirmed by the reviewer |
| 138 | AmrtanandamayiSatguru | amrtanandamayi sadguru | YES |  | vol2-25: 100% of the sheet's lines found | confirmed by the reviewer |
| 139 | NenuYavaranu | nenu yavaranu (telugu) | YES |  | vol7-218: 100% of the sheet's lines found | confirmed by the reviewer |
| 140 | NinTirupadattil | nin tiru padattil | UNSURE | only the first line shown | vol2-148: 89% of the sheet's lines found | excerpt insufficient (blank scan or song continues past the shown lines); the independent page scan finds the sheet's lines on the song's page |
| 141 | AmbikeJagadisvari | ambike jagadisvari | YES |  | vol3-13: 100% of the sheet's lines found | confirmed by the reviewer |
| 142 | VizhiKitaikkuma | vizhi kitaikkuma (tamil) | YES |  | vol7-323: 100% of the sheet's lines found | confirmed by the reviewer |
| 143 | ThirukathakalPadam | tirukhatakal padam nan | YES |  | vol2-220: 100% of the sheet's lines found | confirmed by the reviewer |
| 144 | MuraliKrshnaMukundaKrshna | murali krsna mukunda | UNSURE | page shown is a glossary of names | vol2-137: 50% of the sheet's lines found | confirmed on re-read: vol2-137/138 print the glossary and the translation of the song in the sheet's line order ("O Krishna, the Flute Player, O Bestower of Liberation ... Cowherd Krishna, Uplifter of the Govardhana Hill"); the sheet's title and lines are this song |
| 145 | MankaliMallamma | mankali mallamma (kannada) | YES |  | vol6-137: 94% of the sheet's lines found | confirmed by the reviewer |
| 146 | SriRamaNamamu | sri rama namamu | YES |  | vol1-235: 90% of the sheet's lines found | confirmed by the reviewer |
| 147 | MunnaMorayiram | munna morayiram | YES |  | vol2-132: 67% of the sheet's lines found | confirmed by the reviewer |
| 148 | DarshanamAmbike | darsanam ambike mohanam | YES |  | vol3-49: 100% of the sheet's lines found | confirmed by the reviewer |
| 149 | Venkataramana | venkataramana | YES |  | vol2-227: 100% of the sheet's lines found | confirmed by the reviewer |
| 150 | GovindaKrishnaJai | govinda krsna jai | YES |  | vol1-90: 100% of the sheet's lines found | confirmed by the reviewer |
