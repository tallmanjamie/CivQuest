import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@notify': path.resolve(__dirname, './src/notify'),
      '@admin': path.resolve(__dirname, './src/admin'),
      '@atlas': path.resolve(__dirname, './src/atlas')
    }
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/arcgis-proxy': {
        target: 'https://notify.civ.quest',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/arcgis-proxy/, '')
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase')) {
            return 'firebase';
          }
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/@arcgis/core')) {
            return 'arcgis';
          }
        }
      }
    }
  },
  optimizeDeps: {
    include: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
    // Exclude ArcGIS from pre-bundling - it handles its own module loading
    exclude: ['@arcgis/core']
  }
});