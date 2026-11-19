/// <reference types="vitest/config" />
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { msw } from 'msw/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // mock 모드(npm run dev:mock)에서만 MSW worker 파일을 제공한다. 일반 개발과 배포 빌드에는 들어가지 않는다
  plugins: [react(), tailwindcss(), mode === 'mock' && msw({ mode: 'worker-only' })],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  // 같은 주소에서 /api는 백엔드(ADR 015). 개발 때는 이 proxy가 개발 백엔드로 넘긴다
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8080',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
}))
