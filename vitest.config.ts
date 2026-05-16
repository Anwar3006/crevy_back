// vitest.config.ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/tests/setup.ts'],

    env: {
      NODE_ENV:            'test',
      APP_PORT:            '4001',
      DATABASE_URL:        'postgresql://localhost:5433/crevy_test',
      SALT_WORK_FACTOR:    '10',
      FRONTEND_URL:        'http://localhost:3000',
      API_VERSION:         'v2',
      BETTER_AUTH_SECRET:  'test-secret-do-not-use-in-production-32chars',
      BETTER_AUTH_URL:     'http://localhost:4001/api/auth',
      // CraftedClimate webhook secret — used by mrv_webhook.middleware.ts
      // to authenticate incoming Worker 2 and Worker 3 webhook calls.
      CC_WEBHOOK_SECRET:   'cc-test-webhook-secret-do-not-use-in-prod',
    },

    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['node_modules', 'drizzle', 'dist'],
    },
    pool: 'forks',
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@':       path.resolve(__dirname, './src'),
      '@config': path.resolve(__dirname, './src/config'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@v1':     path.resolve(__dirname, './src/v1'),
      '@v2':     path.resolve(__dirname, './src/v2'),
    },
  },
})
