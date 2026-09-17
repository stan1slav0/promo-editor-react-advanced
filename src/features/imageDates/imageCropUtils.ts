export interface ImageRegion { x: number; y: number; width: number; height: number }
export interface FoundImageDate { text: string; box?: ImageRegion }

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function getAnalysisRegion(selection: ImageRegion, imageWidth: number, imageHeight: number): ImageRegion {
  const width = Math.min(imageWidth, Math.max(selection.width * imageWidth * 2.5, 160))
  const height = Math.min(imageHeight, Math.max(selection.height * imageHeight * 3, 120))
  const centerX = (selection.x + selection.width / 2) * imageWidth
  const centerY = (selection.y + selection.height / 2) * imageHeight
  return {
    x: clamp(centerX - width / 2, 0, imageWidth - width) / imageWidth,
    y: clamp(centerY - height / 2, 0, imageHeight - height) / imageHeight,
    width: width / imageWidth,
    height: height / imageHeight,
  }
}

export function getTextAnalysisRegion(selection: ImageRegion, imageWidth: number, imageHeight: number): ImageRegion {
  const width = Math.min(imageWidth, Math.max(selection.width * imageWidth * 1.35, 120))
  const height = Math.min(imageHeight, Math.max(selection.height * imageHeight * 1.8, 80))
  const centerX = (selection.x + selection.width / 2) * imageWidth
  const centerY = (selection.y + selection.height / 2) * imageHeight
  return {
    x: clamp(centerX - width / 2, 0, imageWidth - width) / imageWidth,
    y: clamp(centerY - height / 2, 0, imageHeight - height) / imageHeight,
    width: width / imageWidth,
    height: height / imageHeight,
  }
}

// Overlap prevents text near the center lines from being cut in half.
export const DETAIL_REGIONS: ImageRegion[] = [
  { x: 0, y: 0, width: 0.62, height: 0.68 },
  { x: 0.38, y: 0, width: 0.62, height: 0.68 },
  { x: 0, y: 0.32, width: 0.62, height: 0.68 },
  { x: 0.38, y: 0.32, width: 0.62, height: 0.68 },
]

export function mapDatesToImage(dates: FoundImageDate[], region: ImageRegion): FoundImageDate[] {
  return dates.map((date) => ({
    text: date.text,
    ...(date.box ? { box: {
      x: region.x + date.box.x * region.width,
      y: region.y + date.box.y * region.height,
      width: date.box.width * region.width,
      height: date.box.height * region.height,
    } } : {}),
  }))
}

export function mergeImageDates(current: FoundImageDate[], incoming: FoundImageDate[]): FoundImageDate[] {
  const merged = [...current]
  for (const date of incoming) {
    const same = merged.find((existing) => {
      if (existing.text.toLowerCase() !== date.text.toLowerCase()) return false
      if (!existing.box || !date.box) return true
      const firstCenterX = existing.box.x + existing.box.width / 2
      const firstCenterY = existing.box.y + existing.box.height / 2
      const nextCenterX = date.box.x + date.box.width / 2
      const nextCenterY = date.box.y + date.box.height / 2
      return Math.abs(firstCenterX - nextCenterX) < 0.08 && Math.abs(firstCenterY - nextCenterY) < 0.08
    })
    if (!same) merged.push(date)
    else if (!same.box && date.box) same.box = date.box
  }
  return merged
}
