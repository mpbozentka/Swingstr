import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import process from 'node:process'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  cacheDir: path.resolve(process.cwd(), 'node_modules/.vite'),
})
