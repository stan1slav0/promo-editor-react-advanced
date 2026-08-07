import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { toast } from 'react-toastify'
import type { Id } from 'react-toastify'
import { DEFAULT_IMAGE_CONCURRENCY } from '../../../utils/config'
import { generateAltTextsForImages } from '../../../utils/imageAnalyzer'

interface UseEditorImagesOptions {
  editorRef: RefObject<HTMLDivElement | null>
  onContentChange: (html: string) => void
}

export function useEditorImages({ editorRef, onContentChange }: UseEditorImagesOptions) {
  const [hasImages, setHasImages] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const isAnalyzingRef = useRef(false)
  const analysisTimeoutRef = useRef<number | null>(null)
  const analysisToastRef = useRef<Id | null>(null)
  const analysisControllerRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)

  const updateImageCount = useCallback(() => {
    setHasImages(Boolean(editorRef.current?.querySelector('img')))
  }, [editorRef])

  const analyzeImages = useCallback(async () => {
    if (!editorRef.current || isAnalyzingRef.current) return

    const images = Array.from(editorRef.current.querySelectorAll('img'))
      .filter((image) => image.getAttribute('data-ai-analyzed') !== 'true')

    if (images.length === 0) return

    isAnalyzingRef.current = true
    if (mountedRef.current) setIsAnalyzing(true)
    const controller = new AbortController()
    analysisControllerRef.current = controller

    const toastId = toast.loading(`🤖 AI starts analyzing ${images.length} image${images.length > 1 ? 's' : ''}...`)
    analysisToastRef.current = toastId

    try {
      await generateAltTextsForImages(images, toastId, {
        signal: controller.signal,
        concurrency: DEFAULT_IMAGE_CONCURRENCY,
      })
      if (mountedRef.current && editorRef.current) {
        onContentChange(editorRef.current.innerHTML)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('AI Alt Generation failed:', error)
      toast.update(toastId, {
        render: `⚠️ AI Error: ${message}`,
        type: 'error',
        isLoading: false,
        autoClose: 4000,
      })
    } finally {
      isAnalyzingRef.current = false
      analysisToastRef.current = null
      if (analysisControllerRef.current === controller) {
        analysisControllerRef.current = null
      }
      if (mountedRef.current) setIsAnalyzing(false)
    }
  }, [editorRef, onContentChange])

  const scheduleAnalysis = useCallback(() => {
    if (analysisTimeoutRef.current !== null) {
      window.clearTimeout(analysisTimeoutRef.current)
    }
    analysisTimeoutRef.current = window.setTimeout(() => {
      analysisTimeoutRef.current = null
      void analyzeImages()
    }, 1000)
  }, [analyzeImages])

  const resetImageState = useCallback(() => {
    analysisControllerRef.current?.abort()
    analysisControllerRef.current = null
    if (analysisTimeoutRef.current !== null) {
      window.clearTimeout(analysisTimeoutRef.current)
      analysisTimeoutRef.current = null
    }
    setHasImages(false)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    updateImageCount()

    const editor = editorRef.current
    if (!editor) return

    const observer = new MutationObserver((mutations) => {
      if (isAnalyzingRef.current) return
      if (!mutations.some((mutation) => mutation.type === 'childList')) return
      updateImageCount()
      scheduleAnalysis()
    })

    observer.observe(editor, { childList: true, subtree: true })

    return () => {
      mountedRef.current = false
      observer.disconnect()
      analysisControllerRef.current?.abort()
      if (analysisTimeoutRef.current !== null) {
        window.clearTimeout(analysisTimeoutRef.current)
      }
      if (analysisToastRef.current !== null) {
        toast.dismiss(analysisToastRef.current)
      }
    }
  }, [editorRef, scheduleAnalysis, updateImageCount])

  return {
    hasImages,
    isAnalyzing,
    isAnalyzingRef,
    updateImageCount,
    scheduleAnalysis,
    resetImageState,
  }
}
