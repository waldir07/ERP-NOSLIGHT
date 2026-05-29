import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'   // ← importa esto

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),   // ← esto hace que @/ = src/
    },
  },

  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000', // 👈 Cambiamos 'http://localhost' por 'http://localhost:8000'
        changeOrigin: true,
        secure: false,
      },
    },
  },
})