import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';
import type { UserConfig as VitestConfig } from 'vitest/config';

// Node.js polyfills (same as config-overrides.js - MCP SDK requires these)
const nodePolyfills = [
  'child_process', 'fs', 'net', 'tls', 'dns', 'path', 'os', 'crypto',
  'stream', 'http', 'https', 'zlib', 'util', 'buffer', 'url', 'assert',
  'querystring', 'events', 'process'
];

const nodeAliases: Record<string, string | false> = {};
for (const mod of nodePolyfills) {
  nodeAliases[mod] = false;
  nodeAliases[`node:${mod}`] = false;
}

export default defineConfig({
  plugins: [
    react(),
    svgr(),
    tsconfigPaths(),
  ],

  resolve: {
    alias: nodeAliases,
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
