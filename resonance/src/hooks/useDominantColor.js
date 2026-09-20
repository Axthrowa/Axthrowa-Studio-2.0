import { useEffect, useState } from 'react'

const cache = new Map()

export function useDominantColor(imageUrl) {
  const [color, setColor] = useState(cache.get(imageUrl) || '#8b5cf6')

  useEffect(() => {
    if (!imageUrl) return
    if (cache.has(imageUrl)) {
      setColor(cache.get(imageUrl))
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const size = 24
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, size, size)
        const { data } = ctx.getImageData(0, 0, size, size)
        let r = 0
        let g = 0
        let b = 0
        let count = 0
        for (let i = 0; i < data.length; i += 4) {
          r += data[i]
          g += data[i + 1]
          b += data[i + 2]
          count++
        }
        r = Math.round(r / count)
        g = Math.round(g / count)
        b = Math.round(b / count)
        const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
        cache.set(imageUrl, hex)
        setColor(hex)
      } catch {
        /* CORS or decode failure: keep fallback color */
      }
    }
    img.src = imageUrl
  }, [imageUrl])

  return color
}
