var fs = require("fs");
var path = require("path");
var _ = require("lodash");
var distance = require("jaro-winkler");

/**
 * The makeSearchable function takes a bhajan name and returns a modified version of the name
 *  with certain characters replaced or removed.
 * This modified string is intended to be used as a search key for matching with entries in the JSON file.
 * @param {string} bhajanName
 * @returns
 */
const makeSearchable = (bhajanName) =>
  bhajanName
    .toLowerCase()
    .replace(/[^A-z0-9]/g, "")
    .replace(/va/g, "v") //bhava ~= bhav
    .replace(/h/g, "")
    .replace(/z/g, "r")
    .replace(/ri?/g, "ri")
    .replace(/a+/g, "a")
    // .replace(/ai?/g, "ai")
    .replace(/ee/g, "i")
    .replace(/oo|uu/g, "u")
    .replace(/[kg]il/g, "kgil") // 2
    .replace(/[cj]al/g, "Cal")
    .replace(/[vw]/g, "V")
    .replace(/ny?/g, "ny")
    .replace(/(t|k|c){2}/g, "$1")
    .replace(/(g|p|j){2}/g, "$1")
    .replace(/[ie]*y/g, "Y")
    .replace(/[tdl]/g, "T");

var bhajans,
  searchableBhajans,
  searchableBhajansObject,
  count,
  noMatch,
  manyMatches,
  noMatchSheet,
  manyMatchesSheet;

function readBhajanIndex() {
  bhajans = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../../public/bhajan-index2.json"))
  );
  // TODO hack to remove songs that don't have a real volume associated with them.
  bhajans = _.filter(
    bhajans,
    (value) => !!value.l[0] && value.l[0].match(/\d{4}supl\d?-\d+|vol\d-\d+/gi)
  );
  searchableBhajans = [];
  searchableBhajansObject = {};
  bhajans.forEach((bhajan, i) => {
    !bhajan.n && console.log(bhajan, i);
    var s = makeSearchable(bhajan.n);
    if (bhajan.t) bhajan.t = _.sortedUniq(bhajan.t);
    searchableBhajansObject[s] = i;
    searchableBhajans.push(s);
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
  const addSong = (fullSearch, song) => {
    const realBhajan = bhajans[searchableBhajansObject[fullSearch]];
    realBhajan.cu = realBhajan.cu || [];
    realBhajan.cs = realBhajan.cs || [];
    realBhajan.cn = realBhajan.cn || [];
    realBhajan.cu.push(song.u);
    realBhajan.cs.push(
      song.mp3.replace(
        /https:\/\/content.cdbaby.com\/audio\/samples\/.*?\//,
        "https://singwithamma.s3.amazonaws.com/samples/"
      )
    );
    realBhajan.cn.push(song.name);
    count += 1;
  };

  // read all JSON files in the current directory
  fs.readdirSync(path.resolve(__dirname))
    .filter((x) => x.endsWith("json"))
    .forEach((f) => {
      // parse the JSON data and process each song
      JSON.parse(fs.readFileSync(path.resolve(__dirname, f))).forEach(
        (song) => {
          // create a searchable version of the song name
          const searchableName = makeSearchable(
            song.name.replace(/[\[\(].*[\]\)]/gi, "")
          );
          song.sn = searchableName;
          searchable[song.name] = song;

          // if the searchable name is found in the searchableBhajansObject object, add the song data to the 'bhajans' array
          if (searchableBhajansObject[searchableName]) {
            addSong(searchableName, song);
          } else {
            // if the searchable name is not found, find matches that start with or contain the searchable name
            const matches = searchableBhajans.filter(
              (b) =>
                b.startsWith(searchableName) || b.includes(`(${searchableName}`)
            );
            // if there is one match, add the song data to the 'bhajans' array
            if (matches.length === 1) {
              addSong(matches[0], song);
              // if there are no matches, add the song to the 'noMatch' array
            } else if (matches.length === 0) {
              noMatch.push(song);
              // if there are many matches, add the song data to the 'bhajans' array for each match and add the song and matches to the 'manyMatches' array
            } else {
              matches.forEach((fullSearch) => addSong(fullSearch, song));
              manyMatches.push([song, matches]);
            }
          }
        }
      );
    });

  // write the 'searchable' object, 'noMatch' array, and 'manyMatches' array to separate JSON files
  fs.writeFileSync(
    path.resolve(__dirname, "../cdbaby.json"),
    JSON.stringify(searchable)
  );
  fs.writeFileSync(
    path.resolve(__dirname, "../noMatch.json"),
    JSON.stringify(noMatch)
  );
  fs.writeFileSync(
    path.resolve(__dirname, "../manyMatches.json"),
    JSON.stringify(manyMatches)
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

function readSheetMusic() {
  var smCount = 0;
  var total = 0;
  noMatchSheet = [];
  manyMatchesSheet = [];
  function addSheetMusic(searchableName, filename) {
    var realBhajan = bhajans[searchableBhajansObject[searchableName]];
    realBhajan.sm = realBhajan.sm || [];
    realBhajan.sm.push(filename);
    smCount += 1;
  }
  fs.readFileSync(path.resolve(__dirname, "../sheetmusiclist.txt"))
    .toString()
    .split("\n")
    // fs.readdirSync(path.resolve(__dirname, "../../public/pdfs/sheetmusic/"))
    .filter((x) => x.endsWith("pdf"))
    .map((filename) => {
      var name = filename
        .replace(/[A-Z][mb]*(?:sharp)?[mb]*\.pdf$/, "")
        .replace(/\(.*\)|\d*/, "");
      // console.log(name);
      total += 1;
      var searchableName = makeSearchable(name);
      if (searchableBhajansObject[searchableName]) {
        addSheetMusic(searchableName, filename);
      } else {
        var matches = searchableBhajans.filter(
          (b) => b.startsWith(searchableName) || b.includes(`${searchableName}`)
        );
        if (matches.length === 1) {
          addSheetMusic(matches[0], filename);
        } else if (matches.length === 0) {
          console.log(filename, name, searchableName);
          const matched = [];
          searchableBhajans.map((searchableBhajan) => {
            const d = distance(searchableBhajan, searchableName, {
              caseSensitive: false,
            });
            if (d >= 0.89) {
              matched.push(searchableBhajan);
              addSheetMusic(searchableBhajan, filename);
              console.log(name, searchableName, searchableBhajan, d);
            }
          });
          // if (matched.length === 0) console.log(name, searchableName);
        } else {
          matches.forEach((fullSearch) => addSheetMusic(fullSearch, filename));
          manyMatchesSheet.push([filename, matches]);
        }
      }
    });
  const noMatch = Object.keys(noMatchSheet).length;
  const manyMatch = Object.keys(manyMatchesSheet).length;
  console.log(
    `Total sheetmusic: ${total}, Match: ${
      total - noMatch - manyMatch
    }, No Match: ${noMatch}, Many Matches: ${manyMatch}`
  );
}

readBhajanIndex();
readFiles();
readSheetMusic();
writeNewBhajanIndex();
