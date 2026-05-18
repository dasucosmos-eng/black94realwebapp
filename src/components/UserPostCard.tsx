'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { PAvatar, VerifiedBadge } from './PAvatar'
import { useAppStore } from '@/stores/app'
import type { TrendingLabel } from '@/lib/engagement-engine'
import { ExpandableText } from './ExpandableText'
import { CommentSheet } from './CommentSheet'
import { ShareMenu, RepostToast } from './ShareMenu'

interface UserPostCardProps {
  post: {
    id: string
    authorId: string
    authorUsername?: string
    authorDisplayName?: string
    authorProfileImage?: string
    authorIsVerified?: boolean
    authorBadge?: string
    caption?: string
    mediaUrls?: string
    likeCount?: number
    commentCount?: number
    repostCount?: number
    viewCount?: number
    createdAt?: string
    isLiked?: boolean
    isReposted?: boolean
    isBookmarked?: boolean
    comments?: Array<{
      id: string
      authorId: string
      authorUsername: string
      authorDisplayName: string
      authorProfileImage: string
      content: string
      createdAt: string
    }>
  }
  onLike?: (postId: string) => void
  onRepost?: (postId: string) => void
  onBookmark?: (postId: string) => void
  onComment?: (postId: string) => void
  onProfileTap?: (userId: string) => void
  onDelete?: (postId: string) => void
  trendingLabel?: TrendingLabel
  userId?: string
  userDisplayName?: string
  userUsername?: string
  userProfileImage?: string
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return ''
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatCount(n?: number): string {
  if (!n) return ''
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toString()
}

function highlightContent(text?: string) {
  if (!text) return null
  const parts = text.split(/(#\w+|@\w+)/g)
  return parts.map((part, i) => {
    if (part.startsWith('#')) {
      return <span key={i} className="text-[#FFFFFF] hover:underline cursor-pointer">{part}</span>
    }
    if (part.startsWith('@')) {
      return <span key={i} className="text-[#FFFFFF] hover:underline cursor-pointer">{part}</span>
    }
    return <span key={i}>{part}</span>
  })
}

export function UserPostCard({
  post,
  onLike,
  onRepost,
  onBookmark,
  onComment,
  onProfileTap,
  onDelete,
  trendingLabel,
  userId,
  userDisplayName,
  userUsername,
  userProfileImage,
}: UserPostCardProps) {
  /* ── Local interaction state (optimistic) ── */
  const [isLiked, setIsLiked] = useState(post.isLiked ?? false)
  const [likeCount, setLikeCount] = useState(post.likeCount ?? 0)
  const [isReposted, setIsReposted] = useState(post.isReposted ?? false)
  const [repostCount, setRepostCount] = useState(post.repostCount ?? 0)
  const [isBookmarked, setIsBookmarked] = useState(post.isBookmarked ?? false)
  const [commentCount, setCommentCount] = useState(post.commentCount ?? 0)
  const [viewCount] = useState(post.viewCount ?? 0)

  /* ── Sync local state with parent props (e.g., after Firestore check) ── */
  useEffect(() => { setIsLiked(post.isLiked ?? false) }, [post.isLiked])
  useEffect(() => { setLikeCount(post.likeCount ?? 0) }, [post.likeCount])
  useEffect(() => { setIsReposted(post.isReposted ?? false) }, [post.isReposted])
  useEffect(() => { setRepostCount(post.repostCount ?? 0) }, [post.repostCount])
  useEffect(() => { setIsBookmarked(post.isBookmarked ?? false) }, [post.isBookmarked])
  useEffect(() => { setCommentCount(post.commentCount ?? 0) }, [post.commentCount])

  /* ── Animation state ── */
  const [showHeart, setShowHeart] = useState(false)
  const [likeAnim, setLikeAnim] = useState(false)
  const [repostAnim, setRepostAnim] = useState(false)
  const [bookmarkAnim, setBookmarkAnim] = useState(false)

  /* ── UI state ── */
  const [commentSheetOpen, setCommentSheetOpen] = useState(false)
  const [shareMenuOpen, setShareMenuOpen] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' })
  const [deleting, setDeleting] = useState(false)

  const lastTapRef = useRef(0)
  const likeTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const shareBtnRef = useRef<HTMLButtonElement>(null)
  const moreBtnRef = useRef<HTMLButtonElement>(null)

  const mediaUrls: string[] = useMemo(() => {
    if (!post.mediaUrls) return []
    // Safety: ensure mediaUrls is a string (Firestore may return arrays)
    const raw = String(post.mediaUrls)
    if (!raw.trim()) return []
    // Treat as comma-separated URL list
    return raw.split(',').map((u) => u.trim()).filter(Boolean)
  }, [post.mediaUrls])

  const comments = useMemo(() => post.comments ?? [], [post.comments])

  /* ── BULLETPROOF BADGE: must be BEFORE the early-return guard
     (React hooks cannot be called conditionally). ── */
  const liveUser = useAppStore((s) => s.user)

  /* ── Guard: Don't render cards for empty posts (no caption + no media) ── */
  const hasCaption = !!post.caption && post.caption.trim().length > 0
  const hasMedia = mediaUrls.length > 0
  if (!hasCaption && !hasMedia) return null

  /* ── Handlers ── */

  const handleLike = useCallback(() => {
    const newVal = !isLiked
    setIsLiked(newVal)
    setLikeCount((c) => c + (newVal ? 1 : -1))
    setLikeAnim(true)
    setTimeout(() => setLikeAnim(false), 300)
    onLike?.(post.id)
  }, [isLiked, onLike, post.id])

  const handleRepost = useCallback(() => {
    const newVal = !isReposted
    setIsReposted(newVal)
    setRepostCount((c) => c + (newVal ? 1 : -1))
    setRepostAnim(true)
    setTimeout(() => setRepostAnim(false), 400)
    setToast({
      show: true,
      message: newVal ? 'Reposted' : 'Removed Repost',
    })
    setTimeout(() => setToast({ show: false, message: '' }), 2000)
    onRepost?.(post.id)
  }, [isReposted, onRepost, post.id])

  const handleBookmark = useCallback(() => {
    const newVal = !isBookmarked
    setIsBookmarked(newVal)
    setBookmarkAnim(true)
    setTimeout(() => setBookmarkAnim(false), 300)
    setToast({
      show: true,
      message: newVal ? 'Added to Bookmarks' : 'Removed from Bookmarks',
    })
    setTimeout(() => setToast({ show: false, message: '' }), 2000)
    onBookmark?.(post.id)
  }, [isBookmarked, onBookmark, post.id])

  const handleComment = useCallback(() => {
    setCommentSheetOpen(true)
    onComment?.(post.id)
  }, [onComment, post.id])

  // Double tap to like
  const handleDoubleTap = useCallback(() => {
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      if (!isLiked) {
        setIsLiked(true)
        setLikeCount((c) => c + 1)
        onLike?.(post.id)
      }
      setShowHeart(true)
      setTimeout(() => setShowHeart(false), 900)
      clearTimeout(likeTimeoutRef.current)
    }
    lastTapRef.current = now
  }, [isLiked, onLike, post.id])

  const handleQuote = useCallback(() => {
    setCommentSheetOpen(true)
  }, [])

  const handleCommentSent = useCallback(() => {
    setCommentCount((c) => c + 1)
  }, [])

  const handleDelete = useCallback(async () => {
    if (!onDelete || deleting) return
    setDeleting(true)
    setShowMoreMenu(false)
    try {
      onDelete(post.id)
    } catch (err) {
      console.error('Delete failed:', err)
    } finally {
      setDeleting(false)
    }
  }, [onDelete, deleting, post.id])

  const isOwnPost = userId === post.authorId

  const isLiveOwnPost = liveUser && post.authorId === liveUser.id
  const displayVerified = isLiveOwnPost
    ? (liveUser.isVerified || post.authorIsVerified)
    : post.authorIsVerified
  const displayBadge = isLiveOwnPost
    ? (liveUser.badge || post.authorBadge)
    : post.authorBadge
  const displayProfileImage = isLiveOwnPost
    ? (liveUser.profileImage || post.authorProfileImage)
    : post.authorProfileImage

  return (
    <>
      <article
        className="relative border-b border-white/[0.06] hover:bg-white/[0.03] transition-colors cursor-pointer rounded-none overflow-hidden"
        style={{ paddingLeft: '16px', paddingRight: '16px', paddingTop: '4px', paddingBottom: '12px' }}
      >
        {/* Double-tap heart overlay */}
        {showHeart && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <svg
              className="w-24 h-24 text-[#f43f5e] animate-heart-burst"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          </div>
        )}

        {/* Repost indicator */}
        {isReposted && (
          <div className="flex items-center gap-1.5 ml-10 mb-0.5">
            <svg className="w-[14px] h-[14px] text-[#10b981]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
            </svg>
            <span className="text-[12px] font-bold text-[#10b981]">You shared</span>
          </div>
        )}

        <div className="flex" style={{ gap: '12px' }}>
          {/* Avatar */}
          <div className="shrink-0" onClick={() => onProfileTap?.(post.authorId)}>
            <PAvatar
              src={displayProfileImage}
              name={post.authorDisplayName}
              size={48}
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 relative" onClick={handleDoubleTap}>
            {/* Header row */}
            <div className="flex items-center gap-1 leading-none" style={{ minHeight: 0 }}>
              <button
                onClick={(e) => { e.stopPropagation(); onProfileTap?.(post.authorId) }}
                className="font-bold text-[15px] text-[#e7e9ea] hover:underline truncate leading-tight"
                style={{ minHeight: 0, minWidth: 0 }}
              >
                {post.authorDisplayName || post.authorUsername || 'User'}
              </button>
              {(displayVerified || !!displayBadge) && (
                <VerifiedBadge size={18} badge={displayBadge} />
              )}
              <span className="text-[#94a3b8] text-[15px]">@{post.authorUsername || 'user'}</span>
              <span className="text-[#94a3b8]">·</span>
              <span className="text-[#94a3b8] text-[15px] shrink-0">{timeAgo(post.createdAt)}</span>
              {trendingLabel && (
                <span className={cn(
                  'inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full shrink-0',
                  trendingLabel === 'viral' && 'bg-[#f4212e]/10 text-[#f4212e]',
                  trendingLabel === 'trending' && 'bg-[#FFFFFF]/10 text-[#FFFFFF]',
                  trendingLabel === 'rising' && 'bg-[#10b981]/10 text-[#10b981]',
                )}>
                  {trendingLabel === 'viral' && (
                    <svg className="w-[10px] h-[10px]" viewBox="0 0 24 24" fill="currentColor"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z"/></svg>
                  )}
                  {trendingLabel === 'trending' && (
                    <svg className="w-[10px] h-[10px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                  {trendingLabel === 'rising' && (
                    <svg className="w-[10px] h-[10px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" strokeLinecap="round" strokeLinejoin="round"/><polyline points="17 6 23 6 23 12" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                  {trendingLabel.charAt(0).toUpperCase() + trendingLabel.slice(1)}
                </span>
              )}
              {/* More — vertical dots, absolutely positioned top-right */}
              <button
                ref={moreBtnRef}
                className="absolute top-0 right-0 flex items-center justify-center w-8 h-8 -mr-2 rounded-full hover:bg-white/[0.06] transition-colors"
                onClick={(e) => { e.stopPropagation(); setShowMoreMenu(!showMoreMenu) }}
              >
                <svg className="w-[18px] h-[18px] text-[#94a3b8] hover:text-[#e7e9ea]" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
                </svg>
              </button>
            </div>

            {/* Caption — ExpandableText with line-clamp and Zustand state */}
            {post.caption && (
              <ExpandableText
                id={post.id}
                text={post.caption}
                maxLines={4}
                className="text-[15px] text-[#e7e9ea]"
                style={{ marginTop: '2px', lineHeight: '20px' }}
                renderContent={highlightContent}
              />
            )}

            {/* Media */}
            {mediaUrls.length > 0 && (
              <div
                className={cn(
                  'rounded-2xl overflow-hidden border border-white/[0.06] max-h-[510px]',
                  mediaUrls.length === 1 ? '' : 'grid grid-cols-2 gap-0.5'
                )}
                style={{ marginTop: '12px' }}
              >
                {mediaUrls.slice(0, 4).map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt=""
                    className={cn(
                      'w-full object-cover',
                      mediaUrls.length === 1 ? 'max-h-[510px]' : 'aspect-square'
                    )}
                    loading="lazy"
                  />
                ))}
              </div>
            )}

            {/* Action bar */}
            <div className="flex items-center justify-between max-w-[440px] md:max-w-full -ml-2" style={{ marginTop: '12px' }}>
              {/* Reply / Comment */}
              <button
                className="flex items-center gap-1 group"
                onClick={(e) => { e.stopPropagation(); handleComment() }}
              >
                <div className="p-2.5 rounded-full group-hover:bg-[#FFFFFF]/10 transition-colors">
                  <svg className="w-[18px] h-[18px] text-[#94a3b8] group-hover:text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                {commentCount > 0 && (
                  <span className="text-[13px] text-[#94a3b8] group-hover:text-[#FFFFFF]">{formatCount(commentCount)}</span>
                )}
              </button>

              {/* Repost */}
              <button
                className="flex items-center gap-1 group"
                onClick={(e) => { e.stopPropagation(); handleRepost() }}
              >
                <div className="p-2.5 rounded-full group-hover:bg-[#10b981]/10 transition-colors">
                  <svg
                    className={cn(
                      'w-[18px] h-[18px] transition-colors',
                      isReposted ? 'text-[#10b981]' : 'text-[#94a3b8] group-hover:text-[#10b981]',
                      repostAnim && 'animate-like-bounce'
                    )}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="23 4 23 10 17 10"/>
                    <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
                  </svg>
                </div>
                {repostCount > 0 && (
                  <span className={cn('text-[13px]', isReposted ? 'text-[#10b981]' : 'text-[#94a3b8] group-hover:text-[#10b981]')}>
                    {formatCount(repostCount)}
                  </span>
                )}
              </button>

              {/* Like */}
              <button
                className="flex items-center gap-1 group"
                onClick={(e) => { e.stopPropagation(); handleLike() }}
              >
                <div className="p-2.5 rounded-full group-hover:bg-[#f43f5e]/10 transition-colors">
                  {isLiked ? (
                    <svg
                      className={cn('w-[18px] h-[18px] text-[#f43f5e]', likeAnim && 'animate-like-bounce')}
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                    </svg>
                  ) : (
                    <svg className="w-[18px] h-[18px] text-[#94a3b8] group-hover:text-[#f43f5e]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                    </svg>
                  )}
                </div>
                {likeCount > 0 && (
                  <span className={cn('text-[13px]', isLiked ? 'text-[#f43f5e]' : 'text-[#94a3b8] group-hover:text-[#f43f5e]')}>
                    {formatCount(likeCount)}
                  </span>
                )}
              </button>

              {/* Views */}
              <button className="flex items-center gap-1 group">
                <div className="p-2.5 rounded-full group-hover:bg-[#FFFFFF]/10 transition-colors">
                  <svg className="w-[18px] h-[18px] text-[#94a3b8] group-hover:text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                    <polyline points="17 6 23 6 23 12"/>
                  </svg>
                </div>
                <span className="text-[13px] text-[#94a3b8]">{formatCount(viewCount)}</span>
              </button>

              {/* Bookmark + Share */}
              <div className="flex items-center">
                {/* Bookmark */}
                <button
                  className="group"
                  onClick={(e) => { e.stopPropagation(); handleBookmark() }}
                >
                  <div className="p-2.5 rounded-full group-hover:bg-[#FFFFFF]/10 transition-colors">
                    {isBookmarked ? (
                      <svg
                        className={cn('w-[18px] h-[18px] text-[#FFFFFF]', bookmarkAnim && 'animate-bookmark-pop')}
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      <svg className="w-[18px] h-[18px] text-[#94a3b8] group-hover:text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
                      </svg>
                    )}
                  </div>
                </button>

                {/* Share */}
                <button
                  ref={shareBtnRef}
                  className="group"
                  onClick={(e) => { e.stopPropagation(); setShareMenuOpen(!shareMenuOpen) }}
                >
                  <div className="p-2.5 rounded-full group-hover:bg-[#FFFFFF]/10 transition-colors">
                    <svg className="w-[18px] h-[18px] text-[#94a3b8] group-hover:text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" strokeLinecap="round" strokeLinejoin="round"/>
                      <polyline points="16 6 12 2 8 6" strokeLinecap="round" strokeLinejoin="round"/>
                      <line x1="12" y1="2" x2="12" y2="15" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </article>

      {/* More menu (delete, etc.) */}
      {showMoreMenu && (
        <div className="fixed inset-0 z-50" onClick={(e) => { e.stopPropagation(); setShowMoreMenu(false) }}>
          <div
            className="absolute animate-share-menu-in rounded-2xl bg-[#000000] border border-white/[0.08] shadow-2xl py-2 min-w-[180px] overflow-hidden"
            style={{ top: moreBtnRef.current?.getBoundingClientRect().bottom ? moreBtnRef.current.getBoundingClientRect().bottom + 4 : 100, right: moreBtnRef.current ? window.innerWidth - moreBtnRef.current.getBoundingClientRect().right : 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            {isOwnPost && onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete() }}
                className="w-full flex items-center gap-3 px-4 py-3 text-[14px] text-[#f4212e] hover:bg-white/[0.04] transition-colors"
                disabled={deleting}
              >
                {deleting ? (
                  <div className="w-[18px] h-[18px] border-2 border-[#f4212e]/30 border-t-[#f4212e] rounded-full animate-spin" />
                ) : (
                  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                  </svg>
                )}
                {deleting ? 'Deleting...' : 'Delete post'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Comment Sheet */}
      <CommentSheet
        open={commentSheetOpen}
        onClose={() => setCommentSheetOpen(false)}
        postId={post.id}
        postAuthor={post.authorDisplayName || post.authorUsername || 'User'}
        postAuthorProfileImage={displayProfileImage}
        postAuthorIsVerified={displayVerified}
        postAuthorBadge={displayBadge}
        postCaption={post.caption}
        initialComments={comments}
        userId={userId}
        userDisplayName={userDisplayName}
        userUsername={userUsername}
        userProfileImage={userProfileImage}
        onCommentSent={handleCommentSent}
        likeCount={likeCount}
        commentCount={commentCount}
        repostCount={repostCount}
        viewCount={viewCount}
        isLiked={isLiked}
        isReposted={isReposted}
        isBookmarked={isBookmarked}
        onLike={() => handleLike()}
        onRepost={() => handleRepost()}
        onBookmark={() => handleBookmark()}
      />

      {/* Share Menu */}
      <ShareMenu
        open={shareMenuOpen}
        onClose={() => setShareMenuOpen(false)}
        onRepost={handleRepost}
        onQuote={handleQuote}
        isReposted={isReposted}
        anchorRef={shareBtnRef.current}
        postId={post.id}
      />

      {/* Toast */}
      <RepostToast show={toast.show} message={toast.message} />
    </>
  )
}
