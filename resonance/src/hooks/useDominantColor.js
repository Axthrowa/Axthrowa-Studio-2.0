import { useEffect, useState } from 'react'
import { baskinRenk } from '../lib/baskinRenk'

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
        const hex = baskinRenk(data)
        if (!hex) return
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
