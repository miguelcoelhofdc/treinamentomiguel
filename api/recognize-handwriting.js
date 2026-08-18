const MAX_IMAGE_LENGTH = 3_000_000
const DEFAULT_MODEL = 'gpt-5.4-mini'

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

function extractOutputText(response) {
  if (typeof response.output_text === 'string') return response.output_text
  if (!Array.isArray(response.output)) return ''

  for (const item of response.output) {
    if (!item || !Array.isArray(item.content)) continue
    for (const content of item.content) {
      if (content?.type === 'output_text' && typeof content.text === 'string') return content.text
    }
  }
  return ''
}

export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return json({ error: 'O reconhecimento de escrita ainda não foi configurado.' }, 503)

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Requisição inválida.' }, 400)
  }

  const image = body?.image
  if (typeof image !== 'string' || !image.startsWith('data:image/png;base64,') || image.length > MAX_IMAGE_LENGTH) {
    return json({ error: 'Imagem de escrita inválida ou muito grande.' }, 400)
  }

  const openAIResponse = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_HANDWRITING_MODEL || DEFAULT_MODEL,
      store: false,
      reasoning: { effort: 'none' },
      input: [{
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: [
              'Transcreva somente o texto manuscrito visível nesta imagem.',
              'O idioma principal é português do Brasil.',
              'Preserve acentos, maiúsculas, pontuação e quebras de linha quando estiverem claras.',
              'Não descreva a imagem e não acrescente palavras que não estejam escritas.',
              'Quando um caractere estiver ambíguo, use o contexto da própria frase para escolher a leitura mais provável.',
            ].join(' '),
          },
          { type: 'input_image', image_url: image, detail: 'high' },
        ],
      }],
      text: {
        format: {
          type: 'json_schema',
          name: 'handwriting_transcription',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              confidence: { type: 'number' },
            },
            required: ['text', 'confidence'],
            additionalProperties: false,
          },
        },
      },
      max_output_tokens: 160,
    }),
  })

  const openAIPayload = await openAIResponse.json().catch(() => null)
  if (!openAIResponse.ok) {
    console.error('Handwriting recognition failed', openAIResponse.status, openAIPayload?.error?.code)
    return json({ error: 'O serviço de reconhecimento está indisponível no momento.' }, 502)
  }

  const outputText = extractOutputText(openAIPayload)
  try {
    const result = JSON.parse(outputText)
    const text = typeof result.text === 'string' ? result.text.trim().slice(0, 10_000) : ''
    const confidence = typeof result.confidence === 'number'
      ? Math.min(1, Math.max(0, result.confidence))
      : 0.5
    if (!text) return json({ error: 'Não consegui identificar palavras nesse trecho.' }, 422)
    return json({ text, confidence })
  } catch {
    return json({ error: 'O reconhecimento retornou uma resposta inválida.' }, 502)
  }
}
