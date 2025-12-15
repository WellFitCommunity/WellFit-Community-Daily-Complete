import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';
import type { UserConfig as VitestConfig } from 'vitest/config';

// Node.js modules that should be stubbed for browser (MCP SDK, etc.)
// Using empty object export instead of false (which doesn't work in Vite 7+)
const nodeModules = [
  'child_process', 'fs', 'net', 'tls', 'dns', 'path', 'os',
  'stream', 'http', 'https', 'zlib', 'util', 'url', 'assert',
  'querystring', 'events'
];

export default defineConfig({
  plugins: [
    react(),
    svgr(),
    tsconfigPaths(),
  ],

  resolve: {
    alias: {
      // Stub out Node.js-only modules with empty exports
      ...Object.fromEntries(nodeModules.flatMap(mod => [
        [mod, 'data:text/javascript,export default {};export const __esModule = true;'],
        [`node:${mod}`, 'data:text/javascript,export default {};export const __esModule = true;']
      ])),
    },
  },

  optimizeDeps: {
    // Only scan the main entry point, not test HTML files
    entries: ['index.html'],
    // Exclude packages that have Node.js conditional imports
    // bcryptjs checks for crypto at runtime and works fine in browser
    exclude: ['bcryptjs'],
  },

  server: {
    port: 3000,
    open: true,
    // Codespaces support
    host: true,
    hmr: {
      clientPort: process.env.CODESPACES ? 443 : undefined,
    },
  },

  build: {
    outDir: 'build',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          ui: ['lucide-react', 'framer-motion', 'react-toastify'],
        },
      },
    },
  },

  // Preview server (for testing production builds)
  preview: {
    port: 3000,
  },

  // Vitest configuration
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    exclude: ['node_modules', 'build', 'dist', 'supabase'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test-utils/'],
    },
    // Test environment variables
    env: {
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
} as UserConfig & { test: VitestConfig['test'] });

// Type augmentation for Vite config with Vitest
type UserConfig = ReturnType<typeof defineConfig>;
