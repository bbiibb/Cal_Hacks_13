import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The privacy layer's web worker lazy-loads transformers.js, which needs code splitting.
  worker: { format: 'es' },
})
