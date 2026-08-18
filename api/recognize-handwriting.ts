const MAX_IMAGE_LENGTH = 3_000_000
const PROVIDER_TIMEOUT_MS = 18_000
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini'
const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4o-mini'

type RecognitionProvider = 'openrouter' | 'openai'

interface RecognitionRequestBody {
  image?: unknown
}

interface OpenAIContent {
  type?: unknown
  text?: unknown
}

interface OpenAIResponseBody {
  output_text?: unknown
  output?: Array<{ content?: unknown }>
  error?: { code?: unknown }
}

interface OpenRouterResponseBody {
  choices?: Array<{ message?: { content?: unknown } }>
  error?: { code?: unknown }
}

interface ProviderConfig {
  provider: RecognitionProvider
  apiKey: string
  model: string
}

const transcriptionPrompt = [
  'Transcreva somente o texto manuscrito visível nesta imagem.',
  'O idioma principal é português do Brasil.',
  'Preserve acentos, maiúsculas, pontuação e quebras de linha quando estiverem claras.',
  'Não descreva a imagem e não acrescente palavras que não estejam escritas.',
  'Quando um caractere estiver ambíguo, use o contexto da própria frase para escolher a leitura mais provável.',
].join(' ')

const transcriptionSchema = {
  type: 'object',
  properties: {
    text: { type: 'string', description: 'Texto manuscrito transcrito, sem explicações adicionais.' },
    confidence: { type: 'number', description: 'Confiança estimada entre 0 e 1.' },
  },
  required: ['text', 'confidence'],
  additionalProperties: false,
}

function json(payload: Record<string, unknown>, status = 200) {
  return Response.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

function getProviderConfig(): ProviderConfig | null {
  const openRouterKey = process.env.OPENROUTER_API_KEY
  if (openRouterKey) {
    return {
      provider: 'openrouter',
      apiKey: openRouterKey,
      model: process.env.OPENROUTER_HANDWRITING_MODEL || DEFAULT_OPENROUTER_MODEL,
    }
  }

  const openAIKey = process.env.OPENAI_API_KEY
  if (openAIKey) {
    return {
      provider: 'openai',
      apiKey: openAIKey,
      model: process.env.OPENAI_HANDWRITING_MODEL || DEFAULT_OPENAI_MODEL,
    }
  }

  return null
}

function extractOpenAIOutputText(payload: OpenAIResponseBody) {
  if (typeof payload.output_text === 'string') return payload.output_text
  if (!Array.isArray(payload.output)) return ''

  for (const item of payload.output) {
    if (!item || !Array.isArray(item.content)) continue
    for (const content of item.content as OpenAIContent[]) {
      if (content?.type === 'output_text' && typeof content.text === 'string') return content.text
    }
  }
  return ''
}

function extractOpenRouterOutputText(payload: OpenRouterResponseBody) {
  const content = payload.choices?.[0]?.message?.content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''

  return content
    .map(item => (
      item && typeof item === 'object' && 'text' in item && typeof item.text === 'string'
        ? item.text
        : ''
    ))
    .join('')
}

function buildOpenAIRequest(image: string, config: ProviderConfig) {
  return {
    url: 'https://api.openai.com/v1/responses',
    headers: {},
    body: {
      model: config.model,
      store: false,
      input: [{
        role: 'user',
        content: [
          { type: 'input_text', text: transcriptionPrompt },
          { type: 'input_image', image_url: image, detail: 'high' },
        ],
      }],
      text: {
        format: {
          type: 'json_schema',
          name: 'handwriting_transcription',
          strict: true,
          schema: transcriptionSchema,
        },
      },
      max_output_tokens: 160,
    },
  }
}

function buildOpenRouterRequest(image: string, config: ProviderConfig) {
  const headers: Record<string, string> = {}
  if (process.env.OPENROUTER_SITE_URL) headers['HTTP-Referer'] = process.env.OPENROUTER_SITE_URL
  if (process.env.OPENROUTER_APP_NAME) headers['X-OpenRouter-Title'] = process.env.OPENROUTER_APP_NAME

  return {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    headers,
    body: {
      model: config.model,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: transcriptionPrompt },
          { type: 'image_url', image_url: { url: image } },
        ],
      }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'handwriting_transcription',
          strict: true,
          schema: transcriptionSchema,
        },
      },
      provider: { require_parameters: true },
      temperature: 0,
      max_tokens: 160,
    },
  }
}

async function callRecognitionProvider(image: string, config: ProviderConfig, requestSignal: AbortSignal) {
  const controller = new AbortController()
  let timedOut = false
  const abortFromRequest = () => controller.abort()
  requestSignal.addEventListener('abort', abortFromRequest, { once: true })
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, PROVIDER_TIMEOUT_MS)

  const providerRequest = config.provider === 'openrouter'
    ? buildOpenRouterRequest(image, config)
    : buildOpenAIRequest(image, config)

  try {
    const response = await fetch(providerRequest.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        ...providerRequest.headers,
      },
      signal: controller.signal,
      body: JSON.stringify(providerRequest.body),
    })
    const payload: unknown = await response.json().catch(() => null)
    const outputText = config.provider === 'openrouter'
      ? extractOpenRouterOutputText((payload || {}) as OpenRouterResponseBody)
      : extractOpenAIOutputText((payload || {}) as OpenAIResponseBody)
    const errorCode = config.provider === 'openrouter'
      ? (payload as OpenRouterResponseBody | null)?.error?.code
      : (payload as OpenAIResponseBody | null)?.error?.code

    return { response, payload, outputText, errorCode }
  } catch (error) {
    if (timedOut) throw new Error('PROVIDER_TIMEOUT')
    throw error
  } finally {
    clearTimeout(timeout)
    requestSignal.removeEventListener('abort', abortFromRequest)
  }
}

async function handleRecognitionRequest(request: Request): Promise<Response> {
  const config = getProviderConfig()

  if (request.method === 'GET') {
    return json({
      ready: Boolean(config),
      provider: config?.provider || null,
      model: config?.model || DEFAULT_OPENROUTER_MODEL,
    })
  }
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  if (!config) {
    return json({ error: 'Configure OPENROUTER_API_KEY ou OPENAI_API_KEY para ativar a conversão.' }, 503)
  }

  let body: RecognitionRequestBody
  try {
    body = await request.json() as RecognitionRequestBody
  } catch {
    return json({ error: 'Requisição inválida.' }, 400)
  }

  const image = body.image
  if (typeof image !== 'string' || !image.startsWith('data:image/png;base64,') || image.length > MAX_IMAGE_LENGTH) {
    return json({ error: 'Imagem de escrita inválida ou muito grande.' }, 400)
  }

  let result: Awaited<ReturnType<typeof callRecognitionProvider>>
  try {
    result = await callRecognitionProvider(image, config, request.signal)
  } catch (error) {
    if (request.signal.aborted) return json({ error: 'A leitura foi cancelada.' }, 499)
    if (error instanceof Error && error.message === 'PROVIDER_TIMEOUT') {
      return json({ error: 'A leitura demorou mais de 18 segundos. Tente novamente.' }, 504)
    }
    console.error('Handwriting recognition request failed', config.provider, error instanceof Error ? error.name : 'unknown')
    return json({ error: 'Não foi possível conectar ao serviço de reconhecimento.' }, 502)
  }

  if (!result.response.ok || !result.payload) {
    console.error('Handwriting recognition failed', config.provider, result.response.status, result.errorCode)
    const keyName = config.provider === 'openrouter' ? 'OPENROUTER_API_KEY' : 'OPENAI_API_KEY'
    const error = result.response.status === 401
      ? `A chave ${keyName} não foi aceita.`
      : result.response.status === 402
        ? 'O OpenRouter está sem créditos para realizar a leitura.'
        : result.response.status === 429
          ? 'O limite de reconhecimento foi atingido. Aguarde um momento.'
          : 'O serviço de reconhecimento está indisponível no momento.'
    return json({ error }, result.response.status === 429 ? 429 : 502)
  }

  try {
    const parsed = JSON.parse(result.outputText) as { text?: unknown; confidence?: unknown }
    const text = typeof parsed.text === 'string' ? parsed.text.trim().slice(0, 10_000) : ''
    const confidence = typeof parsed.confidence === 'number'
      ? Math.min(1, Math.max(0, parsed.confidence))
      : 0.5
    if (!text) return json({ error: 'Não consegui identificar palavras nesse trecho.' }, 422)
    return json({ text, confidence })
  } catch {
    return json({ error: 'O reconhecimento retornou uma resposta inválida.' }, 502)
  }
}

export default {
  fetch: handleRecognitionRequest,
}
