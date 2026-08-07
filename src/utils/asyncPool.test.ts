import { describe, expect, it } from 'vitest'
import { mapWithConcurrency } from './asyncPool'

describe('mapWithConcurrency', () => {
  it('limits parallel work and preserves input order', async () => {
    let activeWorkers = 0
    let peakWorkers = 0

    const result = await mapWithConcurrency([30, 5, 15, 1], 2, async (delay, index) => {
      activeWorkers += 1
      peakWorkers = Math.max(peakWorkers, activeWorkers)
      await new Promise((resolve) => setTimeout(resolve, delay))
      activeWorkers -= 1
      return `item-${index}`
    })

    expect(peakWorkers).toBe(2)
    expect(result).toEqual(['item-0', 'item-1', 'item-2', 'item-3'])
  })

  it('stops before starting work when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (item) => item, controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })
})
