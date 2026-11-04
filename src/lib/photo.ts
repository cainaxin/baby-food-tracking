/**
 * 把相机/相册图片压成 JPEG data URL，控制体积。
 * 家宽 HTTP 入口可用（只用 Canvas + FileReader，不依赖安全上下文 API）。
 */
export async function compressImage(
  file: File,
  maxDim = 1280,
  quality = 0.82,
): Promise<string> {
  const bitmap = await loadImage(file)
  const { width, height } = bitmap
  const scale = Math.min(1, maxDim / Math.max(width, height))
  const w = Math.round(width * scale)
  const h = Math.round(height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法处理图片')
  ctx.drawImage(bitmap, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', quality)
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片读取失败'))
    }
    img.src = url
  })
}
