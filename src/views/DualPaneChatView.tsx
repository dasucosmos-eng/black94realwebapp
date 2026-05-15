'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useDualPaneChat, type ChatMsg, type MessageReaction } from '@/stores/dualPaneChat'
import { useAppStore } from '@/stores/app'
import { PAvatar, VerifiedBadge } from '@/components/PAvatar'
import { ChatInputBar } from '@/components/ChatInputBar'

/* ── Helpers ───────────────────────────────────────────────────────── */

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

const REACTION_EMOJIS = ['❤️', '😂', '🔥', '😍', '😮', '😢', '💯', '👎']

/* ── E2EE Shield Badge ────────────────────────────────────────────── */

function E2EEBadge() {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FFFFFF]/10 border border-[#FFFFFF]/20">
      <svg className="w-3.5 h-3.5 text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
      <span className="text-[11px] text-[#FFFFFF] font-semibold tracking-wide">E2E ENCRYPTED</span>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   REACTION PICKER — Floating emoji bar above a message
   ═══════════════════════════════════════════════════════════════════════════ */

function ReactionPicker({
  msgId,
  position,
  onClose,
}: {
  msgId: string
  position: { x: number; y: number; alignRight: boolean }
  onClose: () => void
}) {
  const { toggleReaction } = useDualPaneChat()
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // Small delay to avoid the opening click closing it immediately
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 50)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler) }
  }, [onClose])

  return (
    <div
      ref={pickerRef}
      className={cn(
        'absolute z-50 flex items-center gap-0.5 px-1.5 py-1.5 rounded-full',
        'bg-[#000000] border border-white/[0.12] shadow-xl shadow-black/50',
        'animate-reaction-picker-in'
      )}
      style={{
        bottom: position.alignRight ? '100%' : '100%',
        right: position.alignRight ? 0 : 'auto',
        left: position.alignRight ? 'auto' : 0,
        transform: 'translateY(-6px)',
      }}
    >
      {REACTION_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => { toggleReaction(msgId, emoji); onClose() }}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/[0.08] active:scale-125 transition-all duration-150 text-[18px] leading-none"
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   REACTIONS BAR — Displays reactions below a message
   ═══════════════════════════════════════════════════════════════════════════ */

function ReactionsBar({
  msgId,
  reactions,
  isMine,
}: {
  msgId: string
  reactions: MessageReaction[]
  isMine: boolean
}) {
  const { toggleReaction } = useDualPaneChat()
  if (reactions.length === 0) return null

  return (
    <div className={cn('flex flex-wrap gap-1 mt-1 px-1', isMine ? 'justify-end' : 'justify-start')}>
      {reactions.map((r) => (
        <button
          key={r.emoji}
          onClick={() => toggleReaction(msgId, r.emoji)}
          className={cn(
            'inline-flex items-center gap-1 pl-1.5 pr-2 py-[2px] rounded-full text-[13px] transition-all duration-200 border animate-scale-in',
            r.reacted
              ? isMine
                ? 'bg-[#000000]/20 border-black/30 text-black'
                : 'bg-[#FFFFFF]/15 border-[#FFFFFF]/25 text-[#FFFFFF]'
              : 'bg-white/[0.04] border-white/[0.06] text-[#94a3b8] hover:border-white/[0.12]'
          )}
        >
          <span className="text-[13px] leading-none">{r.emoji}</span>
          <span className="text-[11px] font-semibold">{r.count}</span>
        </button>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   MESSAGE BUBBLE — Single chat message with long-press actions
   ═══════════════════════════════════════════════════════════════════════════ */

function MessageBubble({
  msg,
  onLongPress,
}: {
  msg: ChatMsg
  onLongPress: (msg: ChatMsg, rect: DOMRect) => void
}) {
  const { replyTo, setReplyTo, toggleReaction } = useDualPaneChat()
  const [showActions, setShowActions] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>()
  const touchStartPos = useRef({ x: 0, y: 0 })
  const bubbleRef = useRef<HTMLDivElement>(null)

  const isMine = msg.isMine

  // Double click to react
  const lastClickRef = useRef(0)

  const handleClick = useCallback(() => {
    const now = Date.now()
    if (now - lastClickRef.current < 300) {
      // Double click — quick ❤️
      toggleReaction(msg.id, '❤️')
      setShowActions(false)
    }
    lastClickRef.current = now
  }, [msg.id, toggleReaction])

  // Long press for desktop (right click)
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const rect = bubbleRef.current?.getBoundingClientRect()
    if (rect) onLongPress(msg, rect)
  }, [msg, onLongPress])

  // Long press for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    touchStartPos.current = { x: touch.clientX, y: touch.clientY }
    longPressTimer.current = setTimeout(() => {
      const rect = bubbleRef.current?.getBoundingClientRect()
      if (rect) onLongPress(msg, rect)
    }, 500)
  }, [msg, onLongPress])

  const handleTouchEnd = useCallback(() => {
    clearTimeout(longPressTimer.current)
  }, [])

  const handleTouchMove = useCallback(() => {
    clearTimeout(longPressTimer.current)
  }, [])

  return (
    <div
      ref={bubbleRef}
      className={cn('flex flex-col relative group', isMine ? 'items-end' : 'items-start')}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
    >
      {/* Reply context inside bubble */}
      <div className={cn(
        'max-w-[82%] animate-fade-in',
        isMine
          ? 'bg-gradient-to-br from-[#FFFFFF] to-[#D1D5DB] text-black rounded-2xl rounded-br-sm'
          : 'bg-white/[0.06] text-[#e7e9ea] rounded-2xl rounded-bl-sm border border-white/[0.06]'
      )}>
        {/* Inline reply preview */}
        {msg.replyTo && (
          <div className={cn(
            'mx-2 mt-2 mb-1 px-2.5 py-1.5 rounded-lg border-l-[3px]',
            isMine
              ? 'bg-[#000000]/10 border-l-black/40'
              : 'bg-white/[0.04] border-l-[#FFFFFF]/50'
          )}>
            <span className={cn('text-[11px] font-bold block leading-tight', isMine ? 'text-black/60' : 'text-[#FFFFFF]')}>
              {msg.replyTo.isMine ? 'You' : msg.replyTo.senderName}
            </span>
            <span className={cn('text-[12px] block leading-snug mt-0.5 line-clamp-1', isMine ? 'text-black/50' : 'text-[#64748b]')}>
              {msg.replyTo.content}
            </span>
          </div>
        )}
        {/* Message content */}
        <div className="px-3.5 py-2.5 text-[14px] leading-relaxed">
          {msg.content}
        </div>
      </div>

      {/* Timestamp + read receipt */}
      <div className={cn('flex items-center gap-1 mt-0.5 px-1', isMine ? 'flex-row-reverse' : '')}>
        <span className="text-[10px] text-[#64748b]">{formatTime(msg.timestamp)}</span>
        {isMine && (
          <svg className="w-3.5 h-3.5 text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>

      {/* Reactions */}
      <ReactionsBar msgId={msg.id} reactions={msg.reactions} isMine={isMine} />

      {/* Quick action buttons — appear on hover (desktop) */}
      <div className={cn(
        'absolute top-0 flex items-center gap-0.5 px-1 py-0.5 rounded-full',
        'bg-[#000000]/95 border border-white/[0.08] shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none group-hover:pointer-events-auto',
        isMine ? '-left-[76px]' : '-right-[76px]'
      )}>
        <button
          onClick={(e) => { e.stopPropagation(); setReplyTo(msg) }}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/[0.08] transition-colors"
          title="Reply"
        >
          <svg className="w-3.5 h-3.5 text-[#94a3b8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 00-4-4H4"/>
          </svg>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            const rect = bubbleRef.current?.getBoundingClientRect()
            if (rect) onLongPress(msg, rect)
          }}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/[0.08] transition-colors"
          title="React"
        >
          <svg className="w-3.5 h-3.5 text-[#f43f5e]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
          </svg>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); toggleReaction(msg.id, '❤️') }}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/[0.08] transition-colors text-[14px]"
          title="Love"
        >
          ❤️
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   REPLY CONTEXT BAR — Shows above input when replying
   ═══════════════════════════════════════════════════════════════════════════ */

function ReplyBar() {
  const { replyTo, setReplyTo } = useDualPaneChat()

  if (!replyTo) return null

  return (
    <div className="shrink-0 px-3 pt-2 bg-[#000000]/80 backdrop-blur-xl animate-reply-slide-in">
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-t-xl bg-white/[0.04] border-x border-t border-white/[0.06]">
        {/* Left accent bar */}
        <div className="w-[3px] h-8 rounded-full bg-[#FFFFFF] shrink-0" />
        {/* Reply content */}
        <div className="flex-1 min-w-0">
          <span className="text-[12px] font-bold text-[#FFFFFF] block">
            {replyTo.isMine ? 'You' : replyTo.senderName}
          </span>
          <span className="text-[12px] text-[#64748b] block truncate">{replyTo.content}</span>
        </div>
        {/* Dismiss */}
        <button
          onClick={() => setReplyTo(null)}
          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/[0.08] transition-colors shrink-0"
        >
          <svg className="w-3.5 h-3.5 text-[#64748b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRIVATE CHAT PANEL
   ═══════════════════════════════════════════════════════════════════════════ */

function PrivateChatPanel() {
  const { messages, addMessage, typing, setTyping, replyTo, setReplyTo } = useDualPaneChat()
  const [text, setText] = useState('')
  const [reactionPicker, setReactionPicker] = useState<{
    msgId: string
    position: { x: number; y: number; alignRight: boolean }
  } | null>(null)
  const [chatPartner] = useState({ name: 'Chat', initial: '?', color: '#FFFFFF', online: false })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to message when replyTo changes
  useEffect(() => {
    if (replyTo) {
      inputRef.current?.focus()
    }
  }, [replyTo])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  const handleSend = useCallback(() => {
    if (!text.trim()) return
    addMessage({
      id: `msg_${Date.now()}`,
      senderId: 'me', senderName: 'You', content: text.trim(),
      timestamp: Date.now(), isMine: true, read: true,
      replyTo: replyTo ? {
        id: replyTo.id,
        senderName: replyTo.senderName,
        content: replyTo.content,
        isMine: replyTo.isMine,
      } : undefined,
    })
    setText('')
    setReplyTo(null)
    inputRef.current?.focus()
  }, [text, addMessage, replyTo, setReplyTo])

  const handleLongPress = useCallback((msg: ChatMsg, rect: DOMRect) => {
    setReactionPicker({
      msgId: msg.id,
      position: { x: rect.left + rect.width / 2, y: rect.top, alignRight: msg.isMine },
    })
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* ─── Chat Header ─── */}
      <div className="shrink-0 h-[56px] px-4 flex items-center justify-between border-b border-white/[0.06] bg-[#000000]/60 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="relative">
            <PAvatar name={chatPartner.name} size={36} verified={chatPartner.verified} />
            {chatPartner.online && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#10b981] border-2 border-black" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[14px] font-bold text-white">{chatPartner.name}</span>
              {chatPartner.verified && <VerifiedBadge size={14} />}
            </div>
            <span className="text-[11px] text-[#FFFFFF]">{chatPartner.online ? 'Online' : 'Offline'}</span>
          </div>
        </div>
        <E2EEBadge />
      </div>

      {/* ─── Messages ─── */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2 no-scrollbar relative">
        {/* Date separator */}
        <div className="flex justify-center py-2">
          <span className="text-[11px] text-[#64748b] bg-white/[0.04] px-3 py-0.5 rounded-full">Today</span>
        </div>

        {messages.map((msg) => (
          <div key={msg.id} className="relative">
            <MessageBubble msg={msg} onLongPress={handleLongPress} />
            {/* Reaction picker attached to this message */}
            {reactionPicker && reactionPicker.msgId === msg.id && (
              <ReactionPicker
                msgId={msg.id}
                position={reactionPicker.position}
                onClose={() => setReactionPicker(null)}
              />
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {typing && (
          <div className="flex items-start animate-fade-in">
            <div className="bg-white/[0.06] border border-white/[0.06] rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex items-center gap-1">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ─── Reply Context Bar ─── */}
      <ReplyBar />

      {/* ─── Input Bar ─── */}
      <ChatInputBar
        value={text}
        onChange={setText}
        onSend={handleSend}
        inputRef={inputRef as React.RefObject<HTMLInputElement>}
        placeholder={replyTo ? `Replying to ${replyTo.isMine ? 'yourself' : replyTo.senderName}...` : 'Type a message'}
      />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   SINGLE AD CARD
   ═══════════════════════════════════════════════════════════════════════════ */

function AdCard({ ad }: { ad: ReturnType<typeof useDualPaneChat.getState>['ads'][0] }) {
  const { likeAd, saveAd, skipAd, clickCta } = useDualPaneChat()

  return (
    <div className={cn(
      'mx-3 mb-3 rounded-2xl overflow-hidden bg-white/[0.03] border border-white/[0.06] transition-all duration-400 animate-fade-in',
      ad.skipped && 'opacity-0 -translate-x-full h-0 mb-0 mx-0 overflow-hidden'
    )}>
      {/* Brand header */}
      <div className="flex items-center justify-between px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1a2a1a] to-[#110f1a] flex items-center justify-center text-[12px] text-[#FFFFFF] font-bold border border-white/[0.08]">
            {ad.brandInitial}
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className="text-[13px] font-semibold text-white">{ad.brandName}</span>
              {ad.verified && <VerifiedBadge size={13} />}
            </div>
            <span className="text-[11px] text-[#64748b]">Sponsored · {timeAgo(ad.timestamp)}</span>
          </div>
        </div>
        <button
          onClick={() => skipAd(ad.id)}
          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/[0.08] transition-colors"
          aria-label="Dismiss"
        >
          <svg className="w-3.5 h-3.5 text-[#64748b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Ad content */}
      <div className="px-3.5 pb-2">
        <p className="text-[14px] font-semibold text-white leading-snug">{ad.headline}</p>
        <p className="text-[13px] text-[#94a3b8] mt-1 leading-relaxed">{ad.body}</p>
      </div>

      {/* Ad image */}
      <div className="mx-3.5 mb-2.5 rounded-xl overflow-hidden aspect-[16/10] bg-white/[0.04]">
        <img src={ad.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
      </div>

      {/* CTA Button */}
      <div className="px-3.5 pb-2">
        <button
          onClick={() => clickCta(ad.id)}
          className="w-full py-2.5 rounded-xl text-[13px] font-bold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          style={{ backgroundColor: ad.ctaColor }}
        >
          {ad.ctaText}
        </button>
      </div>

      {/* Bottom: reward + actions */}
      <div className="flex items-center justify-between px-3.5 py-2 border-t border-white/[0.04]">
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-[#64748b]">Earn</span>
          <span className="text-[13px] font-bold text-[#f59e0b]">{ad.reward}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => likeAd(ad.id)}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[12px] transition-all duration-200',
              ad.liked ? 'bg-[#f43f5e]/15 text-[#f43f5e]' : 'text-[#94a3b8] hover:bg-white/[0.06]'
            )}
          >
            <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill={ad.liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
            <span>{ad.liked ? 'Liked' : 'Like'}</span>
          </button>
          <button
            onClick={() => saveAd(ad.id)}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[12px] transition-all duration-200',
              ad.saved ? 'bg-[#2a7fff]/15 text-[#2a7fff]' : 'text-[#94a3b8] hover:bg-white/[0.06]'
            )}
          >
            <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill={ad.saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
            </svg>
            <span>{ad.saved ? 'Saved' : 'Save'}</span>
          </button>
          <button
            onClick={() => skipAd(ad.id)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[12px] text-[#94a3b8] hover:bg-white/[0.06] transition-all duration-200"
          >
            <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
            </svg>
            <span>Skip</span>
          </button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   CHAT ADS PANEL
   ═══════════════════════════════════════════════════════════════════════════ */

function ChatAdsPanel() {
  const { ads, loadMoreAds, totalEarned } = useDualPaneChat()
  const [visibleCount, setVisibleCount] = useState(4)
  const scrollRef = useRef<HTMLDivElement>(null)

  const visibleAds = useMemo(() => ads.slice(0, visibleCount), [ads, visibleCount])

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    if (scrollHeight - scrollTop - clientHeight < 120 && visibleCount < ads.length) {
      setVisibleCount((c) => Math.min(c + 3, ads.length))
      if (visibleCount >= ads.length - 1) loadMoreAds()
    }
  }, [visibleCount, ads.length, loadMoreAds])

  return (
    <div className="flex flex-col h-full">
      {/* ─── Ads Stats Bar ─── */}
      <div className="shrink-0 px-4 py-3 flex items-center justify-between border-b border-white/[0.06] bg-[#000000]/60 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f59e0b]/10 border border-[#f59e0b]/20">
            <svg className="w-3.5 h-3.5 text-[#f59e0b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
            <span className="text-[12px] font-bold text-[#f59e0b]">{ads.length} ads</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#f59e0b]/15 to-[#f97316]/15 border border-[#f59e0b]/20">
          <span className="text-[12px] text-[#f59e0b] font-semibold">Total Earned</span>
          <span className="text-[13px] font-bold text-[#f59e0b]">₹{totalEarned}</span>
        </div>
      </div>

      {/* ─── Ads Feed ─── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto py-2 no-scrollbar"
        style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 3%, black 97%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 3%, black 97%, transparent 100%)' }}
      >
        {visibleAds.map((ad) => (
          <AdCard key={ad.id} ad={ad} />
        ))}

        {visibleAds.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-[#64748b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
            </div>
            <p className="text-[14px] text-[#94a3b8]">No more ads right now</p>
            <p className="text-[12px] text-[#64748b] mt-1">Check back later for new sponsored content</p>
          </div>
        )}

        {visibleCount < ads.length && (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border-2 border-[#FFFFFF]/30 border-t-[#FFFFFF] rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN CHAT VIEW — Tab-based single pane
   ═══════════════════════════════════════════════════════════════════════════ */

export function DualPaneChatView() {
  const { activeTab, setActiveTab, setIsMobile } = useDualPaneChat()
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    setInitialized(true)
    return () => window.removeEventListener('resize', check)
  }, [setIsMobile])

  if (!initialized) {
    return (
      <div className="h-[calc(100vh-106px)] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#FFFFFF]/30 border-t-[#FFFFFF] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-106px)] flex flex-col animate-fade-in">
      {/* ─── Tab Switcher (always visible) ─── */}
      <div className="shrink-0 flex border-b border-white/[0.06] bg-[#000000]/80 backdrop-blur-xl">
        <button
          onClick={() => setActiveTab('chat')}
          className={cn(
            'flex-1 py-3 text-[15px] font-medium relative transition-colors',
            activeTab === 'chat' ? 'text-[#e7e9ea] font-bold' : 'text-[#94a3b8]'
          )}
        >
          <div className="flex items-center justify-center gap-2">
            <svg className={cn('w-[18px] h-[18px]', activeTab === 'chat' ? 'text-[#FFFFFF]' : 'text-[#94a3b8]')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={activeTab === 'chat' ? 2.2 : 1.8}>
              <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Chat
          </div>
          {activeTab === 'chat' && (
            <div className="absolute bottom-0 inset-x-8 h-[3px] bg-[#FFFFFF] rounded-full animate-tab-indicator" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('ads')}
          className={cn(
            'flex-1 py-3 text-[15px] font-medium relative transition-colors',
            activeTab === 'ads' ? 'text-[#e7e9ea] font-bold' : 'text-[#94a3b8]'
          )}
        >
          <div className="flex items-center justify-center gap-2">
            <svg className={cn('w-[18px] h-[18px]', activeTab === 'ads' ? 'text-[#f59e0b]' : 'text-[#94a3b8]')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={activeTab === 'ads' ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
              <line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
            Chat Ads
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded-full font-bold',
              activeTab === 'ads'
                ? 'bg-[#f59e0b]/20 text-[#f59e0b]'
                : 'bg-white/[0.06] text-[#64748b]'
            )}>
              NEW
            </span>
          </div>
          {activeTab === 'ads' && (
            <div className="absolute bottom-0 inset-x-8 h-[3px] bg-[#f59e0b] rounded-full animate-tab-indicator" />
          )}
        </button>
      </div>

      {/* Desktop: Both panels side-by-side with active highlight */}
      <div className="flex-1 min-h-0 overflow-hidden hidden md:flex gap-0">
        <div className={cn(
          'w-1/2 border-r border-white/[0.06] min-h-0 transition-all duration-300',
          activeTab === 'chat' ? 'ring-2 ring-inset ring-[#FFFFFF]/30' : 'opacity-60'
        )}>
          <PrivateChatPanel />
        </div>
        <div className={cn(
          'w-1/2 min-h-0 transition-all duration-300',
          activeTab === 'ads' ? 'ring-2 ring-inset ring-[#f59e0b]/30' : 'opacity-60'
        )}>
          <ChatAdsPanel />
        </div>
      </div>
      {/* Mobile: Tab-based single pane */}
      <div className="flex-1 min-h-0 overflow-hidden md:hidden">
        {activeTab === 'chat' ? (
          <PrivateChatPanel />
        ) : (
          <ChatAdsPanel />
        )}
      </div>
    </div>
  )
}
