import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    host: 'localhost',
    strictPort: true
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/pixi') || id.includes('node_modules/@pixi')) return 'vendor-pixi';
          if (id.includes('node_modules/socket.io') || id.includes('node_modules/engine.io')) return 'vendor-socket';
          if (id.includes('node_modules/styled-components')) return 'vendor-styled';
          if (id.includes('node_modules/react-player')) return 'vendor-player';
          if (id.includes('node_modules/react-router')) return 'vendor-router';
          if (id.includes('node_modules/react-dom')) return 'vendor-react-dom';
          if (id.includes('node_modules/react/')) return 'vendor-react';
          if (id.includes('node_modules/')) return 'vendor-misc';
        }
      }
    }
  }
})
