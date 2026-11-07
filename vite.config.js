import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";

// Lyrics books under public/pdfs, each with a content fingerprint ("rev").
// They are not precached at install; the app downloads them later
// (src/pdfPrefetch.js) and re-downloads a book only when its rev changes.
const PDF_DIR = new URL("./public/pdfs/", import.meta.url);
const LYRICS_PDFS = readdirSync(PDF_DIR)
  .filter((file) => /\.pdf$/i.test(file))
  .sort()
  .map((file) => ({
    url: `/pdfs/${file}`,
    rev: createHash("sha256").update(readFileSync(new URL(file, PDF_DIR))).digest("hex").slice(0, 12),
  }));


// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __LYRICS_PDFS__: JSON.stringify(LYRICS_PDFS),
  },
  plugins: [
    // React Compiler through plugin-react's native (oxc) port; no Babel in our build.
    react({ compiler: { target: "19" } }),
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
        // Shows Firebase Cloud Messaging pushes (opt-in, see src/notifications.js).
        importScripts: ["push-handler.js"],
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/__\/auth\//, /reset\.html$/],
        globPatterns: [
          "**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,gif,json,woff,woff2,ttf,wasm,lottie}",
        ],
        runtimeCaching: [
          {
            urlPattern: /\/pdfs\/.*\.(pdf|PDF)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "pdfs-cache",
              // PDF.js asks for byte ranges; serve them from the cached full file.
              rangeRequests: true,
              // No expiration: lyrics books stay available offline indefinitely.
              // Updated books are replaced by src/pdfPrefetch.js when their rev changes.
              cacheableResponse: {
                statuses: [0, 200],
              },
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
