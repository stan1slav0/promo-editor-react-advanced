import type { RefObject } from 'react'
import type { ScrollableRef } from '../model/types'

interface OutputPanelsProps {
  supportsMJML: boolean
  htmlOutput: string
  mjmlOutput: string
  htmlOutputRef: ScrollableRef
  mjmlOutputRef: ScrollableRef
  onHtmlScroll: () => void
  onMjmlScroll: () => void
}

export function OutputPanels({
  supportsMJML,
  htmlOutput,
  mjmlOutput,
  htmlOutputRef,
  mjmlOutputRef,
  onHtmlScroll,
  onMjmlScroll,
}: OutputPanelsProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: supportsMJML ? '1fr 1fr' : '1fr 0fr',
        gap: supportsMJML ? '20px' : '0px',
        transition: 'grid-template-rows 0.25s ease, gap 0.25s ease',
        flexGrow: 1,
        minHeight: 0,
      }}
    >
      <div className="code-block" style={{ minHeight: 0 }}>
        <div className="code-inner-block">
          <h2 className="sm-main-headline">HTML:</h2>
          <div className="field-big" style={{ borderRadius: '16px' }}>
            <div className="field-big__line" />
            <textarea
              ref={htmlOutputRef as RefObject<HTMLTextAreaElement | null>}
              id="output"
              className="field-big__area html-code-block"
              value={htmlOutput}
              onScroll={onHtmlScroll}
              readOnly
            />
          </div>
        </div>
      </div>

      <div className="code-block" style={{ minHeight: 0 }}>
        {supportsMJML && (
          <div className="code-inner-block" style={{ height: '100%' }}>
            <h2 className="sm-main-headline">MJML:</h2>
            <div className="field-big">
              <div className="field-big__line" />
              <textarea
                ref={mjmlOutputRef as RefObject<HTMLTextAreaElement | null>}
                id="mjmlOutput"
                className="field-big__area html-code-block"
                value={mjmlOutput}
                onScroll={onMjmlScroll}
                readOnly
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
