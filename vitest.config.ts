import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    pool: 'forks', // CI 环境使用子进程池，避免线程相关问题
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  oxc: {
    jsx: 'automatic',
  },
})
