export async function withAbortTimeout<T>(
  task: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  externalSignal?: AbortSignal,
): Promise<T> {
  if (externalSignal?.aborted) throw new Error('Operation canceled')

  const controller = new AbortController()
  let reason: 'timeout' | 'cancel' | undefined
  let interrupt!: (reason: 'timeout' | 'cancel') => void
  const interrupted = new Promise<never>((_, reject) => {
    interrupt = (nextReason) => {
      if (reason) return
      reason = nextReason
      controller.abort()
      reject(new Error(nextReason === 'timeout'
        ? `No response from the server after ${Math.round(timeoutMs / 1000)} seconds. Please try again.`
        : 'Operation canceled'))
    }
  })
  const onExternalAbort = () => interrupt('cancel')
  externalSignal?.addEventListener('abort', onExternalAbort, { once: true })
  if (externalSignal?.aborted) onExternalAbort()
  const timer = setTimeout(() => interrupt('timeout'), timeoutMs)

  try {
    return await Promise.race([Promise.resolve().then(() => task(controller.signal)), interrupted])
  } catch (error) {
    if (reason === 'timeout') throw new Error(`No response from the server after ${Math.round(timeoutMs / 1000)} seconds. Please try again.`)
    if (reason === 'cancel') throw new Error('Operation canceled')
    throw error
  } finally {
    clearTimeout(timer)
    externalSignal?.removeEventListener('abort', onExternalAbort)
  }
}
