interface DownloadActionsProps {
  activeCategory: string
  supportsMJML: boolean
  hasImages: boolean
  isAnalyzing: boolean
  onDownloadAll: () => void
  onDownloadHtml: () => void
  onDownloadImages: () => void
}

function DownloadIcon({ packageMode }: { packageMode: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M4.94 15.86V22.898C4.9496 23.4582 5.40158 23.9103 5.9614 23.9198L5.9795 23.92H16.2538L20.54 19.6338V15.86H22.1V20.28L16.9 25.48H5.9795C4.55803 25.48 3.4033 24.3391 3.38035 22.923L3.38 22.88V15.86H4.94ZM20.228 18.72L15.548 23.4V18.72H20.228ZM19.5005 0C20.922 0 22.0767 1.14087 22.0997 2.55695L22.1 2.59995V3.38H22.88C24.3159 3.38 25.48 4.54406 25.48 5.98V11.7C25.48 13.1359 24.3159 14.3 22.88 14.3H2.6C1.16406 14.3 0 13.1359 0 11.7V5.98C0 4.54406 1.16406 3.38 2.6 3.38H3.38V2.59995C3.38 1.17876 4.52067 0.0233153 5.93651 0.000348427L5.9795 0H19.5005ZM22.88 4.94H2.6C2.03161 4.94 1.56971 5.39597 1.56 5.96209V11.7C1.56 12.2684 2.01597 12.7303 2.58209 12.7398L2.6 12.74H22.88C23.4484 12.74 23.9103 12.284 23.92 11.7179V5.98C23.92 5.41161 23.464 4.94971 22.8979 4.94015L22.88 4.94ZM19.5005 1.56H5.9616C5.40199 1.56961 4.94971 2.02195 4.94 2.58185V3.38H20.54V2.58203C20.5303 2.01582 20.0686 1.56 19.5005 1.56Z" />
      {packageMode && (
        <>
          <path d="M7.7 5.98H9.1L11.05 11.18H9.85L9.4 9.9H7.4L6.95 11.18H5.75L7.7 5.98ZM7.8 8.85H9L8.4 7.15L7.8 8.85Z" />
          <path d="M12.6 5.98V10.15H14.8V11.18H11.4V5.98H12.6ZM16.4 5.98V10.15H18.6V11.18H15.2V5.98H16.4Z" />
        </>
      )}
      {!packageMode && (
        <path d="M4.1236 5.98V8.0236H6.5806V5.98H7.696V11.1826H6.5806V8.9986H4.1236V11.1826H3.016V5.98H4.1236ZM12.2876 5.98V6.955H10.7744V11.1826H9.659V6.955H8.138V5.98H12.2876ZM14.2896 5.98L15.5532 9.2248L16.8168 5.98H18.3768V11.1826H17.2614V7.4386L15.795 11.1826H15.3114L13.845 7.4386V11.1826H12.7374V5.98H14.2896ZM20.254 5.98V10.2076H22.4536V11.1826H19.1464V5.98H20.254Z" />
      )}
    </svg>
  )
}

function ImagesIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M23 24H3C1.34 24 0 22.66 0 21V5C0 3.34 1.34 2 3 2H23C24.66 2 26 3.34 26 5V21C26 22.66 24.66 24 23 24ZM3 4C2.45 4 2 4.45 2 5V21C2 21.55 2.45 22 3 22H23C23.55 22 24 21.55 24 21V5C24 4.45 23.55 4 23 4H3Z" />
      <path d="M18 12C16.34 12 15 10.66 15 9C15 7.34 16.34 6 18 6C19.66 6 21 7.34 21 9C21 10.66 19.66 12 18 12ZM18 8C17.45 8 17 8.45 17 9C17 9.55 17.45 10 18 10C18.55 10 19 9.55 19 9C19 8.45 18.55 8 18 8Z" />
      <path d="M23 24C22.84 24 22.67 23.96 22.53 23.88C22.38 23.8 22.26 23.69 22.17 23.55L17.83 17.05C17.65 16.78 17.34 16.61 17 16.61C16.66 16.61 16.35 16.78 16.17 17.05L15.83 17.55C15.52 17.98 14.93 18.09 14.5 17.76C14.08 17.48 13.94 16.91 14.17 16.45L14.5 15.94C15.05 15.11 15.98 14.6 17 14.6C18.02 14.6 18.95 15.11 19.5 15.94L23.83 22.45C24.13 22.91 24.01 23.53 23.55 23.83C23.39 23.94 23.2 24 23 24Z" />
      <path d="M3 24C2.81 24 2.62 23.94 2.46 23.84C2 23.54 1.87 22.92 2.16 22.46L8.39 12.84C8.95 11.98 9.88 11.47 10.89 11.47C11.9 11.47 12.84 11.97 13.39 12.81L19.81 22.45C20.12 22.91 20 23.53 19.55 23.84C19.09 24.14 18.47 24.02 18.16 23.56L11.72 13.92C11.53 13.64 11.25 13.47 10.89 13.47C10.56 13.47 10.25 13.64 10.06 13.93L3.84 23.54C3.65 23.84 3.33 24 3 24Z" />
    </svg>
  )
}

export function DownloadActions({
  activeCategory,
  supportsMJML,
  hasImages,
  isAnalyzing,
  onDownloadAll,
  onDownloadHtml,
  onDownloadImages,
}: DownloadActionsProps) {
  const isPackageCategory = ['finance', 'health', 'pets'].includes(activeCategory.toLowerCase())
  const disabledStyle = {
    opacity: isAnalyzing ? 0.6 : 1,
    cursor: isAnalyzing ? 'not-allowed' : 'pointer',
  }

  return (
    <div className="code-buttons-wrapper">
      <button
        disabled={isAnalyzing}
        type="button"
        id={isPackageCategory ? 'downloadAllBtn' : 'downloadBtn'}
        className="main-btn primary-button"
        title={isPackageCategory
          ? (supportsMJML ? 'Download HTML, MJML & Images' : 'Download HTML & Images')
          : 'Download HTML'}
        onClick={isPackageCategory ? onDownloadAll : onDownloadHtml}
        style={disabledStyle}
      >
        <span>
          {isAnalyzing ? 'Analyzing...' : 'Download'}
          <DownloadIcon packageMode={isPackageCategory && supportsMJML} />
        </span>
      </button>

      <button
        type="button"
        id="btn-download"
        className="main-btn main-btn_marg main-btn_icon primary-button"
        title="Download images"
        onClick={onDownloadImages}
        disabled={isAnalyzing}
        style={{ ...disabledStyle, display: hasImages ? 'flex' : 'none' }}
      >
        <span><ImagesIcon /></span>
      </button>
    </div>
  )
}
