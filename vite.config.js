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
    // Proxy for ArcGIS services (development only)
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
        manualChunks: {
          // Separate vendor chunks for better caching
          'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'arcgis': ['@arcgis/core'],
          'react-vendor': ['react', 'react-dom']
        }
      }
    }
  },
  // Optimize deps for ArcGIS
  optimizeDeps: {
    include: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
    exclude: ['@arcgis/core']
  }
});
