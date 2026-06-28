/**
 * Convierte texto en nube de puntos 2D muestreando un canvas offscreen.
 * Retorna posiciones normalizadas [-1, 1] para uso en R3F/Three.
 */

export interface LogoPoint {
  x: number
  y: number
}

let cachedPoints: LogoPoint[] | null = null

export function generateLogoPoints(
  text = 'DAIMUZ',
  width = 512,
  height = 128,
  sampleStep = 3
): LogoPoint[] {
  if (cachedPoints) return cachedPoints

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return []

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 80px "Inter", "Space Grotesk", "Sora", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, width / 2, height / 2)

  const imageData = ctx.getImageData(0, 0, width, height)
  const points: LogoPoint[] = []

  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const idx = (y * width + x) * 4
      const alpha = imageData.data[idx + 3]
      if (alpha > 128) {
        points.push({
          x: (x / width) * 2 - 1,
          y: -((y / height) * 2 - 1),
        })
      }
    }
  }

  cachedPoints = points
  return points
}

export function getCachedPoints(): LogoPoint[] {
  return cachedPoints ?? []
}

export function clearCache() {
  cachedPoints = null
}
