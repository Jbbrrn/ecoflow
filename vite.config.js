import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname),
  publicDir: path.resolve(__dirname, 'public'),
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    extensions: ['.js', '.jsx', '.json'],
  },
  // Server config (used in dev mode, middleware mode ignores most of this)
  server: {
    port: 5173,
    strictPort: false,
    host: true, // Allow external connections
    allowedHosts: [
      'localhost',
      '.onrender.com', // Allow all Render subdomains
      '.render.com',
    ],
    hmr: {
      clientPort: 5173,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-is', 'react-router-dom', 'framer-motion', 'recharts'],
  },
  // Ensure Vite works in production middleware mode
  clearScreen: false,
  logLevel: 'info',
});
