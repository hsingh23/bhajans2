# Rater rubric: language and deity of Amma bhajans

You get a JSON list of songs (id, title, lyrics in IAST transliteration, English meaning). Labels are hidden on purpose. Read the LYRICS themselves, not the title.

## language
The language whose GRAMMAR carries the song (verb forms, case endings, pronouns, particles), not the language of the vocabulary. Many bhajans are Sanskrit-heavy Malayalam/Hindi/Tamil: Sanskrit nouns and epithets with regional grammar.
- Malayalam markers: -unnu/-unnū (verbs), ente/ninte/nin/ninne/enne, ñān, -ude/-inde, -il, -ē vocative + -um, allō, vēṇam/vēṇḍa, tannu, kāṇum, entinu, ammē with Malayalam verbs.
- Tamil markers: nān/nī/un/en, -ai accusative (uṇmaiyai), -ukku, -il, -um, vā/vārāy, vēṇḍum, illai, ammā with -ēn/-āy/-ār verb endings, zh (ழ) in ulagam/pazham etc., kaḷ plurals with -ellām.
- Kannada: nā/nānu, ninna/nanna, -alli, -ige, bā, illa, -ide/-uvenu. Telugu: nēnu/nīvu, nī/nā, -lō, -ni, -ki, rā/rāvā, lēdu, -ānu/-āvu.
- Hindi: hai/haiṃ/hū̃, mērē/mērī/terē, kī/kā/kē/kō/mēṃ/sē, karō/dō/āō. Braj: mōhe, kāhe, hamārō, tihārō, bhayō. Marathi: mājhā/mājhī, tujhā, āhe, kar, -lā. Gujarati: chhe/che, mārā, tamē, nē. Punjabi: tērā/mērā with da/dī/nū̃, hō gayā, nāl.
- Sanskrit only if the grammar is Sanskrit throughout (namaḥ, namāmi, -āya/-āyai datives, vande, jaya with vocatives, bhaja, -asi/-ati verbs, compounds with no regional verbs). A song made only of divine names/vocatives with "jaya"/"namo" and no regional grammar = Sanskrit.
- If two languages each carry real grammar (e.g. Sanskrit refrain + Malayalam verses), give the dominant one as `lg` and the other in `lg2`.
- The meaning field sometimes contains a note like "(tamil)" or "(sanskrit – 2014)": report it in `note` but judge from the lyrics.

## deity
The primary deity the song is addressed to or about. One of: Amma, Devi, Krishna, Vishnu, Rama, Shiva, Ganesha, Murugan, Ayyappa, Hanuman, Guru, Universal, Other.
- Amma = the song names Mata Amritanandamayi / Amṛtānandamayī / Amṛtēśvarī / Amṛtapurī / Sudhāmaṇi / "Ammā" as the living Guru-mother, or speaks of her as Guru in human form.
- Devi = the Divine Mother by Devi names (Kāḷī, Durgā, Ambā, Bhavānī, Pārvatī, Lalitā, Mūkāmbikā, Dēvī, Jaganmātā) with no specific Amritanandamayi reference. Generic "Ammā"/"Mother" addressing the cosmic Mother with Devi epithets is Devi.
- Guru = addressed to the Guru in general (Satguru, Guru) without naming Amma.
- Universal = no addressee/teaching song (vedantic, love, peace, nature, the mind, life's impermanence), or addresses God generically.
- Krishna includes Gopāla/Kaṇṇā/Rādhā songs; Vishnu = Nārāyaṇa/Padmanābha/Vēṅkaṭēśa/Viṭṭhala(=Krishna); Murugan = Skanda/Kārtikēya/Subrahmaṇya.
- If two deities are equally central give `d` and `d2`.

## Output
Write one JSON object per line (JSONL) to the output path you are given, one line per input id, in input order:
{"id":"s001","lg":"Malayalam","lg2":null,"lg_conf":0.95,"lg_why":"verbs -unnu, ente, ñān","d":"Devi","d2":null,"d_conf":0.8,"d_why":"Kāḷī, Durgā; no Amritanandamayi","note":null}
Confidence = your probability (0-1) that the label is right. Be calibrated: 0.95+ only when the markers are unambiguous. Do every item; do not skip. Do not look at any other files in the repo.
