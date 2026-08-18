import { Buffer } from 'node:buffer'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import recognizeHandwriting from './api/recognize-handwriting'

function handwritingApiDevPlugin(): Plugin {
  return {
    name: 'handwriting-api-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/recognize-handwriting', async (request, response) => {
        try {
          const chunks: Buffer[] = []
          for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))

          const headers = new Headers()
          Object.entries(request.headers).forEach(([key, value]) => {
            if (Array.isArray(value)) value.forEach(item => headers.append(key, item))
            else if (value !== undefined) headers.set(key, value)
          })

          const method = request.method || 'GET'
          const webRequest = new Request('http://127.0.0.1/api/recognize-handwriting', {
            method,
            headers,
            body: method === 'GET' || method === 'HEAD' ? undefined : Buffer.concat(chunks),
          })
          const webResponse = await recognizeHandwriting(webRequest)
          response.statusCode = webResponse.status
          webResponse.headers.forEach((value, key) => response.setHeader(key, value))
          response.end(Buffer.from(await webResponse.arrayBuffer()))
        } catch (error) {
          server.config.logger.error(error instanceof Error ? error.message : 'Handwriting API failed')
          response.statusCode = 500
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify({ error: 'Falha interna no reconhecimento de escrita.' }))
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
      handwritingApiDevPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: 'Treino — Performance diária',
          short_name: 'Treino',
          description: 'App de acompanhamento do plano de treino de 6 meses',
          theme_color: '#376F56',
          background_color: '#F3F6F4',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          icons: [
            { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
          navigateFallbackDenylist: [/^\/api\//],
        },
      }),
    ],
    resolve: {
      alias: { '@': '/src' },
    },
  }
})
