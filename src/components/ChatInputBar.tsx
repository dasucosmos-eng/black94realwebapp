'use client'

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type RefObject } from 'react'
import { cn } from '@/lib/utils'

/* ═══════════════════════════════════════════════════════════════════════════════
   ChatInputBar — Message Input Component

   Layout:
   ┌─────────────────────────────────────────────────────────────────────────┐
   │  Border-top: 0.5px border                                              │
   │  Background: #000000                                                   │
   │                                                                        │
   │   ┌─────────────────────────────────────────────────┐  ┌───┐           │
   │   │ 😊  GIF  [ Type a message               ] 📎  │  │ ➤ │           │
   │   └─────────────────────────────────────────────────┘  └───┘           │
   │   pill: rounded-full input area                                         │
   │   send: active when text is present                                     │
   │   height: ~56px, safe-area inset bottom                                │
   └─────────────────────────────────────────────────────────────────────────┘
   ═══════════════════════════════════════════════════════════════════════════════ */

export interface ChatInputBarProps {
  /** Current text value */
  value: string
  /** Called on every keystroke */
  onChange: (value: string) => void
  /** Called when user presses Enter (or taps send) */
  onSend: () => void
  /** Placeholder text (default: "Type a message") */
  placeholder?: string
  /** Disable the input entirely */
  disabled?: boolean
  /** Ref to the underlying input/textarea element */
  inputRef?: RefObject<HTMLInputElement | HTMLTextAreaElement | null>
  /** Additional condition for enabling send (e.g. image attached) */
  canSend?: boolean
  /** Use textarea instead of input (for multi-line support) */
  multiline?: boolean
  /** Show GIF button (default: true) */
  showGif?: boolean
  /** Emoji button click handler */
  onEmojiClick?: () => void
  /** Emoji button active state */
  emojiActive?: boolean
  /** GIF button click handler */
  onGifClick?: () => void
  /** Attach / paperclip click handler */
  onAttachClick?: () => void
}

export function ChatInputBar({
  value,
  onChange,
  onSend,
  placeholder = 'Type a message',
  disabled = false,
  inputRef,
  canSend,
  multiline = false,
  showGif = true,
  onEmojiClick,
  emojiActive = false,
  onGifClick,
  onAttachClick,
}: ChatInputBarProps) {
  const hasText = value.trim().length > 0
  const isActive = hasText || !!canSend
  const localRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null)
  const activeRef = (inputRef as RefObject<HTMLInputElement | HTMLTextAreaElement>) || localRef

  /* Auto-resize textarea */
  useEffect(() => {
    if (multiline && activeRef.current && 'style' in activeRef.current) {
      const el = activeRef.current
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 140) + 'px'
    }
  }, [value, multiline, activeRef])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (isActive) onSend()
      }
    },
    [isActive, onSend],
  )

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange(e.target.value)
    },
    [onChange],
  )

  /* ─── Shared input classes ─── */
  const inputClass =
    'flex-1 bg-transparent text-[15px] leading-[20px] text-white placeholder-[#71767b] outline-none min-w-0 focus-visible:ring-0 focus-visible:outline-none ring-0'

  return (
    <div
      className={cn(
        'shrink-0 bg-black',
        /* Thin top border */
        'border-t border-[#374151]',
        /* Safe area for notched phones / keyboards */
        'pb-[env(safe-area-inset-bottom,0px)]',
      )}
    >
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-2.5">

        {/* ══════════ Input Pill ══════════ */}
        <div
          className={cn(
            'flex-1 flex items-center gap-0.5',
            'bg-[#1f2937]',
            'rounded-full',
            'pl-1.5 pr-2 py-1',
            /* Subtle focus glow */
            'transition-shadow duration-200',
            'focus-within:shadow-[0_0_0_1px_rgba(59,130,246,0.35)]',
          )}
        >
          {/* ── Emoji button ── */}
          <button
            type="button"
            onClick={onEmojiClick}
            tabIndex={-1}
            className={cn(
              'shrink-0 flex items-center justify-center',
              'w-[34px] h-[34px] rounded-full',
              'transition-colors duration-150',
              emojiActive
                ? 'text-[#3b82f6]'
                : 'text-[#71767b] hover:text-[#e7e9ea] hover:bg-white/[0.07]',
            )}
            aria-label="Emoji"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          </button>

          {/* ── GIF button ── */}
          {showGif && (
            <button
              type="button"
              onClick={onGifClick}
              tabIndex={-1}
              className={cn(
                'shrink-0 flex items-center justify-center',
                'w-[34px] h-[34px] rounded-full',
                'text-[#71767b] hover:text-[#e7e9ea] hover:bg-white/[0.07]',
                'transition-colors duration-150',
              )}
              aria-label="GIF"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="5" width="20" height="14" rx="3" stroke="currentColor" strokeWidth={1.7} />
                <text
                  x="6"
                  y="15.5"
                  fill="currentColor"
                  fontSize="8"
                  fontWeight="800"
                  fontFamily="'SF Pro Display', 'Helvetica Neue', system-ui, sans-serif"
                  letterSpacing="0"
                >
                  GIF
                </text>
              </svg>
            </button>
          )}

          {/* ── Text Input ── */}
          {multiline ? (
            <textarea
              ref={activeRef as RefObject<HTMLTextAreaElement>}
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              rows={1}
              className={cn(inputClass, 'resize-none max-h-[140px] py-[6px]')}
              style={{ minHeight: '22px' }}
            />
          ) : (
            <input
              ref={activeRef as RefObject<HTMLInputElement>}
              type="text"
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              className={cn(inputClass, 'py-[6px]')}
            />
          )}

          {/* ── Attach / Paperclip button ── */}
          {onAttachClick && (
            <button
              type="button"
              onClick={onAttachClick}
              tabIndex={-1}
              className={cn(
                'shrink-0 flex items-center justify-center',
                'w-[34px] h-[34px] rounded-full',
                'text-[#71767b] hover:text-[#e7e9ea] hover:bg-white/[0.07]',
                'transition-colors duration-150',
              )}
              aria-label="Attach"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
          )}
        </div>

        {/* ══════════ Send Button (outside pill, arrow style) ══════════ */}
        <button
          type="button"
          onClick={isActive ? onSend : undefined}
          disabled={!isActive || disabled}
          className={cn(
            'shrink-0 flex items-center justify-center',
            'w-[36px] h-[36px] rounded-full',
            'transition-all duration-200 ease-in-out',
            isActive && !disabled
              ? 'text-[#3b82f6] hover:bg-[#3b82f6]/10 active:scale-[0.88]'
              : 'text-[#374151] cursor-default',
          )}
          aria-label="Send"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="transition-transform duration-200"
          >
            <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
