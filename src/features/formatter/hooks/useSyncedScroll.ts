import { useCallback, useEffect, useRef } from 'react'
import type { ScrollableRef } from '../model/types'

export function useSyncedScroll(
  editorRef: ScrollableRef,
  htmlOutputRef: ScrollableRef,
  mjmlOutputRef: ScrollableRef,
) {
  const isSyncingRef = useRef(false)
  const frameRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
  }, [])

  return useCallback((sourceRef: ScrollableRef) => {
    if (isSyncingRef.current || !sourceRef.current) return
    isSyncingRef.current = true

    const source = sourceRef.current
    const maxScroll = source.scrollHeight - source.clientHeight

    if (maxScroll <= 0) {
      isSyncingRef.current = false
      return
    }

    const scrollPercentage = source.scrollTop / maxScroll

    const targetRefs = [editorRef, htmlOutputRef, mjmlOutputRef]
    targetRefs.forEach((targetRef) => {
      if (!targetRef.current || targetRef === sourceRef) return
      const targetMaxScroll = targetRef.current.scrollHeight - targetRef.current.clientHeight
      if (targetMaxScroll > 0) {
        targetRef.current.scrollTop = scrollPercentage * targetMaxScroll
      }
    })

    frameRef.current = requestAnimationFrame(() => {
      isSyncingRef.current = false
      frameRef.current = null
    })
  }, [editorRef, htmlOutputRef, mjmlOutputRef])
}
