'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  type StoryGroup, type StoryCard, type PollOption, type CricketMatch,
  type ReactionType, getLanguage, formatCount, getReactionLabel
} from '@/lib/story-data'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StoryViewerProps {
  groups: StoryGroup[]
  initialGroupIndex: number
  onClose: () => void
  onNavigateCreator: (creatorId: string) => void
}

interface FloatingReaction {
  id: string
  emoji: string
  x: number
  y: number
}

interface HeartAnimation {
  id: string
  x: number
  y: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORY_DURATION_MS = 6000
const VOICE_TICK_MS = 100
const LONG_PRESS_MS = 500

const POLL_COLORS = ['#FFFFFF', '#3b82f6', '#06b6d4', '#f59e0b']

const EXTENDED_REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: 'fire', emoji: '🔥', label: 'Fire' },
  { type: 'mindblown', emoji: '🤯', label: 'Mind-blown' },
  { type: 'agree', emoji: '😢', label: 'Crying' },
  { type: 'clapping', emoji: '👏', label: 'Clapping' },
]

// ---------------------------------------------------------------------------
// Helper: format seconds → mm:ss
// ---------------------------------------------------------------------------

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function VerifiedBadge() {
  return (
    <svg className="w-4 h-4 text-blue-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
      <path d="M22.5 12.5l-1.58-1.25c.07-.41.08-.83.08-1.25s-.01-.84-.08-1.25l1.58-1.25c.36-.28.45-.79.22-1.18l-1.5-2.6c-.23-.39-.73-.55-1.14-.35l-1.8.8c-.66-.5-1.38-.91-2.17-1.21L15.75 1.8c-.06-.44-.44-.8-.9-.8h-3c-.46 0-.84.36-.9.8l-.34 1.81c-.79.3-1.51.71-2.17 1.21l-1.8-.8c-.41-.2-.91-.04-1.14.35l-1.5 2.6c-.23.39-.14.9.22 1.18l1.58 1.25c-.07.41-.08.83-.08 1.25s.01.84.08 1.25l-1.58 1.25c-.36.28-.45.79-.22 1.18l1.5 2.6c.23.39.73.55 1.14.35l1.8-.8c.66.5 1.38.91 2.17 1.21l.34 1.81c.06.44.44.8.9.8h3c.46 0 .84-.36.9-.8l.34-1.81c.79-.3 1.51-.71 2.17-1.21l1.8.8c.41.2.91.04 1.14-.35l1.5-2.6c.23-.39.14-.9-.22-1.18zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5S10.07 8.5 12 8.5s3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Progress Bars
// ---------------------------------------------------------------------------

function ProgressBars({
  total,
  currentIndex,
  progress,
  isPaused,
}: {
  total: number
  currentIndex: number
  progress: number // 0-100
  isPaused: boolean
}) {
  return (
    <div className="absolute top-0 left-0 right-0 z-30 flex gap-1 px-2 pt-2">
      {Array.from({ length: total }).map((_, i) => {
        const isCompleted = i < currentIndex
        const isCurrent = i === currentIndex

        let width = 0
        if (isCompleted) width = 100
        else if (isCurrent) width = isPaused ? progress : progress

        return (
          <div
            key={i}
            className="flex-1 h-[2.5px] rounded-full bg-white/20 overflow-hidden"
          >
            <motion.div
              className="h-full rounded-full bg-white"
              initial={false}
              animate={{ width: `${width}%` }}
              transition={isCurrent && !isPaused ? { duration: 0.1, ease: 'linear' } : { duration: 0.3 }}
              style={{ opacity: isCurrent && isPaused ? 0.5 : 1 }}
            />
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Story Content Renderers
// ---------------------------------------------------------------------------

function TextStory({ card }: { card: StoryCard }) {
  const bg = card.mediaUrl?.startsWith('linear-gradient') ? card.mediaUrl : 'linear-gradient(135deg, #7B1FA2 0%, #1565C0 100%)'

  return (
    <motion.div
      key={card.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 flex items-center justify-center p-8"
      style={{ background: bg }}
    >
      <p
        className="text-white text-xl sm:text-2xl md:text-3xl font-bold text-center leading-relaxed"
        style={{ textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}
      >
        {card.content}
      </p>
    </motion.div>
  )
}

function VoiceStory({ card, isPaused }: { card: StoryCard; isPaused: boolean }) {
  const waveform = card.voiceWaveform ?? Array.from({ length: 20 }, () => Math.random() * 80 + 20)
  const duration = card.voiceDuration ?? 45
  const [elapsed, setElapsed] = useState(0)
  const progress = duration > 0 ? (elapsed / duration) * 100 : 0

  useEffect(() => {
    if (isPaused) return
    const interval = setInterval(() => {
      setElapsed((p) => {
        if (p >= duration) return duration
        return p + 0.1
      })
    }, VOICE_TICK_MS)
    return () => clearInterval(interval)
  }, [isPaused, duration])

  // Animated captions: show a portion of content based on elapsed time
  const sentences = card.content.split(/[.!?]+/).filter(Boolean)
  const sentenceIdx = Math.min(Math.floor((elapsed / duration) * sentences.length), sentences.length - 1)
  const currentCaption = sentences[sentenceIdx]?.trim() ?? ''

  return (
    <motion.div
      key={card.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 flex flex-col items-center justify-between py-20 px-6"
      style={{ background: 'linear-gradient(180deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)' }}
    >
      {/* Caption area */}
      <div className="flex-1 flex items-center justify-center w-full max-w-md">
        <AnimatePresence mode="wait">
          <motion.p
            key={sentenceIdx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="text-white/90 text-lg sm:text-xl text-center leading-relaxed"
          >
            {currentCaption}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Waveform */}
      <div className="w-full max-w-sm mb-6">
        <div className="flex items-end justify-center gap-[3px] h-16">
          {waveform.map((h, i) => {
            const barProgress = i / waveform.length
            const isActive = barProgress <= progress / 100
            const clampedH = Math.max(8, h)
            return (
              <motion.div
                key={i}
                className={cn(
                  'w-[3px] sm:w-1.5 rounded-full transition-colors duration-200',
                  isActive ? 'bg-white' : 'bg-white/20'
                )}
                animate={{
                  height: isPaused ? clampedH * 0.4 : clampedH * (isActive ? 1 : 0.6) + (isActive ? Math.sin(Date.now() / 200 + i) * 4 : 0),
                }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
              />
            )
          })}
        </div>

        {/* Playback position indicator */}
        <div className="relative w-full h-1 bg-white/10 rounded-full mt-3 overflow-hidden">
          <motion.div
            className="absolute left-0 top-0 h-full bg-white/60 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Duration */}
        <div className="flex items-center justify-between mt-2 text-white/40 text-xs font-mono">
          <span>{formatTime(elapsed)}</span>
          <span>{formatTime(duration)}</span>
        </div>

        {/* Play / Pause button */}
        <div className="flex justify-center mt-4">
          <button className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
            {isPaused ? (
              <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

function PollStory({ card }: { card: StoryCard }) {
  const options = card.pollOptions ?? []
  const [votes, setVotes] = useState(options.map((o) => ({ ...o })))
  const [userVoted, setUserVoted] = useState<string | null>(null)
  const [animKey, setAnimKey] = useState(0)
  const totalVotes = useMemo(() => votes.reduce((s, v) => s + v.votes, 0), [votes])

  const handleVote = (id: string) => {
    if (userVoted) return
    setUserVoted(id)
    setVotes((prev) =>
      prev.map((v) => (v.id === id ? { ...v, votes: v.votes + 1 } : v))
    )
    setAnimKey((k) => k + 1)
  }

  const getPercentage = (v: PollOption) => {
    const total = votes.reduce((s, o) => s + o.votes, 0)
    return total > 0 ? Math.round((v.votes / total) * 100) : 0
  }

  return (
    <motion.div
      key={card.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-black"
    >
      <p
        className="text-white text-lg sm:text-xl font-bold text-center mb-8 px-4 leading-snug"
        style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}
      >
        {card.content}
      </p>

      <div className="w-full max-w-sm space-y-3">
        {votes.map((opt, i) => {
          const pct = getPercentage(opt)
          const isVoted = userVoted === opt.id
          return (
            <motion.button
              key={`${animKey}-${opt.id}`}
              onClick={() => handleVote(opt.id)}
              className={cn(
                'relative w-full text-left rounded-xl overflow-hidden transition-all',
                isVoted ? 'ring-2 ring-white/40' : 'hover:ring-1 hover:ring-white/20',
              )}
              whileTap={{ scale: 0.97 }}
            >
              {/* Background bar */}
              <motion.div
                className="absolute inset-0 rounded-xl"
                initial={{ width: '0%' }}
                animate={{ width: `${pct}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                style={{ background: `${POLL_COLORS[i % POLL_COLORS[i].length]}40` }}
              />
              {/* Colored left bar */}
              <motion.div
                className="absolute left-0 top-0 bottom-0 rounded-xl"
                initial={{ width: '0%' }}
                animate={{ width: `${pct}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                style={{ background: POLL_COLORS[i % POLL_COLORS.length], opacity: 0.35 }}
              />
              {/* Text */}
              <div className="relative flex items-center justify-between p-3 px-4">
                <span className="text-white text-sm font-medium truncate mr-3">{opt.text}</span>
                <span className="text-white/70 text-xs font-semibold shrink-0">{pct}%</span>
              </div>
              {/* Vote count at end */}
              <div className="absolute right-3 bottom-1">
                <span className="text-white/30 text-[10px]">{formatCount(opt.votes)} votes</span>
              </div>
            </motion.button>
          )
        })}
      </div>

      <p className="text-white/30 text-xs mt-6">{formatCount(totalVotes)} total votes</p>
    </motion.div>
  )
}

function ThreadStory({ card, group }: { card: StoryCard; group: StoryGroup }) {
  // Parse thread index from content like "1/5 — "
  const threadMatch = card.content.match(/^(\d+)\/(\d+)/)
  const current = threadMatch ? parseInt(threadMatch[1], 10) : 1
  const total = threadMatch ? parseInt(threadMatch[2], 10) : group.stories.length

  // Count how many thread stories before this one in the group
  const threadCards = group.stories.filter((s) => s.format === 'thread')
  const threadIdx = threadCards.findIndex((s) => s.id === card.id)
  const totalThreadCards = threadCards.length

  return (
    <motion.div
      key={card.id}
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -40 }}
      transition={{ type: 'spring', stiffness: 200, damping: 25 }}
      className="absolute inset-0 flex flex-col items-center justify-center p-6"
      style={{ background: 'linear-gradient(180deg, #111 0%, #1a1a1a 100%)' }}
    >
      {/* Counter */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2">
        <span className="text-white/40 text-xs font-mono bg-white/5 px-3 py-1 rounded-full">
          {threadIdx + 1}/{totalThreadCards}
        </span>
      </div>

      {/* Thread card */}
      <div className="w-full max-w-sm">
        <motion.div
          className="bg-white/[0.06] backdrop-blur-sm rounded-2xl p-5 border border-white/[0.08]"
          style={{
            background: 'linear-gradient(145deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)',
          }}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 150, damping: 20, delay: 0.05 }}
        >
          {/* Author */}
          <div className="flex items-center gap-2.5 mb-4">
            <img
              src={group.creatorAvatar}
              alt={group.creatorName}
              className="w-8 h-8 rounded-full"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-white text-sm font-semibold truncate">{group.creatorName}</span>
                {group.creatorVerified && <VerifiedBadge />}
              </div>
              <span className="text-white/40 text-xs">@{group.creatorHandle}</span>
            </div>
            <span className="text-white/20 text-xs">Thread</span>
          </div>

          {/* Thread number badge */}
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-white/10 text-white/60 text-[10px] font-bold px-2 py-0.5 rounded-full">
              #{current}
            </span>
          </div>

          {/* Content */}
          <p className="text-white/85 text-sm sm:text-[15px] leading-relaxed">
            {card.content.replace(/^\d+\/\d+\s*[—–]\s*/, '')}
          </p>
        </motion.div>

        {/* Swipe hint */}
        <div className="flex justify-center mt-4">
          <motion.div
            animate={{ y: [0, 4, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="text-white/20"
          >
            <svg className="w-5 h-5 rotate-180" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}

function CricketStory({ card }: { card: StoryCard }) {
  const data = card.cricketData
  const [liveScore, setLiveScore] = useState(data)

  if (!liveScore) return null

  return (
    <motion.div
      key={card.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-black"
    >
      {/* Score card overlay at top */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="w-full max-w-sm bg-white/[0.08] backdrop-blur-md rounded-2xl border border-white/[0.1] overflow-hidden mb-6"
      >
        {/* Live badge */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span className="text-red-400 text-xs font-bold tracking-wider">LIVE</span>
          </div>
          <span className="text-white/30 text-xs">{liveScore.venue}</span>
        </div>

        {/* Teams & scores */}
        <div className="px-4 pb-4 space-y-3">
          {/* Team 1 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{liveScore.team1 === 'IND' ? '🇮🇳' : liveScore.team1 === 'AUS' ? '🇦🇺' : '🏏'}</span>
              <span className="text-white font-bold text-sm">{liveScore.team1}</span>
            </div>
            <span className="text-white font-mono font-bold text-lg">{liveScore.team1Score}</span>
          </div>
          {/* Team 2 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{liveScore.team2 === 'IND' ? '🇮🇳' : liveScore.team2 === 'AUS' ? '🇦🇺' : '🏏'}</span>
              <span className="text-white font-bold text-sm">{liveScore.team2}</span>
            </div>
            <span className="text-white font-mono font-bold text-lg">{liveScore.team2Score}</span>
          </div>
          {/* Overs */}
          <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
            <span className="text-white/40 text-xs">Overs</span>
            <span className="text-white/70 text-sm font-mono">{liveScore.overs} ov</span>
          </div>
        </div>
      </motion.div>

      {/* Creator take */}
      <p
        className="text-white/70 text-sm sm:text-base text-center max-w-sm leading-relaxed px-2"
        style={{ textShadow: '0 1px 6px rgba(0,0,0,0.5)' }}
      >
        {card.content}
      </p>
    </motion.div>
  )
}

function FestivalStory({ card }: { card: StoryCard }) {
  const template = card.festivalTemplate

  return (
    <motion.div
      key={card.id}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.4 }}
      className="absolute inset-0 flex flex-col items-center justify-center p-8"
      style={{ background: template?.gradient ?? 'linear-gradient(135deg, #FF6F00 0%, #FFD54F 100%)' }}
    >
      {/* Emoji */}
      <motion.div
        animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
        transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
        className="text-7xl sm:text-8xl mb-6 drop-shadow-lg"
      >
        {template?.emoji ?? '🎉'}
      </motion.div>

      {/* Text */}
      <p
        className="text-center text-lg sm:text-xl font-bold leading-relaxed"
        style={{
          color: template?.textColor ?? '#FFFFFF',
          textShadow: '0 2px 12px rgba(0,0,0,0.3)',
        }}
      >
        {card.content}
      </p>
    </motion.div>
  )
}

function FeedStory({ card, group }: { card: StoryCard; group: StoryGroup }) {
  return (
    <motion.div
      key={card.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 flex items-center justify-center p-6 bg-black"
    >
      <div className="w-full max-w-sm">
        {/* Embedded post card */}
        <motion.div
          className="bg-white/[0.06] backdrop-blur-sm rounded-2xl overflow-hidden border border-white/[0.08]"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 150, damping: 20 }}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 p-4 pb-3">
            <img
              src={group.creatorAvatar}
              alt={group.creatorName}
              className="w-9 h-9 rounded-full"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-white text-sm font-semibold truncate">{group.creatorName}</span>
                {group.creatorVerified && <VerifiedBadge />}
              </div>
              <span className="text-white/40 text-xs">@{group.creatorHandle}</span>
            </div>
          </div>

          {/* Content */}
          <div className="px-4 pb-4">
            <p className="text-white/85 text-sm leading-relaxed">{card.content}</p>
          </div>

          {/* Shared attribution */}
          <div className="px-4 pb-4">
            <div className="flex items-center gap-1.5 text-white/25 text-xs">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span>Shared from @{group.creatorHandle}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Creator Profile Overlay
// ---------------------------------------------------------------------------

function CreatorProfileOverlay({
  group,
  onClose,
}: {
  group: StoryGroup
  onClose: () => void
}) {
  const [isFollowing, setIsFollowing] = useState(false)
  const lang = getLanguage(group.creatorLanguages[0])
  const totalReactions = Object.values(group.reactions).reduce((s, v) => s + v, 0)

  return (
    <motion.div
      className="absolute inset-0 z-40"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Card */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-[#1a1a1a] border-t border-white/10 overflow-hidden"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <div className="px-6 pb-8 pt-2">
          {/* Avatar row */}
          <div className="flex flex-col items-center mb-5">
            <div className="relative mb-3">
              <div className="w-20 h-20 rounded-full p-[2px]" style={{ background: 'linear-gradient(135deg, #FFFFFF, #06b6d4)' }}>
                <img
                  src={group.creatorAvatar}
                  alt={group.creatorName}
                  className="w-full h-full rounded-full object-cover border-2 border-[#1a1a1a]"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-white font-bold text-lg">{group.creatorName}</span>
              {group.creatorVerified && <VerifiedBadge />}
            </div>
            <span className="text-white/40 text-sm mb-2">@{group.creatorHandle}</span>

            {/* Follow */}
            <button
              onClick={() => setIsFollowing((p) => !p)}
              className={cn(
                'px-6 py-2 rounded-full text-sm font-semibold transition-all duration-200',
                isFollowing
                  ? 'bg-white/10 text-white/60 border border-white/10 hover:bg-white/15'
                  : 'bg-white text-black hover:bg-white/90',
              )}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          </div>

          {/* Bio */}
          <p className="text-white/50 text-sm text-center mb-5">
            Content creator • {lang.flag} {lang.nativeLabel} speaker • {formatCount(totalReactions)} reactions
          </p>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Stories', value: group.stories.length.toString() },
              { label: 'Views', value: formatCount(group.viewCount) },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/[0.05] rounded-xl py-3 text-center">
                <div className="text-white font-bold text-base">{stat.value}</div>
                <div className="text-white/30 text-xs mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Share Sheet
// ---------------------------------------------------------------------------

function ShareSheet({
  onClose,
}: {
  onClose: () => void
}) {
  return (
    <motion.div
      className="absolute inset-0 z-40"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-[#1a1a1a] border-t border-white/10"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        <div className="px-6 pb-8 pt-3">
          <h3 className="text-white font-bold text-base mb-5 text-center">Share Story</h3>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <ShareOption
              icon="🟢"
              label="Status"
              message="Shared successfully!"
              onClose={onClose}
            />
            <ShareOption
              icon="🔗"
              label="Copy Link"
              message="Link copied!"
              onClose={onClose}
            />
            <ShareOption
              icon="↗️"
              label="Share"
              message="Opening share..."
              onClose={onClose}
            />
            <ShareOption
              icon="📱"
              label="Photos"
              message="Opening Photos..."
              onClose={onClose}
            />
          </div>
          <div className="space-y-2">
            {['More'].map((platform) => (
              <button
                key={platform}
                onClick={onClose}
                className="w-full text-left text-white/60 text-sm py-3 px-4 rounded-xl hover:bg-white/5 transition-colors"
              >
                {platform}
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

function ShareOption({
  icon,
  label,
  message,
  onClose,
}: {
  icon: string
  label: string
  message: string
  onClose: () => void
}) {
  const handleShare = async () => {
    if (label === 'Copy Link') {
      try {
        await navigator.clipboard.writeText(window.location.href)
      } catch {
        // fallback: noop
      }
    }
    // We use a simple event-based toast: dispatch a custom event
    window.dispatchEvent(new CustomEvent('story-toast', { detail: message }))
    onClose()
  }

  return (
    <button
      onClick={handleShare}
      className="flex flex-col items-center gap-2 group"
    >
      <div className="w-12 h-12 rounded-full bg-white/[0.08] flex items-center justify-center text-xl group-hover:bg-white/15 transition-colors">
        {icon}
      </div>
      <span className="text-white/50 text-[11px] text-center leading-tight">{label}</span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Extended Reactions Picker
// ---------------------------------------------------------------------------

function ReactionsPicker({
  onSelect,
  onClose,
}: {
  onSelect: (emoji: string, type: ReactionType) => void
  onClose: () => void
}) {
  const moreReactions = [
    { type: 'fire' as ReactionType, emoji: '🔥', label: 'Fire' },
    { type: 'mindblown' as ReactionType, emoji: '🤯', label: 'Mind-blown' },
    { type: 'agree' as ReactionType, emoji: '😢', label: 'Crying' },
    { type: 'clapping' as ReactionType, emoji: '👏', label: 'Clapping' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="absolute bottom-full right-0 mb-3 bg-[#1a1a1a] border border-white/10 rounded-2xl p-2 flex gap-1 shadow-xl shadow-black/40"
    >
      {moreReactions.map((r) => (
        <motion.button
          key={r.type}
          onClick={() => {
            onSelect(r.emoji, r.type)
            onClose()
          }}
          className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-lg transition-colors"
          whileHover={{ scale: 1.2 }}
          whileTap={{ scale: 0.9 }}
        >
          {r.emoji}
        </motion.button>
      ))}
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// MAIN COMPONENT: StoryViewer
// ---------------------------------------------------------------------------

export default function StoryViewer({ groups, initialGroupIndex, onClose, onNavigateCreator }: StoryViewerProps) {
  // ---- State ----
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex)
  const [storyIndex, setStoryIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const [showPauseIcon, setShowPauseIcon] = useState(false)
  const [heartAnimations, setHeartAnimations] = useState<HeartAnimation[]>([])
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([])
  const [showProfile, setShowProfile] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [showReactionsPicker, setShowReactionsPicker] = useState(false)
  const [replyText, setReplyText] = useState('')

  const lastTapRef = useRef<number>(0)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(Date.now())
  const pausedProgressRef = useRef<number>(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // ---- Derived ----
  const currentGroup = groups[groupIndex]
  const currentStory = currentGroup?.stories[storyIndex]
  const lang = currentGroup ? getLanguage(currentGroup.creatorLanguages[0]) : null

  // ---- Toast listener ----
  useEffect(() => {
    const handler = (e: Event) => {
      const msg = (e as CustomEvent<string>).detail
      window.dispatchEvent(new CustomEvent('sonner-toast', { detail: msg }))
    }
    window.addEventListener('story-toast', handler)
    return () => window.removeEventListener('story-toast', handler)
  }, [])

  // ---- Progress timer ----
  const storyDuration = useMemo(() => {
    if (currentStory?.format === 'voice') {
      return (currentStory.voiceDuration ?? 45) * 1000
    }
    return STORY_DURATION_MS
  }, [currentStory])

  const startTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    startTimeRef.current = Date.now()
    const startP = pausedProgressRef.current

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current
      const total = storyDuration
      const pct = Math.min(((startP / 100) * total + elapsed) / total * 100, 100)
      setProgress(pct)

      if (pct >= 100) {
        if (intervalRef.current) clearInterval(intervalRef.current)
        // Auto-advance
        if (storyIndex < (currentGroup?.stories.length ?? 0) - 1) {
          pausedProgressRef.current = 0
          setStoryIndex((i) => i + 1)
        } else if (groupIndex < groups.length - 1) {
          pausedProgressRef.current = 0
          setGroupIndex((i) => i + 1)
          setStoryIndex(0)
        } else {
          // Last story of last group → auto-close
          onClose()
        }
      }
    }, 16)
  }, [storyDuration, storyIndex, groupIndex, groups.length, currentGroup, onClose])

  const pauseTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    pausedProgressRef.current = progress
  }, [progress])

  // Reset on story/group change
  useEffect(() => {
    setProgress(0)
    pausedProgressRef.current = 0
    setIsPaused(false)
    setShowPauseIcon(false)

    if (!showProfile && !showShare) {
      startTimer()
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [groupIndex, storyIndex, startTimer])

  // Pause when profile or share is open
  useEffect(() => {
    if (showProfile || showShare) {
      pauseTimer()
      setIsPaused(true)
    }
  }, [showProfile, showShare, pauseTimer])

  // ---- Heart animations cleanup ----
  useEffect(() => {
    if (heartAnimations.length > 0) {
      const timer = setTimeout(() => {
        setHeartAnimations([])
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [heartAnimations])

  // ---- Floating reactions cleanup ----
  useEffect(() => {
    if (floatingReactions.length > 0) {
      const timer = setTimeout(() => {
        setFloatingReactions([])
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [floatingReactions])

  // ---- Navigation ----
  const goNext = useCallback(() => {
    pausedProgressRef.current = 0
    if (storyIndex < (currentGroup?.stories.length ?? 0) - 1) {
      setStoryIndex((i) => i + 1)
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex((i) => i + 1)
      setStoryIndex(0)
    } else {
      onClose()
    }
  }, [storyIndex, groupIndex, groups.length, currentGroup, onClose])

  const goPrev = useCallback(() => {
    if (storyIndex > 0) {
      pausedProgressRef.current = 0
      setStoryIndex((i) => i - 1)
    } else if (groupIndex > 0) {
      const prevGroup = groups[groupIndex - 1]
      setGroupIndex((i) => i - 1)
      setStoryIndex(prevGroup.stories.length - 1)
    }
  }, [storyIndex, groupIndex, groups])

  // ---- Tap handling ----
  const handleTapStart = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      // Long press
      longPressTimerRef.current = setTimeout(() => {
        setIsPaused(true)
        setShowPauseIcon(true)
        pauseTimer()
      }, LONG_PRESS_MS)

      // Double tap detection (only for touch)
      if ('touches' in e) {
        const now = Date.now()
        if (now - lastTapRef.current < 300) {
          // Double tap → heart
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
          const x = e.touches[0].clientX - rect.left
          const y = e.touches[0].clientY - rect.top
          setHeartAnimations((prev) => [...prev, { id: `h-${Date.now()}`, x, y }])
          if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
        }
        lastTapRef.current = now
      }
    },
    [pauseTimer],
  )

  const handleTapEnd = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }

      if (isPaused && showPauseIcon) {
        // Was paused by long press → resume
        setIsPaused(false)
        setShowPauseIcon(false)
        startTimer()
        return
      }

      // Ignore if paused or if profile/share open
      if (isPaused || showProfile || showShare) return

      // Determine left/right
      let clientX: number
      if ('changedTouches' in e) {
        clientX = e.changedTouches[0].clientX
      } else {
        clientX = (e as React.MouseEvent).clientX
      }

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const relativeX = clientX - rect.left
      if (relativeX < rect.width * 0.3) {
        goPrev()
      } else {
        goNext()
      }
    },
    [isPaused, showPauseIcon, showProfile, showShare, goPrev, goNext, startTimer],
  )

  // ---- Keyboard support ----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (showProfile || showShare) {
        if (e.key === 'Escape') {
          setShowProfile(false)
          setShowShare(false)
        }
        return
      }
      switch (e.key) {
        case 'ArrowRight':
          goNext()
          break
        case 'ArrowLeft':
          goPrev()
          break
        case 'Escape':
          onClose()
          break
        case ' ':
          e.preventDefault()
          if (isPaused) {
            setIsPaused(false)
            setShowPauseIcon(false)
            startTimer()
          } else {
            setIsPaused(true)
            setShowPauseIcon(true)
            pauseTimer()
          }
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [goNext, goPrev, onClose, isPaused, startTimer, pauseTimer, showProfile, showShare])

  // ---- Swipe up for profile ----
  const [touchStartY, setTouchStartY] = useState<number | null>(null)

  const handleTouchStartContent = useCallback((e: React.TouchEvent) => {
    setTouchStartY(e.touches[0].clientY)
  }, [])

  const handleTouchEndContent = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartY === null) return
      const dy = touchStartY - e.changedTouches[0].clientY
      if (dy > 60) {
        setShowProfile(true)
      }
      setTouchStartY(null)
    },
    [touchStartY],
  )

  // ---- Reaction handlers ----
  const handleHeartTap = useCallback((e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top
    setFloatingReactions((prev) => [
      ...prev,
      { id: `f-${Date.now()}`, emoji: '❤️', x, y },
    ])
  }, [])

  const handleReactionSelect = useCallback((emoji: string) => {
    setFloatingReactions((prev) => [
      ...prev,
      { id: `f-${Date.now()}`, emoji, x: window.innerWidth - 80, y: window.innerHeight - 100 },
    ])
  }, [])

  // ---- Reply handler ----
  const handleReplySubmit = useCallback(() => {
    if (replyText.trim()) {
      setReplyText('')
      window.dispatchEvent(new CustomEvent('story-toast', { detail: 'Quote posted!' }))
    }
  }, [replyText])

  // ---- Swipe navigation direction ----
  const prevGroupIndexRef = useRef(groupIndex)

  useEffect(() => {
    prevGroupIndexRef.current = groupIndex
  }, [groupIndex])

  const direction = useMemo(() => {
    // We'll determine direction based on prev/current, but for simplicity:
    return 1
  }, [])

  // ---- Render story content ----
  const renderStoryContent = () => {
    if (!currentStory || !currentGroup) return null

    switch (currentStory.format) {
      case 'text':
        return <TextStory card={currentStory} />
      case 'voice':
        return <VoiceStory card={currentStory} isPaused={isPaused} />
      case 'poll':
        return <PollStory card={currentStory} />
      case 'thread':
        return <ThreadStory card={currentStory} group={currentGroup} />
      case 'cricket':
        return <CricketStory card={currentStory} />
      case 'festival':
        return <FestivalStory card={currentStory} />
      case 'feed':
        return <FeedStory card={currentStory} group={currentGroup} />
      default:
        return null
    }
  }

  // ---- Transition mode ----
  const transitionKey = `${groupIndex}-${storyIndex}`

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black select-none"
      role="dialog"
      aria-label="Story viewer"
    >
      {/* -- Story Content with transitions -- */}
      <AnimatePresence mode="wait">
        <motion.div
          key={transitionKey}
          className="absolute inset-0"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
        >
          {renderStoryContent()}
        </motion.div>
      </AnimatePresence>

      {/* -- Gradient overlay (top) -- */}
      <div className="absolute top-0 left-0 right-0 h-36 bg-gradient-to-b from-black/50 to-transparent pointer-events-none z-20" />

      {/* -- Progress bars -- */}
      <ProgressBars
        total={currentGroup?.stories.length ?? 0}
        currentIndex={storyIndex}
        progress={progress}
        isPaused={isPaused}
      />

      {/* -- Header -- */}
      <div className="absolute top-0 left-0 right-0 z-30 px-3 pt-6 flex items-center justify-between">
        {/* Creator info */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* Avatar with gradient ring */}
          <div
            className="w-9 h-9 rounded-full p-[2px] shrink-0"
            style={{ background: 'linear-gradient(135deg, #FFFFFF, #06b6d4)' }}
          >
            <img
              src={currentGroup?.creatorAvatar}
              alt={currentGroup?.creatorName}
              className="w-full h-full rounded-full object-cover"
            />
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-white text-sm font-semibold truncate">{currentGroup?.creatorName}</span>
            {currentGroup?.creatorVerified && <VerifiedBadge />}
            <span className="text-white/30 text-xs hidden sm:inline truncate">@{currentGroup?.creatorHandle}</span>
            <span className="text-xs">{currentGroup?.creatorCountry}</span>
            {lang && (
              <span className="text-white/25 text-[10px] bg-white/[0.06] px-1.5 py-0.5 rounded font-mono uppercase hidden sm:inline">
                {lang.code}
              </span>
            )}
          </div>
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors shrink-0 ml-2"
          aria-label="Close story"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* -- Tap zones -- */}
      <div
        className="absolute inset-0 z-20"
        onTouchStart={handleTapStart}
        onTouchEnd={handleTapEnd}
        onMouseDown={handleTapStart}
        onMouseUp={handleTapEnd}
        onTouchMove={handleTouchStartContent}
        onTouchEndCapture={handleTouchEndContent}
        style={{ cursor: 'pointer' }}
      >
        {/* Left 30% zone visual guide (invisible) */}
        <div className="absolute left-0 top-0 bottom-0 w-[30%]" />
      </div>

      {/* -- Pause icon overlay -- */}
      <AnimatePresence>
        {showPauseIcon && (
          <motion.div
            className="absolute inset-0 z-25 flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.6 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.6 }}
              className="w-20 h-20 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
            >
              <svg className="w-10 h-10 text-white/70 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* -- Heart animations (double-tap) -- */}
      <AnimatePresence>
        {heartAnimations.map((h) => (
          <motion.div
            key={h.id}
            className="absolute z-30 pointer-events-none"
            style={{ left: h.x - 30, top: h.y - 30 }}
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 1.4, opacity: 0 }}
            exit={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            <span className="text-6xl" style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))' }}>
              ❤️
            </span>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* -- Floating reactions -- */}
      <AnimatePresence>
        {floatingReactions.map((r) => (
          <motion.div
            key={r.id}
            className="absolute z-40 pointer-events-none"
            style={{ left: r.x - 16, top: r.y }}
            initial={{ scale: 0, y: 0, opacity: 1 }}
            animate={{ scale: 1.3, y: -80, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, duration: 1.2 }}
          >
            <span className="text-3xl">{r.emoji}</span>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* -- Bottom bar -- */}
      <div className="absolute bottom-0 left-0 right-0 z-30 px-3 pb-4 pt-8 bg-gradient-to-t from-black/60 to-transparent">
        {/* Reply input */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleReplySubmit()
              }}
              placeholder="Reply as quote..."
              className="w-full rounded-full bg-white/[0.07] border border-white/[0.06] px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 focus:bg-white/[0.09] transition-all"
            />
          </div>

          {/* Heart button */}
          <div className="relative">
            <button
              onClick={handleHeartTap}
              className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
              aria-label="React with heart"
            >
              <motion.span
                className="text-xl"
                whileTap={{ scale: 0.7 }}
                animate={{ scale: 1 }}
              >
                ❤️
              </motion.span>
            </button>

            {/* Extended reactions (show on hold) */}
            <div
              onMouseEnter={() => setShowReactionsPicker(true)}
              onMouseLeave={() => setShowReactionsPicker(false)}
              onTouchStart={() => setShowReactionsPicker(true)}
              onTouchEnd={() => setTimeout(() => setShowReactionsPicker(false), 2000)}
            >
              <AnimatePresence>
                {showReactionsPicker && (
                  <ReactionsPicker
                    onSelect={(emoji) => handleReactionSelect(emoji)}
                    onClose={() => setShowReactionsPicker(false)}
                  />
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Share button */}
          <button
            onClick={() => setShowShare(true)}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
            aria-label="Share"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </button>
        </div>
      </div>

      {/* -- Creator Profile Overlay -- */}
      <AnimatePresence>
        {showProfile && currentGroup && (
          <CreatorProfileOverlay
            group={currentGroup}
            onClose={() => setShowProfile(false)}
          />
        )}
      </AnimatePresence>

      {/* -- Share Sheet -- */}
      <AnimatePresence>
        {showShare && (
          <ShareSheet onClose={() => setShowShare(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}
