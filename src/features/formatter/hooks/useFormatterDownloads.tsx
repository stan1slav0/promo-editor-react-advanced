import { useCallback } from 'react'
import { saveAs } from 'file-saver'
import { toast } from 'react-toastify'
import { isAbortError, toErrorMessage } from '../../../utils/errors'
import type { HtmlConversionResult, MjmlConversionResult } from './useConversion'

interface UseFormatterDownloadsOptions {
  getRawContent: () => string
  generateHTML: (html: string) => Promise<HtmlConversionResult>
  generateMJML: (html: string) => Promise<MjmlConversionResult | null>
  processImages: () => Promise<void>
  supportsMJML: boolean
}

export function useFormatterDownloads({
  getRawContent,
  generateHTML,
  generateMJML,
  processImages,
  supportsMJML,
}: UseFormatterDownloadsOptions) {
  const generateHTMLCode = useCallback(async () => {
    try {
      return await generateHTML(getRawContent())
    } catch (error) {
      toast.error(` ${toErrorMessage(error)}`, {
        closeButton: false,
        closeOnClick: true,
        autoClose: 2000,
        hideProgressBar: true,
        draggable: true,
      })
      return null
    }
  }, [generateHTML, getRawContent])

  const generateMJMLCode = useCallback(async () => {
    try {
      return await generateMJML(getRawContent())
    } catch (error) {
      toast.error(` ${toErrorMessage(error)}`, {
        closeButton: true,
        closeOnClick: true,
        autoClose: 4000,
        draggable: true,
      })
      return null
    }
  }, [generateMJML, getRawContent])

  const downloadHTML = useCallback(async () => {
    try {
      await processImages()
      const result = await generateHTMLCode()
      if (!result) return

      saveAs(
        new Blob([result.prettyHtml], { type: 'text/html;charset=utf-8' }),
        `${result.formattedName}_html.html`,
      )
      toast.success(<span><strong>{result.formattedName}</strong> downloaded</span>, {
        autoClose: 3000,
      })
    } catch (error) {
      if (!isAbortError(error)) console.error('Error during HTML export:', error)
    }
  }, [generateHTMLCode, processImages])

  const downloadAll = useCallback(async () => {
    try {
      await processImages()
      const htmlResult = await generateHTMLCode()
      if (!htmlResult) return

      saveAs(
        new Blob([htmlResult.prettyHtml], { type: 'text/html;charset=utf-8' }),
        `${htmlResult.formattedName}_html.html`,
      )

      if (supportsMJML) {
        const mjmlResult = await generateMJMLCode()
        if (mjmlResult?.prettyMjml) {
          saveAs(
            new Blob([mjmlResult.prettyMjml], { type: 'text/html;charset=utf-8' }),
            `${htmlResult.formattedName}_mjml.html`,
          )
        }
      }

      toast.success(
        <span>
          <strong>{htmlResult.formattedName}</strong><br />
          {supportsMJML ? 'HTML & MJML downloaded' : 'HTML downloaded'}
        </span>,
        { autoClose: 3000 },
      )
    } catch (error) {
      if (!isAbortError(error)) console.error('Error downloading all items:', error)
    }
  }, [generateHTMLCode, generateMJMLCode, processImages, supportsMJML])

  const downloadImages = useCallback(async () => {
    try {
      await processImages()
    } catch (error) {
      if (isAbortError(error)) return
      console.error('Error processing images:', error)
      toast.error(`❌ Image Download Error: ${toErrorMessage(error)}`)
    }
  }, [processImages])

  return { downloadAll, downloadHTML, downloadImages }
}
