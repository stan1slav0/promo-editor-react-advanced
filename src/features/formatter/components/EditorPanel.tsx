import type { ClipboardEventHandler, FormEventHandler, RefObject } from 'react'
import type { ScrollableRef } from '../model/types'

interface EditorPanelProps {
  editorRef: ScrollableRef
  onPaste: ClipboardEventHandler<HTMLDivElement>
  onInput: FormEventHandler<HTMLDivElement>
  onScroll: () => void
}

export function EditorPanel({ editorRef, onPaste, onInput, onScroll }: EditorPanelProps) {
  return (
    <div className="flex-col">
      <div className="primary-text-editor-wrapper">
        <div className="primary-text-editor-bg field-big" style={{ borderRadius: '16px' }}>
          <div className="field-big__line" />
          <div
            ref={editorRef as RefObject<HTMLDivElement | null>}
            tabIndex={2}
            id="editor"
            className="field-big__area field-big__area_main primary-text-editor-block"
            contentEditable
            onPaste={onPaste}
            onInput={onInput}
            onScroll={onScroll}
            suppressContentEditableWarning
          />
        </div>
      </div>
    </div>
  )
}
