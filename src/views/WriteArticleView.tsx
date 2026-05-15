'use client'

import { useState, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app'
import { toast } from 'sonner'
import {
  saveArticle,
  generateArticleId,
  getWordCount,
  calculateReadTime,
  getArticle,
} from '@/lib/articles'
import type { Article } from '@/stores/app'

type FactCheckStatus = 'Pending Review' | 'Verified' | 'Not Verified'

export function WriteArticleView() {
  const navigate = useAppStore((s) => s.navigate)
  const user = useAppStore((s) => s.user)
  const previousView = useAppStore((s) => s.previousView)

  // Check if we're editing an existing article
  const viewParams = useAppStore((s) => s.viewParams)
  const editingId = viewParams?.articleId ?? null

  // Load existing article if editing
  const existingArticle = editingId ? getArticle(editingId) : null

  const [title, setTitle] = useState(existingArticle?.title ?? '')
  const [content, setContent] = useState(existingArticle?.content ?? '')
  const [coverImage, setCoverImage] = useState(existingArticle?.coverImage ?? '')
  const [factCheckEnabled, setFactCheckEnabled] = useState(!!existingArticle?.factCheck)
  const [factCheckUrl, setFactCheckUrl] = useState(existingArticle?.factCheck ?? '')
  const [factCheckStatus, setFactCheckStatus] = useState<FactCheckStatus>('Pending Review')
  const [publishing, setPublishing] = useState(false)
  const [saving, setSaving] = useState(false)

  // ── Computed stats ──
  const wordCount = useMemo(() => getWordCount(content), [content])
  const charCount = useMemo(() => content.length, [content])
  const readTime = useMemo(() => calculateReadTime(content), [content])

  // ── Handlers ──
  const handleCoverClick = useCallback(() => {
    // Image upload
  }, [])

  const buildArticle = useCallback(
    (isPublished: boolean): Article => ({
      id: existingArticle?.id ?? generateArticleId(),
      authorId: user?.id ?? 'anonymous',
      title: title.trim(),
      content: content.trim(),
      coverImage,
      factCheck: factCheckEnabled ? `${factCheckStatus}:${factCheckUrl}` : '',
      isPublished,
      views: existingArticle?.views ?? 0,
      createdAt: existingArticle?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: user ?? undefined,
    }),
    [title, content, coverImage, factCheckEnabled, factCheckUrl, factCheckStatus, existingArticle, user]
  )

  const handleSaveDraft = useCallback(() => {
    if (!title.trim() && !content.trim()) {
      toast.error('Please write a title or some content before saving')
      return
    }
    setSaving(true)
    try {
      const article = buildArticle(false)
      saveArticle(article)
      toast.success('Draft saved')
    } catch {
      toast.error('Failed to save draft')
    } finally {
      setSaving(false)
    }
  }, [buildArticle, title, content])

  const handlePublish = useCallback(() => {
    if (!title.trim()) {
      toast.error('Please add a title to your article')
      return
    }
    if (!content.trim()) {
      toast.error('Please write some content before publishing')
      return
    }
    setPublishing(true)
    try {
      const article = buildArticle(true)
      saveArticle(article)
      toast.success('Article published!')
      navigate('article', { articleId: article.id })
    } catch {
      toast.error('Failed to publish article')
    } finally {
      setPublishing(false)
    }
  }, [buildArticle, title, content, navigate])

  const handleBack = useCallback(() => {
    navigate(previousView === 'write-article' || previousView === 'article' ? 'feed' : previousView)
  }, [navigate, previousView])

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
            <h1 className="text-[17px] font-bold text-[#e7e9ea]">
              {existingArticle ? 'Edit Article' : 'Write Article'}
            </h1>
          </div>

          <button
            onClick={handlePublish}
            disabled={publishing}
            className={cn(
              'px-5 py-2 rounded-full text-[14px] font-bold transition-all duration-200',
              publishing
                ? 'bg-[#FFFFFF]/40 text-black/60 cursor-not-allowed'
                : 'bg-[#FFFFFF] text-black hover:bg-[#D1D5DB] active:scale-95'
            )}
          >
            {publishing ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </header>

      {/* ─── Content ─── */}
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-32">
        {/* Cover Image */}
        <button
          disabled
          onClick={handleCoverClick}
          className="w-full relative group mb-6 rounded-2xl overflow-hidden border border-dashed border-white/[0.12] opacity-50 cursor-not-allowed"
          style={{ aspectRatio: '16/9' }}
        >
          {coverImage ? (
            <img
              src={coverImage}
              alt="Cover"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#000000]">
              <div className="w-12 h-12 rounded-full bg-white/[0.06] flex items-center justify-center group-hover:bg-[#FFFFFF]/10 transition-colors">
                <svg className="w-6 h-6 text-[#94a3b8] group-hover:text-[#FFFFFF] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
              <span className="text-[14px] text-[#94a3b8] group-hover:text-[#FFFFFF] transition-colors">
                Add Cover Image
              </span>
            </div>
          )}
        </button>

        {/* Title Input */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Article Title..."
          className="w-full bg-transparent text-[28px] sm:text-[36px] font-bold text-[#e7e9ea] placeholder-[#64748b] outline-none leading-tight mb-6 tracking-tight"
        />

        {/* Content Textarea */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your article content here..."
          className="w-full min-h-[300px] bg-transparent text-[17px] leading-relaxed text-[#c8d0bc] placeholder-[#64748b] outline-none resize-none"
        />

        {/* ─── Toolbar (word/char/readtime) ─── */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/[0.06]">
          <span className="text-[13px] text-[#94a3b8]">
            <span className="text-[#FFFFFF] font-semibold">{wordCount}</span> words
          </span>
          <span className="text-[13px] text-[#94a3b8]">
            <span className="text-[#FFFFFF] font-semibold">{charCount}</span> characters
          </span>
          <span className="text-[13px] text-[#94a3b8]">
            <span className="text-[#FFFFFF] font-semibold">{readTime}</span>
          </span>
        </div>

        {/* ─── Fact Check Section (collapsible) ─── */}
        <div className="mt-8 bg-[#000000] rounded-2xl border border-white/[0.06] overflow-hidden">
          <button
            onClick={() => setFactCheckEnabled((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-[#FFFFFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <path d="M22 4L12 14.01l-3-3" />
              </svg>
              <span className="text-[15px] font-semibold text-[#e7e9ea]">Fact Check</span>
            </div>
            {/* Toggle switch */}
            <div
              className={cn(
                'w-11 h-6 rounded-full transition-colors relative flex-shrink-0',
                factCheckEnabled ? 'bg-[#FFFFFF]' : 'bg-white/[0.15]'
              )}
            >
              <div
                className={cn(
                  'w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform shadow-sm',
                  factCheckEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                )}
              />
            </div>
          </button>

          {factCheckEnabled && (
            <div className="px-5 pb-5 space-y-4 animate-fade-in">
              {/* Status Dropdown */}
              <div className="space-y-1.5">
                <label className="text-[13px] text-[#94a3b8]">Status</label>
                <div className="relative">
                  <select
                    value={factCheckStatus}
                    onChange={(e) => setFactCheckStatus(e.target.value as FactCheckStatus)}
                    className="w-full appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-[14px] text-[#e7e9ea] outline-none focus:border-[#FFFFFF]/50 transition-colors cursor-pointer"
                  >
                    <option value="Pending Review" className="bg-[#000000] text-[#e7e9ea]">Pending Review</option>
                    <option value="Verified" className="bg-[#000000] text-[#e7e9ea]">Verified</option>
                    <option value="Not Verified" className="bg-[#000000] text-[#e7e9ea]">Not Verified</option>
                  </select>
                  <svg className="w-4 h-4 text-[#94a3b8] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>

              {/* Source URL */}
              <div className="space-y-1.5">
                <label className="text-[13px] text-[#94a3b8]">Source URL</label>
                <input
                  type="url"
                  value={factCheckUrl}
                  onChange={(e) => setFactCheckUrl(e.target.value)}
                  placeholder="https://example.com/source"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-[14px] text-[#e7e9ea] placeholder-[#64748b] outline-none focus:border-[#FFFFFF]/50 transition-colors"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Sticky Bottom Actions ─── */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-[#000000]/80 backdrop-blur-md border-t border-white/[0.06]">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <button
            onClick={handleSaveDraft}
            disabled={saving}
            className={cn(
              'flex-1 py-2.5 rounded-full text-[14px] font-bold border transition-all duration-200',
              saving
                ? 'border-white/[0.06] text-[#64748b] cursor-not-allowed'
                : 'border-[#FFFFFF]/40 text-[#FFFFFF] hover:bg-[#FFFFFF]/10 active:scale-[0.98]'
            )}
          >
            {saving ? 'Saving...' : 'Save as Draft'}
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing}
            className={cn(
              'flex-1 py-2.5 rounded-full text-[14px] font-bold transition-all duration-200',
              publishing
                ? 'bg-[#FFFFFF]/40 text-black/60 cursor-not-allowed'
                : 'bg-[#FFFFFF] text-black hover:bg-[#D1D5DB] active:scale-[0.98]'
            )}
          >
            {publishing ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  )
}
