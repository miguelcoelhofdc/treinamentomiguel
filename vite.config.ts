import { Buffer } from 'node:buffer'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import recognizeHandwriting from './api/recognize-handwriting'

function apiDevPlugin(): Plugin {
  return {
    name: 'app-api-dev',
    apply: 'serve',
    configureServer(server) {
      for (const [path, handler] of [
        ['/api/recognize-handwriting', recognizeHandwriting],
      ] as const) server.middlewares.use(path, async (request, response) => {
        try {
          const chunks: Buffer[] = []
          for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))

          const headers = new Headers()
          Object.entries(request.headers).forEach(([key, value]) => {
            if (Array.isArray(value)) value.forEach(item => headers.append(key, item))
            else if (value !== undefined) headers.set(key, value)
          })

          const method = request.method || 'GET'
          const host = request.headers.host ?? '127.0.0.1'
          const search = (request.url ?? '').split('?')[1]
          const webRequest = new Request('http://' + host + path + (search ? '?' + search : ''), {
            method,
            headers,
            body: method === 'GET' || method === 'HEAD' ? undefined : Buffer.concat(chunks),
          })
          const webResponse = await handler.fetch(webRequest)
          response.statusCode = webResponse.status
          webResponse.headers.forEach((value, key) => response.setHeader(key, value))
          response.end(Buffer.from(await webResponse.arrayBuffer()))
        } catch (error) {
          server.config.logger.error(error instanceof Error ? error.message : 'App API failed')
          response.statusCode = 500
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify({ error: 'Falha interna na API.' }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const serverEnv = {
    ...loadEnv(mode, process.cwd(), 'OPENAI_'),
    ...loadEnv(mode, process.cwd(), 'OPENROUTER_'),
  }
  Object.entries(serverEnv).forEach(([key, value]) => { process.env[key] = value })

  return {
    plugins: [
      react(),
      apiDevPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'pwa-192.png', 'pwa-512.png'],
        manifest: {
          name: 'Meu ritmo — Rotinas de saúde',
          lang: 'pt-BR',
          short_name: 'Meu ritmo',
          description: 'Acompanhe suas rotinas de saúde, metas e progresso',
          theme_color: '#FAFBF9',
          background_color: '#FAFBF9',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          icons: [
            { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff,woff2}'],
          navigateFallbackDenylist: [/^\/api\//],
        },
      }),
    ],
    resolve: {
      alias: { '@': '/src' },
    },
  }
})
