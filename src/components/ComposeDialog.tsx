'use client'

import { useState, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { PAvatar } from './PAvatar'
import { useAppStore } from '@/stores/app'
import { createPost } from '@/lib/db'
import { storage } from '@/lib/firebase'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import data from '@emoji-mart/data'
import Picker from '@emoji-mart/react'
import { toast } from 'sonner'
import { IMAGE_FILTERS, type ImageFilter } from '@/lib/image-filters'

interface ComposeDialogProps {
  open: boolean
  onClose: () => void
}

interface PollOption {
  id: string
  text: string
}

/* ── Upload media (image/GIF) to Firebase Storage, returns download URL ── */
async function uploadMediaToStorage(
  file: File,
  userId: string,
  filterCss?: string,
): Promise<string> {
  const isGif = file.type === 'image/gif'

  // For GIFs: upload directly (no compression — preserves animation)
  if (isGif) {
    const path = `posts/${userId}/${Date.now()}_${file.name}`
    const ref = storageRef(storage, path)
    await uploadBytes(ref, file)
    return getDownloadURL(ref)
  }

  // For images: compress, apply filter, then upload
  const compressedBlob = await compressImageToBlob(file, filterCss)
  const path = `posts/${userId}/${Date.now()}_${file.name.replace(/\.[^.]+$/, '.jpg')}`
  const ref = storageRef(storage, path)
  await uploadBytes(ref, compressedBlob, { contentType: 'image/jpeg' })
  return getDownloadURL(ref)
}

/* ── Compress image to Blob (for Firebase Storage upload) ── */
function compressImageToBlob(
  file: File,
  filterCss?: string,
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
        if (!ctx) { reject(new Error('Canvas not supported')); return }
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, width, height)
        if (filterCss && filterCss !== 'none') {
          ctx.filter = filterCss
        }
        ctx.drawImage(img, 0, 0, width, height)
        ctx.filter = 'none'
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob)
            else reject(new Error('Failed to compress image'))
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

/* ── Generate a unique ID for poll options ── */
function makePollId() {
  return `po_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

export function ComposeDialog({ open, onClose }: ComposeDialogProps) {
  const user = useAppStore((s) => s.user)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [selectedFilter, setSelectedFilter] = useState<ImageFilter>(IMAGE_FILTERS[0])
  const [uploading, setUploading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [isGif, setIsGif] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const gifInputRef = useRef<HTMLInputElement>(null)
  const pendingFileRef = useRef<File | null>(null)

  // Poll state
  const [pollEnabled, setPollEnabled] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState<PollOption[]>([
    { id: makePollId(), text: '' },
    { id: makePollId(), text: '' },
  ])

  const maxLen = 4000
  const remaining = maxLen - text.length
  const overLimit = remaining < 0

  // Check if post is valid: needs text, or image, or poll
  const hasContent = text.trim().length > 0 || !!imagePreview ||
    (pollEnabled && pollQuestion.trim() && pollOptions.some(o => o.text.trim()))

  const handleImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error('File must be under 15MB')
      return
    }
    pendingFileRef.current = file
    const isGifFile = file.type === 'image/gif'
    setIsGif(isGifFile)
    const reader = new FileReader()
    reader.onload = (ev) => {
      setImagePreview(ev.target?.result as string)
      if (!isGifFile) {
        setSelectedFilter(IMAGE_FILTERS[0])
        setShowFilters(true)
      } else {
        setShowFilters(false) // No filters for GIFs
      }
    }
    reader.readAsDataURL(file)
  }, [])

  const handleGifSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'image/gif') {
      toast.error('Please select a GIF file')
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error('GIF must be under 15MB')
      return
    }
    pendingFileRef.current = file
    setIsGif(true)
    const reader = new FileReader()
    reader.onload = (ev) => {
      setImagePreview(ev.target?.result as string)
      setShowFilters(false)
    }
    reader.readAsDataURL(file)
  }, [])

  const removeImage = useCallback(() => {
    setImagePreview(null)
    pendingFileRef.current = null
    setSelectedFilter(IMAGE_FILTERS[0])
    setShowFilters(false)
    setIsGif(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (gifInputRef.current) gifInputRef.current.value = ''
  }, [])

  // Poll helpers
  const addPollOption = useCallback(() => {
    if (pollOptions.length < 4) {
      setPollOptions(prev => [...prev, { id: makePollId(), text: '' }])
    }
  }, [pollOptions.length])

  const removePollOption = useCallback((id: string) => {
    if (pollOptions.length > 2) {
      setPollOptions(prev => prev.filter(o => o.id !== id))
    }
  }, [pollOptions.length])

  const updatePollOption = useCallback((id: string, text: string) => {
    setPollOptions(prev => prev.map(o => o.id === id ? { ...o, text } : o))
  }, [])

  const handleSubmit = async () => {
    if (!hasContent || !user || sending || overLimit) return
    if (overLimit) {
      toast.error(`Post exceeds ${maxLen} character limit by ${Math.abs(remaining)} characters`)
      return
    }
    if (pollEnabled && (!pollQuestion.trim() || !pollOptions.some(o => o.text.trim()))) {
      toast.error('Please add a question and at least one option for the poll')
      return
    }
    setSending(true)
    setUploading(true)
    try {
      // Upload media to Firebase Storage (not base64!)
      let mediaUrls = ''
      if (imagePreview && pendingFileRef.current) {
        mediaUrls = await uploadMediaToStorage(pendingFileRef.current, user.id, selectedFilter.css)
      }

      // Build poll data (append to caption as structured JSON if present)
      let finalCaption = text.trim()
      if (pollEnabled && pollQuestion.trim()) {
        const pollData = {
          question: pollQuestion.trim(),
          options: pollOptions.filter(o => o.text.trim()).map(o => ({
            id: o.id,
            text: o.text.trim(),
            votes: 0,
          })),
        }
        finalCaption = JSON.stringify({ caption: finalCaption, poll: pollData })
      }

      await createPost(user.id, finalCaption, mediaUrls)

      // Reset everything
      setText('')
      setImagePreview(null)
      pendingFileRef.current = null
      setSelectedFilter(IMAGE_FILTERS[0])
      setShowFilters(false)
      setIsGif(false)
      setShowEmoji(false)
      setPollEnabled(false)
      setPollQuestion('')
      setPollOptions([{ id: makePollId(), text: '' }, { id: makePollId(), text: '' }])
      onClose()
      toast.success('Post published!')
    } catch (err) {
      console.error('Failed to create post:', err)
      toast.error('Failed to publish post. Try again.')
    } finally {
      setUploading(false)
      setSending(false)
    }
  }

  const handleEmojiSelect = (emoji: any) => {
    const newText = text + emoji.native
    if (newText.length <= maxLen + 100) {
      setText(newText)
    }
    textareaRef.current?.focus()
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#000000]/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative w-full max-w-lg bg-[#0d0b14] border border-white/[0.08] rounded-t-2xl sm:rounded-2xl animate-scale-in max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.08] shrink-0">
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/[0.08] transition-colors"
          >
            <svg className="w-5 h-5 text-[#e7e9ea]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSubmit}
              disabled={!hasContent || sending || overLimit}
              className={cn(
                'px-5 py-1.5 rounded-full text-[15px] font-bold transition-all',
                hasContent && !sending && !overLimit
                  ? 'bg-[#FFFFFF] text-black hover:bg-[#D1D5DB]'
                  : 'bg-white/[0.08] text-[#64748b] cursor-not-allowed'
              )}
            >
              {uploading ? 'Uploading...' : sending ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex gap-3.5 p-4 overflow-y-auto flex-1">
          <PAvatar
            src={user?.profileImage}
            name={user?.displayName}
            size={38}
            verified={user?.isVerified}
            badge={user?.badge}
          />
          <div className="flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleChange}
              onPaste={(e) => {
                setTimeout(() => {
                  if (textareaRef.current) {
                    const val = textareaRef.current.value
                    if (val.length > maxLen) {
                      setText(val.slice(0, maxLen))
                    }
                  }
                }, 0)
              }}
              placeholder="What's on your mind?"
              className="w-full bg-transparent text-[#e7e9ea] text-[17px] placeholder-[#64748b] resize-none outline-none min-h-[80px] leading-relaxed"
              autoFocus
            />

            {/* Uploading indicator */}
            {uploading && (
              <div className="flex items-center gap-2 mt-2">
                <div className="w-4 h-4 border-2 border-[#FFFFFF]/30 border-t-[#FFFFFF] rounded-full animate-spin" />
                <span className="text-[13px] text-[#94a3b8]">
                  {isGif ? 'Uploading GIF...' : 'Uploading image...'}
                </span>
              </div>
            )}

            {/* Image/GIF Preview with filter (filters only for non-GIF) */}
            {imagePreview && (
              <div className="mt-3 space-y-3">
                <div className="relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-h-[200px] max-w-full rounded-2xl border border-white/[0.08] object-cover"
                    style={!isGif && selectedFilter.css !== 'none' ? { filter: selectedFilter.css } : undefined}
                  />
                  {/* GIF badge */}
                  {isGif && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-[#000000]/70 backdrop-blur-sm">
                      <span className="text-[11px] text-white font-bold">GIF</span>
                    </div>
                  )}
                  {/* Filter badge */}
                  {!isGif && selectedFilter.id !== 'normal' && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-[#000000]/70 backdrop-blur-sm">
                      <span className="text-[11px] text-white font-medium">{selectedFilter.name}</span>
                    </div>
                  )}
                  <button
                    onClick={removeImage}
                    className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[#000000] border border-white/[0.15] flex items-center justify-center hover:bg-red-500/20 transition-colors"
                  >
                    <svg className="w-4 h-4 text-[#e7e9ea]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>

                {/* Filter toggle (only for non-GIF images) */}
                {!isGif && (
                  <>
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className="flex items-center gap-1.5 text-[13px] text-[#FFFFFF] font-medium hover:underline"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" strokeLinecap="round" />
                        <circle cx="12" cy="12" r="4" />
                      </svg>
                      {showFilters ? 'Hide Filters' : 'Edit Filters'}
                    </button>

                    {/* Filter selector strip */}
                    {showFilters && (
                      <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1 animate-fade-in">
                        {IMAGE_FILTERS.map((f) => (
                          <button
                            key={f.id}
                            onClick={() => setSelectedFilter(f)}
                            className="flex flex-col items-center gap-1 shrink-0"
                          >
                            <div
                              className={cn(
                                'w-[52px] h-[52px] rounded-lg overflow-hidden border-2 transition-all',
                                selectedFilter.id === f.id
                                  ? 'border-[#FFFFFF] scale-105 shadow-lg shadow-[#FFFFFF]/20'
                                  : 'border-transparent opacity-75 hover:opacity-100'
                              )}
                            >
                              <img
                                src={imagePreview}
                                alt={f.name}
                                className="w-full h-full object-cover"
                                style={f.css !== 'none' ? { filter: f.css } : undefined}
                                draggable={false}
                              />
                            </div>
                            <span className={cn(
                              'text-[9px] max-w-[52px] truncate',
                              selectedFilter.id === f.id ? 'text-[#FFFFFF] font-bold' : 'text-[#94a3b8]'
                            )}>
                              {f.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Poll Creator */}
            {pollEnabled && (
              <div className="mt-3 space-y-2.5 animate-fade-in">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <text x="12" y="15" textAnchor="middle" fill="#FFFFFF" fontSize="7" fontWeight="bold" fontFamily="sans-serif">GIF</text>
                  </svg>
                  <span className="text-[13px] text-[#FFFFFF] font-semibold">Poll</span>
                </div>
                <input
                  type="text"
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  placeholder="Ask a question..."
                  className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-[15px] text-[#e7e9ea] placeholder-[#64748b] outline-none focus:border-[#FFFFFF]/30 transition-colors"
                />
                <div className="space-y-2">
                  {pollOptions.map((opt, i) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-white/[0.06] flex items-center justify-center shrink-0">
                        <span className="text-[11px] text-[#94a3b8] font-bold">{i + 1}</span>
                      </div>
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => updatePollOption(opt.id, e.target.value)}
                        placeholder={`Option ${i + 1}`}
                        className="flex-1 bg-white/[0.06] border border-white/[0.08] rounded-xl px-3.5 py-2 text-[14px] text-[#e7e9ea] placeholder-[#64748b] outline-none focus:border-[#FFFFFF]/30 transition-colors"
                      />
                      {pollOptions.length > 2 && (
                        <button
                          onClick={() => removePollOption(opt.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-full bg-white/[0.06] text-[#94a3b8] hover:text-red-400 hover:bg-red-500/10 transition-colors text-sm"
                        >
                          x
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {pollOptions.length < 4 && (
                  <button
                    onClick={addPollOption}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors bg-white/[0.04] border border-white/[0.08] text-[#94a3b8] hover:text-[#FFFFFF] hover:bg-white/[0.08]"
                  >
                    + Add option
                  </button>
                )}
                {/* Poll duration selector */}
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-[#64748b]">Duration:</span>
                  {['1 day', '3 days', '7 days'].map((d) => (
                    <span
                      key={d}
                      className="text-[12px] text-[#94a3b8] px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08]"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Emoji Picker */}
            {showEmoji && (
              <div className="mt-3 animate-fade-in">
                <Picker
                  data={data}
                  onEmojiSelect={handleEmojiSelect}
                  theme="dark"
                  set="native"
                  perLine={8}
                  previewPosition="none"
                  skinTonePosition="search"
                  style={{ maxWidth: '100%' }}
                />
              </div>
            )}

            <div className="border-t border-white/[0.08] pt-3 mt-3 flex items-center justify-between">
              <div className="flex items-center gap-0.5">
                {/* Image upload (non-GIF) */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="p-2 rounded-full hover:bg-[#FFFFFF]/10 transition-colors disabled:opacity-50"
                >
                  <svg className="w-5 h-5 text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleImageSelect}
                />

                {/* GIF upload */}
                <button
                  onClick={() => gifInputRef.current?.click()}
                  disabled={uploading}
                  className="p-2 rounded-full hover:bg-[#FFFFFF]/10 transition-colors disabled:opacity-50"
                >
                  <svg className="w-5 h-5 text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <rect x="2" y="4" width="20" height="16" rx="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <text x="12" y="15" textAnchor="middle" fill="#FFFFFF" fontSize="7" fontWeight="bold" fontFamily="sans-serif">GIF</text>
                  </svg>
                </button>
                <input
                  ref={gifInputRef}
                  type="file"
                  accept="image/gif"
                  className="hidden"
                  onChange={handleGifSelect}
                />

                {/* Poll toggle */}
                <button
                  onClick={() => setPollEnabled(!pollEnabled)}
                  className={cn(
                    'p-2 rounded-full transition-colors',
                    pollEnabled ? 'bg-[#FFFFFF]/20' : 'hover:bg-[#FFFFFF]/10'
                  )}
                >
                  <svg className="w-5 h-5 text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path d="M18 20V10M12 20V4M6 20v-6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                {/* Emoji toggle */}
                <button
                  onClick={() => setShowEmoji(!showEmoji)}
                  className={cn(
                    'p-2 rounded-full transition-colors',
                    showEmoji ? 'bg-[#FFFFFF]/20' : 'hover:bg-[#FFFFFF]/10'
                  )}
                >
                  <svg className="w-5 h-5 text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
              <div className="flex items-center gap-2">
                {overLimit && (
                  <span className="text-[13px] text-red-400 font-bold tabular-nums">
                    {Math.abs(remaining)} over
                  </span>
                )}
                {!overLimit && text.length > maxLen * 0.85 && (
                  <span className={cn('text-[13px] tabular-nums', 'text-[#94a3b8]')}>
                    {remaining}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
