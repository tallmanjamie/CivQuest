// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
      '@shared': '/src/shared',
      '@notify': '/src/notify',
      '@atlas': '/src/atlas',
      '@admin': '/src/admin'
    }
  },
  server: {
    port: 5173,
    // For local subdomain testing
    host: true
  }
})