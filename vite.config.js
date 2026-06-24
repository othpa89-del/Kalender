import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// base wird im GitHub-Workflow automatisch auf /<repo-name>/ gesetzt (--base).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
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
