import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Electron (Chromium) and every modern browser load the woff2 source, so the
// legacy .woff fallbacks referenced by fontsource CSS only bloat the build
// (~41 MB of duplicate font data). Stripping the fallback URLs before Vite's
// CSS pipeline runs means the .woff files are never emitted as assets.
const stripWoffFallbacks = () => ({
  name: 'strip-woff-fallbacks',
  enforce: 'pre',
  transform(code, id) {
    if (id.includes('@fontsource') && id.endsWith('.css')) {
      return {
        code: code.replace(/,\s*url\([^)]+\.woff\)\s+format\(['"]woff['"]\)/g, ''),
        map: null,
      }
    }
  },
})

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [stripWoffFallbacks(), react()],
  base: './',
  server: {
    port: 5173,
    host: 'localhost',
    strictPort: true
  },
  // The game ships in Electron (Steam) and modern browsers; both support
  // es2020 natively, so we avoid the legacy down-leveling that would inflate
  // bundle size and slow JIT warm-up.
  esbuild: {
    legalComments: 'none',
    // Mark these console calls as side-effect free so esbuild can drop them
    // from the production bundle. Hot paths (collision, animation, broadcast)
    // contain console calls that incur string-formatting cost even when
    // devtools are closed. console.warn / console.error are kept so real
    // errors remain visible.
    pure: ['console.log', 'console.debug', 'console.info', 'console.trace'],
    drop: ['debugger'],
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1500,
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
