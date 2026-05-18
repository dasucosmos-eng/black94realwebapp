/* ── Firebase Storage Upload Utility ────────────────────────────────────────── */
/* Uploads images to Firebase Storage and returns public download URLs.
   Avoids storing large base64 blobs directly in Firestore documents,
   which are limited to 1 MB per document.                                  */

import { storage } from './firebase'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'

/**
 * Upload a File (image, GIF, etc.) to Firebase Storage.
 *
 * @param file  - The browser File object to upload
 * @param folder - Storage folder path, e.g. "posts" or "stories"
 * @returns      - Public download URL (https://…)
 */
export async function uploadToStorage(
  file: File,
  folder: string,
): Promise<string> {
  // Build a unique path:  {folder}/{timestamp}_{random}.{ext}
  const ext = file.name.split('.').pop() || 'jpg'
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
  const path = `${folder}/${safeName}`

  const ref = storageRef(storage, path)
  await uploadBytes(ref, file)
  const url = await getDownloadURL(ref)

  console.log(`[upload] ${path} → ${url}`)
  return url
}

/**
 * Compress an image file via canvas, then upload to Firebase Storage.
 * Returns the download URL.  Keeps the original MIME type for GIFs
 * (GIFs are passed through without recompression to preserve animation).
 *
 * @param file      - Raw browser File (image/*)
 * @param folder    - Storage folder
 * @param maxDim    - Max width/height in px (default 1200)
 * @param quality   - JPEG quality 0–1 (default 0.82)
 */
export async function compressAndUpload(
  file: File,
  folder: string,
  maxDim = 1200,
  quality = 0.82,
): Promise<string> {
  // GIF: skip canvas compression to preserve animation
  if (file.type === 'image/gif') {
    return uploadToStorage(file, folder)
  }

  // Non-GIF: compress via canvas → Blob → upload
  const blob = await compressImageBlob(file, maxDim, quality)
  // Create a new File from the blob for upload
  const compressed = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
    type: 'image/jpeg',
  })
  return uploadToStorage(compressed, folder)
}

/**
 * Compress an image File to a JPEG Blob via <canvas>.
 * Does NOT upload — just returns the Blob.
 */
function compressImageBlob(
  file: File,
  maxDim = 1200,
  quality = 0.82,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Failed to load image'))
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          } else {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas not supported'))
          return
        }
        // Fill white bg so JPEG transparency → white (not black)
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (b) => {
            if (b) resolve(b)
            else reject(new Error('Canvas toBlob returned null'))
          },
          'image/jpeg',
          quality,
        )
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}
