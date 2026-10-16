import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Served from https://pradhan-not-found.github.io/Roadster/
  base: '/Roadster/',
})
