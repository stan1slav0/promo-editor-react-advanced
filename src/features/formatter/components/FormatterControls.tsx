import type { ChangeEvent, RefObject } from 'react'
import type { FormatterMode } from '../model/types'

interface FormatterControlsProps {
  fileName: string
  fileNameInputRef: RefObject<HTMLInputElement | null>
  mode: FormatterMode
  activeCategory: string
  activeCategoryIndex: number
  availableCategories: string[]
  showCategories: boolean
  onFileNameChange: (event: ChangeEvent<HTMLInputElement>) => void
  onChangeNumber: (amount: number) => void
  onModeChange: (mode: FormatterMode) => void
  onCategoryChange: (category: string) => void
}

export function FormatterControls({
  fileName,
  fileNameInputRef,
  mode,
  activeCategory,
  activeCategoryIndex,
  availableCategories,
  showCategories,
  onFileNameChange,
  onChangeNumber,
  onModeChange,
  onCategoryChange,
}: FormatterControlsProps) {
  return (
    <div className="main-input-number-block">
      <div
        className={`input-name-block ${mode === 'dates' ? 'input-name-block_placeholder' : ''}`}
        aria-hidden={mode === 'dates'}
      >
        <button type="button" tabIndex={-1} className="button-number button-decrement" onClick={() => onChangeNumber(-1)}>
          <svg viewBox="0 0 15 3" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 1.5C0 0.671573 0.671573 0 1.5 0H13.5C14.3284 0 15 0.671573 15 1.5C15 2.32843 14.3284 3 13.5 3H1.5C0.671573 3 0 2.32843 0 1.5Z" />
          </svg>
        </button>

        <div className="field">
          <div className="field__line" />
          <input
            ref={fileNameInputRef}
            tabIndex={1}
            className="field__area input-name"
            id="fileName"
            type="text"
            value={fileName}
            onChange={onFileNameChange}
            autoComplete="off"
          />
        </div>

        <button type="button" tabIndex={-1} className="button-number button-increment" onClick={() => onChangeNumber(1)}>
          <svg viewBox="0 0 15 15" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 7.5C0 6.67157 0.671573 6 1.5 6H13.5C14.3284 6 15 6.67157 15 7.5C15 8.32843 14.3284 9 13.5 9H1.5C0.671573 9 0 8.32843 0 7.5Z" />
            <path d="M7.5 15C6.67157 15 6 14.3284 6 13.5L6 1.5C6 0.671573 6.67157 0 7.5 0C8.32843 0 9 0.671573 9 1.5V13.5C9 14.3284 8.32843 15 7.5 15Z" />
          </svg>
        </button>
      </div>

      <div
        className={`category-wrap mode-switch mode-switch_${mode} _show`}
        style={{ marginRight: '8px' }}
        role="group"
        aria-label="Conversion mode"
      >
        {(['basic', 'advanced', 'dates'] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={`main-btn main-btn_noicon category-wrap__link ${mode === item ? '_active' : ''}`}
            aria-pressed={mode === item}
            onClick={() => onModeChange(item)}
          >
            <span>{item === 'basic' ? 'Basic' : item === 'advanced' ? 'Custom' : 'Dates'}</span>
          </button>
        ))}
      </div>

      {mode !== 'dates' && showCategories && availableCategories.length > 1 && (
        <div
          className={`category-wrap category-switch category-switch_pos-${activeCategoryIndex} _show`}
          role="group"
          aria-label="Content category"
        >
          {availableCategories.map((category) => {
            const normalizedCategory = category.toLowerCase()
            return (
              <button
                key={category}
                type="button"
                className={`main-btn main-btn_noicon category-wrap__link ${activeCategory === normalizedCategory ? '_active' : ''}`}
                aria-pressed={activeCategory === normalizedCategory}
                onClick={() => onCategoryChange(category)}
              >
                <span>{category}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
