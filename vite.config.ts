import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        id: "/",
        name: "En casa · Tu despensa",
        short_name: "En casa",
        description: "El inventario y la lista del súper de tu hogar.",
        lang: "es-AR",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#f6f7f2",
        theme_color: "#175b45",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico,webmanifest}"],
        navigateFallbackDenylist: [/^\/__\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/@firebase/firestore/"))
            return "firebase-firestore";
          if (id.includes("/node_modules/@firebase/auth/"))
            return "firebase-auth";
          if (id.includes("/node_modules/@firebase/")) return "firebase-core";
        },
      },
    },
  },
});
