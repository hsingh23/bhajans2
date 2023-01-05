var fs = require("fs");
var path = require("path");
var _ = require("lodash");

const translationMap = {
  à: "a",
  à: "a",
  À: "a",
  ā: "a",
  ā: "a",
  á: "d",
  á: "d",
  ã: "h",
  å: "n",
  å: "n",
  ä: "r",
  ä: "r",
  Ä: "r",
  â: "t",
  â: "t",
  ç: "s",
  ç: "s",
  ḍ: "d",
  ḍ: "d",
  è: "e",
  è: "e",
  È: "e",
  ē: "e",
  ē: "e",
  ë: "m",
  ê: "n",
  ê: "n",
  é: "s",
  é: "s",
  É: "s",
  É: "s",
  ḥ: "h",
  ì: "i",
  ì: "i",
  ī: "i",
  ī: "i",
  î: "l",
  î: "l",
  ḷ: "l",
  ḷ: "l",
  ñ: "n",
  ñ: "n",
  Ñ: "n",
  ṅ: "n",
  ṇ: "n",
  ṇ: "n",
  ø: "e",
  ó: "o",
  ò: "o",
  ò: "o",
  Ò: "o",
  ö: "o",
  ō: "o",
  ō: "o",
  ṛ: "r",
  ṛ: "r",
  ś: "s",
  ś: "s",
  ṣ: "s",
  ṣ: "s",
  ṭ: "l",
  // ṭ: "t",
  ṭ: "t",
  ù: "u",
  ù: "u",
  ŭ: "u",
  ū: "u",
  ū: "u",
  û: "u",
  ï: "i",
};

const name = "vol1";
var md = fs.readFileSync(path.resolve(__dirname, `${name}.md`)).toString();

Object.entries(translationMap).forEach(([k, v]) => {
  // Find funky chars with [^A-z0-9 ,*!.()–\-=;:?"'&]
  md = md.replaceAll(new RegExp(k, "ig"), v);
});

md = md
  .replaceAll(/\*\*((?=.*[A-Z])[A-z ]*)\*\*/g, (match, p1) => {
    return `## ${p1.toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase())}`;
  })
  .replaceAll(/\n*```\nDevotional songs .*\n```\n*/gm, "\n")
  .replaceAll(/\n*\d+ _Bhajanamritam 1_\n*/gm, "\n")
  .replaceAll(/[‘’]/g, "'")
  .replaceAll(/[“”]/g, '"');

fs.writeFileSync(`${name}-new.md`, md);
