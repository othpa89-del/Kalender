import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { readFileSync } from "fs";

// App-Version aus package.json (wird in der Fußzeile angezeigt – nur Major.Minor, z. B. 1.1).
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url)));
const shortVersion = pkg.version.split(".").slice(0, 2).join(".");

// base wird im GitHub-Workflow automatisch auf /<repo-name>/ gesetzt (--base).
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(shortVersion),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: null,
      includeAssets: ["apple-touch-icon-v2.png", "favicon-v2.ico", "favicon-32-v2.png"],
      manifest: {
        name: "Kalender – Familie & Business",
        short_name: "Kalender",
        description: "Gemeinsamer Familien- und Business-Kalender mit Terminen und Aufgaben",
        theme_color: "#16233F",
        background_color: "#000000",
        display: "standalone",
        orientation: "any",
        icons: [
          { src: "icon-192-v2.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512-v2.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512-v2.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,ico,svg,woff2}"],
        navigateFallback: null
      }
    })
  ]
});
