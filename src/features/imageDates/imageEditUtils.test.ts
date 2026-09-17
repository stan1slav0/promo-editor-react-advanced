import { describe, expect, it } from 'vitest'
import { getEditPatch, selectedImageRegion } from './imageEditUtils'

describe('local image edit geometry', () => {
  it('keeps the input crop below the model limit and inside the source image', () => {
    const patch = getEditPatch({ x: 0.8, y: 0.47, width: 0.09, height: 0.045 }, 1000, 563)
    expect(patch.crop.width).toBeLessThan(512)
    expect(patch.crop.height).toBeLessThan(512)
    expect(patch.crop.x + patch.crop.width).toBeLessThanOrEqual(1000)
    expect(patch.crop.y + patch.crop.height).toBeLessThanOrEqual(563)
    expect(patch.blend.x).toBeLessThanOrEqual(800)
    expect(patch.blend.x + patch.blend.width).toBeGreaterThanOrEqual(890)
  })

  it('normalizes a backwards drag', () => {
    expect(selectedImageRegion(0.9, 0.6, 0.8, 0.4)).toEqual({ x: 0.8, y: 0.4, width: 0.09999999999999998, height: 0.19999999999999996 })
  })
})
