/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import yaml from '@rollup/plugin-yaml'

export default defineConfig({
  plugins: [react(), yaml()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
    globals: true,
    // Ignore nested git worktrees under .claude/ so their copies of the test
    // files aren't discovered and run alongside the real ones.
    exclude: [...configDefaults.exclude, '**/.claude/**'],
  },
})
