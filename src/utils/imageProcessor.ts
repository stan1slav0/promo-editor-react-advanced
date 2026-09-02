import { isAbortError } from './errors'

export interface ProcessedImage {
  outBlob: Blob
  targetW: number
  targetH: number
}

export interface ImageDimensions {
  width: number
  height: number
}

export const MIN_IMAGE_WIDTH = 200
export const DEFAULT_MAX_IMAGE_WIDTH = 560
export const EXPORT_IMAGE_WIDTH_ATTRIBUTE = 'data-export-width'

export function getCategoryImageMaxWidth(category: string): number {
  switch (category.toLowerCase()) {
    case 'alpha':
      return 562
    case 'red':
      return 564
    default:
      return DEFAULT_MAX_IMAGE_WIDTH
  }
}

export function getTargetImageDimensions(
  sourceWidth: number,
  sourceHeight: number,
  maxWidth = DEFAULT_MAX_IMAGE_WIDTH,
): ImageDimensions {
  if (sourceWidth <= 0 || sourceHeight <= 0 || maxWidth < MIN_IMAGE_WIDTH) {
    throw new Error('Image dimensions must be greater than zero')
  }

  const width = Math.min(maxWidth, Math.max(MIN_IMAGE_WIDTH, sourceWidth))
  const height = Math.round(sourceHeight * (width / sourceWidth))
  return { width, height }
}

export function setExportImageWidth(
  image: HTMLImageElement,
  width: number,
): boolean {
  const nextWidth = String(Math.round(width))
  const changed = image.getAttribute(EXPORT_IMAGE_WIDTH_ATTRIBUTE) !== nextWidth

  image.setAttribute(EXPORT_IMAGE_WIDTH_ATTRIBUTE, nextWidth)
  return changed
}

export function setExportImageWidthFromNaturalSize(
  image: HTMLImageElement,
  maxWidth = DEFAULT_MAX_IMAGE_WIDTH,
): boolean {
  if (!image.naturalWidth || !image.naturalHeight) return false
  const { width } = getTargetImageDimensions(
    image.naturalWidth,
    image.naturalHeight,
    maxWidth,
  )
  return setExportImageWidth(image, width)
}

function readPositiveIntegerAttribute(tag: string, attribute: string): number | null {
  const match = tag.match(new RegExp(`\\b${attribute}=["'](\\d+)["']`, 'i'))
  if (!match) return null
  const value = Number.parseInt(match[1], 10)
  return value > 0 ? value : null
}

export function getExportImageWidthFromTag(
  tag: string,
  fallbackWidth: number,
  maxWidth = fallbackWidth,
): number {
  const storedWidth = readPositiveIntegerAttribute(tag, EXPORT_IMAGE_WIDTH_ATTRIBUTE)
  if (!storedWidth) return fallbackWidth

  return Math.min(maxWidth, Math.max(MIN_IMAGE_WIDTH, storedWidth))
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

export async function processImageForEmail(
  blob: Blob,
  maxWidth: number,
  bgColor = '#ffffff',
  quality: number | string = 0.82,
): Promise<ProcessedImage> {
  const bitmap = await createImageBitmap(blob)

  try {
    const { width: targetW, height: targetH } = getTargetImageDimensions(
      bitmap.width,
      bitmap.height,
      maxWidth,
    )
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
