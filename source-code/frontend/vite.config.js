import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Khi phát triển, /api và /uploads được chuyển tới backend (mặc định cổng 4000)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': process.env.VITE_BACKEND || 'http://localhost:4000',
      '/uploads': process.env.VITE_BACKEND || 'http://localhost:4000',
    },
  },
})
