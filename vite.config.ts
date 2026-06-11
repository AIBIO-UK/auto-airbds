import { fileURLToPath } from 'node:url'
import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import yaml from '@rollup/plugin-yaml'

export default defineConfig({
  plugins: [react(), yaml()],
  build: {
    rollupOptions: {
      input: {
        // Public SPA at / and a separate admin entry built to dist/admin/
        // index.html, served at the real path /admin (which Cloudflare Access
        // protects). Keeping it a distinct entry keeps admin code out of the
        // public bundle.
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin/index.html', import.meta.url)),
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
    globals: true,
    // Ignore nested git worktrees under .claude/ so their copies of the test
    // files aren't discovered and run alongside the real ones.
    exclude: [...configDefaults.exclude, '**/.claude/**'],
  },
})
