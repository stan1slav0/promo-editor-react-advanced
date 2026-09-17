import { describe, expect, it } from 'vitest'
import { DETAIL_REGIONS, getAnalysisRegion, getTextAnalysisRegion, mapDatesToImage, mergeImageDates } from './imageCropUtils'

describe('detail image scan', () => {
  it('covers a small calendar in the upper right of a banner', () => {
    expect(DETAIL_REGIONS.some((region) => region.x <= 0.81 && region.x + region.width >= 0.90 && region.y <= 0.47 && region.y + region.height >= 0.54)).toBe(true)
  })

  it('maps a detected box back to full-image coordinates', () => {
    const [date] = mapDatesToImage([{ text: 'AUGUST 15', box: { x: 0.5, y: 0.5, width: 0.2, height: 0.1 } }], DETAIL_REGIONS[1])
    expect(date.box?.x).toBeCloseTo(0.69)
    expect(date.box?.y).toBeCloseTo(0.34)
    expect(date.box?.width).toBeCloseTo(0.124)
  })

  it('analyzes only a padded area around the selected date', () => {
    const region = getAnalysisRegion({ x: 0.81, y: 0.47, width: 0.08, height: 0.05 }, 1000, 563)
    expect(region.x).toBeLessThan(0.81)
    expect(region.x + region.width).toBeGreaterThan(0.89)
    expect(region.width).toBeLessThan(0.3)
    expect(region.height).toBeLessThan(0.3)
  })

  it('keeps arbitrary text analysis close to the selected words', () => {
    const selection = { x: 0.25, y: 0.4, width: 0.2, height: 0.05 }
    const region = getTextAnalysisRegion(selection, 1000, 600)
    expect(region.x).toBeLessThan(selection.x)
    expect(region.x + region.width).toBeGreaterThan(selection.x + selection.width)
    expect(region.width).toBeCloseTo(0.27)
    expect(region.height).toBeLessThan(0.15)
  })

  it('deduplicates an overlapping crop but preserves separate occurrences', () => {
    const first = [{ text: 'August 15', box: { x: 0.8, y: 0.4, width: 0.1, height: 0.04 } }]
    const duplicate = [{ text: 'AUGUST 15', box: { x: 0.81, y: 0.41, width: 0.1, height: 0.04 } }]
    expect(mergeImageDates(first, duplicate)).toHaveLength(1)
    expect(mergeImageDates(first, [{ text: 'AUGUST 15', box: { x: 0.1, y: 0.1, width: 0.1, height: 0.04 } }])).toHaveLength(2)
  })
})
