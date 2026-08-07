import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { saveAs } from 'file-saver'
import { toast, type Id } from 'react-toastify'
import { DEFAULT_IMAGE_CONCURRENCY } from '../../../utils/config'
import { getBlobFromSrc, toJpeg600 } from '../../../utils/imageProcessor'
import { uploadImagesToS3 } from '../../../utils/s3Uploader'
import { formatPromoName } from './useConversion'

interface UseImageExportOptions {
  editorRef: RefObject<HTMLDivElement | null>
  fileName: string
  activeCategory: string
  isS3Enabled: boolean
}

export function useImageExport({
  editorRef,
  fileName,
  activeCategory,
  isS3Enabled,
}: UseImageExportOptions) {
  const operationControllerRef = useRef<AbortController | null>(null)
  const s3ToastIdRef = useRef<Id | null>(null)

  const dismissS3Toast = useCallback(() => {
    if (s3ToastIdRef.current === null) return
    toast.dismiss(s3ToastIdRef.current)
    s3ToastIdRef.current = null
  }, [])

  const cancelImageExport = useCallback(() => {
    operationControllerRef.current?.abort()
    operationControllerRef.current = null
  }, [])

  const processImages = useCallback(async () => {
    const images = Array.from(editorRef.current?.querySelectorAll('img') ?? [])
    if (images.length === 0) return

    cancelImageExport()
    const controller = new AbortController()
    operationControllerRef.current = controller
    const promoName = formatPromoName(fileName)

    try {
      if (isS3Enabled) {
        dismissS3Toast()
        const toastId = toast.loading('🚀 Initializing S3 Upload...')
        s3ToastIdRef.current = toastId
        await uploadImagesToS3(images, promoName, activeCategory, toastId, {
          signal: controller.signal,
          concurrency: DEFAULT_IMAGE_CONCURRENCY,
        })
        return
      }

      let imageIndex = 1
      let savedCount = 0
      for (const image of images) {
        controller.signal.throwIfAborted()
        const source = image.getAttribute('src')
        if (!source) continue

        const blob = await getBlobFromSrc(source, controller.signal)
        if (!blob) continue

        const { outBlob } = await toJpeg600(blob, '#ffffff')
        controller.signal.throwIfAborted()
        saveAs(outBlob, `${promoName}_img-${imageIndex}.jpg`)
        imageIndex += 1
        savedCount += 1
        await new Promise<void>((resolve) => window.setTimeout(resolve, 150))
      }

      const imageWord = savedCount === 1 ? 'image' : 'images'
      toast.success(`💾 ${savedCount} ${imageWord} saved to PC!`, { autoClose: 3000 })
    } finally {
      if (operationControllerRef.current === controller) {
        operationControllerRef.current = null
      }
    }
  }, [activeCategory, cancelImageExport, dismissS3Toast, editorRef, fileName, isS3Enabled])

  useEffect(() => () => {
    cancelImageExport()
    dismissS3Toast()
  }, [cancelImageExport, dismissS3Toast])

  return { processImages, cancelImageExport, dismissS3Toast }
}
