import { isAbortError } from './errors'

export interface ProcessedImage {
  outBlob: Blob
  targetW: number
  targetH: number
}

export async function getBlobFromSrc(
  src: string,
  signal?: AbortSignal,
): Promise<Blob | null> {
  try {
    const response = await fetch(src, { mode: 'cors', signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.blob()
  } catch (error) {
    if (isAbortError(error)) throw error
    console.error('⚠️ Ошибка загрузки изображения:', src, error)
    return null
  }
}

export async function toJpeg600(
  blob: Blob,
  bgColor = '#ffffff',
  quality: number | string = 0.82,
): Promise<ProcessedImage> {
  const bitmap = await createImageBitmap(blob)

  try {
    const targetW = Math.min(600, bitmap.width)
    const targetH = Math.round(bitmap.height * (targetW / bitmap.width))
    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH

    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas 2D context is unavailable')

    context.fillStyle = bgColor
    context.fillRect(0, 0, targetW, targetH)
    context.drawImage(bitmap, 0, 0, targetW, targetH)

    const parsedQuality = typeof quality === 'number'
      ? quality
      : Number.parseFloat(quality) || 0.82
    const normalizedQuality = Math.min(1, Math.max(0, parsedQuality))

    const outBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => result
          ? resolve(result)
          : reject(new Error('Failed to encode image as JPEG')),
        'image/jpeg',
        normalizedQuality,
      )
    })

    canvas.width = 0
    canvas.height = 0
    return { outBlob, targetW, targetH }
  } finally {
    bitmap.close()
  }
}
