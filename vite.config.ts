import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// @tauri-apps/cli sets TAURI_DEV_HOST when developing on a physical device.
const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],

  // react-draggable (via react-grid-layout) reads process.env.DRAGGABLE_DEBUG
  // on every drag start. The browser has no `process` global, so in dev mode
  // (where this isn't dead-code-eliminated like it is in a production build)
  // that throws and silently kills drag/resize. Inline it so esbuild drops
  // the branch.
  define: {
    "process.env.DRAGGABLE_DEBUG": "false",
  },

  // Prevent Vite from clearing Rust/Tauri logs from the terminal.
  clearScreen: false,

  server: {
    // Tauri expects a fixed port and fails if it is unavailable.
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // Don't watch the Rust/Python sources from the Vite dev server.
      ignored: ["**/src-tauri/**", "**/bridge/**"],
    },
  },

  // Produce a build that targets the WebView versions Tauri ships with.
  build: {
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: process.env.TAURI_ENV_DEBUG ? false : "esbuild",
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
