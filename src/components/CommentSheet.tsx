'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { addPostComment, fetchPostComments } from '@/lib/social'
import { toast } from 'sonner'
import { PAvatar, VerifiedBadge } from './PAvatar'
import { useAppStore } from '@/stores/app'

interface CommentData {
  id: string
  authorId: string
  authorUsername: string
  authorDisplayName: string
  authorProfileImage: string
  authorIsVerified?: boolean
  authorBadge?: string
  content: string
  createdAt: string
}

interface CommentSheetProps {
  open: boolean
  onClose: () => void
  postId: string
  postAuthor: string
  postAuthorProfileImage?: string
  postAuthorIsVerified?: boolean
  postAuthorBadge?: string
  postCaption?: string
  initialComments?: CommentData[]
  userId?: string
  userDisplayName?: string
  userUsername?: string
  userProfileImage?: string
  onCommentSent?: () => void
  // Reaction bar props
  likeCount?: number
  commentCount?: number
  repostCount?: number
  viewCount?: number
  isLiked?: boolean
  isReposted?: boolean
  isBookmarked?: boolean
  onLike?: () => void
  onRepost?: () => void
  onBookmark?: () => void
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

/**
 * Enrich comments from Firestore: if a comment's authorId matches the current
 * user, fill in missing isVerified/badge/profileImage from the live user profile.
 * This ensures older comments that were stored before these fields existed
 * still display the correct badge.
 */
function enrichComments(
  comments: CommentData[],
  currentUser: { id?: string; isVerified?: boolean; badge?: string; profileImage?: string } | null,
): CommentData[] {
  if (!currentUser?.id) return comments
  return comments.map((c) => {
    if (c.authorId === currentUser.id) {
      return {
        ...c,
        authorIsVerified: c.authorIsVerified ?? currentUser.isVerified ?? false,
        authorBadge: c.authorBadge || currentUser.badge || '',
        authorProfileImage: c.authorProfileImage || currentUser.profileImage || '',
      }
    }
    return c
  })
}

export function CommentSheet({
  open,
  onClose,
  postId,
  postAuthor,
  postAuthorProfileImage,
  postAuthorIsVerified,
  postAuthorBadge,
  postCaption,
  initialComments = [],
  userId,
  userDisplayName,
  userUsername,
  userProfileImage,
  onCommentSent,
  // Reaction bar
  likeCount: initialLikeCount,
  commentCount: initialCommentCount,
  repostCount: initialRepostCount,
  viewCount = 0,
  isLiked: initialIsLiked,
  isReposted: initialIsReposted,
  isBookmarked: initialIsBookmarked,
  onLike,
  onRepost,
  onBookmark,
}: CommentSheetProps) {
  const [comments, setComments] = useState<CommentData[]>(initialComments)
  const [newComment, setNewComment] = useState('')
  const [sending, setSending] = useState(false)
  const [likeMap, setLikeMap] = useState<Record<string, boolean>>({})
  const [likeCountMap, setLikeCountMap] = useState<Record<string, number>>({})
  const [repostMap, setRepostMap] = useState<Record<string, boolean>>({})
  const [bookmarkMap, setBookmarkMap] = useState<Record<string, boolean>>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const currentUser = useAppStore((s) => s.user)

  // Reaction bar local state
  const [isLiked, setIsLiked] = useState(initialIsLiked ?? false)
  const [likeCount, setLikeCount] = useState(initialLikeCount ?? 0)
  const [isReposted, setIsReposted] = useState(initialIsReposted ?? false)
  const [repostCount, setRepostCount] = useState(initialRepostCount ?? 0)
  const [isBookmarked, setIsBookmarked] = useState(initialIsBookmarked ?? false)
  const [commentCount] = useState(initialCommentCount ?? 0)
  const [likeAnim, setLikeAnim] = useState(false)
  const [repostAnim, setRepostAnim] = useState(false)
  const [bookmarkAnim, setBookmarkAnim] = useState(false)
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' })

  // Derive enriched comments — always patch current user's live profile data
  const enrichedComments = useMemo(
    () => enrichComments(comments, currentUser),
    [comments, currentUser],
  )

  // Fetch comments from Firestore when sheet opens
  useEffect(() => {
    if (!open) return

    // Show initial comments immediately (optimistic)
    if (initialComments.length > 0) {
      setComments(initialComments)
    }

    // Focus input
    setTimeout(() => inputRef.current?.focus(), 350)

    // Fetch fresh comments from Firestore
    fetchPostComments(postId)
      .then((fetched) => {
        if (fetched.length > 0) {
          setComments(fetched)
        } else if (initialComments.length === 0) {
          setComments([])
        }
        // If fetched has results, prefer them; keep optimistic ones appended
        if (fetched.length > 0) {
          setComments(fetched)
        }
      })
      .catch((err) => {
        console.error('Failed to fetch comments:', err)
        // Keep initialComments as fallback
        setComments(initialComments)
      })
  }, [open, postId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom when comments change
  useEffect(() => {
    if (comments.length > 0) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
      }, 100)
    }
  }, [comments.length])

  const handleSend = useCallback(async () => {
    if (!newComment.trim() || sending) return
    const content = newComment.trim()
    setNewComment('')
    setSending(true)

    // Optimistic add
    const tempId = `temp_${Date.now()}`
    const optimistic: CommentData = {
      id: tempId,
      authorId: userId || 'me',
      authorUsername: userUsername || 'you',
      authorDisplayName: userDisplayName || 'You',
      authorProfileImage: userProfileImage || '',
      authorIsVerified: currentUser?.isVerified ?? false,
      authorBadge: currentUser?.badge ?? '',
      content,
      createdAt: new Date().toISOString(),
    }
    setComments((prev) => [...prev, optimistic])

    try {
      if (userId) {
        const real = await addPostComment(postId, userId, content, {
          username: userUsername || 'you',
          displayName: userDisplayName || 'You',
          profileImage: userProfileImage || '',
          isVerified: currentUser?.isVerified,
          badge: currentUser?.badge,
        })
        // Replace optimistic comment with real one from Firestore
        setComments((prev) => prev.map((c) => (c.id === tempId ? {
          id: real.id,
          authorId: real.authorId,
          authorUsername: real.authorUsername,
          authorDisplayName: real.authorDisplayName,
          authorProfileImage: real.authorProfileImage,
          authorIsVerified: real.authorIsVerified,
          authorBadge: real.authorBadge,
          content: real.content,
          createdAt: real.createdAt,
        } : c)))
        // Notify parent that comment was sent
        onCommentSent?.()
      }
    } catch (err) {
      console.error('Comment failed:', err)
      toast.error(err instanceof Error ? err.message : 'Comment failed')
      // Remove optimistic comment on error
      setComments((prev) => prev.filter((c) => c.id !== tempId))
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }, [newComment, sending, postId, userId, userDisplayName, userUsername, userProfileImage, onCommentSent, currentUser])

  const handleLikeComment = useCallback((commentId: string) => {
    setLikeMap((prev) => ({ ...prev, [commentId]: !prev[commentId] }))
    setLikeCountMap((prev) => ({
      ...prev,
      [commentId]: (prev[commentId] || 0) + (likeMap[commentId] ? -1 : 1),
    }))
  }, [likeMap])

  const handleRepostComment = useCallback((commentId: string) => {
    setRepostMap((prev) => ({ ...prev, [commentId]: !prev[commentId] }))
  }, [])

  const handleBookmarkComment = useCallback((commentId: string) => {
    setBookmarkMap((prev) => ({ ...prev, [commentId]: !prev[commentId] }))
  }, [])

  // Post reaction handlers
  const handleLike = useCallback(() => {
    const newVal = !isLiked
    setIsLiked(newVal)
    setLikeCount((c) => c + (newVal ? 1 : -1))
    setLikeAnim(true)
    setTimeout(() => setLikeAnim(false), 400)
    onLike?.()
  }, [isLiked, onLike])

  const handleRepost = useCallback(() => {
    const newVal = !isReposted
    setIsReposted(newVal)
    setRepostCount((c) => c + (newVal ? 1 : -1))
    setRepostAnim(true)
    setTimeout(() => setRepostAnim(false), 400)
    setToast({ show: true, message: newVal ? 'Reposted' : 'Removed Repost' })
    setTimeout(() => setToast({ show: false, message: '' }), 2000)
    onRepost?.()
  }, [isReposted, onRepost])

  const handleBookmark = useCallback(() => {
    const newVal = !isBookmarked
    setIsBookmarked(newVal)
    setBookmarkAnim(true)
    setTimeout(() => setBookmarkAnim(false), 300)
    setToast({ show: true, message: newVal ? 'Added to Bookmarks' : 'Removed from Bookmarks' })
    setTimeout(() => setToast({ show: false, message: '' }), 2000)
    onBookmark?.()
  }, [isBookmarked, onBookmark])

  function fmtCount(n: number): string {
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
    return String(n)
  }

  // Helper: should we show a verified badge for this comment?
  const showBadge = useCallback((c: CommentData) => {
    return c.authorIsVerified || !!c.authorBadge
  }, [])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#000000]/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] flex flex-col bg-[#000000] border-t border-white/[0.08] rounded-t-2xl animate-comment-slide-up safe-area-bottom">
        {/* Handle bar */}
        <div className="flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="w-9 h-1 rounded-full bg-white/[0.2]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] shrink-0">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/[0.08] transition-colors"
          >
            <svg className="w-5 h-5 text-[#e7e9ea]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
            </svg>
          </button>
          <h3 className="text-[15px] font-bold text-[#e7e9ea]">Post</h3>
          <div className="w-8" />
        </div>

        {/* Original post preview */}
        <div className="px-4 py-3 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2 mb-1.5">
            <PAvatar src={postAuthorProfileImage} name={postAuthor} size={24} verified={postAuthorIsVerified} badge={postAuthorBadge} />
            <span className="text-[13px] font-semibold text-[#e7e9ea]">{postAuthor}</span>
            {(postAuthorIsVerified || postAuthorBadge) && <VerifiedBadge size={12} badge={postAuthorBadge} />}
          </div>
          {postCaption && (
            <p className="text-[14px] text-[#94a3b8] line-clamp-2 leading-relaxed">{postCaption}</p>
          )}
        </div>

        {/* Action bar — same reaction buttons as post card */}
        <div className="flex items-center justify-between max-w-[440px] px-2 py-1.5 border-b border-white/[0.06] shrink-0">
          {/* Reply */}
          <button className="flex items-center gap-1 group">
            <div className="p-2.5 rounded-full group-hover:bg-[#FFFFFF]/10 transition-colors">
              <svg className="w-[18px] h-[18px] text-[#94a3b8] group-hover:text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>
              </svg>
            </div>
            {commentCount > 0 && <span className="text-[13px] text-[#94a3b8]">{fmtCount(commentCount)}</span>}
          </button>

          {/* Repost */}
          <button className="flex items-center gap-1 group" onClick={handleRepost}>
            <div className="p-2.5 rounded-full group-hover:bg-[#10b981]/10 transition-colors">
              <svg className={cn('w-[18px] h-[18px] transition-colors', isReposted ? 'text-[#10b981]' : 'text-[#94a3b8] group-hover:text-[#10b981]', repostAnim && 'animate-like-bounce')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
              </svg>
            </div>
            {repostCount > 0 && <span className={cn('text-[13px]', isReposted ? 'text-[#10b981]' : 'text-[#94a3b8]')}>{fmtCount(repostCount)}</span>}
          </button>

          {/* Like */}
          <button className="flex items-center gap-1 group" onClick={handleLike}>
            <div className="p-2.5 rounded-full group-hover:bg-[#f43f5e]/10 transition-colors">
              {isLiked ? (
                <svg className={cn('w-[18px] h-[18px] text-[#f43f5e]', likeAnim && 'animate-like-bounce')} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                </svg>
              ) : (
                <svg className="w-[18px] h-[18px] text-[#94a3b8] group-hover:text-[#f43f5e]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                </svg>
              )}
            </div>
            {likeCount > 0 && <span className={cn('text-[13px]', isLiked ? 'text-[#f43f5e]' : 'text-[#94a3b8]')}>{fmtCount(likeCount)}</span>}
          </button>

          {/* Views */}
          <button className="flex items-center gap-1 group">
            <div className="p-2.5 rounded-full group-hover:bg-[#FFFFFF]/10 transition-colors">
              <svg className="w-[18px] h-[18px] text-[#94a3b8] group-hover:text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                <polyline points="17 6 23 6 23 12"/>
              </svg>
            </div>
            {viewCount > 0 && <span className="text-[13px] text-[#94a3b8]">{fmtCount(viewCount)}</span>}
          </button>

          {/* Bookmark */}
          <div className="flex items-center">
            <button className="group" onClick={handleBookmark}>
              <div className="p-2.5 rounded-full group-hover:bg-[#FFFFFF]/10 transition-colors">
                {isBookmarked ? (
                  <svg className={cn('w-[18px] h-[18px] text-[#FFFFFF]', bookmarkAnim && 'animate-bookmark-pop')} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
                  </svg>
                ) : (
                  <svg className="w-[18px] h-[18px] text-[#94a3b8] group-hover:text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
                  </svg>
                )}
              </div>
            </button>
          </div>
        </div>

        {/* Comments list */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2 no-scrollbar">
          {enrichedComments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg className="w-10 h-10 text-[#64748b] mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p className="text-[14px] text-[#94a3b8]">No comments yet</p>
              <p className="text-[13px] text-[#64748b] mt-1">Be the first to share your thoughts</p>
            </div>
          ) : (
            enrichedComments.map((comment) => (
              <div key={comment.id} className="flex gap-3 py-3 animate-fade-in">
                {/* Avatar */}
                <div className="shrink-0">
                  <PAvatar
                    src={comment.authorProfileImage}
                    name={comment.authorDisplayName || comment.authorUsername}
                    size={32}
                    verified={comment.authorIsVerified}
                    badge={comment.authorBadge}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[14px] font-bold text-[#e7e9ea] truncate">
                      {comment.authorDisplayName || comment.authorUsername}
                    </span>
                    {showBadge(comment) && <VerifiedBadge size={13} badge={comment.authorBadge} />}
                    <span className="text-[13px] text-[#64748b] shrink-0">@{comment.authorUsername}</span>
                    <span className="text-[13px] text-[#64748b] shrink-0">· {timeAgo(comment.createdAt)}</span>
                  </div>
                  <p className="text-[15px] text-[#e7e9ea] mt-0.5 whitespace-pre-wrap break-words leading-[20px]">
                    {comment.content}
                  </p>

                  {/* Comment actions — same reaction buttons as feed */}
                  <div className="flex items-center gap-6 mt-1.5 -ml-2">
                    {/* Reply */}
                    <button className="flex items-center gap-1 group">
                      <div className="p-2 rounded-full group-hover:bg-[#FFFFFF]/10 transition-colors">
                        <svg className="w-[16px] h-[16px] text-[#94a3b8] group-hover:text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>
                        </svg>
                      </div>
                    </button>

                    {/* Repost */}
                    <button
                      onClick={() => handleRepostComment(comment.id)}
                      className="flex items-center gap-1 group"
                    >
                      <div className="p-2 rounded-full group-hover:bg-[#10b981]/10 transition-colors">
                        {repostMap[comment.id] ? (
                          <svg className="w-[16px] h-[16px] text-[#10b981] animate-like-bounce" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="23 4 23 10 17 10"/>
                            <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
                          </svg>
                        ) : (
                          <svg className="w-[16px] h-[16px] text-[#94a3b8] group-hover:text-[#10b981]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="23 4 23 10 17 10"/>
                            <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
                          </svg>
                        )}
                      </div>
                    </button>

                    {/* Like */}
                    <button
                      onClick={() => handleLikeComment(comment.id)}
                      className="flex items-center gap-1 group"
                    >
                      <div className="p-2 rounded-full group-hover:bg-[#f43f5e]/10 transition-colors">
                        {likeMap[comment.id] ? (
                          <svg className="w-[16px] h-[16px] text-[#f43f5e] animate-like-bounce" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                          </svg>
                        ) : (
                          <svg className="w-[16px] h-[16px] text-[#94a3b8] group-hover:text-[#f43f5e]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                          </svg>
                        )}
                      </div>
                    </button>

                    {/* Views */}
                    <button className="flex items-center gap-1 group">
                      <div className="p-2 rounded-full group-hover:bg-[#FFFFFF]/10 transition-colors">
                        <svg className="w-[16px] h-[16px] text-[#94a3b8] group-hover:text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                          <polyline points="17 6 23 6 23 12"/>
                        </svg>
                      </div>
                    </button>

                    {/* Bookmark */}
                    <button
                      onClick={() => handleBookmarkComment(comment.id)}
                      className="flex items-center gap-1 group"
                    >
                      <div className="p-2 rounded-full group-hover:bg-[#FFFFFF]/10 transition-colors">
                        {bookmarkMap[comment.id] ? (
                          <svg className="w-[16px] h-[16px] text-[#FFFFFF]" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
                          </svg>
                        ) : (
                          <svg className="w-[16px] h-[16px] text-[#94a3b8] group-hover:text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
                          </svg>
                        )}
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Sending indicator */}
          {sending && (
            <div className="flex items-center gap-2 py-3 animate-fade-in">
              <div className="w-2 h-2 rounded-full bg-[#FFFFFF] animate-pulse-soft" />
              <span className="text-[13px] text-[#64748b]">Posting...</span>
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="shrink-0 px-4 py-3 border-t border-white/[0.06] bg-[#000000]">
          <div className="flex items-end gap-3">
            {/* User avatar */}
            <div className="shrink-0 mb-0.5">
              <PAvatar
                src={userProfileImage}
                name={userDisplayName || 'You'}
                size={32}
                verified={currentUser?.isVerified}
                badge={currentUser?.badge}
              />
            </div>

            {/* Input */}
            <div className="flex-1 bg-[#18181b] rounded-2xl border border-white/[0.08] focus-within:border-[#FFFFFF]/40 transition-all px-4 py-2.5">
              <input
                ref={inputRef}
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Post your reply..."
                className="w-full bg-transparent text-[14px] text-[#e7e9ea] placeholder-[#64748b] outline-none"
              />
            </div>

            {/* Send */}
            <button
              onClick={handleSend}
              disabled={!newComment.trim() || sending}
              className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 mb-0.5',
                newComment.trim()
                  ? 'bg-gradient-to-br from-[#FFFFFF] to-[#D1D5DB] text-black shadow-md hover:scale-[1.05] active:scale-90'
                  : 'bg-white/[0.06] text-[#64748b]'
              )}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
