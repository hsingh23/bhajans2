var fs = require("fs");
var path = require("path");
var _ = require("lodash");
var distance = require("jaro-winkler");

const { bkey, devoice, oneWordKey } = require("../../src/bkey.js");

// The key of a name as one word, so that word breaks that differ between a track
// list and the index ("Devi Dayakari" / "devi daya kari ma") agree.
const oneWord = (name) => oneWordKey(name);

// Levenshtein distance, giving up once it exceeds max.
const editDistance = (a, b, max) => {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
};

/**
 * Phonetic key shared with the app's search (src/bkey.js): "amriteshwari",
 * "amrtesvari" and "Amrteshvari" all give the same string. Replaces the old regex
 * chain that collapsed t/d/l and dropped every h.
 * @param {string} bhajanName
 * @returns {string}
 */
const makeSearchable = (bhajanName) => bkey(bhajanName).key;

var bhajans,
  searchableBhajans,
  searchableBhajansObject,
  devoicedBhajansObject = {},
  oneWordBhajans = [],
  count,
  noMatch,
  manyMatches;

function readBhajanIndex() {
  bhajans = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../../public/bhajan-index2.json"))
  );
  // TODO hack to remove songs that don't have a real volume associated with them.
  // Pattern matches: YYYYsuplN-X (supplements), volN-X (volumes), and YYYY-X (year-only like 2025-53)
  bhajans = _.filter(
    bhajans,
    (value) => value.l.some(loc => loc && loc.match(/\d{4}(?:supl\d?)?-\d+|vol\d-\d+/gi))
  );
  searchableBhajans = [];
  searchableBhajansObject = {};
  bhajans.forEach((bhajan, i) => {
    !bhajan.n && console.log(bhajan, i);
    var s = makeSearchable(bhajan.n);
    if (bhajan.t) bhajan.t = _.sortedUniq(bhajan.t);
    // several index entries can share a key (two spellings of one song): keep them all
    (searchableBhajansObject[s] = searchableBhajansObject[s] || []).push(i);
    (devoicedBhajansObject[devoice(s)] = devoicedBhajansObject[devoice(s)] || []).push(i);
    searchableBhajans.push(s);
    oneWordBhajans.push(oneWord(bhajan.n));
  });
}

function writeNewBhajanIndex() {
  fs.writeFileSync(
    path.resolve(__dirname, "../../public/bhajan-index2.json"),
    JSON.stringify(bhajans)
  );
}

function readFiles() {
  // initialize counters and arrays
  let count = 0;
  const noMatch = [];
  const manyMatches = [];
  const searchable = {};

  // define a function to add data to the 'bhajans' array
  const addSong = (fullSearch, song, only) => {
    (only === undefined ? searchableBhajansObject[fullSearch] || [] : [only]).forEach((index) => {
      const realBhajan = bhajans[index];
      realBhajan.cs = realBhajan.cs || []; // sample url
      realBhajan.cn = realBhajan.cn || []; // song
      const url = "https://bhajan-samples.withamma.com" + song.path;
      if (!realBhajan.cs.includes(url)) {
        realBhajan.cs.push(url);
        realBhajan.cn.push(song.song);
      }
    });
    count += 1;
  };

  // start from a clean slate so a rerun never keeps links an older matcher made
  bhajans.forEach((bhajan) => {
    delete bhajan.cs;
    delete bhajan.cn;
  });
  // read all JSON files in the current directory
  fs.readdirSync(path.resolve(__dirname))
    .filter((x) => x.endsWith("json"))
    .forEach((f) => {
      // parse the JSON data and process each song
      JSON.parse(fs.readFileSync(path.resolve(__dirname, f))).forEach(
        (song) => {
          // create a searchable version of the song name
          const searchableName = makeSearchable(
            song.song.replace(/[\[\(].*[\]\)]/gi, "")
          );
          song.sn = searchableName;
          searchable[song.song] = song;

          // Songs this sample belongs to: the same key, the same key in Tamil spelling
          // (ambadi/ambati), or titles that start with the sample's words. A short or
          // very common title ("Amma", "Amme") opens too many songs to pick from.
          const matches = new Set(searchableBhajansObject[searchableName] || []);
          (devoicedBhajansObject[devoice(searchableName)] || []).forEach((i) => matches.add(i));
          const exact = new Set(matches); // kept as the fallback when prefixes open too many songs
          if (searchableName.length >= 5) {
            searchableBhajans.forEach((b, i) => {
              if (b.startsWith(`${searchableName} `)) matches.add(i);
            });
          }
          // Word breaks differ between a track list and the index ("Arikilundengilum" /
          // "arikil undenkilum", "Devi Dayakari" / "devi daya kari ma"): compare without spaces.
          const joined = oneWord(song.song.replace(/[\[\(].*[\]\)]/gi, ""));
          if (joined.length >= 7) {
            oneWordBhajans.forEach((bj, i) => {
              if (bj.startsWith(joined) || (bj.length >= 7 && joined.startsWith(bj)) ||
                  devoice(bj).startsWith(devoice(joined))) matches.add(i);
            });
          }
          if (matches.size === 0 && joined.length >= 8) {
            // a misspelt track name ("Bhaktavalsale", "Mizhinirlazhnna"): one edit per eight letters, unique
            const allowed = Math.max(1, Math.floor(joined.length / 8));
            const near = [];
            oneWordBhajans.forEach((bj, i) => {
              if (Math.abs(bj.length - joined.length) <= allowed && editDistance(joined, bj, allowed) <= allowed) near.push(i);
            });
            if (near.length === 1) matches.add(near[0]);
          }
          if (matches.size > 4 && exact.size > 0) {
            matches.clear(); // "Radhe Shyam" opens six titles: keep only the exact one(s)
            exact.forEach((i) => matches.add(i));
          }
          if (matches.size === 0 || matches.size > 4) {
            noMatch.push(song);
          } else {
            matches.forEach((i) => addSong(makeSearchable(bhajans[i].n), song, i));
            if (matches.size > 1) manyMatches.push([song, [...matches].map((i) => bhajans[i].n)]);
          }
        }
      );
    });

  // write the 'searchable' object, 'noMatch' array, and 'manyMatches' array to separate JSON files
  fs.writeFileSync(
    path.resolve(__dirname, "../cdbaby.json"),
    JSON.stringify(searchable, null, 2)
  );
  fs.writeFileSync(
    path.resolve(__dirname, "../noMatch.json"),
    JSON.stringify(noMatch, null, 2)
  );
  fs.writeFileSync(
    path.resolve(__dirname, "../manyMatches.json"),
    JSON.stringify(manyMatches, null, 2)
  );

  // log the total number of songs in the 'searchable' object, the number of matches, the number of no matches, and the number of many matches
  console.log(
    `Total Cdbaby: ${
      Object.keys(searchable).length
    }, Match: ${count}, No Match: ${noMatch.length}, Many Matches: ${
      manyMatches.length
    }`
  );

  // return the 'searchable' object
  return searchable;
}

// Sheet music (`sm`) is no longer matched here by name: that produced links such as
// the English "Amme" sheet on 70 Malayalam songs. create-index/sheet-match/match.py
// matches each PDF's printed lyrics against the songbook pages and write_index.py
// saves the result as sheet-match/sm.json ({song name: [pdf files]}), copied in here.
function readSheetMusic() {
  const smFile = path.resolve(__dirname, "../sheet-match/sm.json");
  if (!fs.existsSync(smFile)) {
    console.log("No sheet-match/sm.json: run sheet-match/match.py and write_index.py; sheet music links unchanged.");
    return;
  }
  const sm = JSON.parse(fs.readFileSync(smFile));
  let linked = 0;
  bhajans.forEach((bhajan) => {
    if (sm[bhajan.n]) {
      bhajan.sm = sm[bhajan.n];
      linked += 1;
    } else {
      delete bhajan.sm;
    }
  });
  console.log(`Sheet music: ${linked} songs linked from sheet-match/sm.json`);
}

// Samples cut from Layamritam recordings (create-index/layamritam/make_samples.py) are
// linked by exact index name, never by title matching; ones that are the same recording
// as a CD sample (`dupOf`) stay unlinked. link_samples.py applies the same mapping.
function readLayamritamSamples() {
  const file = path.resolve(__dirname, "../layamritam/samples.json");
  if (!fs.existsSync(file)) return;
  const samples = JSON.parse(fs.readFileSync(file));
  let linked = 0;
  bhajans.forEach((bhajan) => {
    (samples[bhajan.n] || []).filter((e) => !e.dupOf).forEach((e) => {
      const url = "https://singwithamma.s3.amazonaws.com" + encodeURI(e.path);
      bhajan.cs = bhajan.cs || [];
      bhajan.cn = bhajan.cn || [];
      if (!bhajan.cs.includes(url)) {
        bhajan.cs.push(url);
        bhajan.cn.push(e.song);
        linked += 1;
      }
    });
  });
  console.log(`Layamritam samples: ${linked} linked from layamritam/samples.json`);
}

readBhajanIndex();
readFiles();
readLayamritamSamples();
readSheetMusic();
writeNewBhajanIndex();
