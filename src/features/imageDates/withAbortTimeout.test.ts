import { afterEach, describe, expect, it, vi } from 'vitest'
import { withAbortTimeout } from './withAbortTimeout'

afterEach(() => vi.useRealTimers())

describe('withAbortTimeout', () => {
  it('returns a completed request', async () => {
    await expect(withAbortTimeout(async () => 'ready', 1000)).resolves.toBe('ready')
  })

  it('stops waiting even when an aborted request never settles', async () => {
    vi.useFakeTimers()
    let signal: AbortSignal | undefined
    const request = withAbortTimeout<string>((requestSignal) => {
      signal = requestSignal
      return new Promise(() => {})
    }, 120_000)
    const assertion = expect(request).rejects.toThrow('after 120 seconds')
    await vi.advanceTimersByTimeAsync(120_000)
    await assertion
    expect(signal?.aborted).toBe(true)
  })

  it('cancels a pending request immediately', async () => {
    const controller = new AbortController()
    const request = withAbortTimeout(() => new Promise<string>(() => {}), 120_000, controller.signal)
    const assertion = expect(request).rejects.toThrow('Operation canceled')
    controller.abort()
    await assertion
  })
})
