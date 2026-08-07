import { toast } from 'react-toastify'
import type { Id } from 'react-toastify'
import { mapWithConcurrency } from './asyncPool'
import { API_PROXY_URL, DEFAULT_IMAGE_CONCURRENCY } from './config'
import { isAbortError } from './errors'
import { getLicenseKey } from './licenseStorage'

const CONCISE_PROMPT =
  'TASK: Write a 1-to-5 word HTML alt text for this image.\n\n' +
  'STRICT RULES:\n' +
  "1. ONLY output 'Video preview' if there is a CLEAR video play button overlay (a large triangle inside a circle in the center) or YouTube-style video frame.\n" +
  '2. DO NOT mistake sliders, progress bars, charts, or UI icons for a video player.\n' +
  "3. IF IT IS A CHART/GAUGE/UI CARD: Describe the visual content (e.g., 'Financial rating dashboard' or 'Bullish rating gauge').\n" +
  '4. Describe the subject in 2 to 5 words MAX.\n' +
  '5. NEVER transcribe full quotes/text written on the image.\n' +
  "6. NEVER start with 'image of' or 'photo of'.\n\n" +
  'OUTPUT FORMAT: Return ONLY the raw alt text string. No quotes, no markdown.'

interface AnalyzeAltResponse {
  alt?: string
}

export interface GenerateAltTextOptions {
  signal?: AbortSignal
  concurrency?: number
}

function readBlobAsDataUrl(blob: Blob, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Image analysis aborted', 'AbortError'))
      return
    }

    const reader = new FileReader()

    const cleanup = () => signal?.removeEventListener('abort', handleAbort)
    const handleAbort = () => reader.abort()

    reader.onload = () => {
      cleanup()
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Failed to read image as Base64'))
      }
    }
    reader.onerror = () => {
      cleanup()
      reject(reader.error ?? new Error('Failed to read image'))
    }
    reader.onabort = () => {
      cleanup()
      reject(new DOMException('Image analysis aborted', 'AbortError'))
    }

    signal?.addEventListener('abort', handleAbort, { once: true })
    reader.readAsDataURL(blob)
  })
}

async function imageToBase64(
  image: HTMLImageElement,
  signal?: AbortSignal,
): Promise<string | null> {
  const src = image.getAttribute('src')
  if (!src) return null
  if (src.startsWith('data:image')) return src

  try {
    const response = await fetch(src, { signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await readBlobAsDataUrl(await response.blob(), signal)
  } catch (error) {
    if (isAbortError(error)) throw error
    console.error('Failed to convert image to Base64:', error)
    return null
  }
}

async function processSingleImage(
  image: HTMLImageElement,
  licenseKey: string,
  signal?: AbortSignal,
): Promise<boolean> {
  if (
    image.getAttribute('data-ai-analyzed') === 'true' ||
    image.getAttribute('data-ai-analyzing') === 'true'
  ) {
    return false
  }

  image.setAttribute('data-ai-analyzing', 'true')

  try {
    const imageBase64 = await imageToBase64(image, signal)
    if (!imageBase64) return false

    const response = await fetch(`${API_PROXY_URL}/analyze-alt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `License ${licenseKey}`,
      },
      body: JSON.stringify({ imageBase64, prompt: CONCISE_PROMPT }),
      signal,
    })

    if (!response.ok) {
      console.error(`AI Alt request failed: HTTP ${response.status}`)
      return false
    }

    const data = await response.json() as AnalyzeAltResponse
    if (!data.alt) return false

    const cleanAlt = data.alt.trim().replace(/^["']|["']$/g, '').replace(/"/g, '&quot;')
    image.setAttribute('alt', cleanAlt)
    image.setAttribute('data-ai-analyzed', 'true')
    return true
  } catch (error) {
    if (isAbortError(error)) throw error
    console.error('❌ AI Alt error:', error)
    return false
  } finally {
    image.removeAttribute('data-ai-analyzing')
  }
}

export async function generateAltTextsForImages(
  images: Iterable<HTMLImageElement>,
  toastId?: Id,
  { signal, concurrency = DEFAULT_IMAGE_CONCURRENCY }: GenerateAltTextOptions = {},
): Promise<number> {
  const licenseKey = getLicenseKey()

  if (!licenseKey) {
    console.error('❌ AI Alt generation canceled: Missing License Key.')
    if (toastId !== undefined) toast.dismiss(toastId)
    return 0
  }

  const pendingImages = Array.from(images).filter(
    (image) =>
      image.getAttribute('data-ai-analyzed') !== 'true' &&
      image.getAttribute('data-ai-analyzing') !== 'true',
  )

  if (pendingImages.length === 0) {
    if (toastId !== undefined) toast.dismiss(toastId)
    return 0
  }

  if (toastId !== undefined) {
    toast.update(toastId, {
      render: `🤖 AI analyzing ${pendingImages.length} image${pendingImages.length > 1 ? 's' : ''}...`,
      type: 'info',
      isLoading: true,
    })
  }

  try {
    const results = await mapWithConcurrency(
      pendingImages,
      concurrency,
      (image) => processSingleImage(image, licenseKey, signal),
      signal,
    )
    const processedCount = results.filter(Boolean).length

    if (toastId !== undefined) {
      if (processedCount > 0) {
        toast.update(toastId, {
          render: `${processedCount} ${processedCount === 1 ? 'image' : 'images'} ready for upload.`,
          type: 'success',
          isLoading: false,
          autoClose: 3000,
          closeOnClick: false,
          closeButton: false,
        })
      } else {
        toast.dismiss(toastId)
      }
    }

    return processedCount
  } catch (error) {
    if (isAbortError(error)) {
      if (toastId !== undefined) toast.dismiss(toastId)
      return 0
    }
    throw error
  }
}
