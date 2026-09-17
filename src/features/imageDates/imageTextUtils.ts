export interface TextAnalysisResponse {
  text?: string
  dates?: Array<{ text?: string }>
  ocrText?: string
}

export function recognizedTextFromAnalysis(result: TextAnalysisResponse): string {
  const answer = result.text || result.dates?.find((date) => date.text?.trim())?.text || result.ocrText || ''
  let text = answer.trim()
  try {
    const parsed: unknown = JSON.parse(text)
    if (typeof parsed === 'string') text = parsed
    else if (Array.isArray(parsed)) text = parsed.filter((part): part is string => typeof part === 'string').join('\n')
  } catch { /* plain transcription */ }
  text = text.replace(/^["“]|["”]$/g, '').trim()
  if (/^(?:none|\[\]|no (?:readable|visible|date|text).*|there is no (?:readable|visible|date|text).*)\.?$/i.test(text)) return ''
  return text.slice(0, 300)
}

export function imageChangeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/3030|output has been flagged/i.test(message)) {
    return 'Cloudflare blocked this generated image (3030). This is a model safety decision; no image was uploaded. Try a different image or edit this one manually.'
  }
  if (/timed out|no response from the server after|\b3007\b/i.test(message)) {
    return 'Image generation timed out. No image was uploaded. You can try again or cancel a slow request earlier.'
  }
  return message
}
