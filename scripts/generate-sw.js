/* eslint-disable no-console */
const path = require('path');
const { generateSW } = require('workbox-build');

(async () => {
  const buildDir = path.resolve(__dirname, '../build');
  try {
    const { count, size, warnings, filePaths } = await generateSW({
      swDest: path.join(buildDir, 'service-worker2.js'),
      globDirectory: buildDir,
      globPatterns: [
        '**/*.{html,js,css,svg,png,jpg,jpeg,ico,json,woff,woff2,ttf}',
      ],
      navigateFallback: '/index.html',
      clientsClaim: true,
      skipWaiting: true,
      sourcemap: false,
      cleanupOutdatedCaches: true,
      runtimeCaching: [
        {
          urlPattern: /\/pdfs\/.*\.(pdf|PDF)$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'pdfs-cache',
            matchOptions: { ignoreVary: true },
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
            },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          urlPattern: /^https?:\/\//,
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'runtime-cache',
            expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 7 },
          },
        },
      ],
    });

    if (warnings && warnings.length) {
      console.warn('Workbox warnings:', warnings);
    }
    console.log(`Generated service worker, precached ${count} files (${size} bytes).`);
  } catch (err) {
    console.error('generateSW failed:', err);
    process.exit(1);
  }
})();
