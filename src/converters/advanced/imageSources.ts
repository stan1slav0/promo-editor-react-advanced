interface PromoParts {
  prefix: string
  suffix: string
}

function getPromoParts(promoName: string): PromoParts {
  const normalizedName = (promoName || 'promo').trim().replace(/\s+/g, '').toLowerCase()
  return {
    prefix: normalizedName.match(/[a-z]+/)?.[0] || 'promo',
    suffix: normalizedName.match(/\d+/)?.[0] || '0',
  }
}

export function buildAdvancedImageSource(
  category: string,
  promoName: string,
  imageIndex: number,
): string {
  const normalizedCategory = (category || 'finance').toLowerCase()
  const { prefix, suffix } = getPromoParts(promoName)

  switch (normalizedCategory) {
    case 'alpha':
      return `https://alphaonest.com/files/promo/${prefix}/lift-${suffix}/img-${imageIndex}.jpg`
    case 'terra':
      return `https://ogfinstorage.com/files/creatives/${prefix}/creative-${suffix}/img-${imageIndex}.jpg`
    case 'red':
      return `https://reagstr.com/files/promo/${prefix}/lift-${suffix}/img-${imageIndex}.jpg`
    default:
      return `https://storage.5th-elementagency.com/files/Promo/${normalizedCategory}/${prefix}/lift-${suffix}/img-${imageIndex}.jpg`
  }
}

export function prepareAdvancedImageSources(
  rawHtml: string,
  promoName: string,
  category: string,
): string {
  const document = new DOMParser().parseFromString(`<body>${rawHtml}</body>`, 'text/html')

  document.body.querySelectorAll('img').forEach((image, index) => {
    image.setAttribute('src', buildAdvancedImageSource(category, promoName, index + 1))
  })

  return document.body.innerHTML
}
