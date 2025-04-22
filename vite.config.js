// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';


// Needed for __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  base: '/FleetManager_React_WebApp/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  // Optional: you can remove the proxy entirely if you're using the deployed backend
  server: {
    proxy: {
      '/api': {
        target: 'https://fleetmanager-react-webapp.onrender.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});

