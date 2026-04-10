// 壓縮圖片到指定寬度和品質
export async function compressImage(file: File, maxWidth = 1200, quality = 0.8): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      let { width, height } = img
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width)
        width = maxWidth
      }
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(blob => resolve(blob!), 'image/jpeg', quality)
    }
    img.src = url
  })
}

// 產生縮圖（更小，用於 feed 預覽）
export async function createThumbnail(file: File): Promise<Blob> {
  return compressImage(file, 400, 0.7)
}

// 上傳到 Supabase Storage，回傳公開 URL
import { supabase } from '../supabase'

export async function uploadImage(file: File, bucket: string, folder: string): Promise<string> {
  const compressed = await compressImage(file)
  const ext = 'jpg'
  const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from(bucket).upload(filename, compressed, {
    contentType: 'image/jpeg',
    upsert: false
  })
  if (error) throw error
  const { data } = supabase.storage.from(bucket).getPublicUrl(filename)
  return data.publicUrl
}
