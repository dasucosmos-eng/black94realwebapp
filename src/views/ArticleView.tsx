'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app'
import { toast } from 'sonner'
import { getArticle, calculateReadTime } from '@/lib/articles'
import { PAvatar, VerifiedBadge } from '@/components/PAvatar'

export function ArticleView() {
  const navigate = useAppStore((s) => s.navigate)
  const viewParams = useAppStore((s) => s.viewParams)
  const articleId = viewParams?.articleId ?? ''

  const [liked, setLiked] = useState(false)
  const [bookmarked, setBookmarked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [commentCount] = useState(0)

  const article = useMemo(() => getArticle(articleId), [articleId])

  const readTime = useMemo(
    () => (article ? calculateReadTime(article.content) : ''),
    [article]
  )

  // Increment view count on mount
  useEffect(() => {
    if (!article) return
    const STORAGE_KEY = 'black94_article_views'
    const viewed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, number>
    if (!viewed[articleId]) {
      viewed[articleId] = 1
      localStorage.setItem(STORAGE_KEY, JSON.stringify(viewed))
    }
  }, [article, articleId])

  // ── Fact Check Parsing ──
  const factCheck = useMemo(() => {
    if (!article?.factCheck) return null
    const colonIdx = article.factCheck.indexOf(':')
    if (colonIdx < 0) return null
    const status = article.factCheck.slice(0, colonIdx)
    const url = article.factCheck.slice(colonIdx + 1)
    return { status: status.trim(), url: url.trim() }
  }, [article])

  // ── Handlers ──
  const handleBack = useCallback(() => {
    navigate('feed')
  }, [navigate])

  const handleShare = useCallback(() => {
    toast.info('Share link copied!')
  }, [])

  const handleLike = useCallback(() => {
    setLiked((prev) => {
      setLikeCount((c) => (prev ? c - 1 : c + 1))
      return !prev
    })
  }, [])

  const handleComment = useCallback(() => {
    // Comments feature
  }, [])

  const handleBookmark = useCallback(() => {
    setBookmarked((prev) => {
      toast.success(prev ? 'Removed from bookmarks' : 'Saved to bookmarks')
      return !prev
    })
  }, [])

  const handleEdit = useCallback(() => {
    if (!article) return
    navigate('write-article', { articleId: article.id })
  }, [article, navigate])

  // ── Format date ──
  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return ''
    }
  }

  // ── Render content with paragraph support ──
  const renderContent = (text: string) => {
    return text.split('\n').map((paragraph, i) => {
      if (!paragraph.trim()) return <div key={i} className="h-4" />
      return (
        <p key={i} className="mb-4 text-[17px] leading-[1.8] text-[#c8d0bc]">
          {paragraph}
        </p>
      )
    })
  }

  // ── Article not found ──
  if (!article) {
    return (
      <div className="min-h-screen bg-[#000000]">
        <header className="sticky top-0 z-30 bg-[#000000]/80 backdrop-blur-md border-b border-white/[0.06]">
          <div className="flex items-center gap-3 px-4 h-14">
            <button
              onClick={handleBack}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/[0.06] transition-colors"
              aria-label="Go back"
            >
              <svg className="w-5 h-5 text-[#e7e9ea]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" />
                <path d="M12 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-[17px] font-bold text-[#e7e9ea]">Article</h1>
          </div>
        </header>
        <div className="flex flex-col items-center justify-center py-32 px-4">
          <div className="w-16 h-16 rounded-full bg-white/[0.04] flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-[#94a3b8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <p className="text-[17px] font-semibold text-[#e7e9ea] mb-1">Article not found</p>
          <p className="text-[14px] text-[#94a3b8]">This article may have been removed or doesn&apos;t exist.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#000000]">
      {/* ─── Sticky Header ─── */}
      <header className="sticky top-0 z-30 bg-[#000000]/80 backdrop-blur-md border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/[0.06] transition-colors"
              aria-label="Go back"
            >
              <svg className="w-5 h-5 text-[#e7e9ea]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" />
                <path d="M12 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-[17px] font-bold text-[#e7e9ea]">Article</h1>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleEdit}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/[0.06] transition-colors"
              aria-label="Edit article"
            >
              <svg className="w-[18px] h-[18px] text-[#94a3b8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              onClick={handleShare}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/[0.06] transition-colors"
              aria-label="Share article"
            >
              <svg className="w-[18px] h-[18px] text-[#94a3b8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* ─── Article Content ─── */}
      <article className="max-w-2xl mx-auto pb-24">
        {/* Cover Image */}
        {article.coverImage && (
          <div className="w-full aspect-[16/9] overflow-hidden">
            <img
              src={article.coverImage}
              alt={article.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Article Body */}
        <div className="px-5 pt-6">
          {/* Title */}
          <h1 className="text-[28px] sm:text-[36px] font-bold text-[#e7e9ea] leading-tight tracking-tight mb-5">
            {article.title}
          </h1>

          {/* Author Bar */}
          <div className="flex items-center gap-3 mb-6">
            <PAvatar
              src={(article.author as any)?.profileImage}
              name={article.author?.displayName ?? article.author?.username ?? 'A'}
              size={44}
              verified={article.author?.isVerified}
              badge={(article.author as any)?.badge}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[14px] font-semibold text-[#e7e9ea] truncate">
                  {article.author?.displayName ?? 'Anonymous'}
                </span>
                {(article.author?.isVerified || !!(article.author as any)?.badge) && <VerifiedBadge size={14} badge={(article.author as any)?.badge} />}
              </div>
              <div className="flex items-center gap-1.5 text-[13px] text-[#94a3b8]">
                <span>@{article.author?.username ?? 'anonymous'}</span>
                <span>·</span>
                <span>{formatDate(article.createdAt)}</span>
                <span>·</span>
                <span>{readTime}</span>
              </div>
            </div>
          </div>

          {/* Fact Check Badge */}
          {factCheck && (
            <div className="mb-6">
              <span
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] font-semibold',
                  factCheck.status === 'Verified'
                    ? 'bg-[#FFFFFF]/10 text-[#FFFFFF]'
                    : factCheck.status === 'Not Verified'
                    ? 'bg-red-500/10 text-red-400'
                    : 'bg-yellow-500/10 text-yellow-400'
                )}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <path d="M22 4L12 14.01l-3-3" />
                </svg>
                {factCheck.status}
              </span>
            </div>
          )}

          {/* Content */}
          <div className="prose-article">
            {renderContent(article.content)}
          </div>

          {/* Views */}
          <div className="mt-8 pt-4 border-t border-white/[0.06]">
            <span className="text-[13px] text-[#94a3b8]">
              {article.views + 1} view{article.views + 1 !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </article>

      {/* ─── Sticky Engagement Bar ─── */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-[#000000]/80 backdrop-blur-md border-t border-white/[0.06]">
        <div className="max-w-2xl mx-auto flex items-center justify-around px-4 py-2">
          {/* Like */}
          <button
            onClick={handleLike}
            className="flex flex-col items-center gap-0.5 py-1 px-4 rounded-xl hover:bg-white/[0.04] transition-colors group"
            aria-label="Like"
          >
            <svg
              className={cn(
                'w-[22px] h-[22px] transition-colors',
                liked ? 'text-red-500' : 'text-[#94a3b8] group-hover:text-red-400'
              )}
              viewBox="0 0 24 24"
              fill={liked ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
            <span className={cn('text-[12px] font-semibold', liked ? 'text-red-500' : 'text-[#94a3b8]')}>
              {likeCount}
            </span>
          </button>

          {/* Comment */}
          <button
            disabled
            onClick={handleComment}
            className="flex flex-col items-center gap-0.5 py-1 px-4 rounded-xl opacity-50 cursor-not-allowed"
            aria-label="Comment"
          >
            <svg className="w-[22px] h-[22px] text-[#94a3b8] group-hover:text-[#FFFFFF] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <span className="text-[12px] font-semibold text-[#94a3b8]">{commentCount}</span>
          </button>

          {/* Share */}
          <button
            onClick={handleShare}
            className="flex flex-col items-center gap-0.5 py-1 px-4 rounded-xl hover:bg-white/[0.04] transition-colors group"
            aria-label="Share"
          >
            <svg className="w-[22px] h-[22px] text-[#94a3b8] group-hover:text-[#FFFFFF] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </button>

          {/* Bookmark */}
          <button
            onClick={handleBookmark}
            className="flex flex-col items-center gap-0.5 py-1 px-4 rounded-xl hover:bg-white/[0.04] transition-colors group"
            aria-label="Bookmark"
          >
            <svg
              className={cn(
                'w-[22px] h-[22px] transition-colors',
                bookmarked ? 'text-[#FFFFFF]' : 'text-[#94a3b8] group-hover:text-[#FFFFFF]'
              )}
              viewBox="0 0 24 24"
              fill={bookmarked ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
