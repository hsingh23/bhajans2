import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { VitePWA } from "vite-plugin-pwa";


// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // plugin-react 6 no longer runs Babel itself; the React Compiler goes through @rolldown/plugin-babel.
    babel({ presets: [reactCompilerPreset({ target: "19" })] }),
    VitePWA({
      registerType: "autoUpdate",
      filename: "service-worker2.js",
      includeAssets: ["favicon.ico", "apple-touch-icon.png"],
      manifest: {
        name: "Amma's Bhajans",
        short_name: "Bhajans",
        description: "Search bhajans and find lyrics quickly and easily.",
        theme_color: "#ffa500",
        icons: [
          {
            src: "android-chrome-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "android-chrome-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/__\/auth\//, /reset\.html$/],
        globPatterns: [
          "**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,gif,pdf,json,woff,woff2,ttf,wasm,lottie}",
        ],
        runtimeCaching: [
          {
            urlPattern: /\/pdfs\/.*\.(pdf|PDF)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "pdfs-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.google-analytics\.com\/.*/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-analytics",
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 3000,
  },
  build: {
    rollupOptions: {
      output: {
        // Rolldown (Vite 8) only accepts the function form.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'vendor';
          if (/node_modules\/(@firebase|firebase)\//.test(id)) return 'firebase';
          if (/node_modules\/(@mui|@emotion)\//.test(id)) return 'mui';
          return undefined;
        },
      },
    },
  },

  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/setupTests.js"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
    include: ["src/**/*.{test,spec}.{js,jsx}"],
  },
});
