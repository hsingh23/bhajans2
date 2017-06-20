module.exports = {
  stripPrefix: 'build/',
  staticFileGlobs: ['build/*.html', 'build/manifest.json', 'build/static/**/!(*map*)', 'build/pdfs/*.pdf', 'bhajan-index.json', '*.png', '*.jpg', '*.ico'],
  dontCacheBustUrlsMatching: /\.\w{8}\./,
  swFilePath: 'build/service-worker.js',
};
