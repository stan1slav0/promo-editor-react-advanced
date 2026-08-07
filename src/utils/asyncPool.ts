export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal,
): Promise<R[]> {
  if (items.length === 0) return []

  const requestedConcurrency = Number.isFinite(concurrency)
    ? Math.floor(concurrency)
    : 1
  const workerCount = Math.max(1, Math.min(requestedConcurrency, items.length))
  const results = new Array<R>(items.length)
  let nextIndex = 0

  const worker = async () => {
    for (;;) {
      signal?.throwIfAborted()
      const index = nextIndex
      nextIndex += 1
      if (index >= items.length) return
      results[index] = await mapper(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: workerCount }, worker))
  return results
}
