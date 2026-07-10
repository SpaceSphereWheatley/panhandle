import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The live app is served at /app.html (public/index.html is a separate,
// unrelated marketing landing page — see CLAUDE.md). Vite defaults to
// building index.html at the project root, so the entry is pointed at
// app.html instead; that also means Vite never emits a dist/index.html of
// its own, so public/index.html's copy-through (via publicDir) is left
// untouched instead of being overwritten.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: fileURLToPath(new URL('./app.html', import.meta.url)),
    },
  },
  server: {
    // Local dev (`npm run dev`) starts at /app.html instead of Vite's usual "/".
    open: '/app.html',
  },
})
