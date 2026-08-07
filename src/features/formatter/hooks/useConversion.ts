import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormatterConverter } from '../model/types'

interface UseConversionOptions {
  converter: FormatterConverter
  supportsMJML: boolean
  rawHtml: string
  fileName: string
  debounceMs?: number
}

export interface HtmlConversionResult {
  prettyHtml: string
  formattedName: string
}

export interface MjmlConversionResult {
  prettyMjml: string
  formattedName: string
}

export function formatPromoName(value: string): string {
  return value.trim().replace(/\s+/g, '').toUpperCase()
}

export function useConversion({
  converter,
  supportsMJML,
  rawHtml,
  fileName,
  debounceMs = 300,
}: UseConversionOptions) {
  const [htmlOutput, setHtmlOutput] = useState('')
  const [mjmlOutput, setMjmlOutput] = useState('')
  const requestIdRef = useRef(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      requestIdRef.current += 1
    }
  }, [])

  useEffect(() => {
    const requestId = ++requestIdRef.current

    if (!rawHtml.trim() || rawHtml === '<br>') {
      setHtmlOutput('')
      setMjmlOutput('')
      return
    }

    const timeoutId = window.setTimeout(async () => {
      const formattedName = formatPromoName(fileName)

      try {
        const nextHtml = await converter.exportHTML(rawHtml, formattedName)
        let nextMjml = ''

        if (supportsMJML && converter.exportMJML) {
          nextMjml = await converter.exportMJML(rawHtml, formattedName)
        }

        if (!mountedRef.current || requestId !== requestIdRef.current) return
        setHtmlOutput(nextHtml)
        setMjmlOutput(nextMjml)
      } catch (error) {
        console.error(error)
      }
    }, debounceMs)

    return () => window.clearTimeout(timeoutId)
  }, [converter, debounceMs, fileName, rawHtml, supportsMJML])

  const generateHTML = useCallback(async (currentHtml: string): Promise<HtmlConversionResult> => {
    if (!currentHtml.trim()) throw new Error('Text editor is empty')

    const requestId = ++requestIdRef.current
    const formattedName = formatPromoName(fileName)
    const prettyHtml = await converter.exportHTML(currentHtml, formattedName)
    if (mountedRef.current && requestId === requestIdRef.current) {
      setHtmlOutput(prettyHtml)
    }
    return { prettyHtml, formattedName }
  }, [converter, fileName])

  const generateMJML = useCallback(async (currentHtml: string): Promise<MjmlConversionResult | null> => {
    if (!supportsMJML || !converter.exportMJML) return null
    if (!currentHtml.trim()) throw new Error('Text editor is empty')

    const requestId = ++requestIdRef.current
    const formattedName = formatPromoName(fileName)
    const prettyMjml = await converter.exportMJML(currentHtml, formattedName)
    if (mountedRef.current && requestId === requestIdRef.current) {
      setMjmlOutput(prettyMjml)
    }
    return { prettyMjml, formattedName }
  }, [converter, fileName, supportsMJML])

  const clearOutputs = useCallback(() => {
    requestIdRef.current += 1
    setHtmlOutput('')
    setMjmlOutput('')
  }, [])

  return {
    htmlOutput,
    mjmlOutput,
    generateHTML,
    generateMJML,
    clearOutputs,
  }
}
