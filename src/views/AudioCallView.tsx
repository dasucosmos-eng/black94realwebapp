'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app'
import { PAvatar, VerifiedBadge } from '@/components/PAvatar'

/* ── Audio Call View ──────────────────────────────────────────────── */

export function AudioCallView() {
  const navigate = useAppStore((s) => s.navigate)
  const previousView = useAppStore((s) => s.previousView)
  const viewParams = useAppStore((s) => s.viewParams)
  const chatName = viewParams?.chatName || 'Unknown'

  const [callState, setCallState] = useState<'ringing' | 'connected' | 'ended'>('ringing')
  const [isMuted, setIsMuted] = useState(false)
  const [isSpeaker, setIsSpeaker] = useState(false)
  const [showKeypad, setShowKeypad] = useState(false)
  const [duration, setDuration] = useState(0)
  const [keypadInput, setKeypadInput] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined)

  // Wait for real peer connection via WebRTC
  useEffect(() => {
    // Call stays in ringing state until a real connection is established
  }, [])

  // Timer when connected
  useEffect(() => {
    if (callState === 'connected') {
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1)
      }, 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [callState])

  const formatDuration = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }, [])

  const handleEndCall = useCallback(() => {
    setCallState('ended')
    if (timerRef.current) clearInterval(timerRef.current)
    setTimeout(() => {
      // Go back to whichever view the user came from (chat-room or dual-pane-chat)
      navigate(previousView === 'chat-room' ? 'chat' : previousView === 'dual-pane-chat' ? 'dual-pane-chat' : 'chat')
    }, 1500)
  }, [navigate, previousView])

  // Initial letter and color for avatar
  const initial = chatName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="fixed inset-0 z-50 bg-[#000000] flex flex-col animate-fade-in">
      {/* ─── Gradient background ─── */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a1a0a] via-black to-black pointer-events-none" />

      {/* ─── Status bar area (decorative) ─── */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-4 pb-2">
        <button
          onClick={handleEndCall}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/[0.08] transition-colors"
        >
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5M5 12l7-7 7 7"/>
          </svg>
        </button>
        <span className="text-[13px] text-[#94a3b8]">Black94 Call</span>
        <button className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/[0.08] transition-colors">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
          </svg>
        </button>
      </div>

      {/* ─── Center content ─── */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
        {/* Avatar with ripple */}
        <div className="relative mb-6">
          {/* Ripple rings — only when ringing */}
          {callState === 'ringing' && (
            <>
              <div className="absolute inset-[-20px] rounded-full border-2 border-[#FFFFFF]/30 animate-ping-slow" />
              <div className="absolute inset-[-40px] rounded-full border border-[#FFFFFF]/20 animate-ping-slower" />
              <div className="absolute inset-[-60px] rounded-full border border-[#FFFFFF]/10 animate-ping-slowest" />
            </>
          )}

          {/* Connected glow */}
          {callState === 'connected' && (
            <div className="absolute inset-[-16px] rounded-full bg-[#FFFFFF]/10 blur-xl animate-pulse" />
          )}

          {/* Main avatar */}
          <PAvatar
            src={(viewParams as any)?.chatPartnerProfileImage}
            name={chatName}
            size={112}
            verified={(viewParams as any)?.chatPartnerVerified}
            badge={(viewParams as any)?.chatPartnerBadge}
            className={cn(
              'transition-all duration-500',
              callState === 'ringing' && 'animate-pulse-scale'
            )}
          />
        </div>

        {/* Name */}
        <h1 className="text-2xl font-bold text-white mb-1 flex items-center gap-1.5 justify-center">
          {chatName}
          {(viewParams as any)?.chatPartnerVerified && <VerifiedBadge size={18} badge={(viewParams as any)?.chatPartnerBadge} />}
        </h1>

        {/* Status */}
        <div className="flex items-center gap-2 mb-2">
          {callState === 'ringing' && (
            <>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-[#FFFFFF] animate-pulse" />
                <span className="text-[15px] text-[#FFFFFF] font-medium">Calling...</span>
              </div>
            </>
          )}
          {callState === 'connected' && (
            <>
              <div className="w-2 h-2 rounded-full bg-[#10b981]" />
              <span className="text-[15px] text-[#10b981] font-medium">Connected</span>
              <span className="text-[15px] text-[#94a3b8]">·</span>
              <span className="text-[15px] text-[#94a3b8] tabular-nums">{formatDuration(duration)}</span>
            </>
          )}
          {callState === 'ended' && (
            <>
              <span className="text-[15px] text-[#ef4444] font-medium">Call Ended</span>
              <span className="text-[15px] text-[#94a3b8]">·</span>
              <span className="text-[15px] text-[#94a3b8] tabular-nums">{formatDuration(duration)}</span>
            </>
          )}
        </div>

        {/* E2E badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06]">
          <svg className="w-3.5 h-3.5 text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <span className="text-[11px] text-[#FFFFFF] font-semibold tracking-wide">E2E ENCRYPTED</span>
        </div>
      </div>

      {/* ─── Keypad (if shown) ─── */}
      {showKeypad && (
        <div className="relative z-10 px-8 pb-6 animate-fade-in">
          {/* Display */}
          <div className="text-center mb-4">
            <span className="text-[24px] text-white font-mono tabular-nums tracking-wider">
              {keypadInput || '·'.repeat(0)}
            </span>
          </div>
          {/* Grid */}
          <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
            {['1','2','3','4','5','6','7','8','9','*','0','#'].map((key) => (
              <button
                key={key}
                onClick={() => setKeypadInput((p) => p + key)}
                className="w-[72px] h-[72px] rounded-full bg-white/[0.06] border border-white/[0.08] flex flex-col items-center justify-center hover:bg-white/[0.1] active:scale-95 transition-all"
              >
                <span className="text-[22px] text-white font-medium">{key}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Call Actions ─── */}
      <div className="relative z-10 shrink-0 pb-10 pt-4 safe-area-bottom">
        {/* Secondary actions */}
        <div className={cn(
          'flex items-center justify-center gap-8 mb-8 transition-all duration-300',
          showKeypad && 'opacity-0 pointer-events-none'
        )}>
          {/* Mute */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="flex flex-col items-center gap-2"
          >
            <div className={cn(
              'w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200',
              isMuted
                ? 'bg-[#FFFFFF] text-black'
                : 'bg-white/[0.08] text-white hover:bg-white/[0.12]'
            )}>
              {isMuted ? (
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                  <path d="M19 10v2a7 7 0 01-14 0v-2"/>
                  <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                  <path d="M19 10v2a7 7 0 01-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                </svg>
              )}
            </div>
            <span className={cn('text-[11px]', isMuted ? 'text-[#FFFFFF] font-semibold' : 'text-[#94a3b8]')}>
              {isMuted ? 'Unmute' : 'Mute'}
            </span>
          </button>

          {/* Speaker */}
          <button
            onClick={() => setIsSpeaker(!isSpeaker)}
            className="flex flex-col items-center gap-2"
          >
            <div className={cn(
              'w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200',
              isSpeaker
                ? 'bg-[#FFFFFF] text-black'
                : 'bg-white/[0.08] text-white hover:bg-white/[0.12]'
            )}>
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                {isSpeaker ? (
                  <>
                    <path d="M15.54 8.46a5 5 0 010 7.07"/>
                    <path d="M19.07 4.93a10 10 0 010 14.14"/>
                  </>
                ) : (
                  <path d="M15.54 8.46a5 5 0 010 7.07"/>
                )}
              </svg>
            </div>
            <span className={cn('text-[11px]', isSpeaker ? 'text-[#FFFFFF] font-semibold' : 'text-[#94a3b8]')}>
              {isSpeaker ? 'Speaker On' : 'Speaker'}
            </span>
          </button>

          {/* Keypad */}
          <button
            onClick={() => { setShowKeypad(!showKeypad); setKeypadInput('') }}
            className="flex flex-col items-center gap-2"
          >
            <div className={cn(
              'w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200',
              showKeypad
                ? 'bg-[#FFFFFF] text-black'
                : 'bg-white/[0.08] text-white hover:bg-white/[0.12]'
            )}>
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="9" y1="3" x2="9" y2="21"/>
                <line x1="15" y1="3" x2="15" y2="21"/>
                <line x1="3" y1="9" x2="21" y2="9"/>
                <line x1="3" y1="15" x2="21" y2="15"/>
              </svg>
            </div>
            <span className={cn('text-[11px]', showKeypad ? 'text-[#FFFFFF] font-semibold' : 'text-[#94a3b8]')}>
              Keypad
            </span>
          </button>
        </div>

        {/* End Call */}
        <div className="flex justify-center">
          <button
            onClick={handleEndCall}
            className={cn(
              'w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg',
              callState === 'ended'
                ? 'bg-[#64748b] text-white'
                : 'bg-[#ef4444] text-white hover:bg-[#dc2626] active:scale-90 shadow-[#ef4444]/30'
            )}
          >
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7 2 2 0 011.72 2v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 002.59 3.4z"/>
            </svg>
          </button>
        </div>
        <div className="flex justify-center mt-2">
          <span className={cn(
            'text-[12px] font-medium transition-colors',
            callState === 'ended' ? 'text-[#94a3b8]' : 'text-[#ef4444]'
          )}>
            {callState === 'ended' ? 'Returning to chat...' : 'End Call'}
          </span>
        </div>
      </div>
    </div>
  )
}
