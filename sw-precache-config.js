module.exports = {
  stripPrefix: 'build/',
  staticFileGlobs: ['build/*.html', 'build/static/**/!(*map*)', 'build/bhajan-index.json', 'build/*.png', 'build/*.jpg', 'build/*.ico', 'build/pdfs/*.pdf'],
  dontCacheBustUrlsMatching: /\.\w{8}\./,
  swFilePath: 'build/service-worker.js',
};
