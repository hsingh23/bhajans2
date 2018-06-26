var fs = require("fs");
var path = require("path");
var _ = require("lodash");
const makeSearchable = line =>
  line
    .toLowerCase()
    .replace(/[^A-z0-9]/g, "")
    .replace(/ri?/g, "ri")
    .replace(/[kg]il/g, "kgil") // 2
    .replace(/[vw]/g, "vw")
    .replace(/ny?/g, "ny")
    .replace(/h/g, "")
    .replace(/a+/g, "a")
    .replace(/k+/g, "k")
    .replace(/t+/g, "t")
    .replace(/[iey]+/g, "iey")
    .replace(/[uo]+/g, "uo")
    .replace(/[tdl]/g, "tdl")
    .replace(/z/g, "r");

var bhajans, searchableBhajans, searchableBhajansObject, count, noMatch, manyMatches, noMatchSheet, manyMatchesSheet;

function readBhajanIndex() {
  bhajans = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../public/bhajan-index2.json")));
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
  fs.writeFileSync(path.resolve(__dirname, "../../public/bhajan-index3.json"), JSON.stringify(bhajans));
}

function readFiles() {
  count = 0;
  noMatch = [];
  manyMatches = [];
  var searchable = {};
  function addSong(fullSearch, song) {
    var realBhajan = bhajans[searchableBhajansObject[fullSearch]];
    realBhajan.cu = realBhajan.cu || [];
    realBhajan.cs = realBhajan.cs || [];
    realBhajan.cu.push(song.u);
    realBhajan.cs.push(
      song.mp3.replace(
        "https://content.cdbaby.com/audio/samples/d073192b/",
        "https://s3.amazonaws.com/amma-bhajan-samples/"
      )
    );
    count += 1;
  }
  fs.readdirSync(path.resolve(__dirname))
    .filter(x => x.endsWith("json"))
    .map(f => {
      JSON.parse(fs.readFileSync(path.resolve(__dirname, f))).map(song => {
        var searchableName = makeSearchable(song.name.replace(/[\[\(].*[\]\)]/gi, ""));
        // if (searchable[searchableName]) console.log('Exists', searchable[searchableName].name, song.name, searchableName);
        song.sn = searchableName;
        searchable[song.name] = song;
        if (searchableBhajansObject[searchableName]) {
          addSong(searchableName, song);
          // console.log(song.name);
        } else {
          var matches = searchableBhajans.filter(b => b.startsWith(searchableName) || b.includes(`(${searchableName}`));
          if (matches.length === 1) {
            addSong(matches[0], song);
            console.log(song.name);
          } else if (matches.length === 0) {
            noMatch.push(song);
          } else {
            manyMatches.push([song, matches]);
          }
        }
      });
    });
  fs.writeFileSync(path.resolve(__dirname, "../cdbaby.json"), JSON.stringify(searchable));
  fs.writeFileSync(path.resolve(__dirname, "../noMatch.json"), JSON.stringify(noMatch));
  fs.writeFileSync(path.resolve(__dirname, "../manyMatches.json"), JSON.stringify(manyMatches));
  console.log(noMatch);
  console.log(Object.keys(searchable).length, count, Object.keys(noMatch).length, Object.keys(manyMatches).length);

  return searchable;
}

function readSheetMusic() {
  var smCount = 0;
  noMatchSheet = [];
  manyMatchesSheet = [];
  function addSheetMusic(searchableName, filename) {
    var realBhajan = bhajans[searchableBhajansObject[searchableName]];
    realBhajan.sm = realBhajan.sm || [];
    realBhajan.sm.push(filename);
    smCount += 1;
  }
  fs.readdirSync(path.resolve(__dirname, "../../public/pdfs/sheetmusic/"))
    .filter(x => x.endsWith("pdf"))
    .map(filename => {
      var [filename, name, key] = filename.match(/(.*)([A-Z].*?)\.pdf$/);
      var searchableName = makeSearchable(name);
      if (searchableBhajansObject[searchableName]) {
        addSheetMusic(searchableName, filename);
      } else {
        var matches = searchableBhajans.filter(b => b.startsWith(searchableName) || b.includes(`(${searchableName}`));
        if (matches.length === 1) {
          addSheetMusic(matches[0], filename);
          console.log(filename);
        } else if (matches.length === 0) {
          noMatchSheet.push(filename);
        } else {
          manyMatchesSheet.push([filename, matches]);
        }
      }
    });
  console.log(smCount, Object.keys(noMatchSheet).length, Object.keys(manyMatchesSheet).length);
}

readBhajanIndex();
readFiles();
readSheetMusic();
writeNewBhajanIndex();
