var fs = require('fs');
var _ = require('lodash');
var path = require('path');

var bhajans = fs
  .readFileSync('./bhajanmritam.txt')
  .toString()
  .split('\n');
var tags = fs
  .readFileSync('./tags.txt')
  .toString()
  .split('\n');

var language = {};
tags.forEach(a => {
  const [name, lang] = a.split('##');
  language[name] = lang;
});

var newData = bhajans
  .map(a => {
    const [name, vol] = a.split('##');
    return `${name} ${language[name] ? `(${language[name]})` : ''}##${vol}`.replace(' ##', '##');
  })
  .join('\n');

var bhajans = fs.writeFileSync('./bhajanmritamWithLang.txt', newData);
