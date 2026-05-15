'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useAnonChat, type AnonMessage } from '@/stores/anonymousChat'
import { useAppStore } from '@/stores/app'

/* ── ICEBREAKERS ───────────────────────────────────────────────────── */
const ICEBREAKERS = [
  "Ask about their favorite hobby",
  "Start with a fun random question",
  "Share something you've never told anyone",
  "What would you do if you won the lottery?",
  "If you could teleport anywhere right now...",
  "What's the most spontaneous thing you've done?",
]

/* ── GHOST ANIMATION ──────────────────────────────────────────────── */
function GhostIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none">
      <ellipse cx="32" cy="26" rx="18" ry="20" fill="currentColor" opacity="0.9" />
      <path d="M14 40c0 0-4 8 2 16h32c6-8 2-16 2-16l-4 4-4-4-4 4-4-4-4 4-4-4-4 4z" fill="currentColor" opacity="0.9" />
      <circle cx="25" cy="22" r="3" fill="#000" />
      <circle cx="39" cy="22" r="3" fill="#000" />
      <circle cx="26" cy="21" r="1" fill="#fff" />
      <circle cx="40" cy="21" r="1" fill="#fff" />
      <ellipse cx="32" cy="30" rx="2" ry="1.5" fill="#000" opacity="0.5" />
    </svg>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   ANONYMOUS CHAT LOBBY
   ═══════════════════════════════════════════════════════════════════════════ */
function LobbyScreen() {
  const { startMatching, connectToStranger, room, myAlias } = useAnonChat()
  const { navigate } = useAppStore()
  const [started, setStarted] = useState(false)
  const [showIcebreaker, setShowIcebreaker] = useState(false)
  const icebreakerRef = useRef<ReturnType<typeof setTimeout>>()

  const handleStart = useCallback(() => {
    setStarted(true)
    startMatching()

    // Simulate matching — connect after 2-4 seconds
    const delay = 2000 + Math.random() * 2000
    setTimeout(() => {
      const state = useAnonChat.getState()
      if (state.room?.status === 'matching') {
        // Generate a random alias for the stranger
        const prefixes = ['Ghost', 'Shadow', 'Phantom', 'Echo', 'Mist', 'Wisp', 'Drift', 'Blip', 'Void', 'Haze']
        const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
        const num = Math.floor(Math.random() * 99) + 1
        const strangerAlias = `${prefix}_${num}`
        state.connectToStranger(strangerAlias)
      }
    }, delay)
  }, [startMatching, connectToStranger])

  // Once connected, navigate to the room
  useEffect(() => {
    if (room?.status === 'connected') {
      const t = setTimeout(() => navigate('anonymous-room'), 300)
      return () => clearTimeout(t)
    }
  }, [room?.status, navigate])

  // Show icebreaker tip after a few seconds
  useEffect(() => {
    if (started && room?.status === 'matching') {
      icebreakerRef.current = setTimeout(() => setShowIcebreaker(true), 3000)
      return () => clearTimeout(icebreakerRef.current)
    }
    setShowIcebreaker(false)
  }, [started, room?.status])

  return (
    <div className="min-h-[calc(100vh-90px)] flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Background mesh */}
      <div className="absolute inset-0 liquid-bg opacity-60" />

      {/* Animated floating particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full animate-float-particle"
            style={{
              width: `${3 + Math.random() * 5}px`,
              height: `${3 + Math.random() * 5}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              background: `rgba(163, 217, 119, ${0.1 + Math.random() * 0.3})`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${8 + Math.random() * 12}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center text-center">
        {/* Ghost icon */}
        <div className="relative mb-8">
          <GhostIcon
            className={cn(
              'w-24 h-24 text-[#a3d977] transition-all duration-700',
              started ? 'scale-110 opacity-80' : 'scale-100 opacity-100'
            )}
          />
          {/* Pulse ring when matching */}
          {started && (
            <>
              <div className="absolute inset-0 rounded-full animate-ping-ring opacity-30" />
              <div className="absolute inset-4 rounded-full animate-ping-ring opacity-20" style={{ animationDelay: '0.5s' }} />
            </>
          )}
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">
          Anonymous Chat
        </h1>
        <p className="text-[15px] text-[#71767b] mb-2">
          Talk freely. Stay unknown.
        </p>

        {/* Alias display */}
        {myAlias && (
          <div className="mb-6 px-4 py-2 rounded-full bg-white/[0.06] border border-white/[0.1] animate-fade-in">
            <span className="text-[13px] text-[#a3d977] font-mono">Your identity: {myAlias}</span>
          </div>
        )}

        {/* Matching state */}
        {started && room?.status === 'matching' && (
          <div className="flex flex-col items-center gap-3 animate-fade-in">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#a3d977] animate-pulse-soft" />
              <span className="text-[14px] text-[#e8f0dc]">Looking for someone...</span>
            </div>
            <div className="w-48 h-1 rounded-full bg-white/[0.08] overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#a3d977] to-[#2a7fff] rounded-full animate-matching-progress" />
            </div>

            {/* Icebreaker tip */}
            {showIcebreaker && (
              <div className="mt-4 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] max-w-[280px] animate-slide-up">
                <p className="text-[12px] text-[#71767b] mb-1 font-medium">Icebreaker</p>
                <p className="text-[13px] text-[#a3d977]">
                  {ICEBREAKERS[Math.floor(Math.random() * ICEBREAKERS.length)]}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Start button */}
        {!started && (
          <button
            onClick={handleStart}
            className="mt-8 px-8 py-3.5 rounded-full bg-gradient-to-r from-[#a3d977] to-[#8cc65e] text-black font-semibold text-[15px] shadow-lg hover:shadow-xl hover:scale-[1.03] active:scale-[0.97] transition-all duration-200"
          >
            Start Chat
          </button>
        )}

        {/* Features */}
        {!started && (
          <div className="mt-10 grid grid-cols-3 gap-4 w-full max-w-[300px]">
            {[
              { icon: '🔒', label: 'No Identity' },
              { icon: '💬', label: 'Real-time' },
              { icon: '⚡', label: 'Instant Match' },
            ].map((f) => (
              <div key={f.label} className="flex flex-col items-center gap-1.5">
                <span className="text-xl">{f.icon}</span>
                <span className="text-[11px] text-[#71767b]">{f.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   ANONYMOUS CHAT ROOM VIEW
   85% chat area, 15% input area
   ═══════════════════════════════════════════════════════════════════════════ */
function AnonChatRoom() {
  const {
    room, messages, strangerTyping, reconnecting,
    myAlias, myColor,
    sendMessage, skipToStranger, disconnect,
    setStrangerTyping, clearMessages,
  } = useAnonChat()
  const { navigate } = useAppStore()
  const [input, setInput] = useState('')
  const [showReactions, setShowReactions] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [sentReactions, setSentReactions] = useState<Set<string>>(new Set())
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isConnected = room?.status === 'connected'
  const isMatching = room?.status === 'matching'
  const isDisconnected = room?.status === 'disconnected' || room?.status === 'ended'

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, strangerTyping])

  // Auto-focus input when connected
  useEffect(() => {
    if (isConnected) inputRef.current?.focus()
  }, [isConnected])

  // Navigate back to lobby if no room
  useEffect(() => {
    if (!room) navigate('anonymous-chat')
  }, [room, navigate])

  const handleSend = useCallback(() => {
    if (!input.trim() || !isConnected) return
    sendMessage(input)
    setInput('')
  }, [input, isConnected, sendMessage])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const handleReaction = useCallback((emoji: string) => {
    if (!room) return
    const { addMessage } = useAnonChat.getState()
    addMessage({
      id: `react_${Date.now()}`,
      roomId: room.id,
      senderAlias: myAlias,
      content: emoji,
      isMine: true,
      timestamp: Date.now(),
      type: 'reaction',
    })
    setSentReactions((prev) => new Set(prev).add(emoji))
    setShowReactions(false)

    // Simulate stranger reaction back sometimes
    if (Math.random() > 0.4) {
      setTimeout(() => {
        const emojis = ['🔥', '😂', '💀', '❤️', '👏']
        const r = emojis[Math.floor(Math.random() * emojis.length)]
        addMessage({
          id: `react_${Date.now()}`,
          roomId: room.id,
          senderAlias: room.strangerAlias || 'Stranger',
          content: r,
          isMine: false,
          timestamp: Date.now(),
          type: 'reaction',
        })
      }, 800 + Math.random() * 1500)
    }
  }, [room, myAlias])

  const handleNewChat = useCallback(() => {
    const { startMatching, connectToStranger } = useAnonChat.getState()
    clearMessages()
    startMatching()
    setTimeout(() => {
      const state = useAnonChat.getState()
      if (state.room?.status === 'matching') {
        const prefixes = ['Ghost', 'Shadow', 'Phantom', 'Echo', 'Mist', 'Wisp', 'Drift', 'Blip', 'Void', 'Haze']
        const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
        const num = Math.floor(Math.random() * 99) + 1
        state.connectToStranger(`${prefix}_${num}`)
      }
    }, 1500 + Math.random() * 2000)
  }, [clearMessages])

  const handleBack = useCallback(() => {
    disconnect()
    navigate('anonymous-chat')
  }, [disconnect, navigate])

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const reactions = ['🔥', '😂', '💀', '❤️', '👏', '😮']

  if (!room) return null

  return (
    <div className="fixed inset-0 z-40 bg-black flex flex-col animate-fade-in">
      {/* ─── Top Bar ─── */}
      <div className="shrink-0 h-[56px] flex items-center justify-between px-3 bg-black/80 backdrop-blur-xl border-b border-white/[0.06] relative liquid-refract-bottom z-10">
        <div className="flex items-center gap-2">
          <button onClick={handleBack} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/[0.08] transition-colors">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            {/* Ghost icon */}
            <div className="w-8 h-8 rounded-full bg-white/[0.08] flex items-center justify-center">
              <GhostIcon className="w-5 h-5 text-[#a3d977]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[14px] font-semibold text-white">
                  {isConnected ? room.strangerAlias : isMatching ? 'Searching...' : 'Disconnected'}
                </span>
                {isConnected && (
                  <div className="w-2 h-2 rounded-full bg-[#a3d977] animate-pulse-soft" />
                )}
              </div>
              <span className="text-[11px] text-[#71767b]">
                {isConnected ? 'Online' : isMatching ? 'Looking for someone' : 'Stranger left'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Report */}
          <button
            onClick={() => setShowReport(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/[0.08] transition-colors"
          >
            <svg className="w-[18px] h-[18px] text-[#71767b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
              <line x1="4" y1="22" x2="4" y2="15" />
            </svg>
          </button>
          {/* Skip / New Chat */}
          <button
            onClick={isConnected ? skipToStranger : handleNewChat}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/[0.08] transition-colors"
          >
            <svg className="w-[18px] h-[18px] text-[#71767b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 4v6h6" />
              <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
            </svg>
          </button>
        </div>
      </div>

      {/* ─── Chat Area (85%) ─── */}
      <div className="flex-[85] min-h-0 overflow-y-auto px-4 py-3 space-y-3 no-scrollbar">
        {/* Matching state */}
        {isMatching && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <GhostIcon className="w-16 h-16 text-[#a3d977] animate-pulse-soft" />
            <div className="flex items-center gap-2">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
            <p className="text-[14px] text-[#71767b]">Searching for a stranger...</p>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg) => {
          if (msg.type === 'system') {
            return (
              <div key={msg.id} className="flex justify-center py-1">
                <span className="text-[12px] text-[#71767b] bg-white/[0.04] px-3 py-1 rounded-full">
                  {msg.content}
                </span>
              </div>
            )
          }

          if (msg.type === 'reaction') {
            return (
              <div key={msg.id} className={cn('flex', msg.isMine ? 'justify-end' : 'justify-start')}>
                <div className="px-3 py-1.5 rounded-2xl bg-white/[0.04] text-[28px] animate-scale-in">
                  {msg.content}
                </div>
              </div>
            )
          }

          return (
            <div key={msg.id} className={cn('flex flex-col', msg.isMine ? 'items-end' : 'items-start')}>
              {/* Alias label */}
              <span className={cn(
                'text-[11px] mb-1 ml-1 font-mono',
                msg.isMine ? 'text-[#a3d977]' : 'text-[#71767b]'
              )}>
                {msg.isMine ? myAlias : msg.senderAlias}
              </span>
              {/* Bubble */}
              <div
                className={cn(
                  'max-w-[80%] px-4 py-2.5 text-[14px] leading-relaxed animate-slide-up',
                  msg.isMine
                    ? 'bg-gradient-to-br from-[#a3d977] to-[#8cc65e] text-black rounded-2xl rounded-br-md'
                    : 'bg-white/[0.06] text-white rounded-2xl rounded-bl-md border border-white/[0.06]'
                )}
              >
                {msg.content}
              </div>
              {/* Timestamp */}
              <span className="text-[10px] text-[#536471] mt-0.5 ml-1">
                {formatTime(msg.timestamp)}
              </span>
            </div>
          )
        })}

        {/* Typing indicator */}
        {strangerTyping && isConnected && (
          <div className="flex items-start animate-fade-in">
            <span className="text-[11px] text-[#71767b] font-mono ml-1 mb-1">
              {room.strangerAlias}
            </span>
            <div className="bg-white/[0.06] border border-white/[0.06] rounded-2xl rounded-bl-md px-4 py-3 ml-2">
              <div className="flex items-center gap-1">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            </div>
          </div>
        )}

        {/* Disconnected state */}
        {isDisconnected && (
          <div className="flex flex-col items-center gap-4 pt-8 animate-fade-in">
            <GhostIcon className="w-14 h-14 text-[#536471]" />
            <p className="text-[14px] text-[#71767b] text-center">
              Stranger has disconnected
            </p>
            <button
              onClick={handleNewChat}
              className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#a3d977] to-[#8cc65e] text-black font-semibold text-[14px] shadow-lg hover:shadow-xl hover:scale-[1.03] active:scale-[0.97] transition-all duration-200"
            >
              Find New Stranger
            </button>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* ─── Reconnecting banner ─── */}
      {reconnecting && (
        <div className="shrink-0 px-4 py-2 bg-[#f59e0b]/10 border-t border-[#f59e0b]/20 flex items-center justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#f59e0b] animate-pulse-soft" />
          <span className="text-[12px] text-[#f59e0b]">Reconnecting...</span>
        </div>
      )}

      {/* ─── Reaction picker ─── */}
      {showReactions && (
        <div className="shrink-0 px-4 py-2 bg-black/90 backdrop-blur-xl border-t border-white/[0.08] animate-slide-up">
          <div className="flex items-center justify-center gap-3">
            {reactions.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                className="w-11 h-11 rounded-full bg-white/[0.06] flex items-center justify-center text-xl hover:bg-white/[0.12] active:scale-90 transition-all duration-150"
              >
                {emoji}
              </button>
            ))}
            <button
              onClick={() => setShowReactions(false)}
              className="w-11 h-11 rounded-full bg-white/[0.06] flex items-center justify-center hover:bg-white/[0.12] transition-colors"
            >
              <svg className="w-5 h-5 text-[#71767b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ─── Input Area (15%) ─── */}
      <div className="shrink-0 px-3 py-2.5 bg-black/90 backdrop-blur-xl border-t border-white/[0.08] safe-area-bottom relative liquid-refract-top">
        <div className="flex items-center gap-2">
          {/* Emoji / Reaction toggle */}
          <button
            onClick={() => setShowReactions(!showReactions)}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/[0.08] transition-colors shrink-0"
          >
            <span className="text-xl">
              {showReactions ? '🤫' : '🙂'}
            </span>
          </button>

          {/* Text input */}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Say something anonymously..."
            disabled={!isConnected}
            className={cn(
              'flex-1 h-10 rounded-full bg-white/[0.06] border border-white/[0.1] px-4 text-[14px] text-white placeholder:text-[#536471] outline-none transition-all duration-200',
              'focus:border-[#a3d977]/40 focus:bg-white/[0.08]',
              'disabled:opacity-40 disabled:cursor-not-allowed'
            )}
          />

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || !isConnected}
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 shrink-0',
              input.trim() && isConnected
                ? 'bg-gradient-to-br from-[#a3d977] to-[#8cc65e] text-black shadow-md hover:scale-[1.05] active:scale-90'
                : 'bg-white/[0.06] text-[#536471]'
            )}
          >
            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>

      {/* ─── Report Dialog ─── */}
      {showReport && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowReport(false)}>
          <div
            className="w-full max-w-lg bg-[#0a0a0a] border border-white/[0.1] rounded-t-2xl p-5 animate-slide-up safe-area-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />
            <h3 className="text-[16px] font-bold text-white mb-4">Report User</h3>
            <div className="space-y-1">
              {['Inappropriate behavior', 'Spam', 'Harassment', 'Hate speech', 'Other'].map((reason) => (
                <button
                  key={reason}
                  onClick={() => {
                    setShowReport(false)
                    // In production this would send to backend
                  }}
                  className="w-full text-left px-4 py-3 rounded-xl text-[14px] text-white hover:bg-white/[0.06] transition-colors"
                >
                  {reason}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowReport(false)}
              className="w-full mt-3 py-3 rounded-xl text-[14px] text-[#71767b] font-medium hover:bg-white/[0.04] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   EXPORTS — unified entry point
   ═══════════════════════════════════════════════════════════════════════════ */
export function AnonymousChatView() {
  const { room } = useAnonChat()
  // If we have a room, show the room. Otherwise show lobby.
  // This handles the case where user navigates back from room.
  return room?.status === 'connected' || room?.status === 'matching'
    ? <AnonChatRoom />
    : <LobbyScreen />
}

export { AnonChatRoom as AnonymousChatRoomView }
