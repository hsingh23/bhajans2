const fs = require("fs");

const translation = {
  ḍ: "d",
  ā: "a",
  ṇ: "n",
  ū: "u",
  ó: "o",
  ö: "o",
  é: "e",
  ē: "e",
  ī: "i",
  è: "e",
  à: "a",
  ō: "o",
  ḷ: "l",
  ï: "i",
  ṭ: "t",
  ś: "s",
  ñ: "n",
  î: "i",
  â: "a",
  ê: "e",
  ṛ: "r",
  ṣ: "s",
  ù: "u",
  ä: "a",
  ü: "u",
  í: "i",
  ò: "o",
  ô: "o",
  ṅ: "n",
  ṙ: "r",
  ḥ: "h",
  ø: "o",
  "̣": "",
  "̄": "",
  "̇": "",
  ṫ: "t",
  "…": "",
  ŭ: "u",
};
// Read the file
fs.readFile("cd-sample-names.txt", "utf8", (err, data) => {
  if (err) {
    throw err;
  }
  data = data.toLowerCase().replaceAll(".mp3", "");
  Object.entries(translation).map(([k, v]) => {
    data = data.replaceAll(k, v);
  });
  data = data.replaceAll(/['!",0-9¡&\‘\’\(\)_\-\.]/gi, "");
  data = data.replaceAll(/ +/g, " ");
  data = data.replaceAll(/\n /g, "\n");

  fs.writeFileSync("cleaned-cd-sample-names.txt", data);
  data = data.replaceAll("\n", " ");
  data = data.replaceAll("\\", "");

  // Split the file into an array of words
  const words = data.split(" ");

  // Keep track of how many times each character has been found
  const matches = {};

  // Loop through the words and check for non-a-z characters
  for (const word of words) {
    for (const char of word) {
      if (/[^a-z]/i.test(char)) {
        if (!matches[char]) {
          matches[char] = [];
        }
        matches[char].length <= 5 && matches[char].push(word);
      }
    }
  }

  console.log(JSON.stringify(matches, null, 2));
});
