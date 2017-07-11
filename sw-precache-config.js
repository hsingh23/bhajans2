module.exports = {
  stripPrefix: 'build/',
  staticFileGlobs: [
    'build/*.html',
    'build/static/**/!(*map*)',
    'build/bhajan-index2.json',
    'build/*.min.css',
    'build/*.min.js',
    'build/*.png',
    'build/*.jpg',
    'build/*.ico',
    'build/pdfs/*.pdf',
  ],
  navigateFallback: 'build/index.html',
  ignoreUrlParametersMatching: [/^utm_/, /^mode/],
  importScripts: ['firebase-messaging-sw.js'],
  dontCacheBustUrlsMatching: /\.\w{8}\./,
  swFilePath: 'build/service-worker.js',
};
