import { Fragment } from 'react'
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
      {mode === 'dates' || mode === 'imageDates' ? (
        <div className="dates-mode-badge" role="status" aria-label={mode === 'dates' ? 'Dates Changes' : 'Text on Images Beta'}>
          <span className="dates-mode-badge__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              {mode === 'dates' ? <><path d="M7 3v3m10-3v3M4.5 9h15M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" /><path d="m9 14 2-2 2 2 2-2" /></> : <><path d="M4 6h16M12 6v13M8.5 19h7" /><path d="M3 3h18v18H3z" /></>}
            </svg>
          </span>
          <span className="dates-mode-badge__label">{mode === 'dates' ? 'Dates Changes' : 'Text on Images · Beta'}</span>
        </div>
      ) : (
      <div className="input-name-block">
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
      )}

      <div
        className={`category-wrap mode-switch mode-switch_${mode} _show`}
        style={{ marginRight: '8px' }}
        role="group"
        aria-label="Conversion mode"
      >
        {(['basic', 'advanced', 'dates', 'imageDates'] as const).map((item) => (
          <Fragment key={item}>
            {item === 'dates' && <span className="mode-switch__separator" aria-hidden="true" />}
            <button
              type="button"
              className={`main-btn main-btn_noicon category-wrap__link ${mode === item ? '_active' : ''}`}
              aria-pressed={mode === item}
              aria-label={item === 'imageDates' ? 'Text on images (Beta)' : undefined}
              onClick={() => onModeChange(item)}
            >
              <span>{item === 'basic' ? 'Basic' : item === 'advanced' ? 'Custom' : item === 'dates' ? 'Dates' : 'Text on images'}</span>
              {item === 'imageDates' && <span className="mode-switch__beta" aria-hidden="true">Beta</span>}
            </button>
          </Fragment>
        ))}
      </div>

      {mode !== 'dates' && mode !== 'imageDates' && showCategories && availableCategories.length > 1 && (
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
