'use client'

import { useState, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { PAvatar } from './PAvatar'
import { useAppStore } from '@/stores/app'
import { createPost } from '@/lib/db'
import data from '@emoji-mart/data'
import Picker from '@emoji-mart/react'
import { toast } from 'sonner'
import { IMAGE_FILTERS, type ImageFilter } from '@/lib/image-filters'

interface ComposeDialogProps {
  open: boolean
  onClose: () => void
}

/* ── Image compression helper — fits within Firestore 1MB doc limit ── */
function compressImage(file: File, filterCss: string, maxDim = 1200, quality = 0.82): Promise<string> {
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
        // CRITICAL: Fill white background BEFORE drawing the image.
        // Without this, JPEG (no alpha support) renders transparent pixels as black.
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, width, height)

        // Apply CSS filter if not "Normal"
        if (filterCss && filterCss !== 'none') {
          ctx.filter = filterCss
        }

        ctx.drawImage(img, 0, 0, width, height)
        ctx.filter = 'none'

        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        // If still too large (base64 > ~750KB raw), compress more aggressively
        if (dataUrl.length > 750_000) {
          const dataUrl2 = canvas.toDataURL('image/jpeg', 0.5)
          resolve(dataUrl2.length < dataUrl.length ? dataUrl2 : dataUrl)
        } else {
          resolve(dataUrl)
        }
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

export function ComposeDialog({ open, onClose }: ComposeDialogProps) {
  const user = useAppStore((s) => s.user)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)     // raw preview
  const [selectedFilter, setSelectedFilter] = useState<ImageFilter>(IMAGE_FILTERS[0])
  const [compressing, setCompressing] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingFileRef = useRef<File | null>(null)

  // All users get 4000 character limit (free platform)
  const maxLen = 4000
  const remaining = maxLen - text.length
  const overLimit = remaining < 0

  const handleImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB')
      return
    }
    // Store raw preview and the file for later compression with selected filter
    pendingFileRef.current = file
    const reader = new FileReader()
    reader.onload = (ev) => {
      setImagePreview(ev.target?.result as string)
      setSelectedFilter(IMAGE_FILTERS[0])
      setShowFilters(true)
    }
    reader.readAsDataURL(file)
  }, [])

  const removeImage = useCallback(() => {
    setImagePreview(null)
    pendingFileRef.current = null
    setSelectedFilter(IMAGE_FILTERS[0])
    setShowFilters(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const handleSubmit = async () => {
    if ((!text.trim() && !imagePreview) || !user || sending || overLimit) return
    if (overLimit) {
      toast.error(`Post exceeds ${maxLen} character limit by ${Math.abs(remaining)} characters`)
      return
    }
    setSending(true)
    setCompressing(true)
    try {
      let mediaUrls = ''
      if (imagePreview && pendingFileRef.current) {
        mediaUrls = await compressImage(pendingFileRef.current, selectedFilter.css)
      }
      await createPost(user.id, text.trim(), mediaUrls)
      setText('')
      setImagePreview(null)
      pendingFileRef.current = null
      setSelectedFilter(IMAGE_FILTERS[0])
      setShowFilters(false)
      setShowEmoji(false)
      onClose()
      toast.success('Post published!')
    } catch (err) {
      console.error('Failed to create post:', err)
      toast.error('Failed to publish post. Try again.')
    } finally {
      setCompressing(false)
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
              disabled={(!text.trim() && !imagePreview) || sending || overLimit}
              className={cn(
                'px-5 py-1.5 rounded-full text-[15px] font-bold transition-all',
                (text.trim() || imagePreview) && !sending && !overLimit
                  ? 'bg-[#FFFFFF] text-black hover:bg-[#D1D5DB]'
                  : 'bg-white/[0.08] text-[#64748b] cursor-not-allowed'
              )}
            >
              {compressing ? 'Processing...' : sending ? 'Posting...' : 'Post'}
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
                // Allow full paste, then enforce limit via state
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
              className="w-full bg-transparent text-[#e7e9ea] text-[17px] placeholder-[#64748b] resize-none outline-none min-h-[110px] leading-relaxed"
              autoFocus
            />

            {/* Compressing indicator */}
            {compressing && (
              <div className="flex items-center gap-2 mt-2">
                <div className="w-4 h-4 border-2 border-[#FFFFFF]/30 border-t-[#FFFFFF] rounded-full animate-spin" />
                <span className="text-[13px] text-[#94a3b8]">Optimizing image...</span>
              </div>
            )}

            {/* Image Preview with filter */}
            {imagePreview && (
              <div className="mt-3 space-y-3">
                <div className="relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-h-[200px] max-w-full rounded-2xl border border-white/[0.08] object-cover"
                    style={selectedFilter.css !== 'none' ? { filter: selectedFilter.css } : undefined}
                  />
                  {/* Filter badge */}
                  {selectedFilter.id !== 'normal' && (
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

                {/* Filter toggle */}
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
                {/* Image upload */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={compressing}
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
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelect}
                />

                {/* GIF */}
                <button className="p-2 rounded-full hover:bg-[#FFFFFF]/10 transition-colors">
                  <svg className="w-5 h-5 text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <rect x="2" y="4" width="20" height="16" rx="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <text x="12" y="15" textAnchor="middle" fill="#FFFFFF" fontSize="7" fontWeight="bold" fontFamily="sans-serif">GIF</text>
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
