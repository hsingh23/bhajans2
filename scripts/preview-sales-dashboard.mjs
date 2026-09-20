// Local review only. Never puts production records in public/ or a production build.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { build, preview } from "vite";
const require = createRequire(import.meta.url);
const { aggregateDashboard } = require("../admin-functions/analytics.cjs");
const root = process.cwd();
const cache = path.join(root, "node_modules/.cache/dashboard-data");
const inputs = Object.fromEntries(
  ["paid", "transactions", "favorites"].map((name) => [
    name,
    JSON.parse(fs.readFileSync(path.join(cache, name + ".json"), "utf8")),
  ]),
);
const data = aggregateDashboard(inputs);
const ids = new Map();
const anonymize = (uid) => {
  if (!uid) return null;
  if (!ids.has(uid))
    ids.set(uid, `Account ${String(ids.size + 1).padStart(4, "0")}`);
  return ids.get(uid);
};
data.members.forEach((row) => {
  row.uid = anonymize(row.uid);
});
data.purchases.forEach((row, i) => {
  row.uid = anonymize(row.uid);
  row.orderKey = `order-${i + 1}`;
});
const entry = path.join(root, "node_modules/.cache/dashboard-review");
fs.mkdirSync(entry, { recursive: true });
fs.writeFileSync(path.join(entry, "review.json"), JSON.stringify(data), {
  mode: 0o600,
});
fs.writeFileSync(
  path.join(entry, "index.html"),
  `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sing With Amma · local analytics review</title></head><body><div id="root"></div><script type="module" src="./entry.jsx"></script></body></html>`,
);
fs.writeFileSync(
  path.join(entry, "entry.jsx"),
  `import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';import {ThemeProvider} from '../../../src/ThemeContext.jsx';import {SalesDashboardView} from '../../../src/SalesDashboard.jsx';import '../../../src/index.css';import '../../../src/App.css';import data from './review.json';createRoot(document.getElementById('root')).render(<MemoryRouter><ThemeProvider><div style={{position:'fixed',bottom:0,left:0,right:0,zIndex:9999,padding:8,background:'#173d32',color:'white',textAlign:'center',font:'12px Arial'}}>Local review · real aggregates · account identifiers removed · snapshot data</div><SalesDashboardView data={data}/></ThemeProvider></MemoryRouter>);`,
);
// Source is three levels above this cache folder. Use a dedicated output, never dist/.
const outDir = path.join(entry, "dist");
await build({
  root,
  configFile: false,
  build: {
    outDir,
    emptyOutDir: true,
    rollupOptions: { input: path.join(entry, "index.html") },
  },
  logLevel: "warn",
});
const server = await preview({
  root,
  configFile: false,
  build: { outDir },
  preview: { host: "127.0.0.1", port: 4187, strictPort: true },
});
server.printUrls();
console.log("Review path: /node_modules/.cache/dashboard-review/index.html");
