import type { ImageRegion } from './imageCropUtils'

export interface PixelRect { x: number; y: number; width: number; height: number }
export interface EditPatch { crop: PixelRect; blend: PixelRect }

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function getEditPatch(selection: ImageRegion, imageWidth: number, imageHeight: number): EditPatch {
  if (!Number.isFinite(imageWidth) || !Number.isFinite(imageHeight) || imageWidth <= 0 || imageHeight <= 0) {
    throw new Error('Invalid image size')
  }
  const left = clamp(selection.x, 0, 1) * imageWidth
  const top = clamp(selection.y, 0, 1) * imageHeight
  const targetWidth = clamp(selection.width, 0, 1) * imageWidth
  const targetHeight = clamp(selection.height, 0, 1) * imageHeight
  if (targetWidth < 3 || targetHeight < 3) throw new Error('Select the date area on the original image')

  // Model reference images must be smaller than 512 × 512. Keep the date large
  // relative to its context, then blend only the edited text area back in.
  const size = Math.round(Math.min(480, imageWidth, imageHeight, Math.max(256, targetWidth * 4, targetHeight * 8)))
  const crop: PixelRect = {
    x: Math.round(clamp(left + targetWidth / 2 - size / 2, 0, imageWidth - size)),
    y: Math.round(clamp(top + targetHeight / 2 - size / 2, 0, imageHeight - size)),
    width: size,
    height: size,
  }

  const blendLeft = clamp(left - targetWidth * 0.5, crop.x, crop.x + crop.width)
  const blendTop = clamp(top - targetHeight * 1.1, crop.y, crop.y + crop.height)
  const blendRight = clamp(left + targetWidth * 1.5, crop.x, crop.x + crop.width)
  const blendBottom = clamp(top + targetHeight * 2.1, crop.y, crop.y + crop.height)
  const blend: PixelRect = {
    x: Math.floor(blendLeft),
    y: Math.floor(blendTop),
    width: Math.ceil(blendRight) - Math.floor(blendLeft),
    height: Math.ceil(blendBottom) - Math.floor(blendTop),
  }
  return { crop, blend }
}

export function selectedImageRegion(startX: number, startY: number, endX: number, endY: number): ImageRegion {
  const x = clamp(Math.min(startX, endX), 0, 1)
  const y = clamp(Math.min(startY, endY), 0, 1)
  return {
    x,
    y,
    width: clamp(Math.max(startX, endX), 0, 1) - x,
    height: clamp(Math.max(startY, endY), 0, 1) - y,
  }
}
