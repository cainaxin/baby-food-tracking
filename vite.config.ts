import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// BUILD_NATIVE=1 时给 Capacitor 打包：不注入 Service Worker，
// 避免 APK 更新后旧 SW 缓存挡住新界面（Web 版走原有 PWA 逻辑不受影响）
const isNative = process.env.BUILD_NATIVE === '1'

export default defineConfig({
  plugins: [
    react(),
    ...(isNative
      ? []
      : [
          VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.svg'],
            manifest: {
              name: '宝宝日记',
              short_name: '宝宝日记',
              description: '记录宝宝作息与喂养，全家实时可见',
              theme_color: '#0A84FF',
              background_color: '#F2F2F7',
              display: 'standalone',
              start_url: '/',
              lang: 'zh-CN',
              icons: [
                {
                  src: 'pwa-192.png',
                  sizes: '192x192',
                  type: 'image/png',
                },
                {
                  src: 'pwa-512.png',
                  sizes: '512x512',
                  type: 'image/png',
                },
              ],
            },
            workbox: {
              globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
            },
          }),
        ]),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // 允许局域网 IP 与公网隧道域名访问
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
  },
})
