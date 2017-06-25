module.exports = {
  stripPrefix: 'build/',
  staticFileGlobs: ['build/*.html', 'build/static/**/!(*map*)', 'build/pdfs/*.pdf', 'build/bhajan-index.json', 'build/*.png', 'build/*.jpg', 'build/*.ico'],
  dontCacheBustUrlsMatching: /\.\w{8}\./,
  swFilePath: 'build/service-worker.js',
};
