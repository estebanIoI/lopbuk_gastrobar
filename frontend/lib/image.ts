/**
 * Utilidades de imagen para los flujos de IA (visión).
 *
 * Las fotos de cámara de un celular pesan 8-12 MB; en base64 crecen ~33% y superan
 * el límite del body del backend (15mb) además de hacer lentísima la llamada al
 * modelo. Los modelos de visión no aprovechan más de ~1600px, así que se reduce
 * en el cliente antes de subir.
 */

/** Reduce la imagen a máx. `maxSize` px por lado y la convierte a JPEG (data URL). */
export async function fileToDownscaledDataUrl(
  file: File,
  maxSize = 1600,
  quality = 0.72
): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
  return new Promise<string>((resolve) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(dataUrl); return }
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}
