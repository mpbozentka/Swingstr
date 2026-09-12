import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // onnxruntime-web loads its WASM glue by dynamic import at runtime. Vite's
  // dep pre-bundling rewrites that import and then fails to transform the
  // (huge, generated) .mjs it points at, so ORT reports "no available
  // backend". Excluding it keeps the dynamic import intact.
  optimizeDeps: { exclude: ['onnxruntime-web'] },
})
