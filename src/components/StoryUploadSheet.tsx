'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useAppStore } from '@/stores/app'
import { createStory } from '@/lib/stories-db'
import { IMAGE_FILTERS, type ImageFilter } from '@/lib/image-filters'
import { toast } from 'sonner'

interface StoryUploadSheetProps {
  open: boolean
  onClose: () => void
  onStoryUploaded: () => void
}

/* ── Compress image → returns base64 data-URL for Firestore ── */
function compressStoryImage(
  file: File,
  filterCss: string,
  maxWidth = 720,
  maxHeight = 1280,
  quality = 0.5,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Failed to load image'))
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img

        if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth }
        if (height > maxHeight) { width = Math.round((width * maxHeight) / height); height = maxHeight }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('Canvas not supported')); return }

        ctx.fillStyle = '#000000'
        ctx.fillRect(0, 0, width, height)
        if (filterCss && filterCss !== 'none') ctx.filter = filterCss
        ctx.drawImage(img, 0, 0, width, height)
        ctx.filter = 'none'

        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        resolve(dataUrl)
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

export function StoryUploadSheet({ open, onClose, onStoryUploaded }: StoryUploadSheetProps) {
  const user = useAppStore((s) => s.user)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedFilter, setSelectedFilter] = useState<ImageFilter>(IMAGE_FILTERS[0])
  const [caption, setCaption] = useState('')
  const [uploading, setUploading] = useState(false)
  const [step, setStep] = useState<'idle' | 'compressing' | 'uploading' | 'done'>('idle')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setSelectedFile(null)
      setPreviewUrl(null)
      setSelectedFilter(IMAGE_FILTERS[0])
      setCaption('')
      setUploading(false)
      setStep('idle')
    }
  }, [open])

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }, [])

  const handleShare = useCallback(async () => {
    if (!selectedFile || !user || uploading) return
    setUploading(true)

    // Step 1: Compress
    let base64: string
    try {
      setStep('compressing')
      base64 = await compressStoryImage(selectedFile, selectedFilter.css)
      console.log('[StoryUpload] Compressed →', Math.round(base64.length / 1024), 'KB')
    } catch (err) {
      console.error('[StoryUpload] Compression FAILED:', err)
      setUploading(false)
      setStep('idle')
      toast.error('Failed to process image. Try a different photo.')
      return
    }

    // Step 2: Write to Firestore (direct, no Storage)
    try {
      setStep('uploading')
      await createStory({
        userId: user.id,
        username: user.username,
        displayName: user.displayName || 'You',
        profileImage: user.profileImage || '',
        verified: user.isVerified,
        mediaUrl: base64,
        caption: caption.trim(),
      })
      console.log('[StoryUpload] Upload ✅')
    } catch (err) {
      console.error('[StoryUpload] Upload FAILED:', err)
      setUploading(false)
      setStep('idle')
      toast.error(`Upload failed: ${err instanceof Error ? err.message : String(err)}`)
      return
    }

    // Done
    setStep('done')
    toast.success('Story shared!')
    onClose()
    setUploading(false)
    setTimeout(() => onStoryUploaded(), 600)
  }, [selectedFile, selectedFilter, caption, user, uploading, onStoryUploaded, onClose])

  const statusText = step === 'compressing'
    ? 'Compressing…'
    : step === 'uploading'
      ? 'Sharing…'
      : 'Share Story'

  return (
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <SheetContent
        side="bottom"
        className="bg-[#000] border-t border-white/[0.08] rounded-t-2xl max-h-[85vh] overflow-y-auto"
      >
        <SheetHeader className="px-4 pt-2 pb-0">
          <SheetTitle className="text-[16px] font-bold text-[#e7e9ea] text-left">New Story</SheetTitle>
        </SheetHeader>

        <div className="px-4 pb-5 space-y-3">
          {!previewUrl ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02]
                         hover:border-white/[0.25] hover:bg-white/[0.04] transition-all cursor-pointer
                         flex flex-col items-center justify-center gap-2 py-10"
            >
              <div className="w-11 h-11 rounded-full bg-white/[0.06] flex items-center justify-center">
                <svg className="w-5 h-5 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              </div>
              <p className="text-[13px] text-white/50">Tap to select a photo</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
            </button>
          ) : (
            <div className="space-y-3">
              {/* Preview */}
              <div className="relative rounded-xl overflow-hidden mx-auto" style={{ maxWidth: '180px', aspectRatio: '9/16' }}>
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  style={selectedFilter.css !== 'none' ? { filter: selectedFilter.css } : undefined}
                  draggable={false}
                />
                <button
                  onClick={() => {
                    if (previewUrl) URL.revokeObjectURL(previewUrl)
                    setSelectedFile(null); setPreviewUrl(null); setSelectedFilter(IMAGE_FILTERS[0])
                  }}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 backdrop-blur-sm
                             flex items-center justify-center hover:bg-black/80 transition-colors"
                >
                  <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* Filters */}
              <div className="space-y-1.5">
                <p className="text-[12px] font-medium text-white/40 uppercase tracking-wider">Filter</p>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
                  {IMAGE_FILTERS.map((f) => (
                    <button key={f.id} onClick={() => setSelectedFilter(f)} className="shrink-0">
                      <div className={`w-[44px] h-[58px] rounded-lg overflow-hidden border-[1.5px] transition-all
                        ${selectedFilter.id === f.id ? 'border-[#3b82f6] scale-105' : 'border-transparent opacity-70 hover:opacity-100'}`}>
                        <img src={previewUrl} alt={f.name} className="w-full h-full object-cover"
                          style={f.css !== 'none' ? { filter: f.css } : undefined} draggable={false} />
                      </div>
                      <p className={`text-[9px] mt-0.5 text-center truncate w-[44px]
                        ${selectedFilter.id === f.id ? 'text-[#3b82f6] font-bold' : 'text-white/30'}`}>{f.name}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Caption */}
              <div>
                <textarea value={caption} onChange={(e) => setCaption(e.target.value)}
                  placeholder="Add a caption…" maxLength={200} rows={1}
                  className="w-full rounded-lg bg-white/[0.05] border border-white/[0.08] px-3 py-2
                             text-[14px] text-[#e7e9ea] placeholder-white/25 resize-none
                             focus:outline-none focus:border-[#3b82f6]/40 transition-colors" />
                <p className="text-[11px] text-white/20 mt-0.5 text-right">{caption.length}/200</p>
              </div>

              <button onClick={() => {
                if (previewUrl) URL.revokeObjectURL(previewUrl)
                setPreviewUrl(null); setSelectedFile(null); setSelectedFilter(IMAGE_FILTERS[0])
              }} className="text-[13px] text-[#3b82f6] font-medium hover:underline">
                Change photo
              </button>
            </div>
          )}

          {/* Share */}
          <button onClick={handleShare} disabled={!previewUrl || uploading}
            className={`w-full py-2.5 rounded-full text-[14px] font-bold transition-all flex items-center justify-center gap-2
              ${previewUrl && !uploading
                ? 'bg-[#3b82f6] text-white hover:bg-[#2563eb] active:scale-[0.98]'
                : 'bg-white/[0.06] text-white/25 cursor-not-allowed'}`}>
            {uploading && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {statusText}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
