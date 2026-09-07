import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
  server: { host: true },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // 학교 네트워크가 느릴 수 있다. Firebase 를 별도 덩어리로 떼어
        // 첫 화면(로그인)이 그것을 기다리지 않게 한다.
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
