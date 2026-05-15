'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  type StoryGroup,
  type StoryCard,
  type StoryFormat,
  getLanguage,
  formatCount,
  getReactionLabel,
  getTotalReactions,
} from '@/lib/story-data'
import { VerifiedBadge } from '@/components/PAvatar'
import {
  Plus,
  Search,
  ChevronRight,
  Mic,
  BarChart3,
  FileText,
  Trophy,
  PartyPopper,
  Newspaper,
  Eye,
  MessageCircle,
} from 'lucide-react'
import Image from 'next/image'

// ─── Types ───────────────────────────────────────────────────────────────────

interface StoryFeedProps {
  onOpenStory: (groupId: string) => void
  onOpenCreator: () => void
  storyGroups: StoryGroup[]
}

type CategoryFilter = 'all' | StoryFormat

// ─── Constants ──────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS: { value: CategoryFilter; label: string; icon: string }[] = [
  { value: 'all', label: 'All', icon: '✨' },
  { value: 'voice', label: 'Voice', icon: '🎙️' },
  { value: 'poll', label: 'Polls', icon: '📊' },
  { value: 'cricket', label: 'Cricket', icon: '🏏' },
  { value: 'festival', label: 'Festivals', icon: '🎉' },
  { value: 'thread', label: 'Threads', icon: '🧵' },
  { value: 'text', label: 'Text', icon: '💬' },
  { value: 'feed', label: 'News', icon: '📰' },
]

const FORMAT_CONFIG: Record<StoryFormat, { icon: string; label: string }> = {
  voice: { icon: '🎙️', label: 'Voice' },
  poll: { icon: '📊', label: 'Poll' },
  thread: { icon: '🧵', label: 'Thread' },
  text: { icon: '💬', label: 'Text' },
  cricket: { icon: '🏏', label: 'Cricket' },
  festival: { icon: '🎉', label: 'Festival' },
  feed: { icon: '📰', label: 'News' },
}

function getTimeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'now'
  if (diffMins < 60) return `${diffMins}m`
  const diffHrs = Math.floor(diffMins / 60)
  if (diffHrs < 24) return `${diffHrs}h`
  const diffDays = Math.floor(diffHrs / 24)
  return `${diffDays}d`
}

// ─── Story Ring ──────────────────────────────────────────────────────────────

function StoryRing({ viewed, children, size = 66 }: { viewed: boolean; children: React.ReactNode; size?: number }) {
  if (viewed) {
    return (
      <div className="rounded-full p-[2px] bg-white/10">
        {children}
      </div>
    )
  }

  return (
    <div className="relative" style={{ width: size + 6, height: size + 6 }}>
      <div
        className="rounded-full p-[3px] w-full h-full"
        style={{
          background: 'conic-gradient(from 45deg, #00f0ff, #ff00aa, #39ff14, #a855f7, #00f0ff)',
        }}
      >
        {children}
      </div>
      {/* Subtle rotating glow */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'conic-gradient(from 45deg, rgba(0,240,255,0.3), transparent 40%, rgba(255,0,170,0.2) 60%, transparent 80%, rgba(0,240,255,0.3))',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  )
}

// ─── Story Circle ────────────────────────────────────────────────────────────

function StoryCircle({
  group,
  index,
  onTap,
}: {
  group: StoryGroup
  index: number
  onTap: () => void
}) {
  const firstStory = group.stories[0]
  if (!firstStory) return null
  const size = 66

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: 'easeOut' }}
      whileTap={{ scale: 0.92 }}
      className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group"
      onClick={onTap}
      aria-label={`View ${group.creatorName}'s story`}
    >
      <StoryRing viewed={group.viewed} size={size}>
        <div className="rounded-full bg-black overflow-hidden" style={{ width: size, height: size }}>
          <Image
            src={group.creatorAvatar}
            alt={group.creatorName}
            width={size}
            height={size}
            className="w-full h-full object-cover"
            unoptimized
          />
        </div>
      </StoryRing>
      <div className="flex flex-col items-center w-[72px]">
        <span className="text-[11px] text-white/70 group-hover:text-white transition-colors truncate max-w-[68px] text-center leading-tight">
          {group.creatorHandle.replace('@', '')}
        </span>
        {group.stories.length > 1 && (
          <span className="text-[9px] text-white/30">{group.stories.length}</span>
        )}
      </div>
    </motion.button>
  )
}

// ─── Your Story Circle ───────────────────────────────────────────────────────

function YourStoryCircle({ onTap }: { onTap: () => void }) {
  const size = 66
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      whileTap={{ scale: 0.92 }}
      className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group"
      onClick={onTap}
      aria-label="Create your story"
    >
      <div className="relative" style={{ width: size + 6, height: size + 6 }}>
        <div
          className="rounded-full p-[3px] w-full h-full"
          style={{
            background: 'conic-gradient(from 45deg, #00f0ff, #ff00aa, #00f0ff)',
          }}
        >
          <div className="rounded-full bg-black overflow-hidden flex items-center justify-center" style={{ width: size, height: size }}>
            <div className="w-9 h-9 rounded-full bg-[#00f0ff]/10 flex items-center justify-center">
              <Plus size={20} className="text-[#00f0ff]" strokeWidth={2.5} />
            </div>
          </div>
        </div>
      </div>
      <span className="text-[11px] text-[#00f0ff]/60 group-hover:text-[#00f0ff] transition-colors">
        Your Story
      </span>
    </motion.button>
  )
}

// ─── Discover Card ───────────────────────────────────────────────────────────

function DiscoverCard({
  group,
  index,
  onTap,
}: {
  group: StoryGroup
  index: number
  onTap: () => void
}) {
  const firstStory = group.stories[0]
  if (!firstStory) return null

  const formatInfo = FORMAT_CONFIG[firstStory.format]
  const topReaction = Object.entries(group.reactions)
    .sort((a, b) => (b[1] as number) - (a[1] as number))[0]
  const topReactionEmoji = topReaction ? getReactionLabel(topReaction[0] as never) : ''
  const totalReactions = getTotalReactions(group.reactions)
  const isMultiSlide = group.stories.length > 1

  // Determine card height based on format
  const isTall = ['text', 'festival', 'thread'].includes(firstStory.format)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: 'easeOut' }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      className={cn(
        'rounded-2xl overflow-hidden cursor-pointer relative border border-white/[0.06]',
        isTall ? 'h-[240px]' : 'h-[180px]',
      )}
      onClick={onTap}
      role="button"
    >
      {/* Visual Background */}
      <StoryCardVisual story={firstStory} />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 p-3 flex items-center justify-between z-10">
        {/* Format badge */}
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-md border border-white/10">
          <span className="text-[10px]">{formatInfo.icon}</span>
          <span className="text-[10px] font-medium text-white/80">{formatInfo.label}</span>
        </div>

        {/* Slide count */}
        {isMultiSlide && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-md border border-white/10">
            <div className="flex -space-x-1">
              {group.stories.slice(0, 3).map((_, i) => (
                <div key={i} className="w-1 h-1 rounded-full bg-white/60" />
              ))}
            </div>
            <span className="text-[10px] text-white/60 font-medium">{group.stories.length}</span>
          </div>
        )}
      </div>

      {/* Bottom overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-3 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-8">
        {/* Creator info */}
        <div className="flex items-center gap-2 mb-2">
          <div className="relative">
            <Image
              src={group.creatorAvatar}
              alt={group.creatorName}
              width={24}
              height={24}
              className="rounded-full object-cover border border-white/20"
              unoptimized
            />
            {group.creatorVerified && (
              <div className="absolute -bottom-0.5 -right-0.5">
                <div className="w-3 h-3 rounded-full bg-blue-400 flex items-center justify-center">
                  <svg className="w-[7px] h-[7px] text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                  </svg>
                </div>
              </div>
            )}
          </div>
          <span className="text-[12px] font-semibold text-white truncate flex-1">{group.creatorName}</span>
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Eye size={10} className="text-white/40" />
              <span className="text-[10px] text-white/40">{formatCount(group.viewCount)}</span>
            </div>
            <div className="flex items-center gap-0.5">
              <span className="text-[10px]">{topReactionEmoji}</span>
              <span className="text-[10px] text-white/40">{formatCount(totalReactions)}</span>
            </div>
          </div>
          <span className="text-[10px] text-white/30">{getTimeAgo(group.createdAt)}</span>
        </div>
      </div>

      {/* Unviewed indicator dot */}
      {!group.viewed && (
        <motion.div
          className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[#FFFFFF] z-10"
          animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
    </motion.div>
  )
}

// ─── Story Card Visual ──────────────────────────────────────────────────────

function StoryCardVisual({ story }: { story: StoryCard }) {
  switch (story.format) {
    case 'text': {
      const bg = story.mediaUrl?.startsWith('linear-gradient')
        ? story.mediaUrl
        : 'linear-gradient(135deg, #7B1FA2 0%, #1565C0 100%)'
      return (
        <div className="absolute inset-0 p-4 flex items-center justify-center" style={{ background: bg }}>
          <p
            className="text-white text-[15px] font-bold text-center leading-relaxed line-clamp-4 px-2"
            style={{ textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}
          >
            {story.content}
          </p>
        </div>
      )
    }

    case 'voice': {
      const waveform = story.voiceWaveform ?? Array.from({ length: 16 }, () => Math.random() * 70 + 30)
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: 'linear-gradient(180deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)' }}>
          <div className="flex items-end justify-center gap-[2px] h-16 px-6">
            {waveform.map((h, i) => (
              <motion.div
                key={i}
                className="w-[3px] rounded-full bg-[#FFFFFF]/60"
                initial={{ height: 4 }}
                animate={{ height: `${(h / 100) * 56 + 8}px` }}
                transition={{ duration: 0.5, delay: i * 0.03, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5 mt-3">
            <Mic size={12} className="text-[#FFFFFF]/60" />
            <span className="text-[10px] text-white/30">{story.voiceDuration ?? 45}s</span>
          </div>
          {story.content && (
            <p className="text-[11px] text-white/30 text-center mt-2 mx-4 line-clamp-2">{story.content}</p>
          )}
        </div>
      )
    }

    case 'poll': {
      const options = story.pollOptions
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-black">
          <p className="text-white/80 text-[12px] font-semibold text-center mb-3 line-clamp-2 px-2">
            {story.content}
          </p>
          <div className="w-full space-y-1.5 px-2">
            {options?.slice(0, 3).map((opt, i) => {
              const colors = ['bg-[#FFFFFF]/20', 'bg-[#3b82f6]/20', 'bg-[#06b6d4]/20']
              const barColors = ['bg-[#FFFFFF]/40', 'bg-[#3b82f6]/40', 'bg-[#06b6d4]/40']
              return (
                <div key={opt.id} className="relative rounded-lg overflow-hidden h-7">
                  <motion.div
                    className={cn('absolute inset-y-0 left-0 rounded-lg', barColors[i % 3])}
                    initial={{ width: 0 }}
                    animate={{ width: `${opt.percentage}%` }}
                    transition={{ duration: 1, delay: i * 0.15, ease: 'easeOut' }}
                  />
                  <div className={cn('absolute inset-0 rounded-lg', colors[i % 3])} />
                  <div className="relative flex items-center justify-between px-2.5 h-full">
                    <span className="text-[11px] text-white/70 truncate flex-1 mr-2">{opt.text}</span>
                    <span className="text-[10px] text-white/50 font-semibold shrink-0">{opt.percentage}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    case 'cricket': {
      const data = story.cricketData
      if (!data) return null
      const isLive = data.status === 'live'
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4" style={{ background: 'linear-gradient(180deg, #0a1a0a 0%, #0a0a0a 50%, #1a0a0a 100%)' }}>
          {isLive && (
            <div className="flex items-center gap-1.5 mb-2">
              <motion.span
                className="w-1.5 h-1.5 rounded-full bg-red-500"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
              <span className="text-[10px] font-bold text-red-400 tracking-wider">LIVE</span>
            </div>
          )}
          <div className="w-full space-y-2 px-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-white/70">{data.team1 === 'IND' ? '🇮🇳' : data.team1 === 'AUS' ? '🇦🇺' : '🏏'} {data.team1}</span>
              <span className="text-[14px] font-bold text-white font-mono">{data.team1Score}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-white/50">{data.team2 === 'IND' ? '🇮🇳' : data.team2 === 'AUS' ? '🇦🇺' : '🏏'} {data.team2}</span>
              <span className="text-[14px] text-white/50 font-mono">{data.team2Score}</span>
            </div>
          </div>
          <span className="text-[10px] text-white/20 mt-2">{data.venue} · {data.overs} ov</span>
        </div>
      )
    }

    case 'festival': {
      const template = story.festivalTemplate
      return (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center p-4"
          style={{ background: template?.gradient ?? 'linear-gradient(135deg, #FF6F00 0%, #FFD54F 100%)' }}
        >
          <motion.span
            className="text-4xl mb-2"
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            {template?.emoji ?? '🎉'}
          </motion.span>
          <p
            className="text-[13px] font-bold text-center leading-snug line-clamp-2"
            style={{ color: template?.textColor ?? '#FFFFFF', textShadow: '0 1px 6px rgba(0,0,0,0.3)' }}
          >
            {story.content}
          </p>
        </div>
      )
    }

    case 'thread': {
      const threadMatch = story.content.match(/^(\d+)\/(\d+)/)
      const current = threadMatch ? parseInt(threadMatch[1], 10) : 1
      const total = threadMatch ? parseInt(threadMatch[2], 10) : 1
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4" style={{ background: 'linear-gradient(180deg, #111 0%, #1a1a1a 100%)' }}>
          <div className="flex items-center gap-2 mb-3">
            <FileText size={14} className="text-[#FFFFFF]" />
            <span className="text-[10px] font-bold text-[#FFFFFF] tracking-wider uppercase">Thread</span>
          </div>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[11px] text-white/40 font-mono bg-white/5 px-2 py-0.5 rounded-full">{current}/{total}</span>
          </div>
          <p className="text-[12px] text-white/60 text-center leading-relaxed line-clamp-4 px-1">
            {story.content.replace(/^\d+\/\d+\s*[—–]\s*/, '')}
          </p>
        </div>
      )
    }

    case 'feed': {
      const hasImage = story.mediaUrl && !story.mediaUrl.startsWith('linear-gradient')
      if (hasImage) {
        return (
          <div className="absolute inset-0">
            <Image src={story.mediaUrl} alt="Feed story" fill className="object-cover" unoptimized />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30" />
            <p className="absolute bottom-12 left-3 right-3 text-[12px] text-white/90 line-clamp-3 leading-relaxed">
              {story.content}
            </p>
          </div>
        )
      }
      return (
        <div className="absolute inset-0 flex items-center justify-center p-4 bg-black">
          <div className="flex items-start gap-2">
            <Newspaper size={14} className="text-[#FFFFFF] mt-0.5 shrink-0" />
            <p className="text-[12px] text-white/60 leading-relaxed line-clamp-4">{story.content}</p>
          </div>
        </div>
      )
    }

    default:
      return <div className="absolute inset-0 bg-black" />
  }
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center py-16 px-6"
    >
      <div className="w-20 h-20 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
        <MessageCircle size={32} className="text-white/15" />
      </div>
      <h3 className="text-[16px] font-semibold text-white/70 mb-1">No stories yet</h3>
      <p className="text-[13px] text-white/30 text-center mb-5 max-w-[240px]">
        Be the first to share a story with the world
      </p>
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={onCreate}
        className="px-6 py-2.5 rounded-full text-[13px] font-semibold text-black"
        style={{
          background: 'linear-gradient(135deg, #00f0ff, #ff00aa)',
          boxShadow: '0 0 20px rgba(0,240,255,0.4), 0 0 40px rgba(255,0,170,0.2)',
        }}
      >
        Create your first story
      </motion.button>
    </motion.div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function StoryFeed({ onOpenStory, onOpenCreator, storyGroups }: StoryFeedProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all')
  const [scrollY, setScrollY] = useState(0)
  const feedRef = useRef<HTMLDivElement>(null)

  const groups = useMemo(() => storyGroups ?? [], [storyGroups])

  // ─── Scroll tracking ───
  useEffect(() => {
    const el = feedRef.current
    if (!el) return
    const onScroll = () => setScrollY(el.scrollTop)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // ─── Sort: unviewed first, then by viewCount ───
  const sortedGroups = useMemo(() => {
    return [...groups].sort((a, b) => {
      if (a.viewed !== b.viewed) return a.viewed ? 1 : -1
      return b.viewCount - a.viewCount
    })
  }, [groups])

  // ─── Filter by category ───
  const filteredGroups = useMemo(() => {
    if (activeCategory === 'all') return sortedGroups
    return sortedGroups.filter((g) => g.stories.some((s) => s.format === activeCategory))
  }, [sortedGroups, activeCategory])

  // ─── Unviewed count ───
  const unviewedCount = useMemo(() => groups.filter((g) => !g.viewed).length, [groups])

  const showFab = scrollY > 300

  return (
    <div className="min-h-screen bg-black">
      {/* ─── Header ─── */}
      <div className="sticky top-0 z-20 bg-black/90 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <h1 className="text-[20px] font-bold text-white" style={{ textShadow: '0 0 20px rgba(0,240,255,0.3)' }}>Stories</h1>
            {unviewedCount > 0 && (
              <motion.span
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-[11px] font-semibold text-[#00f0ff] bg-[#00f0ff]/10 border border-[#00f0ff]/20 px-2 py-0.5 rounded-full"
              >
                {unviewedCount} new
              </motion.span>
            )}
          </div>
          <button className="w-9 h-9 rounded-full bg-white/[0.04] flex items-center justify-center hover:bg-white/[0.08] transition-colors">
            <Search size={16} className="text-white/50" />
          </button>
        </div>
      </div>

      {/* ─── Story Circles ─── */}
      <div className="border-b border-white/[0.04]">
        <div className="overflow-x-auto no-scrollbar stories-scroll px-4 py-4">
          <div className="flex items-end gap-4">
            <YourStoryCircle onTap={onOpenCreator} />
            {sortedGroups.map((group, idx) => (
              <StoryCircle
                key={group.creatorId}
                group={group}
                index={idx}
                onTap={() => onOpenStory(group.creatorId)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ─── Category Chips ─── */}
      <div className="border-b border-white/[0.04]">
        <div className="overflow-x-auto no-scrollbar px-4 py-2.5">
          <div className="flex items-center gap-2">
            {CATEGORY_OPTIONS.map((cat) => {
              const isActive = activeCategory === cat.value
              return (
                <motion.button
                  key={cat.value}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveCategory(cat.value)}
                  className={cn(
                    'relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-full whitespace-nowrap text-[12px] font-medium transition-colors shrink-0',
                    isActive
                      ? 'text-white'
                      : 'text-white/40 hover:text-white/60 hover:bg-white/[0.04]',
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="storyCategoryPill"
                      className="absolute inset-0 bg-gradient-to-r from-[#00f0ff] to-[#ff00aa] rounded-full"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 text-[11px]">{cat.icon}</span>
                  <span className="relative z-10">{cat.label}</span>
                </motion.button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ─── Section Header ─── */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h2 className="text-[14px] font-semibold text-[#00f0ff]/60">
          {activeCategory === 'all' ? 'Discover' : FORMAT_CONFIG[activeCategory as StoryFormat]?.label + ' Stories'}
        </h2>
        <span className="text-[12px] text-white/30">{filteredGroups.length} stories</span>
      </div>

      {/* ─── Discover Grid ─── */}
      <div ref={feedRef} className="px-4 pb-28 overflow-y-auto max-h-[calc(100vh-260px)]">
        <AnimatePresence mode="popLayout">
          {filteredGroups.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {filteredGroups.map((group, idx) => (
                <DiscoverCard
                  key={group.creatorId + '-' + activeCategory}
                  group={group}
                  index={idx}
                  onTap={() => onOpenStory(group.creatorId)}
                />
              ))}
            </div>
          ) : (
            <EmptyState onCreate={onOpenCreator} />
          )}
        </AnimatePresence>
      </div>

      {/* ─── Floating Create Button ─── */}
      <AnimatePresence>
        {showFab && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 16 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={onOpenCreator}
            className="fixed bottom-20 right-5 z-30 w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #00f0ff, #ff00aa)',
              boxShadow: '0 4px 20px rgba(0,240,255,0.5), 0 0 40px rgba(255,0,170,0.3)',
            }}
            aria-label="Create story"
          >
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ background: 'linear-gradient(135deg, #00f0ff, #ff00aa)' }}
              animate={{ scale: [1, 1.3], opacity: [0.4, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
            />
            <svg width="22" height="22" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24" className="relative z-10">
              <path d="M12 20h9" strokeLinecap="round" />
              <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
