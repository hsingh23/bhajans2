import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { readdirSync } from "node:fs";

// Lyrics books under public/pdfs. They are not precached at install; the app
// fetches them later (src/pdfPrefetch.js) once the page is idle.
const LYRICS_PDFS = readdirSync(new URL("./public/pdfs", import.meta.url))
  .filter((file) => /\.pdf$/i.test(file))
  .sort()
  .map((file) => `/pdfs/${file}`);


// https://vitejs.dev/config/
// Inlines the entry stylesheet into index.html so it doesn't block the first paint.
const inlineEntryCss = () => ({
  name: "inline-entry-css",
  apply: "build",
  enforce: "post",
  generateBundle(_, bundle) {
    const page = bundle["index.html"];
    if (!page || page.type !== "asset") return;
    page.source = String(page.source).replace(
      /<link rel="stylesheet"[^>]*href="\/(assets\/[^"]+\.css)"[^>]*>/g,
      (tag, file) => {
        const css = bundle[file];
        return css && css.type === "asset" ? `<style>${css.source}</style>` : tag;
      }
    );
  },
});

export default defineConfig({
  define: {
    __LYRICS_PDFS__: JSON.stringify(LYRICS_PDFS),
  },
  plugins: [
    inlineEntryCss(),
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
              expiration: {
                maxEntries: 100,
                // Outlasts the 90-day offline period the app allows (src/firebase.js).
                maxAgeSeconds: 60 * 60 * 24 * 100, // 100 days
              },
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
