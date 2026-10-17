import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // No "npm run dev" as funções /api não existem localmente: usa as do site publicado
  server: {
    proxy: {
      '/api': { target: 'https://www.cangacoalimentos.com.br', changeOrigin: true },
    },
  },
})
