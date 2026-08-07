import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { toast } from 'react-toastify'

import { getConverter } from '../../converters'
import { DownloadActions } from './components/DownloadActions'
import { EditorPanel } from './components/EditorPanel'
import { FormatterControls } from './components/FormatterControls'
import { OutputPanels } from './components/OutputPanels'
import { useConversion } from './hooks/useConversion'
import { useEditorImages } from './hooks/useEditorImages'
import { useFormatterDownloads } from './hooks/useFormatterDownloads'
import { useFormatterShortcuts } from './hooks/useFormatterShortcuts'
import { useImageExport } from './hooks/useImageExport'
import { useSyncedScroll } from './hooks/useSyncedScroll'
import { getSavedMode, saveMode } from './model/storage'
import type { FormatterConverter, FormatterMode, FormatterProps, ScrollableRef } from './model/types'

export default function Formatter({
  activeCategory,
  onCategoryChange,
  availableCategories = ['Finance', 'Health', 'Pets'],
  isS3Enabled,
}: FormatterProps) {
  const [fileName, setFileName] = useState('')
  const [editorContent, setEditorContent] = useState('')
  const [mode, setMode] = useState<FormatterMode>(getSavedMode)

  const editorRef = useRef<HTMLDivElement>(null)
  const htmlOutputRef = useRef<HTMLTextAreaElement>(null)
  const mjmlOutputRef = useRef<HTMLTextAreaElement>(null)
  const fileNameInputRef = useRef<HTMLInputElement>(null)
  const pasteTimeoutRef = useRef<number | null>(null)
  const isFirstS3RenderRef = useRef(true)
  const previousS3EnabledRef = useRef(isS3Enabled)

  const activeConverter = getConverter(mode, activeCategory) as FormatterConverter
  const supportsMJML = activeConverter.hasMJML !== false
  const activeCategoryIndex = Math.max(
    0,
    availableCategories.findIndex(
      (category) => category.toLowerCase() === activeCategory.toLowerCase(),
    ),
  )

  const { processImages, cancelImageExport, dismissS3Toast } = useImageExport({
    editorRef,
    fileName,
    activeCategory,
    isS3Enabled,
  })

  useEffect(() => {
    fileNameInputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (activeConverter.setCategory) {
      activeConverter.setCategory(activeCategory)
    } else {
      activeConverter.categoryName = activeCategory
    }
  }, [activeCategory, activeConverter])

  useEffect(() => saveMode(mode), [mode])

  useEffect(() => {
    if (isFirstS3RenderRef.current) {
      isFirstS3RenderRef.current = false
      previousS3EnabledRef.current = isS3Enabled
      return
    }

    if (previousS3EnabledRef.current === isS3Enabled) return
    toast.info(isS3Enabled ? '☁️ Auto-upload to S3' : '💻 Download to PC', {
      autoClose: 2000,
      closeButton: false,
      hideProgressBar: true,
    })
    previousS3EnabledRef.current = isS3Enabled
  }, [isS3Enabled])

  useEffect(() => () => {
    if (pasteTimeoutRef.current !== null) window.clearTimeout(pasteTimeoutRef.current)
  }, [])

  const {
    htmlOutput,
    mjmlOutput,
    generateHTML,
    generateMJML,
    clearOutputs,
  } = useConversion({
    converter: activeConverter,
    supportsMJML,
    rawHtml: editorContent,
    fileName,
  })

  const {
    hasImages,
    isAnalyzing,
    isAnalyzingRef,
    updateImageCount,
    scheduleAnalysis,
    resetImageState,
  } = useEditorImages({ editorRef, onContentChange: setEditorContent })

  const handleSyncScroll = useSyncedScroll(
    editorRef as ScrollableRef,
    htmlOutputRef as ScrollableRef,
    mjmlOutputRef as ScrollableRef,
  )

  const handleCategoryChange = useCallback((category: string) => {
    const normalizedCategory = category.toLowerCase()
    if (normalizedCategory === activeCategory.toLowerCase()) return

    dismissS3Toast()
    onCategoryChange(normalizedCategory)

    const formattedCategory = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase()
    toast.info(
      <span>Category changed to <strong>{formattedCategory}</strong></span>,
      { autoClose: 2000, hideProgressBar: true, closeButton: false },
    )
  }, [activeCategory, dismissS3Toast, onCategoryChange])

  const handleModeChange = useCallback((nextMode: FormatterMode) => {
    setMode(nextMode)
    toast.info(
      <span><strong>{nextMode === 'basic' ? 'Basic' : 'Custom'}</strong> Mode</span>,
      { autoClose: 1500, hideProgressBar: true, closeButton: false },
    )
  }, [])

  const handleEditorInput = useCallback((event: FormEvent<HTMLDivElement>) => {
    if (isAnalyzingRef.current) return
    dismissS3Toast()
    setEditorContent(event.currentTarget.innerHTML)
    updateImageCount()
    scheduleAnalysis()
  }, [dismissS3Toast, isAnalyzingRef, scheduleAnalysis, updateImageCount])

  const handlePaste = useCallback(() => {
    if (pasteTimeoutRef.current !== null) window.clearTimeout(pasteTimeoutRef.current)
    pasteTimeoutRef.current = window.setTimeout(() => {
      pasteTimeoutRef.current = null
      if (editorRef.current) editorRef.current.scrollTop = 0
      if (htmlOutputRef.current) htmlOutputRef.current.scrollTop = 0
      if (mjmlOutputRef.current) mjmlOutputRef.current.scrollTop = 0
    }, 10)
  }, [])

  const handleFileNameChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    dismissS3Toast()
    setFileName(event.target.value)
  }, [dismissS3Toast])

  const changeNumber = useCallback((amount: number) => {
    dismissS3Toast()
    setFileName((currentName) => {
      const match = currentName.match(/(\D*)(\d+)/)
      if (!match) return currentName ? currentName : ''
      return match[1] + ((parseInt(match[2], 10) || 0) + amount)
    })
  }, [dismissS3Toast])

  const getRawContent = useCallback(() => {
    const currentHtml = editorRef.current?.innerHTML ?? ''
    return currentHtml.trim() ? currentHtml : editorContent
  }, [editorContent])

  const {
    downloadAll: handleDownloadAll,
    downloadHTML: handleFullDownloadHTML,
    downloadImages: handleDownloadImagesOnly,
  } = useFormatterDownloads({
    getRawContent,
    generateHTML,
    generateMJML,
    processImages,
    supportsMJML,
  })

  const handleResetAll = useCallback(() => {
    dismissS3Toast()
    cancelImageExport()
    if (editorRef.current) editorRef.current.innerHTML = ''
    setEditorContent('')
    setFileName('')
    clearOutputs()
    resetImageState()
    fileNameInputRef.current?.focus()
    toast.info('All fields cleared', {
      autoClose: 2000,
      hideProgressBar: true,
      closeButton: false,
    })
  }, [cancelImageExport, clearOutputs, dismissS3Toast, resetImageState])

  useFormatterShortcuts({
    activeCategory,
    isAnalyzing,
    onDownloadAll: () => void handleDownloadAll(),
    onDownloadHtml: () => void handleFullDownloadHTML(),
    onReset: handleResetAll,
  })

  return (
    <div className="limit-main">
      <div className="limit">
        <FormatterControls
          fileName={fileName}
          fileNameInputRef={fileNameInputRef}
          mode={mode}
          activeCategory={activeCategory}
          activeCategoryIndex={activeCategoryIndex}
          availableCategories={availableCategories}
          showCategories={hasImages}
          onFileNameChange={handleFileNameChange}
          onChangeNumber={changeNumber}
          onModeChange={handleModeChange}
          onCategoryChange={handleCategoryChange}
        />

        <div className="flex-cols flex-cols_cat">
          <EditorPanel
            editorRef={editorRef as ScrollableRef}
            onPaste={handlePaste}
            onInput={handleEditorInput}
            onScroll={() => handleSyncScroll(editorRef as ScrollableRef)}
          />

          <div className="flex-col">
            <div className="code-blocks-wrapper">
              <DownloadActions
                activeCategory={activeCategory}
                supportsMJML={supportsMJML}
                hasImages={hasImages}
                isAnalyzing={isAnalyzing}
                onDownloadAll={() => void handleDownloadAll()}
                onDownloadHtml={() => void handleFullDownloadHTML()}
                onDownloadImages={() => void handleDownloadImagesOnly()}
              />
              <OutputPanels
                supportsMJML={supportsMJML}
                htmlOutput={htmlOutput}
                mjmlOutput={mjmlOutput}
                htmlOutputRef={htmlOutputRef as ScrollableRef}
                mjmlOutputRef={mjmlOutputRef as ScrollableRef}
                onHtmlScroll={() => handleSyncScroll(htmlOutputRef as ScrollableRef)}
                onMjmlScroll={() => handleSyncScroll(mjmlOutputRef as ScrollableRef)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
