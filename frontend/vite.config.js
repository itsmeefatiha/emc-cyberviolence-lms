/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const BACKEND = 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    globals: true,
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/test/**',
        'src/tests/**',
        'src/**/*.test.{js,jsx}',
        'src/main.jsx',
      ],
    },
  },
  server: {
    proxy: {
      '/api': {
        target: BACKEND,
        changeOrigin: true,
      },
      '/media': {
        target: BACKEND,
        changeOrigin: true,
      },
    },
  },
})