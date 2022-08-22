var fs = require("fs");
var path = require("path");
var _ = require("lodash");
var distance = require("jaro-winkler");

const makeSearchable = (line) =>
  line
    .toLowerCase()
    .replace(/[^A-z0-9]/g, "")
    .replace(/va/g, "v") //bhava ~= bhav
    .replace(/h/g, "")
    .replace(/z/g, "r")
    .replace(/ri?/g, "ri")
    .replace(/a+/g, "a")
    .replace(/ai?/g, "ai")
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
  count = 0;
  noMatch = [];
  manyMatches = [];
  var total = 0;
  var searchable = {};
  function addSong(fullSearch, song) {
    var realBhajan = bhajans[searchableBhajansObject[fullSearch]];
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
  }
  fs.readdirSync(path.resolve(__dirname))
    .filter((x) => x.endsWith("json"))
    .map((f) => {
      JSON.parse(fs.readFileSync(path.resolve(__dirname, f))).map((song) => {
        var searchableName = makeSearchable(
          song.name.replace(/[\[\(].*[\]\)]/gi, "")
        );
        // if (searchable[searchableName]) console.log('Exists', searchable[searchableName].name, song.name, searchableName);
        song.sn = searchableName;
        searchable[song.name] = song;
        if (searchableBhajansObject[searchableName]) {
          addSong(searchableName, song);
          // console.log(song.name);
        } else {
          var matches = searchableBhajans.filter(
            (b) =>
              b.startsWith(searchableName) || b.includes(`(${searchableName}`)
          );
          if (matches.length === 1) {
            addSong(matches[0], song);
          } else if (matches.length === 0) {
            // console.log(song.name);
            noMatch.push(song);
          } else {
            matches.forEach((fullSearch) => addSong(fullSearch, song));
            manyMatches.push([song, matches]);
          }
        }
      });
    });
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
  // console.log(noMatch.map(x => x.name));
  console.log(
    `Total Cdbaby: ${
      Object.keys(searchable).length
    }, Match: ${count}, No Match: ${
      Object.keys(noMatch).length
    }, Many Matches: ${Object.keys(manyMatches).length}`
  );

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
